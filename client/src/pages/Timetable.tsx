import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiDel } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  BookOpen,
  Printer,
  RefreshCw,
  Save,
  School,
  Trash2,
  X,
} from "lucide-react";

// 🗓️ Timetable (v1.7) — saada, haath se bana class timetable.
// NICHOD ka faisla: auto-scheduler NAHI — Indian chhote school ka
// timetable fixed hota hai, office use haath se ek baar bhar deta hai
// aur saal bhar wahi chalta hai.
//  - Grid: din (Mon–Sat) × period 1–8. Cell par tap → chhota form
//    (subject text + teacher staff-list se) → POST /api/timetable
//    upsert (class+day+period par ek hi entry; dobara save = update).
//  - Badalna sirf principal/teacher (server bhi wahi deta hai);
//    accountant/staff sirf dekhte hain.
//  - Parent: server uske APNE bacche ki class ka hafta khud deta hai
//    (bina className ke call) — class chunne ka option hi nahi; dusri
//    class ka timetable parent ko kabhi nahi jata (server par jaanch).
//  - Super Admin: no-school card, koi API call nahi.

const CLASSES = [
  "Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "10", "11", "12",
] as const;

const DAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
] as const;

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

interface TimetableEntryApi {
  id: number;
  className: string;
  dayOfWeek: number;
  periodNo: number;
  subject: string;
  teacherId: number | null;
  teacherName: string | null;
}

interface StaffApi {
  id: number;
  name: string;
  designation?: string;
}

interface CellTarget {
  dayOfWeek: number;
  periodNo: number;
  entry: TimetableEntryApi | null;
}

