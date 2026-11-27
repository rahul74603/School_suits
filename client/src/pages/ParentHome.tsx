import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  Award,
  Banknote,
  BookOpen,
  CalendarCheck,
  CalendarOff,
  Home,
  Megaphone,
  RefreshCw,
} from "lucide-react";

// 🏠 Parent Home (v2.0, Arena port #5) — parent login ke baad ki
// pehli screen. Arena ke ParentMobileApp se DESIGN liya hai, lekin
// account model main ka hi hai: parent apne mobile number se login
// karta hai aur server use SIRF uske parent_students-linked bacche
// deta hai (GET /api/parent/overview — ek hi call, koi student id
// client se jata hi nahi, isliye dusre ka baccha yahan aa hi nahi
// sakta).
//  - Baccha ek se zyada ho to upar switcher; har card chune hue
//    bacche ka hai. Notices school-level hain (sab baccho ke liye ek).
//  - Fees ka hisaab server par getStudentStatus se aata hai — Fees
//    page wala hi hisaab, yahan koi alag jod-ghatav nahi hota.
//  - Homework (v3.0): overview me bacche ki class/section ka asal
//    homework aata hai (server filter karke deta hai) — placeholder
//    hata, asal list lagi.
//  - Leave (v3.0): parent yahi se chutti lagata hai (sirf apne
//    linked bacche ke liye — server unlinked ko 404 deta hai) aur
//    apni leaves ka status (Pending/Approved/Rejected) dekhta hai.
//  - v1.9 responsive niyam: sab w-full/min-w-0, koi fixed width
//    nahi, page kabhi side me nahi bhagta.

interface ParentOverviewExam {
  examId: number;
  examName: string;
  examType: string | null;
  examDate: string | null;
  subjects: Array<{
    subject: string | null;
    marksObtained: number | null;
    maxMarks: number | null;
  }>;
  totalObtained: number;
  totalMax: number;
  percentage: number | null;
}

interface ParentOverviewChild {
  student: {
    id: number;
    name: string;
    class: string;
    section: string;
    rollNo: string | null;
    admissionNo: string;
    fatherName: string;
  };
  attendance: {
    month: string;
    totalMarked: number;
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    percentage: number;
  };
  fees: {
    monthlyFee: number;
    admissionTotal: number;
    admissionPaidSoFar: number;
    admissionBalance: number;
    admissionPaid: boolean;
    totalPaid: number;
    pendingDues: Array<{
      id: number;
      fee_name: string;
      due_date: string;
      amount: number;
    }>;
    pendingDuesTotal: number;
    dueMonths: string[];
    monthStatus: Array<{
      name: string;
      tuitionStatus: "paid" | "due" | "future";
      transportStatus: "paid" | "due" | "future";
    }>;
  };
  results: { exams: ParentOverviewExam[] };
  timetable: Array<{
    id: number;
    className: string;
    dayOfWeek: number;
    periodNo: number;
    subject: string;
    teacherId: number | null;
    teacherName: string | null;
  }>;
  homework: Array<{
    id: number;
    subject: string;
    title: string;
    description: string | null;
    dueDate: string;
    overdue: boolean;
  }>;
}

interface ParentLeaveRow {
  id: number;
  studentId: number | null;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
}

function leaveStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          Approved ✅
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          Rejected ❌
        </Badge>
      );
    default:
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
          Pending ⏳
        </Badge>
      );
  }
}

interface ParentOverview {
  children: ParentOverviewChild[];
  notices: Array<{
    id: number;
    title: string;
    body: string | null;
    audience: string | null;
    createdAt: string | null;
  }>;
}

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

function rupees(amount: number): string {
  return `₹${(amount ?? 0).toLocaleString("en-IN")}`;
}

