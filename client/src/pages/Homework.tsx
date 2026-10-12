import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useSchoolCatalog } from "@/hooks/use-school-catalog";
import { apiRequest } from "@/lib/queryClient";
import { BookOpen, Trash2 } from "lucide-react";
import type { HomeworkAssignment } from "@shared/schema";

export default function Homework() {
  const { data: user } = useAuth();
  const { classOptions, sectionOptions, subjects, subjectMap } = useSchoolCatalog();
  const qc = useQueryClient();
  const canAssign = ["admin", "principal", "teacher"].includes(user?.role ?? "");
  const isStudent = user?.role === "student";
  const today = new Date().toISOString().slice(0, 10);

  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedDate, setAssignedDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [filterClass, setFilterClass] = useState("all");
  const [filterSection, setFilterSection] = useState("all");
  const [message, setMessage] = useState("");

  const homework = useQuery<HomeworkAssignment[]>({
    queryKey: ["/api/homework", filterClass, filterSection],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterClass && filterClass !== "all") params.set("class", filterClass);
      if (filterSection && filterSection !== "all") params.set("section", filterSection);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/homework${qs}`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!user,
  });

  const createHomework = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/homework", {
        className,
        section,
        subjectId: Number(subjectId),
        title,
        description,
        assignedDate,
        dueDate,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/homework"] });
      setTitle("");
      setDescription("");
      setMessage("Homework assignment posted to class diary.");
    },
  });

  const removeHomework = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/homework/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/homework"] }),
  });

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Homework & Daily Diary</h1>
            <p className="text-slate-500 mt-1">
              {isStudent
                ? "Daily homework and classwork assigned to your class."
                : "Select Class, Section, and Subject from connected dropdowns to assign daily homework."}
            </p>
          </div>
          {!isStudent && (
            <div className="flex gap-2">
              <select
                className="h-10 rounded-md border bg-white px-3 text-sm font-medium"
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
              >
                <option value="all">Filter: All Classes</option>
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    Class {c}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border bg-white px-3 text-sm font-medium"
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
              >
                <option value="all">Filter: All Sections</option>
                {sectionOptions.map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {message}
          </div>
        )}

        {canAssign && (
          <Card>
            <CardHeader>
              <CardTitle>Assign New Homework (Connected Class, Section & Subject Dropdowns)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Class (Dropdown)
                  </label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
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
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Section (Dropdown)
                  </label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                  >
                    <option value="">Select Section...</option>
                    {sectionOptions.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Subject (Dropdown)
                  </label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                  >
                    <option value="">Select Subject...</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.code ? `(${s.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Assigned Date
                  </label>
                  <Input
                    type="date"
                    value={assignedDate}
                    onChange={(e) => setAssignedDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Submission Due Date
                  </label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <Input
                placeholder="Topic / Homework Title (e.g., Chapter 4 Fractions Exercise 4.2)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <textarea
                className="w-full min-h-[90px] rounded-md border p-3 text-sm"
                placeholder="Detailed instructions, questions, or page numbers..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <Button
                onClick={() => createHomework.mutate()}
                disabled={
                  createHomework.isPending ||
                  !className.trim() ||
                  !section.trim() ||
                  !subjectId ||
                  !title.trim() ||
                  !description.trim()
                }
              >
                {createHomework.isPending ? "Saving..." : "Assign Homework"}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {homework.isLoading ? (
            <Card className="md:col-span-2">
              <CardContent className="p-6 text-slate-500">Loading homework diary...</CardContent>
            </Card>
          ) : !homework.data?.length ? (
            <Card className="md:col-span-2">
              <CardContent className="p-8 text-center text-slate-500">
                <BookOpen className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                No homework assignments found.
              </CardContent>
            </Card>
          ) : (
            homework.data.map((hw) => (
              <Card key={hw.id} className="bg-white">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                          Class {hw.className}-{hw.section}
                        </span>
                        <span className="rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          {subjectMap.get(hw.subjectId)?.name || `Subject #${hw.subjectId}`}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mt-2">{hw.title}</h3>
                    </div>
                    {canAssign && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => removeHomework.mutate(hw.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{hw.description}</p>
                  <div className="flex items-center justify-between pt-2 border-t text-xs text-slate-500">
                    <span>Assigned: {hw.assignedDate}</span>
                    <span className="font-semibold text-amber-700">Due Date: {hw.dueDate}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
