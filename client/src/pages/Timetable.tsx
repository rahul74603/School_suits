import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useActiveSession } from "@/hooks/use-core";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, Clock, Plus, Radio, Trash2, UserCheck, Users } from "lucide-react";

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

export default function Timetable() {
  const { data: user } = useAuth();
  const activeSession = useActiveSession();
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

  // Add Period Form state (all dropdowns)
  const [formClass, setFormClass] = useState("10");
  const [formSection, setFormSection] = useState("ALL");
  const [dayOfWeek, setDayOfWeek] = useState("ALL");
  const [periodNo, setPeriodNo] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:45");
  const [subjectId, setSubjectId] = useState("");
  const [teacherUserId, setTeacherUserId] = useState("");
  const [roomNo, setRoomNo] = useState("");

  const dbClasses = useQuery<any[]>({
    queryKey: ["/api/management/classes", activeSession.data?.id],
    queryFn: async () => {
      const res = await fetch(
        `/api/management/classes?sessionId=${activeSession.data?.id}`,
        { credentials: "include" },
      );
      return res.ok ? res.json() : [];
    },
    enabled: !!activeSession.data?.id,
  });

  const dbSections = useQuery<any[]>({
    queryKey: ["/api/management/sections", activeSession.data?.id],
    queryFn: async () => {
      const res = await fetch(
        `/api/management/sections?sessionId=${activeSession.data?.id}`,
        { credentials: "include" },
      );
      return res.ok ? res.json() : [];
    },
    enabled: !!activeSession.data?.id,
  });

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

  const subjects = useQuery<{ id: number; name: string; code: string }[]>({
    queryKey: ["/api/subjects"],
    queryFn: async () => {
      const res = await fetch("/api/subjects", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!user,
  });

  const schoolUsers = useQuery<{ id: number; name: string; role: string; username: string }[]>({
    queryKey: ["/api/school-users"],
    queryFn: async () => {
      const res = await fetch("/api/school-users", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!user && canManage,
  });

  const classOrderWeight = (name: string) => {
    const clean = name.trim().toLowerCase();
    if (clean === "nursery") return -3;
    if (clean === "lkg" || clean === "kg1") return -2;
    if (clean === "ukg" || clean === "kg2") return -1;
    const num = Number(clean);
    if (!Number.isNaN(num)) return num;
    return 100;
  };

  const classOptions: string[] =
    dbClasses.data && dbClasses.data.length > 0
      ? [...dbClasses.data]
          .sort((a, b) => classOrderWeight(a.name) - classOrderWeight(b.name))
          .map((c) => String(c.name))
      : ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

  const sectionSet = new Set<string>(["A", "B", "C", "D"]);
  for (const sec of dbSections.data ?? []) {
    if (sec.name && String(sec.name).trim().length <= 4) {
      sectionSet.add(String(sec.name).trim());
    }
  }
  const sectionOptions = Array.from(sectionSet).sort();

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
      qc.invalidateQueries({ queryKey: ["/api/teacher-assignments"] });
      toast({
        title: "Period & Teacher Assigned!",
        description: `Class ${formClass} (${
          formSection === "ALL" ? "All Sections" : `Section ${formSection}`
        }) · ${dayOfWeek === "ALL" ? "Mon–Sat" : dayOfWeek} · Period ${periodNo}`,
      });
    },
    onError: (err: Error) =>
      toast({ variant: "destructive", title: "Error", description: err.message }),
  });

  const deleteEntry = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/timetable/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/timetable"] });
      toast({ title: "Period removed" });
    },
  });

  const subjectMap = new Map((subjects.data ?? []).map((s) => [s.id, s]));
  const teacherList = (schoolUsers.data ?? []).filter((u) => u.role === "teacher");
  const teacherMap = new Map(teacherList.map((u) => [u.id, u.name]));

  // Live Active Periods right now
  const liveEntriesNow = (allTimetable.data ?? []).filter((t) => {
    if (t.dayOfWeek !== activeDayName) return false;
    const st = timeToMinutes(t.startTime);
    const et = timeToMinutes(t.endTime);
    return st !== -1 && et !== -1 && activeMinutes >= st && activeMinutes <= et;
  });

  // Filtered timetable entries for the weekly grid
  const filteredEntries = (allTimetable.data ?? []).filter((t) => {
    if (className !== "all" && t.className !== className) return false;
    if (
      section !== "all" &&
      t.section !== section &&
      t.section !== "ALL"
    ) {
      return false;
    }
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
              Live Classroom Tracker & Class Timetable
            </h1>
            <p className="text-sm text-slate-500">
              Real-time live view of which teacher is in which class teaching what subject right now
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

        {/* REAL-TIME LIVE RADAR FOR PRINCIPAL / ADMIN */}
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-white to-indigo-50/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                <span className="h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
                Live Classes Running Right Now ({activeDayName} ·{" "}
                {simTime ||
                  now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                )
              </CardTitle>
              <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">
                {liveEntriesNow.length} Active Class{liveEntriesNow.length === 1 ? "" : "es"} in Session
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
                  . Tip: Use the <b>&ldquo;Check Period 1 (08:00 - 08:45)&rdquo;</b> dropdown at the top-right to preview any period, or add a period below!
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
                        Class {entry.className} —{" "}
                        {entry.section === "ALL" ? "All Sections" : `Section ${entry.section}`}
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
                  All Teachers Live Status ({teacherList.length} Teachers)
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
                            🟢 Teaching Class {activeSlot.className}-
                            {activeSlot.section === "ALL" ? "All" : activeSlot.section} (
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

        {/* ADD / UPDATE PERIOD SCHEDULE (ALL DROPDOWNS) */}
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4" />
                Assign Class + Section + Subject + Teacher + Period Time (All Dropdowns)
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
                    2. Section (Dropdown)
                  </label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value)}
                  >
                    <option value="ALL">All Sections (A, B, C, D...)</option>
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
                    {(subjects.data ?? []).map((s) => (
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
                    disabled={createEntry.isPending || !subjectId}
                  >
                    {createEntry.isPending ? "Saving..." : "Save Period Slot"}
                  </Button>
                </div>
              </div>
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
                                Class {item.className}-
                                {item.section === "ALL" ? "All Sections" : item.section}
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
