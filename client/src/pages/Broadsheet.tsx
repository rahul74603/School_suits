import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { FileText, Printer, RefreshCw, School } from "lucide-react";

// 📊 Broadsheet / Tabulation Sheet (v1.7) — lav_sms se seekha design,
// apna code. Poori class ka subject-wise marks matrix ek print sheet
// par: result wale din office ka sabse bada kagaz haath se banta tha.
//
// Data-model ka sach: REST me ek exam = ek subject (exams table ki ek
// row ek subject ki hoti hai). "Ek term ka result" isliye exams ko
// (class + examName) se group karke banta hai — examName hi term ka
// naam hai ("Unit Test 1", "Half Yearly"...); schema me iske alawa
// koi grouping/term field hai hi nahi (session sirf saal batata hai,
// group key me wo bhi joda hai taaki do saal ke ek-naam wale exam
// ghul na jayein). Har group ke exams = columns (subjects), class ke
// students = rows, marks maujooda GET /api/exams/:id/marks se aate hain.
//
// Approval samman (v1.7): ye OFFICE screen hai — parent ke liye page
// hi band hai (uska rasta Report Cards hai). Office roles ko draft
// exams bhi dikhte hain, par group me draft ho to chetaavni dikhti
// hai ki parent ko ye result abhi nahi dikh raha.

export interface BroadsheetStudent {
  id: number;
  name: string;
  rollNo?: string | null;
  admissionNo?: string;
}

export interface BroadsheetExam {
  id: number;
  subject: string | null;
  maxMarks: number | null;
  resultsStatus?: string | null;
}

export interface BroadsheetMark {
  studentId: number;
  marksObtained: number | null;
}

export interface BroadsheetRow {
  studentId: number;
  name: string;
  rollNo: string | null;
  marksByExamId: Record<number, number | null>;
  total: number;
  maxTotal: number;
  percentage: number;
  rank: number;
}

// Shudh hisaab (koi API/state nahi) — isi function ko smoke test bhi
// asal bundle se chalata hai. Niyam:
//  - Cell khaali (marks nahi bhare / row hi nahi) = kul me 0, par
//    maxTotal me us subject ke maxMarks PURE judte hain (baccha us
//    subject me fail/absent jaisa hi gina jayega — office ka sach).
//  - Percentage = total / maxTotal * 100, 2 decimal tak round.
//  - Rank = competition ranking (1, 2, 2, 4): barabar kul par rank
//    ek, agla rank utne sthaan chhod kar. Kram: rank, fir naam.
export function buildBroadsheetRows(
  students: BroadsheetStudent[],
  exams: BroadsheetExam[],
  marksByExamId: Record<number, BroadsheetMark[]>,
): BroadsheetRow[] {
  const maxTotal = exams.reduce((sum, e) => sum + (e.maxMarks ?? 100), 0);
  const rows: BroadsheetRow[] = students.map((student) => {
    const marksByExamIdForStudent: Record<number, number | null> = {};
    let total = 0;
    for (const exam of exams) {
      const row = (marksByExamId[exam.id] || []).find(
        (m) => m.studentId === student.id,
      );
      const value = row ? row.marksObtained : null;
      marksByExamIdForStudent[exam.id] = value;
      total += value ?? 0;
    }
    const percentage =
      maxTotal > 0 ? Math.round((total / maxTotal) * 10000) / 100 : 0;
    return {
      studentId: student.id,
      name: student.name,
      rollNo: student.rollNo ?? null,
      marksByExamId: marksByExamIdForStudent,
      total,
      maxTotal,
      percentage,
      rank: 0,
    };
  });
  const sortedTotals = [...rows]
    .map((r) => r.total)
    .sort((a, b) => b - a);
  for (const row of rows) {
    row.rank = sortedTotals.indexOf(row.total) + 1;
  }
  rows.sort(
    (a, b) => a.rank - b.rank || a.name.localeCompare(b.name),
  );
  return rows;
}

interface ExamApiRow {
  id: number;
  examName: string;
  examType: string | null;
  class: string;
  section: string | null;
  subject: string | null;
  maxMarks: number | null;
  session: string | null;
  resultsStatus: string | null;
}

const CLASSES = [
  "Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "10", "11", "12",
] as const;

function groupKey(exam: ExamApiRow): string {
  return `${exam.class}||${exam.examName}||${exam.session ?? ""}`;
}

