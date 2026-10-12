import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useSchoolCatalog } from "@/hooks/use-school-catalog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Radio,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const PERIOD_PRESETS = [
  { periodNo: 1, label: "Period 1 (08:00 - 08:45)", start: "08:00", end: "08:45" },
  { periodNo: 2, label: "Period 2 (08:45 - 09:30)", start: "08:45", end: "09:30" },
  { periodNo: 3, label: "Period 3 (09:30 - 10:15)", start: "09:30", end: "10:15" },
  { periodNo: 4, label: "Period 4 (10:30 - 11:15)", start: "10:30", end: "11:15" },
  { periodNo: 5, label: "Period 5 (11:15 - 12:00)", start: "11:15", end: "12:00" },
  { periodNo: 6, label: "Period 6 (12:00 - 12:45)", start: "12:00", end: "12:45" },
  { periodNo: 7, label: "Period 7 (13:15 - 14:00)", start: "13:15", end: "14:00" },
  { periodNo: 8, label: "Period 8 (14:00 - 14:45)", start: "14:00", end: "14:45" },
];

type TimetableEntry = {
  id: number;
  className: string;
  section: string;
  dayOfWeek: string;
  periodNo: number;
  startTime: string;
  endTime: string;
  subjectId: number;
  teacherUserId: number | null;
  roomNo: string | null;
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  return h * 60 + m;
}

function slotsOverlap(
  s1: string,
  e1: string,
  p1: number,
  s2: string,
  e2: string,
  p2: number,
): boolean {
  if (p1 === p2) return true;
  const m1s = timeToMinutes(s1);
  const m1e = timeToMinutes(e1);
  const m2s = timeToMinutes(s2);
  const m2e = timeToMinutes(e2);
  if (m1s !== -1 && m1e !== -1 && m2s !== -1 && m2e !== -1) {
    return m1s < m2e && m1e > m2s;
  }
  return false;
}

