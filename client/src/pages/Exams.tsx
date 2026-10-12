import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useSchoolCatalog } from "@/hooks/use-school-catalog";
import type { Exam, ExamSchedule } from "@shared/schema";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => null))?.message ?? "Exam request failed",
    );
  return response.status === 204 ? (undefined as T) : response.json();
}

type Detail = {
  exam: Exam;
  scopes: { className: string; section: string }[];
  schedules: ExamSchedule[];
};

const EXAM_TYPES = [
  { value: "unit-test", label: "Unit Test / Periodic Test" },
  { value: "quarterly", label: "Quarterly Exam (Timahi)" },
  { value: "half-yearly", label: "Half-Yearly Exam (Ardhvarshik)" },
  { value: "pre-board", label: "Pre-Board Exam" },
  { value: "annual", label: "Annual / Final Exam (Varshik)" },
  { value: "general", label: "General Exam" },
];

export default function Exams() {
  const { data: user } = useAuth();
  const { classOptions, sectionOptions, subjects, subjectMap } = useSchoolCatalog();
  const queryClient = useQueryClient();
  const manager = user?.role === "admin" || user?.role === "principal";
  const [selectedId, setSelectedId] = useState<number>();
  const [name, setName] = useState("");
  const [examType, setExamType] = useState("half-yearly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [passingMarks, setPassingMarks] = useState("33");

  const exams = useQuery<Exam[]>({
    queryKey: ["/api/exams"],
    queryFn: () => api("/api/exams"),
  });
  const detail = useQuery<Detail>({
    queryKey: ["/api/exams", selectedId],
    queryFn: () => api(`/api/exams/${selectedId}`),
    enabled: !!selectedId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
    if (selectedId) queryClient.invalidateQueries({ queryKey: ["/api/exams", selectedId] });
  };

  const create = useMutation({
    mutationFn: () => {
      const targetSections = section === "ALL" ? sectionOptions : [section];
      return api("/api/exams", {
        method: "POST",
        body: JSON.stringify({
          name,
          examType,
          startDate,
          endDate,
          scopes: targetSections.map((sec) => ({ className, section: sec })),
        }),
      });
    },
    onSuccess: () => {
      invalidate();
      setName("");
    },
  });

  const setStatus = useMutation({
    mutationFn: (status: string) =>
      api(`/api/exams/${selectedId}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: invalidate,
  });

  const addSchedule = useMutation({
    mutationFn: () =>
      api(`/api/exams/${selectedId}/schedules`, {
        method: "POST",
        body: JSON.stringify({
          subjectId: Number(subjectId),
          className,
          section,
          examDate,
          maxMarks: Number(maxMarks),
          passingMarks: Number(passingMarks),
        }),
      }),
    onSuccess: invalidate,
  });

  const error =
    exams.error ?? detail.error ?? create.error ?? setStatus.error ?? addSchedule.error;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Exams & Schedules</h1>
          <p className="mt-1 text-slate-500">
            Create exams and subject schedules using connected Class, Section, and Subject dropdowns.
          </p>
        </div>
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">
            {(error as Error).message}
          </div>
        )}
        {manager && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Exam (Connected Dropdowns)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <Input
                placeholder="Exam Name (e.g., Half-Yearly Exam 2026)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm font-medium"
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
              >
                {EXAM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm font-medium"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
              >
                <option value="">Select Class...</option>
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
                <option value="">Select Section...</option>
                <option value="ALL">All Sections ({sectionOptions.join(", ")})</option>
                {sectionOptions.map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => create.mutate()}
                disabled={
                  create.isPending || !name || !startDate || !endDate || !className || !section
                }
              >
                {create.isPending ? "Creating..." : "Create Exam"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{manager ? "Exam Management" : "Available Exams"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {exams.isLoading ? (
                <p>Loading exams...</p>
              ) : exams.data?.length ? (
                exams.data.map((exam) => (
                  <button
                    key={exam.id}
                    className={`rounded-lg border p-4 text-left ${
                      selectedId === exam.id ? "border-primary bg-primary/5" : "bg-white"
                    }`}
                    onClick={() => setSelectedId(exam.id)}
                  >
                    <div className="font-semibold">{exam.name}</div>
                    <div className="text-sm text-slate-500">
                      {exam.examType} · {exam.startDate} to {exam.endDate}
                    </div>
                    <span className="mt-2 inline-block rounded bg-slate-100 px-2 py-1 text-xs capitalize">
                      {exam.status}
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-slate-500">No exams are visible for this account.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {detail.data && (
          <Card>
            <CardHeader>
              <CardTitle>{detail.data.exam.name} — Subject Schedule</CardTitle>
              <p className="text-sm text-slate-500">
                Authorized Classes:{" "}
                {detail.data.scopes.map((s) => `Class ${s.className}-${s.section}`).join(", ")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {manager && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      setStatus.mutate(
                        detail.data!.exam.status === "draft" ? "published" : "completed",
                      )
                    }
                    disabled={setStatus.isPending}
                  >
                    {detail.data.exam.status === "draft"
                      ? "Publish Exam"
                      : detail.data.exam.status === "published"
                        ? "Mark Completed"
                        : "Status Locked"}
                  </Button>
                  {detail.data.exam.status === "published" && (
                    <Button variant="outline" onClick={() => setStatus.mutate("draft")}>
                      Unpublish (Back to Draft)
                    </Button>
                  )}
                </div>
              )}

              {manager && detail.data.exam.status === "draft" && (
                <div className="grid gap-2 rounded border p-3 md:grid-cols-6 bg-slate-50">
                  <select
                    className="h-10 rounded border bg-white px-2 text-sm"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                  >
                    <option value="">Select Subject...</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-10 rounded border bg-white px-2 text-sm"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                  >
                    <option value="">Select Class...</option>
                    {Array.from(new Set(detail.data.scopes.map((s) => s.className))).map((c) => (
                      <option key={c} value={c}>
                        Class {c}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-10 rounded border bg-white px-2 text-sm"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                  >
                    <option value="">Select Section...</option>
                    {Array.from(new Set(detail.data.scopes.map((s) => s.section))).map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="date"
                    className="bg-white"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      type="number"
                      className="bg-white"
                      placeholder="Max"
                      value={maxMarks}
                      onChange={(e) => setMaxMarks(e.target.value)}
                    />
                    <Input
                      type="number"
                      className="bg-white"
                      placeholder="Pass"
                      value={passingMarks}
                      onChange={(e) => setPassingMarks(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() => addSchedule.mutate()}
                    disabled={
                      addSchedule.isPending ||
                      !subjectId ||
                      !examDate ||
                      !className ||
                      !section
                    }
                  >
                    Add Subject Paper
                  </Button>
                </div>
              )}

              <div className="overflow-x-auto rounded border bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 text-left">Class & Section</th>
                      <th className="p-3 text-left">Subject</th>
                      <th className="p-3 text-left">Exam Date</th>
                      <th className="p-3 text-left">Passing / Max Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.data.schedules.map((schedule) => (
                      <tr className="border-t" key={schedule.id}>
                        <td className="p-3 font-medium">
                          Class {schedule.className} - Section {schedule.section}
                        </td>
                        <td className="p-3 font-semibold text-indigo-700">
                          {subjectMap.get(schedule.subjectId)?.name ??
                            `Subject #${schedule.subjectId}`}
                        </td>
                        <td className="p-3">{schedule.examDate}</td>
                        <td className="p-3">
                          {schedule.passingMarks} / {schedule.maxMarks}
                        </td>
                      </tr>
                    ))}
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
