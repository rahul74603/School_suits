import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useSchoolCatalog } from "@/hooks/use-school-catalog";
import type { Exam, ExamSchedule, Student } from "@shared/schema";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => null))?.message ?? "Result request failed",
    );
  return response.json();
}

export default function ExamResults() {
  const { data: user } = useAuth();
  const { subjectMap } = useSchoolCatalog();
  const qc = useQueryClient();
  const [examId, setExamId] = useState<number>();
  const [scheduleId, setScheduleId] = useState<number>();
  const [drafts, setDrafts] = useState<
    Record<number, { marksObtained: string; isAbsent: boolean; remarks: string }>
  >({});
  const [message, setMessage] = useState("");

  const exams = useQuery<Exam[]>({
    queryKey: ["/api/exams"],
    queryFn: () => api("/api/exams"),
  });
  const detail = useQuery<{ exam: Exam; schedules: ExamSchedule[] }>({
    queryKey: ["/api/exams", examId],
    queryFn: () => api(`/api/exams/${examId}`),
    enabled: !!examId,
  });
  const schedule = detail.data?.schedules.find((row) => row.id === scheduleId);
  const students = useQuery<Student[]>({
    queryKey: ["/api/students", schedule?.className, schedule?.section],
    queryFn: () =>
      api(`/api/students?class=${schedule?.className}&section=${schedule?.section}`),
    enabled: !!schedule,
  });
  const marks = useQuery<any[]>({
    queryKey: ["/api/exams", examId, "marks", scheduleId],
    queryFn: () => api(`/api/exams/${examId}/marks?examScheduleId=${scheduleId}`),
    enabled: !!examId && !!scheduleId,
  });

  useEffect(() => {
    const next: Record<
      number,
      { marksObtained: string; isAbsent: boolean; remarks: string }
    > = {};
    for (const mark of marks.data ?? []) {
      next[mark.studentId] = {
        marksObtained: String(mark.marksObtained ?? 0),
        isAbsent: Boolean(mark.isAbsent),
        remarks: mark.remarks ?? "",
      };
    }
    setDrafts(next);
  }, [marks.data]);

  const save = useMutation({
    mutationFn: () =>
      api(`/api/exams/${examId}/marks`, {
        method: "POST",
        body: JSON.stringify({
          examScheduleId: scheduleId,
          entries: (students.data ?? []).map((student) => ({
            studentId: student.id,
            marksObtained: drafts[student.id]?.isAbsent
              ? null
              : Number(drafts[student.id]?.marksObtained ?? 0),
            isAbsent: Boolean(drafts[student.id]?.isAbsent),
            remarks: drafts[student.id]?.remarks || null,
          })),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/exams", examId, "marks", scheduleId] });
      setMessage("Student marks saved as draft.");
    },
  });

  const publish = useMutation({
    mutationFn: (published: boolean) =>
      api(`/api/exams/${examId}/results/publish`, {
        method: "POST",
        body: JSON.stringify({ examScheduleId: scheduleId, published }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/exams", examId, "marks", scheduleId] });
      setMessage("Result publication status updated.");
    },
  });

  const error =
    exams.error ??
    detail.error ??
    students.error ??
    marks.error ??
    save.error ??
    publish.error;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Exam Marks Entry & Results</h1>
          <p className="mt-1 text-slate-500">
            Select an Exam and Subject Paper below to enter student marks and publish results.
          </p>
        </div>
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">
            {(error as Error).message}
          </div>
        )}
        {message && (
          <div className="rounded border border-green-200 bg-green-50 p-3 text-green-700">
            {message}
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Select Exam & Subject Paper (परीक्षा और विषय चुनें)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                1. Select Exam (परीक्षा चुनें) *
              </label>
              <select
                className="h-10 w-full rounded border bg-background px-3 text-sm font-medium"
                value={examId ?? ""}
                onChange={(e) => {
                  setExamId(Number(e.target.value) || undefined);
                  setScheduleId(undefined);
                }}
              >
                <option value="">-- Select Exam --</option>
                {(exams.data ?? []).map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name} ({exam.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                2. Select Class & Subject Paper (विषय चुनें) *
              </label>
              <select
                className="h-10 w-full rounded border bg-background px-3 text-sm font-medium"
                value={scheduleId ?? ""}
                onChange={(e) => setScheduleId(Number(e.target.value) || undefined)}
                disabled={!examId}
              >
                <option value="">-- Select Subject Paper --</option>
                {(detail.data?.schedules ?? []).map((row) => (
                  <option key={row.id} value={row.id}>
                    Class {row.className}-{row.section} ·{" "}
                    {subjectMap.get(row.subjectId)?.name ?? `Subject #${row.subjectId}`} (Max:{" "}
                    {row.maxMarks})
                  </option>
                ))}
              </select>
            </div>

            {(user?.role === "admin" || user?.role === "principal") && scheduleId && (
              <div className="flex gap-2">
                <Button className="h-10" onClick={() => publish.mutate(true)}>
                  Publish Results
                </Button>
                <Button
                  className="h-10"
                  variant="outline"
                  onClick={() => publish.mutate(false)}
                >
                  Unpublish
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {schedule && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>
                  Class {schedule.className}-{schedule.section} ·{" "}
                  {subjectMap.get(schedule.subjectId)?.name ?? `Subject #${schedule.subjectId}`}
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Maximum Marks (पूर्णांक): <b>{schedule.maxMarks}</b> · Passing Marks (उत्तीर्णांक):{" "}
                  <b>{schedule.passingMarks}</b>
                </p>
              </div>
              {user?.role !== "student" && (
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? "Saving..." : "Save Marks"}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded border bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 text-left">Student Name</th>
                      <th className="p-3 text-left">
                        Marks Obtained (प्राप्तांक out of {schedule.maxMarks})
                      </th>
                      <th className="p-3 text-left">Absent? (अनुपस्थित)</th>
                      <th className="p-3 text-left">Teacher Remarks (टिप्पणी)</th>
                      <th className="p-3 text-left">Result Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(students.data ?? []).map((student) => {
                      const existing = marks.data?.find(
                        (mark) => mark.studentId === student.id,
                      );
                      const draft = drafts[student.id] ?? {
                        marksObtained: "0",
                        isAbsent: false,
                        remarks: "",
                      };
                      return (
                        <tr className="border-t" key={student.id}>
                          <td className="p-3 font-medium">
                            {student.name}{" "}
                            <span className="text-xs text-slate-500">
                              ({student.admissionNo})
                            </span>
                          </td>
                          <td className="p-3">
                            {user?.role === "student" ? (
                              <b>{existing?.marksObtained ?? "-"}</b>
                            ) : (
                              <Input
                                type="number"
                                min="0"
                                max={schedule.maxMarks}
                                disabled={draft.isAbsent}
                                value={draft.marksObtained}
                                onChange={(e) =>
                                  setDrafts({
                                    ...drafts,
                                    [student.id]: { ...draft, marksObtained: e.target.value },
                                  })
                                }
                              />
                            )}
                          </td>
                          <td className="p-3">
                            {user?.role === "student" ? (
                              existing?.isAbsent ? (
                                "Yes"
                              ) : (
                                "No"
                              )
                            ) : (
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={draft.isAbsent}
                                onChange={(e) =>
                                  setDrafts({
                                    ...drafts,
                                    [student.id]: { ...draft, isAbsent: e.target.checked },
                                  })
                                }
                              />
                            )}
                          </td>
                          <td className="p-3">
                            {user?.role === "student" ? (
                              existing?.remarks ?? "-"
                            ) : (
                              <Input
                                placeholder="e.g., Good performance"
                                value={draft.remarks}
                                onChange={(e) =>
                                  setDrafts({
                                    ...drafts,
                                    [student.id]: { ...draft, remarks: e.target.value },
                                  })
                                }
                              />
                            )}
                          </td>
                          <td className="p-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                                existing?.status === "published"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {existing?.status ?? "draft"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