export default function Timetable() {
  const { data: user } = useAuth();
  const { classOptions, sectionOptions, subjects, subjectMap } = useSchoolCatalog();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canManage = user?.role === "admin" || user?.role === "principal";

  // Live clock + optional simulated time for testing at any hour
  const [now, setNow] = useState(() => new Date());
  const [simDay, setSimDay] = useState<string>("LIVE");
  const [simTime, setSimTime] = useState<string>("");

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const realDayName = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][now.getDay()];
  const activeDayName =
    simDay === "LIVE" ? (realDayName === "Sunday" ? "Monday" : realDayName) : simDay;
  const activeMinutes = simTime
    ? timeToMinutes(simTime)
    : now.getHours() * 60 + now.getMinutes();

  // Filter state
  const [className, setClassName] = useState("all");
  const [section, setSection] = useState("all");

  // Add Period Form state (concrete section A/B/C/D — never ALL for a physical classroom)
  const [formClass, setFormClass] = useState("10");
  const [formSection, setFormSection] = useState("A");
  const [dayOfWeek, setDayOfWeek] = useState("ALL");
  const [periodNo, setPeriodNo] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:45");
  const [subjectId, setSubjectId] = useState("");
  const [teacherUserId, setTeacherUserId] = useState("");
  const [roomNo, setRoomNo] = useState("");

  const allTimetable = useQuery<TimetableEntry[]>({
    queryKey: ["/api/timetable"],
    queryFn: async () => {
      const res = await fetch("/api/timetable", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load timetable");
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const conflicts = useQuery<any[]>({
    queryKey: ["/api/timetable/conflicts"],
    queryFn: async () => {
      const res = await fetch("/api/timetable/conflicts", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const schoolUsers = useQuery<{ id: number; name: string; role: string; username: string }[]>({
    queryKey: ["/api/school-users"],
    queryFn: async () => {
      const res = await fetch("/api/school-users", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!user && canManage,
  });

  const resolveConflicts = useMutation({
    mutationFn: () => apiRequest("POST", "/api/timetable/resolve-conflicts", {}),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["/api/timetable"] });
      qc.invalidateQueries({ queryKey: ["/api/timetable/conflicts"] });
      toast({
        title: "All Clashes & Duplicates Resolved!",
        description: `Cleaned ${res?.removed ?? 0} conflicting period entries. Every teacher and classroom is now clash-free.`,
      });
    },
  });

  const createEntry = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/timetable", {
        className: formClass,
        section: formSection,
        dayOfWeek,
        days: dayOfWeek === "ALL" ? [...DAYS] : undefined,
        periodNo: Number(periodNo),
        startTime,
        endTime,
        subjectId: Number(subjectId),
        teacherUserId: teacherUserId ? Number(teacherUserId) : null,
        roomNo: roomNo.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/timetable"] });
      qc.invalidateQueries({ queryKey: ["/api/timetable/conflicts"] });
      qc.invalidateQueries({ queryKey: ["/api/teacher-assignments"] });
      toast({
        title: "Period Scheduled (No Clash)!",
        description: `Class ${formClass}-${formSection} · ${
          dayOfWeek === "ALL" ? "Mon–Sat" : dayOfWeek
        } · Period ${periodNo} (${startTime}–${endTime})`,
      });
    },
    onError: (err: Error) =>
      toast({
        variant: "destructive",
        title: "Schedule Clash Blocked!",
        description: err.message,
      }),
  });

  const deleteEntry = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/timetable/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/timetable"] });
      qc.invalidateQueries({ queryKey: ["/api/timetable/conflicts"] });
      toast({ title: "Period removed" });
    },
  });

  const teacherList = (schoolUsers.data ?? []).filter((u) => u.role === "teacher");
  const teacherMap = new Map(teacherList.map((u) => [u.id, u.name]));

  // Live pre-save clash detector in the form
  const targetDaysForForm = dayOfWeek === "ALL" ? [...DAYS] : [dayOfWeek];
  const formTeacherClash = teacherUserId
    ? (allTimetable.data ?? []).find(
        (e) =>
          targetDaysForForm.includes(e.dayOfWeek) &&
          e.teacherUserId === Number(teacherUserId) &&
          !(
            e.className === formClass &&
            e.section === formSection &&
            e.periodNo === Number(periodNo)
          ) &&
          slotsOverlap(
            startTime,
            endTime,
            Number(periodNo),
            e.startTime,
            e.endTime,
            e.periodNo,
          ),
      )
    : undefined;

  const formRoomClash = (allTimetable.data ?? []).find(
    (e) =>
      targetDaysForForm.includes(e.dayOfWeek) &&
      e.className === formClass &&
      e.section === formSection &&
      e.periodNo !== Number(periodNo) &&
      slotsOverlap(
        startTime,
        endTime,
        Number(periodNo),
        e.startTime,
        e.endTime,
        e.periodNo,
      ),
  );

  // Live Active Periods right now (deduplicated per classroom & teacher so 1 teacher never shows in 2 rooms)
  const rawLiveEntries = (allTimetable.data ?? []).filter((t) => {
    if (t.dayOfWeek !== activeDayName) return false;
    const st = timeToMinutes(t.startTime);
    const et = timeToMinutes(t.endTime);
    return st !== -1 && et !== -1 && activeMinutes >= st && activeMinutes <= et;
  });

  const seenTeachers = new Set<number>();
  const seenClassrooms = new Set<string>();
  const liveEntriesNow: TimetableEntry[] = [];
  for (const item of rawLiveEntries) {
    const roomKey = `${item.className}-${item.section}`;
    if (seenClassrooms.has(roomKey)) continue;
    if (item.teacherUserId && seenTeachers.has(item.teacherUserId)) continue;
    seenClassrooms.add(roomKey);
    if (item.teacherUserId) seenTeachers.add(item.teacherUserId);
    liveEntriesNow.push(item);
  }

  // Filtered timetable entries for the weekly grid
  const filteredEntries = (allTimetable.data ?? []).filter((t) => {
    if (className !== "all" && t.className !== className) return false;
    if (section !== "all" && t.section !== section) return false;
    return true;
  });

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              Live Classroom Tracker & Clash-Free Timetable
            </h1>
            <p className="text-sm text-slate-500">
              Automatic Clash Detector prevents 1 teacher in 2 classes or 2 teachers in 1 classroom at the same time
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-2.5 shadow-sm">
            <div className="flex items-center gap-2 px-2 text-xs font-semibold text-emerald-700">
              <Radio className="h-4 w-4 animate-pulse text-emerald-600" />
              <span>
                {simTime || simDay !== "LIVE" ? "Preview Mode:" : "Live Real Time:"}{" "}
                <b>{activeDayName}</b>{" "}
                <b>
                  {simTime ||
                    now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </b>
              </span>
            </div>
            <select
              className="h-8 rounded border bg-slate-50 px-2 text-xs"
              value={simDay}
              onChange={(e) => setSimDay(e.target.value)}
            >
              <option value="LIVE">Today ({realDayName})</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  Check {d}
                </option>
              ))}
            </select>
            <select
              className="h-8 rounded border bg-slate-50 px-2 text-xs"
              value={simTime}
              onChange={(e) => setSimTime(e.target.value)}
            >
              <option value="">Live Clock (Now)</option>
              {PERIOD_PRESETS.map((p) => (
                <option key={p.periodNo} value={p.start}>
                  Check {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CLASH / DUPLICATE DETECTOR CARD */}
        {(conflicts.data ?? []).length > 0 ? (
          <Card className="border-red-300 bg-red-50 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base text-red-900 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  ⚠️ Duplicate / Same-Time Schedule Clashes Detected ({conflicts.data!.length})
                </CardTitle>
                {canManage && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={resolveConflicts.isPending}
                    onClick={() => resolveConflicts.mutate()}
                  >
                    {resolveConflicts.isPending
                      ? "Cleaning Clashes..."
                      : "1-Click Auto-Fix & Remove Duplicate Clashes"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {conflicts.data!.slice(0, 6).map((c) => (
                <div
                  key={c.id}
                  className="rounded border border-red-200 bg-white px-3 py-2 text-xs text-red-900 font-medium"
                >
                  • {c.message}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs font-semibold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Clash Detector Active: Zero same-time teacher or classroom conflicts in the schedule!
          </div>
        )}

        {/* REAL-TIME LIVE RADAR FOR PRINCIPAL / ADMIN */}
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-white to-indigo-50/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                <span className="h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
                Live Classrooms Running Right Now ({activeDayName} ·{" "}
                {simTime ||
                  now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                )
              </CardTitle>
              <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">
                {liveEntriesNow.length} Active Classroom{liveEntriesNow.length === 1 ? "" : "s"} in Session
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {liveEntriesNow.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white/80 p-4 text-sm text-slate-600 flex flex-wrap items-center justify-between gap-2">
                <span>
                  No period is running at{" "}
                  <b>
                    {simTime ||
                      now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </b>
                  . Use the <b>&ldquo;Check Period 1 (08:00 - 08:45)&rdquo;</b> dropdown at the top-right to preview any period!
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSimTime("08:15")}
                >
                  Preview Period 1 (08:15 AM)
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {liveEntriesNow.map((entry) => {
                  const endMins = timeToMinutes(entry.endTime);
                  const minsLeft = Math.max(0, endMins - activeMinutes);
                  return (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-emerald-300 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                          <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                          PERIOD {entry.periodNo} · LIVE
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {entry.startTime} – {entry.endTime} ({minsLeft}m left)
                        </span>
                      </div>
                      <div className="mt-2 text-lg font-bold text-slate-900">
                        Class {entry.className} — Section {entry.section}
                      </div>
                      <div className="text-sm font-semibold text-indigo-700">
                        Subject: {subjectMap.get(entry.subjectId)?.name ?? `Subject #${entry.subjectId}`}
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs text-slate-700">
                        <span className="font-semibold flex items-center gap-1">
                          <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                          Teacher:{" "}
                          {entry.teacherUserId
                            ? teacherMap.get(entry.teacherUserId) ??
                              `Teacher #${entry.teacherUserId}`
                            : "Not assigned"}
                        </span>
                        {entry.roomNo && <span>Room {entry.roomNo}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Teacher-wise Live Status Summary */}
            {canManage && teacherList.length > 0 && (
              <div className="rounded-lg border bg-white p-3">
                <div className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  All Teachers Live Status (1 Teacher = Max 1 Classroom at a Time)
                </div>
                <div className="flex flex-wrap gap-2">
                  {teacherList.map((t) => {
                    const activeSlot = liveEntriesNow.find(
                      (e) => e.teacherUserId === t.id,
                    );
                    return (
                      <div
                        key={t.id}
                        className={`rounded-lg border px-3 py-1.5 text-xs ${
                          activeSlot
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        <span className="font-bold">{t.name}: </span>
                        {activeSlot ? (
                          <span className="font-semibold text-emerald-800">
                            🟢 Teaching Class {activeSlot.className}-{activeSlot.section} (
                            {subjectMap.get(activeSlot.subjectId)?.name ?? "Subject"})
                          </span>
                        ) : (
                          <span>⚪ Free right now</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ADD / UPDATE PERIOD SCHEDULE (ALL DROPDOWNS + LIVE CLASH WARNING) */}
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4" />
                Schedule Classroom Period (All Dropdowns + Automatic Clash Protection)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    1. Class (Dropdown)
                  </label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
                    value={formClass}
                    onChange={(e) => setFormClass(e.target.value)}
                  >
                    {classOptions.map((c) => (
                      <option key={c} value={c}>
                        Class {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    2. Classroom Section (Dropdown)
                  </label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value)}
                  >
                    {sectionOptions.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    3. Days (Dropdown)
                  </label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value)}
                  >
                    <option value="ALL">All Working Days (Mon–Sat)</option>
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d} Only
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    4. Period Preset (Dropdown)
                  </label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
                    value={periodNo}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPeriodNo(val);
                      const preset = PERIOD_PRESETS.find(
                        (p) => String(p.periodNo) === val,
                      );
                      if (preset) {
                        setStartTime(preset.start);
                        setEndTime(preset.end);
                      }
                    }}
                  >
                    {PERIOD_PRESETS.map((p) => (
                      <option key={p.periodNo} value={p.periodNo}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Start Time
                  </label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    End Time
                  </label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    5. Subject (Dropdown)
                  </label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                  >
                    <option value="">Select Subject...</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    6. Teacher (Dropdown)
                  </label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
                    value={teacherUserId}
                    onChange={(e) => setTeacherUserId(e.target.value)}
                  >
                    <option value="">Select Teacher...</option>
                    {teacherList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (@{t.username})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full h-10"
                    onClick={() => createEntry.mutate()}
                    disabled={
                      createEntry.isPending ||
                      !subjectId ||
                      !!formTeacherClash ||
                      !!formRoomClash
                    }
                  >
                    {createEntry.isPending ? "Checking & Saving..." : "Save Period Slot"}
                  </Button>
                </div>
              </div>

              {(formTeacherClash || formRoomClash) && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  {formTeacherClash ? (
                    <span>
                      ⚠️ <b>Teacher Clash Blocked:</b> Selected teacher is already scheduled in{" "}
                      <b>
                        Class {formTeacherClash.className}-{formTeacherClash.section}
                      </b>{" "}
                      during Period {formTeacherClash.periodNo} ({formTeacherClash.startTime}–
                      {formTeacherClash.endTime}) on {formTeacherClash.dayOfWeek}. Please select a different Period or Teacher!
                    </span>
                  ) : (
                    <span>
                      ⚠️ <b>Classroom Clash Blocked:</b> Class {formClass}-{formSection} already has an overlapping period ({formRoomClash?.startTime}–{formRoomClash?.endTime}).
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* WEEKLY TIMETABLE GRID WITH CLASS & SECTION DROPDOWN FILTERS */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border shadow-sm">
          <div className="text-sm font-bold text-slate-800">
            Weekly Routine Filter:
          </div>
          <div className="flex gap-2">
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm font-medium"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            >
              <option value="all">All Classes</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  Class {c}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm font-medium"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="all">All Sections</option>
              {sectionOptions.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {DAYS.map((day) => {
            const dayEntries = filteredEntries
              .filter((e) => e.dayOfWeek === day)
              .sort((a, b) => a.periodNo - b.periodNo);
            return (
              <Card key={day}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{day}</span>
                    <span className="text-xs font-normal text-slate-500">
                      {dayEntries.length} period(s)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dayEntries.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3">
                      No periods scheduled for {day}.
                    </p>
                  ) : (
                    <div className="divide-y">
                      {dayEntries.map((item) => (
                        <div
                          key={item.id}
                          className="py-2.5 flex items-center justify-between text-sm"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">
                              Period {item.periodNo}:{" "}
                              {subjectMap.get(item.subjectId)?.name ??
                                `Subject #${item.subjectId}`}
                              <span className="ml-2 rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                                Class {item.className}-Section {item.section}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {item.startTime} – {item.endTime}
                              {item.teacherUserId && (
                                <span>
                                  · Teacher:{" "}
                                  <b>
                                    {teacherMap.get(item.teacherUserId) ??
                                      `#${item.teacherUserId}`}
                                  </b>
                                </span>
                              )}
                            </div>
                          </div>
                          {canManage && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => deleteEntry.mutate(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