export default function Timetable() {
  const { toast } = useToast();
  const { user, school } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const isParent = user?.role === "parent";
  const canEdit = user?.role === "principal" || user?.role === "teacher";

  const [className, setClassName] = useState<string>("1");
  const [entries, setEntries] = useState<TimetableEntryApi[]>([]);
  const [staffList, setStaffList] = useState<StaffApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [parentClass, setParentClass] = useState<string>("");

  const [cell, setCell] = useState<CellTarget | null>(null);
  const [subject, setSubject] = useState("");
  const [teacherId, setTeacherId] = useState<string>("none");
  const [saving, setSaving] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const entryAt = (day: number, period: number) =>
    entries.find((e) => e.dayOfWeek === day && e.periodNo === period) ??
    null;

  const loadEntries = async () => {
    if (isSuperAdmin) return;
    setLoading(true);
    try {
      // Parent: className bhejte hi nahi — server bacche ki class
      // khud lagata hai (aur jawab ki pehli row se wahi class yahan
      // padh lete hain, taaki heading me asal class dikhe).
      const url = isParent
        ? "/api/timetable"
        : `/api/timetable?className=${encodeURIComponent(className)}`;
      const rows = await apiGet<TimetableEntryApi[]>(url);
      const list = rows || [];
      setEntries(list);
      if (isParent && list.length > 0) setParentClass(list[0].className);
      setLoadedOnce(true);
    } catch (e) {
      toast({
        title: "Timetable nahi aaya",
        description: "Dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className, isParent]);

  // Teacher select ke liye staff list — sirf edit karne walon ko
  // chahiye (parent/staff-readonly ko GET /api/staff ki zaroorat
  // nahi; naam server teacherName me bhejta hi hai).
  useEffect(() => {
    if (!canEdit) return;
    (async () => {
      try {
        const rows = await apiGet<StaffApi[]>("/api/staff");
        setStaffList(rows || []);
      } catch (e) {
        // Staff list na aaye to bhi subject save ho sakta hai —
        // teacher select khaali rahega, page nahi rukega.
        setStaffList([]);
      }
    })();
  }, [canEdit]);

  const openCell = (dayOfWeek: number, periodNo: number) => {
    if (!canEdit) return;
    const entry = entryAt(dayOfWeek, periodNo);
    setCell({ dayOfWeek, periodNo, entry });
    setSubject(entry?.subject ?? "");
    setTeacherId(entry?.teacherId != null ? String(entry.teacherId) : "none");
  };

  const saveCell = async () => {
    if (!cell) return;
    if (!subject.trim()) {
      toast({
        title: "Subject likhein",
        description: "Khaali period rakhna ho to entry delete karein.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/timetable", {
        className,
        dayOfWeek: cell.dayOfWeek,
        periodNo: cell.periodNo,
        subject: subject.trim(),
        teacherId: teacherId === "none" ? null : parseInt(teacherId, 10),
      });
      toast({ title: "Save ho gaya", description: "Timetable entry update ho gayi." });
      setCell(null);
      void loadEntries();
    } catch (e) {
      toast({
        title: "Save nahi hua",
        description: "Dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteCell = async () => {
    if (!cell?.entry) return;
    setSaving(true);
    try {
      await apiDel(`/api/timetable/${cell.entry.id}`);
      toast({ title: "Entry hat gayi", description: "Period khaali ho gaya." });
      setCell(null);
      void loadEntries();
    } catch (e) {
      toast({
        title: "Delete nahi hua",
        description: "Dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Print: ReportCards/Broadsheet wala hi tareeka — nayi window me
  // sirf grid.
  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Timetable - Class ${isParent ? parentClass : className}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 12px; }
            h1 { font-size: 18px; text-align: center; margin: 0 0 2px; }
            p.sub { text-align: center; font-size: 12px; color: #555; margin: 0 0 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #333; padding: 6px; text-align: center; }
            th { background: #1e40af; color: #fff; }
            td.subj { font-weight: 600; }
            span.t { display: block; font-size: 10px; color: #555; font-weight: normal; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (isSuperAdmin) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="border-t-4 border-t-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" /> No School Linked to This Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              You are signed in as Super Admin. This account is not linked
              to any school, so there is no timetable to show here. Each
              school maintains its own timetable from the Principal /
              Teacher accounts.
            </p>
            <Link href="/schools">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <School className="h-4 w-4 mr-2" /> Go to Schools
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const headingClass = isParent ? parentClass || "—" : className;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-slate-800">
            <BookOpen className="h-7 w-7 text-blue-600" /> Timetable
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isParent
              ? "Apne bacche ki class ka hafta-bhar ka timetable."
              : canEdit
                ? "Kisi cell par tap karke subject / teacher bharein."
                : "Class ka hafta-bhar ka timetable (sirf dekhne ke liye)."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => void loadEntries()}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button
            onClick={handlePrint}
            disabled={!loadedOnce}
            className="bg-blue-600 hover:bg-blue-700 min-h-[44px]"
          >
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        </div>
      </div>

      {!isParent && (
        <Card>
          <CardContent className="pt-6">
            <div className="max-w-xs space-y-1 min-w-0">
              <Label>Class</Label>
              <Select value={className} onValueChange={setClassName}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Class chunein" />
                </SelectTrigger>
                <SelectContent>
                  {CLASSES.map((c) => (
                    <SelectItem key={c} value={c}>
                      Class {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-gray-500 text-sm py-8 text-center">
              Timetable aa raha hai…
            </p>
          ) : (
            <div className="overflow-x-auto" ref={printRef}>
              <h2 className="text-center font-bold text-lg pt-4 px-4">
                {school?.name || "School Guardian Suite"}
              </h2>
              <p className="text-center text-sm text-gray-500 pb-3 px-4">
                Timetable — Class {headingClass}
              </p>
              <table className="w-full text-sm border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border px-2 py-2 text-left">Day</th>
                    {PERIODS.map((p) => (
                      <th key={p} className="border px-2 py-2">
                        Period {p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day) => (
                    <tr key={day.value}>
                      <td className="border px-2 py-2 font-semibold whitespace-nowrap">
                        {day.label}
                      </td>
                      {PERIODS.map((period) => {
                        const entry = entryAt(day.value, period);
                        return (
                          <td
                            key={period}
                            onClick={() => openCell(day.value, period)}
                            className={`border px-2 py-2 text-center align-top min-w-[92px] ${
                              canEdit
                                ? "cursor-pointer hover:bg-blue-50"
                                : ""
                            }`}
                          >
                            {entry ? (
                              <>
                                <span className="block font-semibold text-slate-800">
                                  {entry.subject}
                                </span>
                                {entry.teacherName && (
                                  <span className="block text-[11px] text-gray-500">
                                    {entry.teacherName}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-300">
                                {canEdit ? "+ " : "—"}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {loadedOnce && entries.length === 0 && (
                <p className="text-gray-500 text-sm py-4 text-center">
                  {isParent
                    ? "Is class ka timetable abhi school ne nahi bhara hai."
                    : "Is class ka timetable abhi khaali hai — cell par tap karke bharein."}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cell edit dialog */}
      <Dialog open={cell != null} onOpenChange={(open) => !open && setCell(null)}>
        <DialogContent className="max-w-md bg-white z-[9999]">
          <DialogHeader>
            <DialogTitle>
              {cell
                ? `${DAYS.find((d) => d.value === cell.dayOfWeek)?.label} — Period ${cell.periodNo} (Class ${className})`
                : "Period"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Subject *</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Mathematics"
              />
            </div>
            <div className="space-y-1">
              <Label>Teacher</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Teacher chunein" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[9999] shadow-lg border">
                  <SelectItem value="none">— Koi nahi —</SelectItem>
                  {staffList.map((member) => (
                    <SelectItem key={member.id} value={String(member.id)}>
                      {member.name}
                      {member.designation ? ` (${member.designation})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex flex-wrap gap-2">
            {cell?.entry && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void deleteCell()}
                disabled={saving}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Entry Hatao
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setCell(null)}
              disabled={saving}
            >
              <X className="h-4 w-4 mr-2" /> Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveCell()}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Save ho raha hai…" : "Save Karein"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
