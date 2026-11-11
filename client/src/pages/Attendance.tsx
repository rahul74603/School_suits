import { useEffect, useMemo, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  CalendarCheck,
  School,
  Users,
  Save,
  RefreshCw,
  CheckCheck,
  ClipboardList,
  Phone,
} from "lucide-react";

// 📅 Attendance (v1.5) — roz ki hajri.
// Design (Gibbon/RosarioSIS se seekha, apna code):
//  - Hajri class-wise EK bulk save me lagti hai (POST /api/attendance).
//  - Default har student "present" — teacher sirf exceptions (absent/
//    late/half-day) badalta hai, isliye roz ka kaam minuteon me hota hai.
//  - Dobara save karne par usi din ki hajri update hoti hai (server
//    upsert), dohra record nahi banta.
//  - Mark sirf principal/teacher kar sakte hain; accountant/staff
//    sirf dekh sakte hain; parent apne bacche ka summary Student
//    Profile me dekhta hai (is page par use wahi raasta dikhta hai).
//  - Super Admin ka koi school nahi — Dashboard wala no-school card,
//    koi API call nahi (server uske liye 403 deta hai).

const CLASSES = [
  "Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "10", "11", "12",
] as const;

const SECTIONS = ["A", "B", "C", "D", "E"] as const;

type AttendanceStatus = "present" | "absent" | "late" | "half_day";

const STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  activeClass: string;
}> = [
  { value: "present", label: "Present", activeClass: "bg-green-600 text-white border-green-600" },
  { value: "absent", label: "Absent", activeClass: "bg-red-600 text-white border-red-600" },
  { value: "late", label: "Late", activeClass: "bg-amber-500 text-white border-amber-500" },
  { value: "half_day", label: "Half Day", activeClass: "bg-violet-600 text-white border-violet-600" },
];

interface RosterRow {
  studentId: number;
  name: string;
  rollNo: string | null;
  class: string;
  section: string;
  status: string | null;
}

interface MonthSummary {
  month: string;
  totalMarked: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  percentage: number;
}

// Office reports (v1.7) — server ke jawab ke shape (storage.ts ke
// AttendanceMissingReport / AbsentStreakEntry se mel).
interface MissingGroup {
  class: string;
  section: string;
  studentCount: number;
  markedCount: number;
  status: "marked" | "partial" | "missing";
}

interface MissingReport {
  date: string;
  totalGroups: number;
  markedGroups: number;
  partialGroups: number;
  missingGroups: number;
  totalStudents: number;
  markedStudents: number;
  groups: MissingGroup[];
}

interface StreakEntry {
  studentId: number;
  name: string;
  class: string;
  section: string;
  admissionNo: string;
  contact: string;
  consecutiveAbsent: number;
  lastAbsentDate: string;
  lastPresentDate: string | null;
  streakDates: string[];
}

