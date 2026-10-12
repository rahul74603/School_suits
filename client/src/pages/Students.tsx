import { useState, useRef } from "react";
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
import { Search, Plus, Printer, ArrowUpRight } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { StudentIdCard } from "@/components/StudentIdCard";
import { type Student } from "@shared/schema";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSchool, useActiveSession } from "@/hooks/use-core";
import { useToast } from "@/hooks/use-toast";
import { QueryError } from "@/components/QueryState";

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

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  function toggleStudent(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
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
              Manage student records, promotions, and generate ID cards
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
              {["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map(
                (cls) => (
                  <option key={cls} value={cls}>
                    Class {cls}
                  </option>
                ),
              )}
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
                placeholder="Target Class (e.g., 6)"
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
                <TableHead>Father&apos;s Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isError ? (
                <TableRow>
                  <TableCell colSpan={7}>
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
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading students...
                  </TableCell>
                </TableRow>
              ) : students?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No students found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                students?.map((student) => (
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
                    <TableCell>{student.fatherName}</TableCell>
                    <TableCell>{student.contact}</TableCell>
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
