import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useStudents } from "@/hooks/use-students";
import { usePayments, useDefaulters } from "@/hooks/use-fees";
import { useActiveSession, useSchool } from "@/hooks/use-core";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/Sidebar";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import {
  Users,
  CreditCard,
  AlertCircle,
  Bell,
  BookOpen,
  ClipboardCheck,
  UserPlus,
  Award,
  Calendar,
  Radio,
} from "lucide-react";
import { format } from "date-fns";
import type { HomeworkAssignment, Notice } from "@shared/schema";

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  return h * 60 + m;
}

export default function Dashboard() {
  const { data: user } = useAuth();
  const school = useSchool(user?.schoolId);
  const session = useActiveSession();
  const canViewFees = ["admin", "principal", "accountant", "staff"].includes(user?.role ?? "");
  const isManager = user?.role === "admin" || user?.role === "principal";
  const isStudent = user?.role === "student";

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  const currentDayName = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const students = useStudents();
  const payments = usePayments();
  const defaulters = useDefaulters({
    month: format(new Date(), "MMMM"),
    year: new Date().getFullYear(),
  });
  const notices = useQuery<Notice[]>({
    queryKey: ["/api/notices"],
    queryFn: async () => (await fetch("/api/notices", { credentials: "include" })).json(),
    enabled: !!user,
  });
  const homework = useQuery<HomeworkAssignment[]>({
    queryKey: ["/api/homework"],
    queryFn: async () => (await fetch("/api/homework", { credentials: "include" })).json(),
    enabled: !!user,
  });
  const timetable = useQuery<any[]>({
    queryKey: ["/api/timetable"],
    queryFn: async () => {
      const res = await fetch("/api/timetable", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });
  const subjects = useQuery<any[]>({
    queryKey: ["/api/subjects"],
    queryFn: async () => {
      const res = await fetch("/api/subjects", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!user,
  });
  const schoolUsers = useQuery<any[]>({
    queryKey: ["/api/school-users"],
    queryFn: async () => {
      const res = await fetch("/api/school-users", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!user && isManager,
  });

  const subjectMap = new Map((subjects.data ?? []).map((s) => [s.id, s]));
  const teacherMap = new Map((schoolUsers.data ?? []).map((u) => [u.id, u.name]));

  const liveClassesNow = (timetable.data ?? []).filter((t) => {
    if (t.dayOfWeek !== currentDayName) return false;
    const st = timeToMinutes(t.startTime);
    const et = timeToMinutes(t.endTime);
    return st !== -1 && et !== -1 && currentMinutes >= st && currentMinutes <= et;
  });

  const today = new Date().toDateString();
  const todayCollection =
    payments.data
      ?.filter((payment) => new Date(payment.paymentDate).toDateString() === today)
      .reduce((sum, payment) => sum + payment.amount, 0) ?? 0;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {school.data?.name || "School Operations Dashboard"}
            </h1>
            <p className="text-slate-500 mt-1">
              Welcome back, <b>{user?.name || "User"}</b> ({user?.role || "member"}) ·{" "}
              {session.data?.name || "Active academic session"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isStudent && (
              <Link href="/admissions">
                <Button size="sm" variant="outline">
                  <UserPlus className="h-4 w-4 mr-1.5" /> New Admission
                </Button>
              </Link>
            )}
            <Link href="/attendance">
              <Button size="sm" variant="outline">
                <ClipboardCheck className="h-4 w-4 mr-1.5" /> Attendance
              </Button>
            </Link>
            <Link href="/timetable">
              <Button size="sm" variant="outline">
                <Calendar className="h-4 w-4 mr-1.5" /> Live Classes & Timetable
              </Button>
            </Link>
            <Link href="/report-cards">
              <Button size="sm">
                <Award className="h-4 w-4 mr-1.5" /> Report Cards
              </Button>
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title={isStudent ? "My Student Profile" : "Authorized Students"}
            value={students.data?.length ?? "—"}
            icon={Users}
          />
          <StatCard
            title={isStudent ? "My Fee Payments" : "Today's Fee Collection"}
            value={
              payments.data
                ? isStudent
                  ? `${payments.data.length} Receipts`
                  : `₹${todayCollection.toLocaleString()}`
                : "—"
            }
            icon={CreditCard}
          />
          <StatCard
            title="Active Notices"
            value={notices.data?.length ?? 0}
            icon={Bell}
          />
          {canViewFees ? (
            <StatCard
              title="Monthly Fee Defaulters"
              value={defaulters.data?.length ?? "—"}
              icon={AlertCircle}
            />
          ) : (
            <StatCard
              title="Active Homework"
              value={homework.data?.length ?? 0}
              icon={BookOpen}
            />
          )}
        </div>

        {/* REAL-TIME LIVE CLASSES & TEACHER MONITOR */}
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-white to-indigo-50/50 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Radio className="h-5 w-5 text-emerald-600 animate-pulse" />
              Live Classroom & Teacher Monitor ({currentDayName},{" "}
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
            </h2>
            <Link href="/timetable">
              <span className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer">
                Open Live Tracker & Full Timetable →
              </span>
            </Link>
          </div>
          {liveClassesNow.length === 0 ? (
            <p className="text-sm text-slate-600">
              No active period running at this exact minute ({now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}).{" "}
              <Link href="/timetable">
                <span className="font-semibold text-indigo-600 hover:underline cursor-pointer">
                  Go to Live Timetable
                </span>
              </Link>{" "}
              to schedule periods or preview any period slot.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {liveClassesNow.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-emerald-300 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                    <span>● LIVE · PERIOD {item.periodNo}</span>
                    <span>
                      {item.startTime}–{item.endTime}
                    </span>
                  </div>
                  <div className="mt-1.5 text-base font-bold text-slate-900">
                    Class {item.className} —{" "}
                    {item.section === "ALL" ? "All Sections" : `Section ${item.section}`}
                  </div>
                  <div className="text-sm font-semibold text-indigo-700">
                    {subjectMap.get(item.subjectId)?.name ?? `Subject #${item.subjectId}`}
                  </div>
                  {item.teacherUserId && (
                    <div className="mt-1 text-xs text-slate-600">
                      Teacher: <b>{teacherMap.get(item.teacherUserId) ?? `#${item.teacherUserId}`}</b>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white p-6 rounded-2xl border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Bell className="h-5 w-5 text-indigo-600" /> Latest Notices & Circulars
              </h2>
              <Link href="/notices">
                <span className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer">
                  View all →
                </span>
              </Link>
            </div>
            {!notices.data?.length ? (
              <p className="text-sm text-slate-500">No active circulars published.</p>
            ) : (
              <div className="space-y-3">
                {notices.data.slice(0, 4).map((n) => (
                  <div key={n.id} className="border-b pb-3 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-slate-900">{n.title}</span>
                      <span className="text-xs uppercase rounded bg-slate-100 px-2 py-0.5 text-slate-600">
                        {n.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-1">{n.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600" /> Recent Homework & Diary
              </h2>
              <Link href="/homework">
                <span className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer">
                  Open diary →
                </span>
              </Link>
            </div>
            {!homework.data?.length ? (
              <p className="text-sm text-slate-500">No homework assignments posted yet.</p>
            ) : (
              <div className="space-y-3">
                {homework.data.slice(0, 4).map((hw) => (
                  <div key={hw.id} className="border-b pb-3 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-slate-900">{hw.title}</span>
                      <span className="text-xs rounded bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
                        Class {hw.className}-{hw.section}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Due: {hw.dueDate}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Recent Fee Payments</h2>
            <Link href="/fees">
              <span className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer">
                Manage fees & receipts →
              </span>
            </Link>
          </div>
          {payments.isLoading ? (
            <p className="text-sm text-slate-500">Loading payments...</p>
          ) : payments.data?.length ? (
            <div className="space-y-3">
              {payments.data.slice(0, 6).map((payment) => (
                <div key={payment.id} className="flex justify-between border-b pb-3 text-sm">
                  <span>
                    Receipt <b>{payment.receiptNo}</b> ({payment.month || "General"}/{payment.year})
                  </span>
                  <span className="font-semibold text-green-700">
                    ₹{payment.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No payments recorded in the active session.</p>
          )}
        </div>
      </main>
    </div>
  );
}