function todayText(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

function currentMonthText(): string {
  return todayText().slice(0, 7);
}

export default function Attendance() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const isParent = user?.role === "parent";
  const canMark = user?.role === "principal" || user?.role === "teacher";
  // 📋 Office reports (v1.7): server par bhi yahi teen roles hain
  // (GET /api/attendance/reports/*). Staff ko reports nahi dikhtin —
  // wo sirf hajri dekh sakta hai, pehle ki tarah.
  const canViewReports =
    user?.role === "principal" ||
    user?.role === "teacher" ||
    user?.role === "accountant";

  const [className, setClassName] = useState<string>("1");
  const [section, setSection] = useState<string>("ALL");
  const [date, setDate] = useState<string>(todayText());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>({});
  const [loadedOnce, setLoadedOnce] = useState(false);

  // Mahina-summary panel
  const [summaryStudentId, setSummaryStudentId] = useState<string>("");
  const [summaryMonth, setSummaryMonth] = useState<string>(currentMonthText());
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Office reports (v1.7) — missing wali date roster wali date se
  // ALAG rakhi hai taaki report dekhne se upar ki hajri screen na badle.
  const [reportDate, setReportDate] = useState<string>(todayText());
  const [missingReport, setMissingReport] = useState<MissingReport | null>(null);
  const [missingLoading, setMissingLoading] = useState(false);
  const [streakDays, setStreakDays] = useState<string>("3");
  const [streakEntries, setStreakEntries] = useState<StreakEntry[] | null>(null);
  const [streakLoading, setStreakLoading] = useState(false);

  const loadRoster = async () => {
    if (isSuperAdmin || isParent) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("class", className);
      if (section !== "ALL") params.set("section", section);
      params.set("date", date);
      const rows = await apiGet<RosterRow[]>(`/api/attendance?${params.toString()}`);
      const list = rows || [];
      setRoster(list);
      const next: Record<number, AttendanceStatus> = {};
      for (const row of list) {
        next[row.studentId] = (row.status as AttendanceStatus) || "present";
      }
      setStatuses(next);
      setLoadedOnce(true);
    } catch (e) {
      toast({
        title: "Failed to load attendance",
        description: "Student list nahi aayi — dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className, section, date]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, half_day: 0 };
    for (const row of roster) {
      const s = statuses[row.studentId];
      if (s) c[s] += 1;
    }
    return c;
  }, [roster, statuses]);

  const markAllPresent = () => {
    const next: Record<number, AttendanceStatus> = {};
    for (const row of roster) next[row.studentId] = "present";
    setStatuses(next);
  };

  const saveAttendance = async () => {
    if (!canMark || roster.length === 0) return;
    setSaving(true);
    try {
      await apiPost("/api/attendance", {
        date,
        entries: roster.map((row) => ({
          studentId: row.studentId,
          status: statuses[row.studentId] || "present",
        })),
      });
      toast({
        title: "Attendance saved",
        description: `${date} — Class ${className}${section !== "ALL" ? `-${section}` : ""}: ${counts.present} present, ${counts.absent} absent, ${counts.late} late, ${counts.half_day} half day.`,
      });
      void loadRoster();
    } catch (e) {
      toast({
        title: "Save failed",
        description: "Hajri save nahi hui — dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const loadSummary = async () => {
    if (!summaryStudentId) return;
    setSummaryLoading(true);
    try {
      const data = await apiGet<MonthSummary>(
        `/api/students/${summaryStudentId}/attendance/summary?month=${summaryMonth}`,
      );
      setSummary(data);
    } catch (e) {
      setSummary(null);
      toast({
        title: "Summary nahi mila",
        description: "Is student ka attendance summary load nahi hua.",
        variant: "destructive",
      });
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadMissingReport = async () => {
    setMissingLoading(true);
    try {
      const data = await apiGet<MissingReport>(
        `/api/attendance/reports/missing?date=${reportDate}`,
      );
      setMissingReport(data);
    } catch (e) {
      setMissingReport(null);
      toast({
        title: "Report nahi aayi",
        description: "Missing-classes report load nahi hui — dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setMissingLoading(false);
    }
  };

  const loadStreakReport = async () => {
    const days = parseInt(streakDays, 10);
    if (!Number.isFinite(days) || days < 1 || days > 30) {
      toast({
        title: "Din ki ginti galat hai",
        description: "Lagatar absent ke din 1 se 30 ke beech rakhein.",
        variant: "destructive",
      });
      return;
    }
    setStreakLoading(true);
    try {
      const data = await apiGet<{ days: number; count: number; entries: StreakEntry[] }>(
        `/api/attendance/reports/absent-streak?days=${days}`,
      );
      setStreakEntries(data?.entries || []);
    } catch (e) {
      setStreakEntries(null);
      toast({
        title: "Report nahi aayi",
        description: "Lagatar-absent list load nahi hui — dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setStreakLoading(false);
    }
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
              to any school, so there is no attendance to mark here. Each
              school&apos;s teachers mark attendance from their own
              accounts.
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

  if (isParent) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="border-t-4 border-t-green-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5" /> Bacche ki Attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Apne bacche ki is mahine ki hajri ka hisaab (present, absent,
              late, half day aur percentage) uske Student Profile me
              dikhta hai.
            </p>
            <Link href="/student-profile">
              <Button className="bg-green-600 hover:bg-green-700">
                <Users className="h-4 w-4 mr-2" /> Student Profile Kholein
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Card className="border-t-4 border-t-blue-600">
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarCheck className="h-5 w-5" /> Daily Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 min-w-0 gap-3 sm:grid-cols-3">
            <div className="space-y-1 min-w-0">
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
            <div className="space-y-1 min-w-0">
              <Label>Section</Label>
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Sections</SelectItem>
                  {SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      Section {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-0">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {!canMark && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Aap sirf hajri dekh sakte hain — mark karna Principal ya
              Teacher ka kaam hai.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-green-100 text-green-800 px-3 py-1 font-medium">
              Present: {counts.present}
            </span>
            <span className="rounded-full bg-red-100 text-red-800 px-3 py-1 font-medium">
              Absent: {counts.absent}
            </span>
            <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 font-medium">
              Late: {counts.late}
            </span>
            <span className="rounded-full bg-violet-100 text-violet-800 px-3 py-1 font-medium">
              Half Day: {counts.half_day}
            </span>
            <span className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 font-medium">
              Kul: {roster.length}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {canMark && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={markAllPresent}
                  disabled={loading || roster.length === 0}
                >
                  <CheckCheck className="h-4 w-4 mr-2" /> Sab Present
                </Button>
                <Button
                  type="button"
                  className="min-h-[44px] bg-blue-600 hover:bg-blue-700"
                  onClick={saveAttendance}
                  disabled={saving || loading || roster.length === 0}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Save ho raha hai…" : "Attendance Save Karein"}
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => void loadRoster()}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <p className="text-gray-500 text-sm py-6 text-center">
              Student list aa rahi hai…
            </p>
          ) : roster.length === 0 ? (
            <p className="text-gray-500 text-sm py-6 text-center">
              {loadedOnce
                ? "Is class/section me koi active student nahi hai."
                : "Class aur date chunein — students ki list yahan ayegi."}
            </p>
          ) : (
            <div className="space-y-2">
              {roster.map((row) => {
                const current = statuses[row.studentId] || "present";
                return (
                  <div
                    key={row.studentId}
                    className="rounded-lg border bg-white p-3 space-y-2"
                  >
                    <div className="flex items-baseline justify-between gap-2 min-w-0">
                      <span className="font-semibold text-sm text-gray-800 truncate">
                        {row.name}
                      </span>
                      <span className="text-xs text-gray-500 shrink-0">
                        {row.class}-{row.section}
                        {row.rollNo ? ` • Roll ${row.rollNo}` : ""}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {STATUS_OPTIONS.map((opt) => {
                        const active = current === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={!canMark}
                            onClick={() =>
                              setStatuses((prev) => ({
                                ...prev,
                                [row.studentId]: opt.value,
                              }))
                            }
                            className={`min-h-[44px] rounded-md border px-1 text-xs font-semibold transition-colors ${
                              active
                                ? opt.activeClass
                                : "bg-white text-gray-600 border-gray-300"
                            } ${!canMark ? "opacity-70" : ""}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {canViewReports && (
        <Card className="border-t-4 border-t-rose-600">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-base text-rose-800">
              <ClipboardList className="h-5 w-5" /> Office Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* (a) Kis class ki hajri NAHI lagi */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-gray-800">
                Kis class ki hajri NAHI lagi?
              </h3>
              <div className="grid grid-cols-1 min-w-0 gap-3 sm:grid-cols-3">
                <div className="space-y-1 min-w-0">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px] w-full sm:w-auto"
                    onClick={() => void loadMissingReport()}
                    disabled={missingLoading}
                  >
                    {missingLoading ? "Aa raha hai…" : "Report Dekhein"}
                  </Button>
                </div>
              </div>

              {missingReport && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-red-100 text-red-800 px-3 py-1 font-medium">
                      Hajri nahi lagi: {missingReport.missingGroups}
                    </span>
                    <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 font-medium">
                      Aadhi lagi: {missingReport.partialGroups}
                    </span>
                    <span className="rounded-full bg-green-100 text-green-800 px-3 py-1 font-medium">
                      Poori lagi: {missingReport.markedGroups}
                    </span>
                    <span className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 font-medium">
                      Students mark: {missingReport.markedStudents}/
                      {missingReport.totalStudents}
                    </span>
                  </div>
                  {missingReport.groups.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      School me koi active student nahi hai.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {missingReport.groups.map((g) => (
                        <div
                          key={`${g.class}-${g.section}`}
                          className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
                            g.status === "missing"
                              ? "border-red-200 bg-red-50"
                              : g.status === "partial"
                                ? "border-amber-200 bg-amber-50"
                                : "border-green-200 bg-green-50"
                          }`}
                        >
                          <span className="font-semibold text-gray-800 min-w-0">
                            Class {g.class} - {g.section}
                          </span>
                          <span className="text-xs font-medium shrink-0">
                            {g.status === "missing" ? (
                              <span className="text-red-700">
                                ❌ Hajri NAHI lagi (0/{g.studentCount})
                              </span>
                            ) : g.status === "partial" ? (
                              <span className="text-amber-700">
                                ⚠️ Aadhi lagi ({g.markedCount}/{g.studentCount})
                              </span>
                            ) : (
                              <span className="text-green-700">
                                ✅ Poori lagi ({g.markedCount}/{g.studentCount})
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t" />

            {/* (b) Lagatar absent — parent ko phone karne ki list */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-gray-800">
                Lagatar absent bacche (phone karne ki list)
              </h3>
              <p className="text-xs text-gray-500">
                Wo students jo apni class ki aakhri hajri-dates par
                lagatar absent hain. Jis class me itne din hajri lagi hi
                nahi, wo is list me nahi aati.
              </p>
              <div className="grid grid-cols-1 min-w-0 gap-3 sm:grid-cols-3">
                <div className="space-y-1 min-w-0">
                  <Label>Lagatar kitne din absent?</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={streakDays}
                    onChange={(e) => setStreakDays(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px] w-full sm:w-auto"
                    onClick={() => void loadStreakReport()}
                    disabled={streakLoading}
                  >
                    {streakLoading ? "Aa raha hai…" : "List Dekhein"}
                  </Button>
                </div>
              </div>

              {streakEntries !== null &&
                (streakEntries.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Koi student itne din lagatar absent nahi hai — ya
                    classes me abhi itne din ki hajri lagi hi nahi hai.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {streakEntries.map((entry) => (
                      <div
                        key={entry.studentId}
                        className="rounded-md border border-red-200 bg-white px-3 py-2 space-y-1"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2 min-w-0">
                          <span className="font-semibold text-sm text-gray-800 min-w-0 truncate">
                            {entry.name}
                            <span className="font-normal text-gray-500">
                              {" "}
                              • {entry.class}-{entry.section} • Adm{" "}
                              {entry.admissionNo}
                            </span>
                          </span>
                          <span className="rounded-full bg-red-100 text-red-800 px-2.5 py-0.5 text-xs font-bold shrink-0">
                            {entry.consecutiveAbsent} din lagatar absent
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                          <span>
                            Aakhri baar aaya:{" "}
                            {entry.lastPresentDate
                              ? entry.lastPresentDate
                              : "record me kabhi present nahi"}
                          </span>
                          {entry.contact ? (
                            <a
                              href={`tel:${entry.contact.replace(/[^+\d]/g, "")}`}
                              className="inline-flex items-center gap-1 font-semibold text-blue-700 min-h-[32px]"
                            >
                              <Phone className="h-3.5 w-3.5" /> {entry.contact}
                            </a>
                          ) : (
                            <span className="text-gray-400">
                              Contact number nahi hai
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-t-4 border-t-violet-600">
        <CardHeader className="py-3">
          <CardTitle className="text-base text-violet-800">
            Ek Student ka Mahina-Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 min-w-0 gap-3 sm:grid-cols-3">
            <div className="space-y-1 min-w-0">
              <Label>Student</Label>
              <Select
                value={summaryStudentId}
                onValueChange={setSummaryStudentId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Student chunein" />
                </SelectTrigger>
                <SelectContent>
                  {roster.map((row) => (
                    <SelectItem
                      key={row.studentId}
                      value={String(row.studentId)}
                    >
                      {row.name} ({row.class}-{row.section})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-0">
              <Label>Mahina</Label>
              <Input
                type="month"
                value={summaryMonth}
                onChange={(e) => setSummaryMonth(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] w-full sm:w-auto"
                onClick={() => void loadSummary()}
                disabled={summaryLoading || !summaryStudentId}
              >
                {summaryLoading ? "Aa raha hai…" : "Summary Dekhein"}
              </Button>
            </div>
          </div>

          {summary && (
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-green-100 text-green-800 px-3 py-1 font-medium">
                Present: {summary.present}
              </span>
              <span className="rounded-full bg-red-100 text-red-800 px-3 py-1 font-medium">
                Absent: {summary.absent}
              </span>
              <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 font-medium">
                Late: {summary.late}
              </span>
              <span className="rounded-full bg-violet-100 text-violet-800 px-3 py-1 font-medium">
                Half Day: {summary.halfDay}
              </span>
              <span className="rounded-full bg-blue-100 text-blue-800 px-3 py-1 font-semibold">
                {summary.totalMarked > 0
                  ? `Attendance: ${summary.percentage}% (${summary.totalMarked} din)`
                  : "Is mahine hajri lagi hi nahi"}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
