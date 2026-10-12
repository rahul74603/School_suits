import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useStudents, usePromoteStudents } from "@/hooks/use-students";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Search, Plus, Printer, ArrowUpRight, Bus, BookOpen } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { StudentIdCard } from "@/components/StudentIdCard";
import { type Student } from "@shared/schema";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSchool, useActiveSession } from "@/hooks/use-core";
import { useToast } from "@/hooks/use-toast";
import { QueryError } from "@/components/QueryState";

const DEFAULT_STREAMS = [
  {
    id: -1,
    code: "PCM",
    name: "Science — Mathematics Group (PCM)",
    compulsorySubjects: "Hindi, English",
    coreSubjects: "Physics, Chemistry, Mathematics",
    electiveOptions: "Computer Science, Informatics Practices, Physical Education, Sanskrit",
    maxElectives: 1,
  },
  {
    id: -2,
    code: "PCB",
    name: "Science — Biology Group (PCB)",
    compulsorySubjects: "Hindi, English",
    coreSubjects: "Physics, Chemistry, Biology",
    electiveOptions: "Informatics Practices, Physical Education, Biotechnology, Mathematics (Additional)",
    maxElectives: 1,
  },
  {
    id: -3,
    code: "PCMB",
    name: "Science — Maths + Biology Combined (PCMB)",
    compulsorySubjects: "Hindi, English",
    coreSubjects: "Physics, Chemistry, Mathematics, Biology",
    electiveOptions: "Physical Education, Computer Science",
    maxElectives: 1,
  },
  {
    id: -4,
    code: "COMMERCE",
    name: "Commerce Group",
    compulsorySubjects: "Hindi, English",
    coreSubjects: "Book Keeping & Accountancy, Business Studies",
    electiveOptions: "Economics, Informatics Practices, Business Mathematics, Industrial Organisation, Physical Education",
    maxElectives: 2,
  },
  {
    id: -5,
    code: "ARTS",
    name: "Arts / Humanities Group",
    compulsorySubjects: "Hindi, English",
    coreSubjects: "History, Political Science",
    electiveOptions: "Geography, Economics, Sociology, Psychology, Sanskrit, Home Science, Drawing & Painting",
    maxElectives: 2,
  },
  {
    id: -6,
    code: "AGRICULTURE",
    name: "Agriculture Group",
    compulsorySubjects: "Hindi, English",
    coreSubjects: "Elements of Science & Maths for Agriculture, Crop Production & Horticulture, Animal Husbandry & Poultry Farming",
    electiveOptions: "Physical Education, Computer Basics",
    maxElectives: 1,
  },
];