function dateText(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function monthLabel(month: string): string {
  const [y, m] = (month || "").split("-").map((x) => parseInt(x, 10));
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export default function ParentHome() {
  const { toast } = useToast();
  const { user, school } = useAuth();

  const [overview, setOverview] = useState<ParentOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [childIndex, setChildIndex] = useState(0);

  // 🌴 Leave (v3.0): apni lagayi leaves + form. List server se
  // sirf apne linked baccho ki aati hai.
  const [leaves, setLeaves] = useState<ParentLeaveRow[]>([]);
  const [leaveForm, setLeaveForm] = useState({
    fromDate: "",
    toDate: "",
    reason: "",
  });
  const [leaveSaving, setLeaveSaving] = useState(false);

  const loadLeaves = async () => {
    try {
      const data = await apiGet<ParentLeaveRow[]>("/api/leaves");
      setLeaves(data ?? []);
    } catch {
      setLeaves([]);
    }
  };

  useEffect(() => {
    void loadLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Baccha badle to form saaf — ek bacche ki chutti dusre ke naam
  // galti se na lag jaye.
  useEffect(() => {
    setLeaveForm({ fromDate: "", toDate: "", reason: "" });
  }, [childIndex]);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await apiGet<ParentOverview>("/api/parent/overview");
      setOverview(data);
      setLoadedOnce(true);
      setChildIndex((prev) =>
        data && data.children.length > 0
          ? Math.min(prev, data.children.length - 1)
          : 0,
      );
    } catch {
      toast({
        title: "Jaankari nahi aayi",
        description: "Parent home load nahi hua — dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const children = overview?.children ?? [];
  const child = children.length > 0 ? children[childIndex] : null;
  const feesClear =
    child != null &&
    child.fees.pendingDuesTotal === 0 &&
    child.fees.admissionBalance === 0 &&
    child.fees.dueMonths.length === 0;

  const childLeaves =
    child != null
      ? leaves.filter((leave) => leave.studentId === child.student.id)
      : [];

  const submitLeave = async () => {
    if (!child) return;
    if (!leaveForm.fromDate || !leaveForm.toDate || !leaveForm.reason.trim()) {
      toast({
        title: "Adhuri jaankari",
        description: "Kab se, kab tak aur karan — teeno lazmi hain.",
        variant: "destructive",
      });
      return;
    }
    setLeaveSaving(true);
    try {
      await apiPost("/api/leaves", {
        kind: "student",
        studentId: child.student.id,
        fromDate: leaveForm.fromDate,
        toDate: leaveForm.toDate,
        reason: leaveForm.reason.trim(),
      });
      toast({
        title: "✅ Chutti lag gayi",
        description: "Principal ke faisle ke baad status yahi dikhega.",
      });
      setLeaveForm({ fromDate: "", toDate: "", reason: "" });
      void loadLeaves();
    } catch (error) {
      toast({
        title: "Chutti nahi lag payi",
        description:
          error instanceof Error ? error.message : "Dobara koshish karein",
        variant: "destructive",
      });
    } finally {
      setLeaveSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-4">
      {/* Heading */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <Home className="h-5 w-5 text-blue-600" /> Parent Home
          </h1>
          <p className="truncate text-sm text-gray-500">
            Namaste{user?.name ? `, ${user.name}` : ""} —{" "}
            {school?.name || "aapke bacche ki jaankari"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => void loadOverview()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading && !loadedOnce && (
        <Card className="w-full min-w-0">
          <CardContent className="py-8 text-center text-sm text-gray-500">
            Jaankari load ho rahi hai…
          </CardContent>
        </Card>
      )}

      {loadedOnce && children.length === 0 && (
        <Card className="w-full min-w-0">
          <CardContent className="space-y-2 py-8 text-center">
            <div className="text-3xl">🎓</div>
            <p className="font-medium text-slate-700">
              Abhi koi baccha is account se link nahi hai
            </p>
            <p className="text-sm text-gray-500">
              Kripya school office se sampark karein — wo aapke bacche ko
              is number se link kar denge.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Baccha switcher — ek se zyada linked bacche hon tabhi */}
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((c, i) => (
            <Button
              key={c.student.id}
              variant={i === childIndex ? "default" : "outline"}
              className="min-h-[44px] flex-1 sm:flex-none"
              onClick={() => setChildIndex(i)}
            >
              {c.student.name}
            </Button>
          ))}
        </div>
      )}

      {child && (
        <>
          {/* Bacche ka profile */}
          <Card className="w-full min-w-0 border-blue-100 bg-blue-50/50">
            <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-1 py-4">
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-slate-800">
                  {child.student.name}
                </div>
                <div className="text-sm text-gray-500">
                  Class {child.student.class}
                  {child.student.section
                    ? ` • Section ${child.student.section}`
                    : ""}
                  {child.student.rollNo
                    ? ` • Roll No. ${child.student.rollNo}`
                    : ""}
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Admission No.:{" "}
                <span className="font-medium text-slate-700">
                  {child.student.admissionNo}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Attendance — is mahine ki */}
          <Card className="w-full min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarCheck className="h-5 w-5 text-green-600" />
                Attendance — {monthLabel(child.attendance.month)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {child.attendance.totalMarked === 0 ? (
                <p className="text-sm text-gray-500">
                  Is mahine ki hajri abhi nahi lagi hai.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <span className="text-3xl font-bold text-slate-800">
                      {child.attendance.percentage}%
                    </span>
                    <span className="pb-1 text-sm text-gray-500">
                      upasthiti ({child.attendance.present}/
                      {child.attendance.totalMarked} din)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg bg-green-50 p-3 text-center">
                      <div className="text-lg font-bold text-green-700">
                        {child.attendance.present}
                      </div>
                      <div className="text-xs text-gray-500">Present</div>
                    </div>
                    <div className="rounded-lg bg-red-50 p-3 text-center">
                      <div className="text-lg font-bold text-red-700">
                        {child.attendance.absent}
                      </div>
                      <div className="text-xs text-gray-500">Absent</div>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3 text-center">
                      <div className="text-lg font-bold text-amber-700">
                        {child.attendance.late}
                      </div>
                      <div className="text-xs text-gray-500">Late</div>
                    </div>
                    <div className="rounded-lg bg-slate-100 p-3 text-center">
                      <div className="text-lg font-bold text-slate-700">
                        {child.attendance.halfDay}
                      </div>
                      <div className="text-xs text-gray-500">Half Day</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fees */}
          <Card className="w-full min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Banknote className="h-5 w-5 text-emerald-600" /> Fees
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg bg-emerald-50 p-3">
                  <div className="text-xs text-gray-500">Kul Jama</div>
                  <div className="text-lg font-bold text-emerald-700">
                    {rupees(child.fees.totalPaid)}
                  </div>
                </div>
                <div className="rounded-lg bg-red-50 p-3">
                  <div className="text-xs text-gray-500">Pending Dues</div>
                  <div className="text-lg font-bold text-red-700">
                    {rupees(child.fees.pendingDuesTotal)}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-100 p-3">
                  <div className="text-xs text-gray-500">Monthly Fee</div>
                  <div className="text-lg font-bold text-slate-700">
                    {rupees(child.fees.monthlyFee)}
                  </div>
                </div>
              </div>

              {child.fees.admissionTotal > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-gray-600">
                    Admission Fee: {rupees(child.fees.admissionPaidSoFar)} /{" "}
                    {rupees(child.fees.admissionTotal)} jama
                  </span>
                  {child.fees.admissionPaid ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      Fully Paid
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                      {rupees(child.fees.admissionBalance)} baaki
                    </Badge>
                  )}
                </div>
              )}

              {child.fees.dueMonths.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-600">Due mahine:</span>
                  {child.fees.dueMonths.map((name) => (
                    <Badge
                      key={name}
                      className="bg-amber-100 text-amber-800 hover:bg-amber-100"
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
              )}

              {child.fees.pendingDues.length > 0 && (
                <div className="space-y-1">
                  {child.fees.pendingDues.map((due) => (
                    <div
                      key={due.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="font-medium text-slate-700">
                          {due.fee_name}
                        </span>
                        {due.due_date && (
                          <span className="text-gray-400">
                            {" "}
                            • {dateText(due.due_date)}
                          </span>
                        )}
                      </span>
                      <span className="font-semibold text-red-700">
                        {rupees(due.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {feesClear && (
                <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                  ✅ Saari fees saaf hai — kuch baaki nahi hai.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Notices — school-level (har bacche ke liye ek jaise) */}
      {overview && (
        <Card className="w-full min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-5 w-5 text-violet-600" /> School
              Notices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overview.notices.length === 0 ? (
              <p className="text-sm text-gray-500">
                Abhi koi notice nahi hai.
              </p>
            ) : (
              <div className="space-y-3">
                {overview.notices.map((notice) => (
                  <div
                    key={notice.id}
                    className="border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 font-medium text-slate-800">
                        {notice.title}
                      </span>
                      <span className="text-xs text-gray-400">
                        {dateText(notice.createdAt)}
                      </span>
                    </div>
                    {notice.body && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                        {notice.body}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {child && (
        <>
          {/* Results / Report Card */}
          <Card className="w-full min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="h-5 w-5 text-amber-600" /> Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {child.results.exams.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Abhi koi result publish nahi hua hai. Result school
                  dwara approve hote hi yahan dikhega.
                </p>
              ) : (
                child.results.exams.map((exam) => (
                  <div key={exam.examId} className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 font-medium text-slate-800">
                        {exam.examName}
                        {exam.examDate && (
                          <span className="ml-2 text-xs font-normal text-gray-400">
                            {dateText(exam.examDate)}
                          </span>
                        )}
                      </span>
                      {exam.percentage != null && (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                          {exam.percentage}%
                        </Badge>
                      )}
                    </div>
                    {exam.subjects.map((subject, i) => (
                      <div
                        key={`${exam.examId}-${i}`}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 text-gray-600">
                          {subject.subject || "Subject"}
                        </span>
                        <span className="font-medium text-slate-700">
                          {subject.marksObtained ?? "—"}
                          {subject.maxMarks != null
                            ? ` / ${subject.maxMarks}`
                            : ""}
                        </span>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-1 text-sm font-medium">
                      <span className="text-gray-600">Total</span>
                      <span className="text-slate-800">
                        {exam.totalObtained} / {exam.totalMax}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <Link href="/report-cards">
                <Button variant="outline" className="min-h-[44px] w-full sm:w-auto">
                  Poora Report Card dekho
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Timetable — sirf dekhne ke liye, din ke hisaab se list */}
          <Card className="w-full min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-5 w-5 text-sky-600" /> Class
                Timetable
              </CardTitle>
            </CardHeader>
            <CardContent>
              {child.timetable.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Is class ka timetable abhi nahi bana hai.
                </p>
              ) : (
                <div className="space-y-3">
                  {DAYS.map((day) => {
                    const rows = child.timetable
                      .filter((e) => e.dayOfWeek === day.value)
                      .slice()
                      .sort((a, b) => a.periodNo - b.periodNo);
                    if (rows.length === 0) return null;
                    return (
                      <div key={day.value}>
                        <div className="mb-1 text-sm font-semibold text-slate-700">
                          {day.label}
                        </div>
                        <div className="space-y-1">
                          {rows.map((row) => (
                            <div
                              key={row.id}
                              className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                            >
                              <Badge
                                variant="outline"
                                className="shrink-0"
                              >
                                P{row.periodNo}
                              </Badge>
                              <span className="min-w-0 font-medium text-slate-700">
                                {row.subject}
                              </span>
                              {row.teacherName && (
                                <span className="text-gray-400">
                                  — {row.teacherName}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 📚 Homework (v3.0) — asal list: server overview me
              bacche ki class/section ka homework filter karke
              deta hai; dusri class/school ka homework yahan aa hi
              nahi sakta. */}
          <Card className="w-full min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-5 w-5 text-blue-600" /> Homework
              </CardTitle>
            </CardHeader>
            <CardContent>
              {child.homework.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Abhi koi homework nahi hai. 😊
                </p>
              ) : (
                <div className="space-y-2">
                  {child.homework.map((hw) => (
                    <div
                      key={hw.id}
                      className="rounded-lg bg-slate-50 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                          {hw.subject}
                        </Badge>
                        <span className="min-w-0 font-medium text-slate-700">
                          {hw.title}
                        </span>
                        {hw.overdue && (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                            Overdue
                          </Badge>
                        )}
                      </div>
                      {hw.description && (
                        <p className="mt-1 text-sm text-gray-500">
                          {hw.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        Kab tak: {dateText(hw.dueDate)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 🌴 Leave (Chutti) — parent yahi se lagata hai aur
              apni leaves ka status dekhta hai. */}
          <Card className="w-full min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarOff className="h-5 w-5 text-blue-600" /> Leave
                (Chutti)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Kab se</Label>
                    <Input
                      type="date"
                      value={leaveForm.fromDate}
                      onChange={(e) =>
                        setLeaveForm((prev) => ({
                          ...prev,
                          fromDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Kab tak</Label>
                    <Input
                      type="date"
                      value={leaveForm.toDate}
                      onChange={(e) =>
                        setLeaveForm((prev) => ({
                          ...prev,
                          toDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Karan</Label>
                  <Textarea
                    value={leaveForm.reason}
                    onChange={(e) =>
                      setLeaveForm((prev) => ({
                        ...prev,
                        reason: e.target.value,
                      }))
                    }
                    rows={2}
                    placeholder="Bukhaar hai / ghar me shaadi hai…"
                  />
                </div>
                <Button
                  onClick={submitLeave}
                  disabled={leaveSaving}
                  className="min-h-[44px] w-full sm:w-auto"
                >
                  {leaveSaving ? "Lag raha hai…" : "Leave (Chutti) lagao"}
                </Button>
              </div>

              {childLeaves.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">
                    Aapki leaves
                  </p>
                  {childLeaves.map((leave) => (
                    <div
                      key={leave.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                    >
                      <div className="min-w-0 text-sm">
                        <span className="font-medium text-slate-700">
                          {dateText(leave.fromDate)} → {dateText(leave.toDate)}
                        </span>
                        <span className="block truncate text-gray-500">
                          {leave.reason}
                        </span>
                      </div>
                      {leaveStatusBadge(leave.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