export default function Broadsheet() {
  const { toast } = useToast();
  const { user, school } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const isParent = user?.role === "parent";
  // Office roles hi asal screen dekhenge (server par marks GET bhi
  // inhi ko hai — v1.7 me accountant joda gaya hai).
  const canUse =
    user?.role === "principal" ||
    user?.role === "teacher" ||
    user?.role === "accountant";

  const [exams, setExams] = useState<ExamApiRow[]>([]);
  const [className, setClassName] = useState<string>("");
  const [group, setGroup] = useState<string>("");
  const [students, setStudents] = useState<BroadsheetStudent[]>([]);
  const [marksByExamId, setMarksByExamId] = useState<
    Record<number, BroadsheetMark[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSuperAdmin || !canUse) return;
    (async () => {
      try {
        const data = await apiGet<ExamApiRow[]>("/api/exams");
        setExams(data || []);
      } catch (e) {
        toast({
          title: "Exams nahi aaye",
          description: "Exam list load nahi hui — dobara koshish karein.",
          variant: "destructive",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, canUse]);

  const classOptions = useMemo(() => {
    const fromExams = Array.from(new Set(exams.map((e) => e.class)));
    return fromExams.length > 0 ? fromExams : [...CLASSES];
  }, [exams]);

  const groupOptions = useMemo(() => {
    if (!className) return [];
    const seen = new Map<string, ExamApiRow[]>();
    for (const exam of exams) {
      if (exam.class !== className) continue;
      const key = groupKey(exam);
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(exam);
    }
    return Array.from(seen.entries()).map(([key, list]) => ({
      key,
      label: `${list[0].examName}${list[0].session ? ` (${list[0].session})` : ""} — ${list.length} subject`,
      exams: list,
    }));
  }, [exams, className]);

  const selectedGroup = groupOptions.find((g) => g.key === group) ?? null;

  const loadSheet = async () => {
    if (!selectedGroup) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ class: className });
      const rawStudents = await apiGet<any[]>(
        `/api/students?${params.toString()}`,
      );
      setStudents(
        (rawStudents || []).map((st: any) => ({
          id: st.id,
          name: st.name,
          rollNo: st.rollNo ?? null,
          admissionNo: st.admissionNo,
        })),
      );
      const marks: Record<number, BroadsheetMark[]> = {};
      for (const exam of selectedGroup.exams) {
        const rows = await apiGet<BroadsheetMark[]>(
          `/api/exams/${exam.id}/marks`,
        );
        marks[exam.id] = rows || [];
      }
      setMarksByExamId(marks);
      setLoadedOnce(true);
    } catch (e) {
      toast({
        title: "Broadsheet nahi bani",
        description: "Students ya marks load nahi hue — dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGroup) void loadSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  const sheetRows = useMemo(() => {
    if (!selectedGroup) return [];
    return buildBroadsheetRows(
      students,
      selectedGroup.exams.map((e: ExamApiRow) => ({
        id: e.id,
        subject: e.subject,
        maxMarks: e.maxMarks,
        resultsStatus: e.resultsStatus,
      })),
      marksByExamId,
    );
  }, [selectedGroup, students, marksByExamId]);

  const hasDraft =
    selectedGroup?.exams.some(
      (e: ExamApiRow) => (e.resultsStatus ?? "approved") !== "approved",
    ) ?? false;

  // Print: ReportCards wala hi tareeka — nayi window me sirf sheet,
  // apni styles ke saath (screen ki baaki UI print nahi hoti).
  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Broadsheet - ${selectedGroup?.exams[0]?.examName ?? ""} - Class ${className}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 12px; }
            h1 { font-size: 18px; text-align: center; margin: 0 0 2px; }
            p.sub { text-align: center; font-size: 12px; color: #555; margin: 0 0 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #333; padding: 5px 6px; text-align: center; }
            th { background: #1e40af; color: #fff; }
            td.name { text-align: left; font-weight: 600; }
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
              to any school, so there is no broadsheet to prepare here.
              Each school&apos;s office prepares it from their own account.
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

  if (isParent || !canUse) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="border-t-4 border-t-green-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Broadsheet — Office Screen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Broadsheet poori class ki sheet hoti hai — ye sirf school
              office (Principal / Teacher / Accountant) ke liye hai.
              {isParent
                ? " Apne bacche ka result Report Cards me dikhta hai — school ke approve karte hi wahan aa jayega."
                : ""}
            </p>
            {isParent && (
              <Link href="/report-cards">
                <Button className="bg-green-600 hover:bg-green-700">
                  <FileText className="h-4 w-4 mr-2" /> Report Cards Kholein
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-slate-800">
            <FileText className="h-7 w-7 text-blue-600" /> Broadsheet
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Poori class ka subject-wise result ek sheet par — print ke liye taiyaar.
          </p>
        </div>
        <Button
          onClick={handlePrint}
          disabled={!loadedOnce || sheetRows.length === 0}
          className="bg-blue-600 hover:bg-blue-700 min-h-[44px]"
        >
          <Printer className="h-4 w-4 mr-2" /> Print Sheet
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 min-w-0 gap-3 sm:grid-cols-3">
            <div className="space-y-1 min-w-0">
              <Label>Class</Label>
              <Select
                value={className}
                onValueChange={(v) => {
                  setClassName(v);
                  setGroup("");
                  setLoadedOnce(false);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Class chunein" />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      Class {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-0 sm:col-span-2">
              <Label>Exam / Term (group)</Label>
              <Select
                value={group}
                onValueChange={setGroup}
                disabled={!className}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Exam group chunein" />
                </SelectTrigger>
                <SelectContent>
                  {groupOptions.map((g) => (
                    <SelectItem key={g.key} value={g.key}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {className && groupOptions.length === 0 && (
            <p className="text-sm text-gray-500 mt-3">
              Is class ke liye koi exam nahi bana hai — pehle Examinations
              page se exam banayein.
            </p>
          )}
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => void loadSheet()}
              disabled={loading || !selectedGroup}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasDraft && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          ⚠️ Is group ke kuch exams abhi <b>Draft</b> hain — parent ko unka
          result abhi <b>nahi</b> dikh raha. Parent ko dikhane ke liye
          Principal Examinations page se approve karein.
        </p>
      )}

      {loadedOnce && selectedGroup && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-gray-500 text-sm py-8 text-center">
                Sheet ban rahi hai…
              </p>
            ) : sheetRows.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">
                Is class me koi active student nahi hai.
              </p>
            ) : (
              <div className="overflow-x-auto" ref={printRef}>
                <h2 className="text-center font-bold text-lg pt-4 px-4">
                  {school?.name || "School Guardian Suite"}
                </h2>
                <p className="text-center text-sm text-gray-500 pb-3 px-4">
                  Broadsheet — {selectedGroup.exams[0].examName}
                  {selectedGroup.exams[0].session
                    ? ` • Session ${selectedGroup.exams[0].session}`
                    : ""}{" "}
                  • Class {className}
                </p>
                <table className="w-full text-sm border-collapse min-w-[720px]">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border px-2 py-2 text-left">Rank</th>
                      <th className="border px-2 py-2 text-left">Student</th>
                      {selectedGroup.exams.map((exam: ExamApiRow) => (
                        <th key={exam.id} className="border px-2 py-2">
                          {exam.subject || "Marks"}
                          <span className="block text-[11px] font-normal text-gray-500">
                            / {exam.maxMarks ?? 100}
                          </span>
                        </th>
                      ))}
                      <th className="border px-2 py-2">Kul</th>
                      <th className="border px-2 py-2">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheetRows.map((row) => (
                      <tr key={row.studentId} className="hover:bg-slate-50">
                        <td className="border px-2 py-1.5 font-bold">
                          {row.rank}
                        </td>
                        <td className="border px-2 py-1.5 font-medium min-w-0">
                          {row.name}
                          {row.rollNo ? (
                            <span className="text-xs text-gray-400">
                              {" "}
                              (Roll {row.rollNo})
                            </span>
                          ) : null}
                        </td>
                        {selectedGroup.exams.map((exam: ExamApiRow) => (
                          <td
                            key={exam.id}
                            className="border px-2 py-1.5 text-center"
                          >
                            {row.marksByExamId[exam.id] ?? "—"}
                          </td>
                        ))}
                        <td className="border px-2 py-1.5 text-center font-bold">
                          {row.total} / {row.maxTotal}
                        </td>
                        <td className="border px-2 py-1.5 text-center">
                          {row.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
