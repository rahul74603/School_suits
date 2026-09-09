import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import type { AttendanceRecord, Student, Subject, TeacherClassAssignment } from "@shared/schema";

const statuses = ["present", "absent", "late", "leave"] as const;
type Status = typeof statuses[number];
type AssignmentResponse = { subjects: { subjectId: number }[]; classes: TeacherClassAssignment[] };
type Summary = { total: number; present: number; absent: number; late: number; leave: number; percentage: number };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Unable to load attendance");
  return response.json();
}

async function sendJson<T>(url: string, body: unknown, method = "POST"): Promise<T> {
  const response = await fetch(url, { method, credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Unable to save attendance");
  return response.json();
}

function queryString(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => value && search.set(key, value));
  const value = search.toString();
  return value ? `?${value}` : "";
}

export default function Attendance() {
  const { data: user } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [statusesByStudent, setStatusesByStudent] = useState<Record<number, Status>>({});
  const isStudent = user?.role === "student";
  const canMark = user?.role === "admin" || user?.role === "principal" || user?.role === "teacher";
  const isManager = user?.role === "admin" || user?.role === "principal";

  const assignments = useQuery<AssignmentResponse>({ queryKey: ["/api/teacher-assignments"], queryFn: () => getJson("/api/teacher-assignments"), enabled: user?.role === "teacher" });
  const subjects = useQuery<Subject[]>({ queryKey: ["/api/subjects"], queryFn: () => getJson("/api/subjects"), enabled: canMark && user?.role !== "student" });
  const classOptions = useMemo(() => assignments.data?.classes ?? [], [assignments.data]);
  const selectedSubject = subjectId || undefined;
  const students = useQuery<Student[]>({
    queryKey: ["/api/students", className, section],
    queryFn: () => getJson(`/api/students${queryString({ class: className || undefined, section: section || undefined })}`),
    enabled: canMark && !!className && !!section,
  });
  const attendance = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance", from, to, className, section, selectedSubject],
    queryFn: () => getJson(`/api/attendance${queryString({ from, to, class: isManager ? className || undefined : undefined, section: isManager ? section || undefined : undefined, subjectId: selectedSubject })}`),
    enabled: !!user,
  });
  const summary = useQuery<Summary>({
    queryKey: ["/api/attendance/summary", from, to, className, section, selectedSubject],
    queryFn: () => getJson(`/api/attendance/summary${queryString({ from, to, class: isManager ? className || undefined : undefined, section: isManager ? section || undefined : undefined, subjectId: selectedSubject })}`),
    enabled: !!user,
  });
  const mark = useMutation({
    mutationFn: () => sendJson<AttendanceRecord[]>("/api/attendance/bulk", {
      className, section, attendanceDate: date, subjectId: selectedSubject ? Number(selectedSubject) : null,
      records: (students.data ?? []).map((student) => ({ studentId: student.id, status: statusesByStudent[student.id] ?? "present" })),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      setStatusMessage("Attendance saved successfully.");
    },
  });
  const [statusMessage, setStatusMessage] = useState("");
  const error = assignments.error ?? subjects.error ?? students.error ?? attendance.error ?? summary.error ?? mark.error;
  const recordsByStudent = new Map((attendance.data ?? []).filter((record) => record.attendanceDate === date && record.className === className && record.section === section).map((record) => [record.studentId, record]));

  function setAll(status: Status) {
    setStatusesByStudent(Object.fromEntries((students.data ?? []).map((student) => [student.id, status])));
  }

  return <div className="flex min-h-screen bg-slate-50"><Sidebar /><main className="flex-1 ml-64 p-8 space-y-6">
    <div><h1 className="text-3xl font-bold text-slate-900">Attendance</h1><p className="text-slate-500 mt-1">Secure school and session scoped attendance records.</p></div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{(error as Error).message}</div>}
    {statusMessage && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">{statusMessage}</div>}
    {canMark && <Card><CardHeader><CardTitle>{isManager ? "Attendance management" : "Mark assigned class attendance"}</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {isManager ? <Input placeholder="Class" value={className} onChange={(event) => setClassName(event.target.value)} /> : <select className="h-10 rounded-md border bg-background px-3" value={className} onChange={(event) => { setClassName(event.target.value); setSection(""); }}><option value="">Assigned class</option>{classOptions.map((item) => <option key={`${item.className}-${item.section}`} value={item.className}>{item.className}</option>)}</select>}
        {isManager ? <Input placeholder="Section" value={section} onChange={(event) => setSection(event.target.value)} /> : <select className="h-10 rounded-md border bg-background px-3" value={section} onChange={(event) => setSection(event.target.value)}><option value="">Assigned section</option>{classOptions.filter((item) => item.className === className).map((item) => <option key={item.section} value={item.section}>{item.section}</option>)}</select>}
        <select className="h-10 rounded-md border bg-background px-3" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">General attendance</option>{(subjects.data ?? []).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}{subject.code ? ` (${subject.code})` : ""}</option>)}</select>
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
      {!!className && !!section && <><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setAll("present")}>All present</Button><Button type="button" variant="outline" onClick={() => setAll("absent")}>All absent</Button><Button type="button" variant="outline" onClick={() => setAll("late")}>All late</Button><Button type="button" variant="outline" onClick={() => setAll("leave")}>All leave</Button><Button className="ml-auto" onClick={() => mark.mutate()} disabled={mark.isPending || !students.data?.length}>{mark.isPending ? "Saving..." : "Save attendance"}</Button></div>
      <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-3 text-left">Student</th><th className="p-3 text-left">Roll No</th><th className="p-3 text-left">Status</th></tr></thead><tbody>{students.isLoading ? <tr><td className="p-3" colSpan={3}>Loading authorized students...</td></tr> : (students.data ?? []).map((student) => <tr key={student.id} className="border-t"><td className="p-3">{student.name}</td><td className="p-3">{student.rollNo ?? "—"}</td><td className="p-3"><select className="rounded border px-2 py-1" value={statusesByStudent[student.id] ?? recordsByStudent.get(student.id)?.status ?? "present"} onChange={(event) => setStatusesByStudent((current) => ({ ...current, [student.id]: event.target.value as Status }))}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div></>}
    </CardContent></Card>}
    <Card><CardHeader><CardTitle>{isStudent ? "My attendance history" : "Attendance history and summary"}</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap gap-3"><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />{isManager && <><Input placeholder="Class filter" value={className} onChange={(event) => setClassName(event.target.value)} /><Input placeholder="Section filter" value={section} onChange={(event) => setSection(event.target.value)} /></>}</div>
      {summary.data && <div className="grid grid-cols-2 gap-3 md:grid-cols-6">{([['Total', summary.data.total], ['Present', summary.data.present], ['Absent', summary.data.absent], ['Late', summary.data.late], ['Leave', summary.data.leave], ['Percentage', `${summary.data.percentage}%`]] as const).map(([label, value]) => <div key={label} className="rounded-lg bg-slate-100 p-3"><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-semibold">{value}</div></div>)}</div>}
      <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Student</th><th className="p-3 text-left">Class</th><th className="p-3 text-left">Subject</th><th className="p-3 text-left">Status</th></tr></thead><tbody>{attendance.isLoading ? <tr><td className="p-3" colSpan={5}>Loading attendance...</td></tr> : (attendance.data ?? []).map((record) => <tr className="border-t" key={record.id}><td className="p-3">{record.attendanceDate}</td><td className="p-3">{record.studentId}</td><td className="p-3">{record.className} / {record.section}</td><td className="p-3">{record.subjectId ?? "General"}</td><td className="p-3 capitalize">{record.status}</td></tr>)}</tbody></table></div>
    </CardContent></Card>
  </main></div>;
}
