import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, Printer, Trash2 } from "lucide-react";
import type { Subject, TimetableEntry } from "@shared/schema";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export default function Timetable() {
  const { data: user } = useAuth();
  const qc = useQueryClient();
  const isManager = ["admin", "principal"].includes(user?.role ?? "");
  const isStudent = user?.role === "student";

  const [className, setClassName] = useState("1");
  const [section, setSection] = useState("A");
  const [dayOfWeek, setDayOfWeek] = useState<(typeof days)[number]>("Monday");
  const [periodNo, setPeriodNo] = useState("1");
  const [startTime, setStartTime] = useState("08:30");
  const [endTime, setEndTime] = useState("09:15");
  const [subjectId, setSubjectId] = useState("");
  const [roomNo, setRoomNo] = useState("");
  const [message, setMessage] = useState("");

  const subjects = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    queryFn: async () => (await fetch("/api/subjects", { credentials: "include" })).json(),
    enabled: !!user && !isStudent,
  });

  const entries = useQuery<TimetableEntry[]>({
    queryKey: ["/api/timetable", className, section],
    queryFn: async () => {
      const qs = isStudent
        ? ""
        : `?class=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}`;
      return (await fetch(`/api/timetable${qs}`, { credentials: "include" })).json();
    },
    enabled: !!user && (isStudent || (!!className && !!section)),
  });

  const subjectById = new Map((subjects.data ?? []).map((s) => [s.id, s.name]));

  const addSlot = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/timetable", {
        className,
        section,
        dayOfWeek,
        periodNo: Number(periodNo),
        startTime,
        endTime,
        subjectId: Number(subjectId),
        roomNo: roomNo || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/timetable"] });
      setMessage("Period added to timetable.");
    },
  });

  const removeSlot = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/timetable/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/timetable"] }),
  });

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Class Timetable & Routine</h1>
            <p className="text-slate-500 mt-1">
              Weekly period-wise schedule for classes, subjects, and rooms.
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {!isStudent && (
              <>
                <Input
                  className="w-28 bg-white"
                  placeholder="Class"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                />
                <Input
                  className="w-28 bg-white"
                  placeholder="Section"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                />
              </>
            )}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" /> Print Routine
            </Button>
          </div>
        </div>

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 print:hidden">
            {message}
          </div>
        )}

        {isManager && (
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle>Add Period Slot (Class {className}-{section})</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-6">
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value as (typeof days)[number])}
              >
                {days.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min="1"
                max="12"
                placeholder="Period #"
                value={periodNo}
                onChange={(e) => setPeriodNo(e.target.value)}
              />
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="">Select Subject</option>
                {(subjects.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Input
                  placeholder="Room"
                  value={roomNo}
                  onChange={(e) => setRoomNo(e.target.value)}
                />
                <Button
                  onClick={() => addSlot.mutate()}
                  disabled={addSlot.isPending || !subjectId || !className || !section}
                >
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {days.map((day) => {
            const daySlots = (entries.data ?? [])
              .filter((e) => e.dayOfWeek === day)
              .sort((a, b) => a.periodNo - b.periodNo);
            return (
              <Card key={day}>
                <CardHeader className="pb-3 bg-slate-100/70 border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                    {day}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2.5">
                  {daySlots.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      No periods scheduled
                    </p>
                  ) : (
                    daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between rounded-lg border bg-white p-3 text-sm"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            Period {slot.periodNo}:{" "}
                            {subjectById.get(slot.subjectId) || `Subject #${slot.subjectId}`}
                          </div>
                          <div className="text-xs text-slate-500">
                            {slot.startTime} – {slot.endTime}
                            {slot.roomNo ? ` · Room ${slot.roomNo}` : ""}
                          </div>
                        </div>
                        {isManager && (
                          <button
                            type="button"
                            onClick={() => removeSlot.mutate(slot.id)}
                            className="text-red-500 hover:text-red-700 print:hidden"
                            title="Remove period"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))
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
