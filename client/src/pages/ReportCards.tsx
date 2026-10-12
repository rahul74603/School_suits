import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import type { Exam, Student } from "@shared/schema";

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => null))?.message ?? "Report card request failed",
    );
  return response.json();
}

export default function ReportCards() {
  const { data: user } = useAuth();
  const [studentId, setStudentId] = useState<number>();
  const [examId, setExamId] = useState<number>();

  const students = useQuery<Student[]>({
    queryKey: ["/api/students"],
    queryFn: () => api("/api/students"),
  });
  const exams = useQuery<Exam[]>({
    queryKey: ["/api/exams"],
    queryFn: () => api("/api/exams"),
  });
  const report = useQuery<any>({
    queryKey: ["/api/report-cards", studentId, examId],
    queryFn: () => api(`/api/report-cards/student/${studentId}?examId=${examId}`),
    enabled: !!studentId && !!examId,
  });

  const activeStudentId = studentId ?? (students.data?.[0]?.id as number | undefined);
  const activeExamId = examId ?? (exams.data?.[0]?.id as number | undefined);
  const activeReport = useQuery<any>({
    queryKey: ["/api/report-cards", activeStudentId, activeExamId],
    queryFn: () =>
      api(`/api/report-cards/student/${activeStudentId}?examId=${activeExamId}`),
    enabled: !!activeStudentId && !!activeExamId,
  });

  const data = report.data ?? activeReport.data;
  const error = students.error ?? exams.error ?? report.error ?? activeReport.error;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-3xl font-bold">Student Report Cards (प्रगति पत्र)</h1>
            <p className="mt-1 text-slate-500">
              Select a student and published exam to view and print their report card.
            </p>
          </div>
          <Button onClick={() => window.print()} disabled={!data}>
            Print Report Card
          </Button>
        </div>
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700 print:hidden">
            {(error as Error).message}
          </div>
        )}
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Select Student & Exam (छात्र और परीक्षा चुनें)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {user?.role !== "student" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1. Select Student (छात्र चुनें) *
                </label>
                <select
                  className="h-10 w-full rounded border bg-background px-3 text-sm font-medium"
                  value={activeStudentId ?? ""}
                  onChange={(e) => setStudentId(Number(e.target.value))}
                >
                  {(students.data ?? []).map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.admissionNo}) — Class {student.class}-
                      {student.section}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                2. Select Exam (परीक्षा चुनें) *
              </label>
              <select
                className="h-10 w-full rounded border bg-background px-3 text-sm font-medium"
                value={activeExamId ?? ""}
                onChange={(e) => setExamId(Number(e.target.value))}
              >
                {(exams.data ?? []).map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name} ({exam.status})
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {data && (
          <Card>
            <CardHeader>
              <CardTitle>
                {data.student.name} — {data.exam.name}
              </CardTitle>
              <p className="text-sm text-slate-500">
                Admission No: {data.student.admissionNo} · Class {data.student.class}-
                {data.student.section}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded border bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 text-left">Subject</th>
                      <th className="p-3 text-left">Exam Date</th>
                      <th className="p-3 text-left">Marks Obtained</th>
                      <th className="p-3 text-left">Passing Marks</th>
                      <th className="p-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subjects.map((row: any) => (
                      <tr className="border-t" key={row.scheduleId}>
                        <td className="p-3 font-medium">
                          {row.subjectName} ({row.subjectCode})
                        </td>
                        <td className="p-3">{row.examDate}</td>
                        <td className="p-3 font-semibold">
                          {row.isAbsent ? "Absent" : `${row.marksObtained} / ${row.maxMarks}`}
                        </td>
                        <td className="p-3">{row.passingMarks}</td>
                        <td className="p-3 capitalize">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="rounded border p-3 bg-white">
                  <small className="text-slate-500">Total Marks</small>
                  <div className="font-bold">
                    {data.totals.obtainedMarks} / {data.totals.maxMarks}
                  </div>
                </div>
                <div className="rounded border p-3 bg-white">
                  <small className="text-slate-500">Percentage</small>
                  <div className="font-bold">{data.totals.percentage}%</div>
                </div>
                <div className="rounded border p-3 bg-white">
                  <small className="text-slate-500">Grade</small>
                  <div className="font-bold">{data.totals.grade}</div>
                </div>
                <div className="rounded border p-3 bg-white">
                  <small className="text-slate-500">Result</small>
                  <div className="font-bold">{data.totals.passed ? "PASS" : "FAIL"}</div>
                </div>
                <div className="rounded border p-3 bg-white">
                  <small className="text-slate-500">Attendance</small>
                  <div className="font-bold">
                    {data.attendance.present}/{data.attendance.total} (
                    {data.attendance.percentage}%)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