export default function Students() {
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [targetClass, setTargetClass] = useState("");
  const { data: students, isLoading, isError, error, refetch } = useStudents({
    search,
    class: selectedClass,
    section: selectedSection,
  });
  const promote = usePromoteStudents();
  const { toast } = useToast();
  const auth = useAuth();
  const isManager = ["admin", "principal"].includes(auth.data?.role ?? "");
  const canAdmit = ["admin", "principal", "staff", "teacher"].includes(auth.data?.role ?? "");
  const schoolQuery = useSchool(auth.data?.schoolId);
  const sessionQuery = useActiveSession();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [transportStudent, setTransportStudent] = useState<Student | null>(null);
  const [transportId, setTransportId] = useState<string>("");

  // Stream & Electives modal state
  const [streamStudent, setStreamStudent] = useState<Student | null>(null);
  const [streamCode, setStreamCode] = useState<string>("PCM");
  const [selectedElectives, setSelectedElectives] = useState<string[]>([]);

  const queryClient = useQueryClient();

  type TransportRoute = {
    id: number;
    routeName: string;
    amount: number;
    isActive: boolean;
  };

  const transportRoutes = useQuery<TransportRoute[]>({
    queryKey: ["/api/transport-routes"],
    queryFn: async () => {
      const response = await fetch("/api/transport-routes", { credentials: "include" });
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!auth.data,
  });

  const streamsQuery = useQuery<any[]>({
    queryKey: ["/api/academic-streams"],
    queryFn: async () => {
      const response = await fetch("/api/academic-streams", { credentials: "include" });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!auth.data,
  });

  const availableStreams =
    streamsQuery.data && streamsQuery.data.length > 0 ? streamsQuery.data : DEFAULT_STREAMS;

  const activeStreamObj = availableStreams.find((s) => s.code === streamCode) ?? availableStreams[0];

  const assignTransport = useMutation({
    mutationFn: ({ studentId, routeId }: { studentId: number; routeId: number | null }) =>
      apiRequest("PUT", `/api/students/${studentId}/transport`, { transportId: routeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setTransportStudent(null);
    },
  });

  const assignStream = useMutation({
    mutationFn: ({
      studentId,
      stream,
      streamId,
      electedSubjects,
    }: {
      studentId: number;
      stream: string | null;
      streamId: number | null;
      electedSubjects: string | null;
    }) =>
      apiRequest("PUT", `/api/students/${studentId}/stream`, {
        stream,
        streamId,
        electedSubjects,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({ title: "Student stream & elected subjects saved" });
      setStreamStudent(null);
    },
  });

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  function toggleStudent(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function openStreamModal(student: Student) {
    setStreamStudent(student);
    const existingCode = student.stream?.split(" - ")[0]?.trim();
    const matched = availableStreams.find((s) => s.code === existingCode) ?? availableStreams[0];
    if (matched) {
      setStreamCode(matched.code);
      const existingSubjs = (student.electedSubjects || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const electivePool = (matched.electiveOptions || "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      setSelectedElectives(existingSubjs.filter((s) => electivePool.includes(s)));
    }
  }

  function handlePromote() {
    if (!selectedIds.length || !targetClass.trim()) return;
    promote.mutate(
      { studentIds: selectedIds, targetClass: targetClass.trim() },
      {
        onSuccess: () => {
          toast({
            title: "Students promoted",
            description: `${selectedIds.length} student(s) promoted to Class ${targetClass}.`,
          });
          setSelectedIds([]);
          setTargetClass("");
        },
        onError: (err) =>
          toast({
            variant: "destructive",
            title: "Promotion failed",
            description: err.message,
          }),
      },
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Students Directory</h1>
            <p className="text-slate-500 mt-1">
              Manage student records, Class 11–12 subject streams, promotions, and ID cards
            </p>
          </div>
          {canAdmit && (
            <Link href="/admissions">
              <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4 mr-2" />
                New Admission
              </Button>
            </Link>
          )}
        </div>

        {/* Filters & Batch Promotion */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-border mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name, roll no, or admission no..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 rounded-lg border border-input bg-background"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="all">All Classes</option>
              {[
                "Nursery",
                "LKG",
                "UKG",
                "1",
                "2",
                "3",
                "4",
                "5",
                "6",
                "7",
                "8",
                "9",
                "10",
                "11",
                "12",
              ].map((cls) => (
                <option key={cls} value={cls}>
                  Class {cls}
                </option>
              ))}
            </select>
            <select
              className="px-4 py-2 rounded-lg border border-input bg-background"
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
            >
              <option value="all">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
              <option value="C">Section C</option>
              <option value="D">Section D</option>
            </select>
          </div>

          {isManager && selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t">
              <span className="text-sm font-medium text-indigo-700">
                {selectedIds.length} student(s) selected for promotion:
              </span>
              <Input
                className="w-44"
                placeholder="Target Class (e.g., 11)"
                value={targetClass}
                onChange={(e) => setTargetClass(e.target.value)}
              />
              <Button
                size="sm"
                onClick={handlePromote}
                disabled={promote.isPending || !targetClass.trim()}
              >
                <ArrowUpRight className="w-4 h-4 mr-1" />
                {promote.isPending ? "Promoting..." : "Promote Selected"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                Clear Selection
              </Button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                {isManager && (
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={
                        !!students?.length && selectedIds.length === students.length
                      }
                      onChange={(e) =>
                        setSelectedIds(
                          e.target.checked ? (students ?? []).map((s) => s.id) : [],
                        )
                      }
                    />
                  </TableHead>
                )}
                <TableHead>Admission No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Stream & Elected Subjects (11th–12th)</TableHead>
                <TableHead>Father&apos;s Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Transport</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isError ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <QueryError
                      message={
                        error instanceof Error ? error.message : "Unable to load students."
                      }
                      onRetry={() => refetch()}
                    />
                  </TableCell>
                </TableRow>
              ) : isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Loading students...
                  </TableCell>
                </TableRow>
              ) : students?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No students found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                students?.map((student) => {
                  const is11Or12 = student.class === "11" || student.class === "12";
                  return (
                    <TableRow key={student.id} className="hover:bg-slate-50/50">
                      {isManager && (
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(student.id)}
                            onChange={() => toggleStudent(student.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{student.admissionNo}</TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{student.name}</div>
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-semibold">
                          {student.class}-{student.section}
                        </span>
                      </TableCell>
                      <TableCell>
                        {is11Or12 || student.stream ? (
                          <div className="space-y-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
                              onClick={() => openStreamModal(student)}
                            >
                              <BookOpen className="w-3.5 h-3.5 mr-1" />
                              {student.stream ? student.stream.split(" - ")[0] : "Select Stream"}
                            </Button>
                            {student.electedSubjects && (
                              <div className="text-[11px] text-slate-500 max-w-xs truncate" title={student.electedSubjects}>
                                {student.electedSubjects}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Common (Up to 10th)</span>
                        )}
                      </TableCell>
                      <TableCell>{student.fatherName}</TableCell>
                      <TableCell>{student.contact}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-600"
                          onClick={() => {
                            setTransportStudent(student);
                            setTransportId(student.transportId ? String(student.transportId) : "");
                          }}
                        >
                          <Bus className="w-4 h-4 mr-1" />
                          {student.transportId
                            ? (transportRoutes.data?.find((r) => r.id === student.transportId)
                                ?.routeName ?? `Route #${student.transportId}`)
                            : "No Transport"}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Link href={`/students/${student.id}`}>
                          <Button variant="ghost" size="sm">
                            View Profile
                          </Button>
                        </Link>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedStudent(student)}
                              className="text-slate-600"
                            >
                              <Printer className="w-4 h-4 mr-2" />
                              ID Card
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-[400px]">
                            <DialogHeader>
                              <DialogTitle>Student ID Card</DialogTitle>
                            </DialogHeader>
                            <div className="flex flex-col items-center">
                              <div ref={printRef} className="my-4">
                                {selectedStudent && schoolQuery.data && (
                                  <StudentIdCard
                                    student={selectedStudent}
                                    school={schoolQuery.data}
                                    sessionName={sessionQuery.data?.name}
                                  />
                                )}
                              </div>
                              <Button onClick={handlePrint} className="w-full mt-4">
                                <Printer className="w-4 h-4 mr-2" />
                                Print ID Card
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Stream & Elective Subjects Dialog */}
        <Dialog open={!!streamStudent} onOpenChange={(open) => !open && setStreamStudent(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Class {streamStudent?.class} Stream & Elective Subjects
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                {streamStudent?.name} · Class {streamStudent?.class}-{streamStudent?.section}
              </p>
              <div>
                <label className="text-sm font-medium">Select Stream / Faculty (संकाय)</label>
                <select
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={streamCode}
                  onChange={(e) => {
                    setStreamCode(e.target.value);
                    setSelectedElectives([]);
                  }}
                >
                  {availableStreams.map((st: any) => (
                    <option key={st.code} value={st.code}>
                      {st.code} — {st.name}
                    </option>
                  ))}
                </select>
              </div>

              {activeStreamObj && (
                <div className="rounded-lg border bg-slate-50 p-3 space-y-3 text-xs">
                  <div>
                    <b className="text-slate-700 block mb-1">Compulsory Languages:</b>
                    <div className="flex flex-wrap gap-1.5">
                      {(activeStreamObj.compulsorySubjects || "")
                        .split(",")
                        .map((s: string) => s.trim())
                        .filter(Boolean)
                        .map((s: string) => (
                          <span key={s} className="rounded bg-white border px-2 py-0.5">
                            ✓ {s}
                          </span>
                        ))}
                    </div>
                  </div>
                  <div>
                    <b className="text-slate-700 block mb-1">Core Stream Subjects:</b>
                    <div className="flex flex-wrap gap-1.5">
                      {(activeStreamObj.coreSubjects || "")
                        .split(",")
                        .map((s: string) => s.trim())
                        .filter(Boolean)
                        .map((s: string) => (
                          <span
                            key={s}
                            className="rounded bg-indigo-100 text-indigo-900 font-semibold px-2 py-0.5"
                          >
                            ✓ {s}
                          </span>
                        ))}
                    </div>
                  </div>
                  {activeStreamObj.electiveOptions && (
                    <div>
                      <b className="text-slate-700 block mb-1">
                        Optional / Elective Subjects (Choose up to{" "}
                        {activeStreamObj.maxElectives || 1}):
                      </b>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {activeStreamObj.electiveOptions
                          .split(",")
                          .map((s: string) => s.trim())
                          .filter(Boolean)
                          .map((subj: string) => {
                            const checked = selectedElectives.includes(subj);
                            return (
                              <button
                                key={subj}
                                type="button"
                                onClick={() =>
                                  setSelectedElectives((prev) =>
                                    prev.includes(subj)
                                      ? prev.filter((item) => item !== subj)
                                      : [...prev, subj],
                                  )
                                }
                                className={`rounded border px-2.5 py-1 font-medium transition ${
                                  checked
                                    ? "border-indigo-600 bg-indigo-600 text-white"
                                    : "bg-white text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                {checked ? "✓ " : "+ "}
                                {subj}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStreamStudent(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={assignStream.isPending}
                  onClick={() => {
                    if (!streamStudent || !activeStreamObj) return;
                    const compulsory = (activeStreamObj.compulsorySubjects || "")
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean);
                    const core = (activeStreamObj.coreSubjects || "")
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean);
                    const combined = [...compulsory, ...core, ...selectedElectives].join(", ");
                    assignStream.mutate({
                      studentId: streamStudent.id,
                      stream: `${activeStreamObj.code} - ${activeStreamObj.name}`,
                      streamId: activeStreamObj.id > 0 ? activeStreamObj.id : null,
                      electedSubjects: combined,
                    });
                  }}
                >
                  {assignStream.isPending ? "Saving..." : "Save Stream & Subjects"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Transport Dialog */}
        <Dialog open={!!transportStudent} onOpenChange={(open) => !open && setTransportStudent(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Student Transport</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                {transportStudent?.name} · Admission {transportStudent?.admissionNo}
              </p>
              <div>
                <label className="text-sm font-medium">Bus route</label>
                <select
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2"
                  value={transportId}
                  onChange={(e) => setTransportId(e.target.value)}
                >
                  <option value="">No Transport</option>
                  {transportRoutes.data?.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.routeName} — ₹{route.amount.toLocaleString()}/month
                    </option>
                  ))}
                </select>
                {transportRoutes.isLoading && (
                  <p className="mt-2 text-sm text-slate-500">Loading routes...</p>
                )}
                {!transportRoutes.isLoading && transportRoutes.data?.length === 0 && (
                  <p className="mt-2 text-sm text-slate-500">
                    No active bus routes are configured.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setTransportStudent(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={assignTransport.isPending}
                  onClick={() => {
                    if (!transportStudent) return;
                    assignTransport.mutate({
                      studentId: transportStudent.id,
                      routeId: transportId ? Number(transportId) : null,
                    });
                  }}
                >
                  {assignTransport.isPending ? "Saving..." : "Save Transport"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
