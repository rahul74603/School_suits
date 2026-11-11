import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiDel } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  GraduationCap,
  Plus,
  Trash2,
  Edit,
  FileText,
  Calendar,
  RefreshCw,
  Search,
  Save,
  X,
  School
} from "lucide-react";

// Types
interface Exam {
  id: number;
  exam_name: string;
  exam_type: string;
  class_name: string;
  section: string;
  max_marks: number;
  passing_marks: number;
  exam_date: string;
  session: string;
  subject?: string;
}

interface Student {
  id: number;
  name: string;
  roll_number: string;
}

interface MarkEntry {
  studentId: number;
  marks: string;
  remarks: string;
}

const EXAM_TYPES = ["Unit Test", "Half Yearly", "Final Exam", "Quiz", "Practical"] as const;
const CLASSES = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;
const SECTIONS = ["A", "B", "C", "D", "E"] as const;
const SESSION = "2026-27";

// --- REST adapter (Phase 3 Batch C) ---------------------------------------
// REST exam camelCase hai (examName/class/maxMarks...); page snake_case
// padhta hai — fetch ke turant baad purane naam bhare jate hain.
function adaptExam(e: any) {
  return {
    ...e,
    exam_name: e.examName,
    exam_type: e.examType,
    class_name: e.class,
    max_marks: e.maxMarks,
    passing_marks: e.passingMarks,
    exam_date: e.examDate,
  };
}

type ExamType = typeof EXAM_TYPES[number];
type ClassType = typeof CLASSES[number];
type SectionType = typeof SECTIONS[number];

export default function Exams() {
  const { toast } = useToast();
  // Super Admin ka khud ka koi school nahi hota — GET /api/exams
  // server par uske liye 403 deta hai (requireRole me super_admin
  // hai hi nahi; routes se verify). Isliye SA par API call hi nahi
  // karte — Settings wala no-school card dikhega, lal toast nahi.
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isMarksOpen, setIsMarksOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [marksData, setMarksData] = useState<Record<number, MarkEntry>>({});
  const [savingMarks, setSavingMarks] = useState(false);

  // Filters
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [sectionFilter, setSectionFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Form
  const [formData, setFormData] = useState({
    examName: "",
    examType: "" as ExamType | "",
    className: "" as ClassType | "",
    section: "" as SectionType | "",
    maxMarks: "100",
    passingMarks: "33",
    examDate: "",
    session: SESSION,
    subject: "",
  });

  const fetchExams = useCallback(async () => {
    // Super Admin: koi school nahi — koi API call nahi (upar wala note).
    if (isSuperAdmin) return;
    setLoading(true);
    try {
      // REST: GET /api/exams — server class/section/session filter
      // nahi leta, isliye IPC wale filter yahin lage hain. Session
      // khali ho to row bahar nahi karte (REST par session optional
      // hai; IPC create hamesha session bhejta tha).
      const data = await apiGet<any[]>("/api/exams");
      const adapted = (data || []).map(adaptExam).filter((exam: any) =>
        (classFilter === "ALL" || exam.class_name === classFilter) &&
        (sectionFilter === "ALL" || exam.section === sectionFilter) &&
        (!exam.session || exam.session === SESSION)
      );
      setExams(adapted);
    } catch (e) {
      toast({ 
        title: "Error", 
        description: "Failed to load exams", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  }, [classFilter, sectionFilter, toast, isSuperAdmin]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const handleCreate = async () => {
    if (!formData.examName || !formData.examType || !formData.className || !formData.examDate) {
      toast({ 
        title: "Validation Error", 
        description: "Please fill all required fields", 
        variant: "destructive" 
      });
      return;
    }

    try {
      // REST: POST /api/exams — className -> class. Khali section/
      // subject bhejte hi nahi (server par optional hain).
      await apiPost("/api/exams", {
        examName: formData.examName,
        examType: formData.examType,
        class: formData.className,
        section: formData.section || undefined,
        subject: formData.subject || undefined,
        maxMarks: parseInt(formData.maxMarks),
        passingMarks: parseInt(formData.passingMarks),
        examDate: formData.examDate,
        session: formData.session,
      });
      toast({ title: "Success", description: "Exam created successfully" });
      setIsAddOpen(false);
      resetForm();
      fetchExams();
    } catch (e) {
      toast({ 
        title: "Error", 
        description: "Failed to create exam", 
        variant: "destructive" 
      });
    }
  };

  const resetForm = () => {
    setFormData({
      examName: "",
      examType: "",
      className: "",
      section: "",
      maxMarks: "100",
      passingMarks: "33",
      examDate: "",
      session: SESSION,
      subject: "",
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this exam and all its marks? This action cannot be undone.")) return;
    try {
      // REST: DELETE /api/exams/:id (server par sirf principal —
      // teacher ko 403 ayega to neeche wala error toast hi dikhega).
      await apiDel(`/api/exams/${id}`);
      toast({ title: "Success", description: "Exam deleted" });
      fetchExams();
    } catch (e) {
      toast({ 
        title: "Error", 
        description: "Failed to delete exam", 
        variant: "destructive" 
      });
    }
  };

  const openMarksEntry = async (exam: Exam) => {
    setSelectedExam(exam);
    setIsMarksOpen(true);
    setLoading(true);
    
    try {
      // REST: GET /api/students?class=&section= — roll_number <- rollNo.
      const studentParams = new URLSearchParams({ class: exam.class_name });
      if (exam.section) studentParams.set("section", exam.section);
      const rawStudents = await apiGet<any[]>(`/api/students?${studentParams.toString()}`);
      const studentsData = (rawStudents || []).map((st: any) => ({ ...st, roll_number: st.rollNo }));
      setStudents(studentsData);
      
      // REST: GET /api/exams/:id/marks — rows camelCase (studentId,
      // marksObtained); page student_id / marks_obtained padhta hai.
      const rawMarks = await apiGet<any[]>(`/api/exams/${exam.id}/marks`);
      const existingMarks = (rawMarks || []).map((m: any) => ({
        ...m,
        student_id: m.studentId,
        marks_obtained: m.marksObtained,
      }));
      
      const initialMarks: Record<number, MarkEntry> = {};
      studentsData?.forEach((student: Student) => {
        const existing = existingMarks?.find((m: any) => m.student_id === student.id);
        initialMarks[student.id] = {
          studentId: student.id,
          marks: existing ? String(existing.marks_obtained) : "",
          remarks: existing?.remarks || "",
        };
      });
      setMarksData(initialMarks);
    } catch (e) {
      toast({ 
        title: "Error", 
        description: "Failed to load students or marks", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkChange = (studentId: number, field: keyof MarkEntry, value: string) => {
    setMarksData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      }
    }));
  };

  const saveMarks = async () => {
    if (!selectedExam) return;
    
    setSavingMarks(true);
    try {
      const marksArray = Object.values(marksData).map(entry => ({
        studentId: entry.studentId,
        marksObtained: entry.marks === "" ? null : parseFloat(entry.marks),
        remarks: entry.remarks,
      }));

      // REST: POST /api/exams/:id/marks — marksArray ka shape
      // ({ studentId, marksObtained, remarks }) server ke schema se
      // bilkul match hai.
      await apiPost(`/api/exams/${selectedExam.id}/marks`, { marks: marksArray });

      toast({ title: "Success", description: "Marks saved successfully" });
      setIsMarksOpen(false);
    } catch (e) {
      toast({ 
        title: "Error", 
        description: "Failed to save marks", 
        variant: "destructive" 
      });
    } finally {
      setSavingMarks(false);
    }
  };

  const getResultStatus = (marks: string, maxMarks: number, passingMarks: number) => {
    const numMarks = parseFloat(marks);
    if (isNaN(numMarks)) return "Pending";
    if (numMarks >= passingMarks) return "Pass";
    return "Fail";
  };

  const filteredExams = exams.filter(exam => 
    exam.exam_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exam.exam_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-slate-800">
            <GraduationCap className="h-8 w-8 text-blue-600" /> Examination
          </h1>
          <p className="text-gray-500 mt-1">Manage exams and student results</p>
        </div>
        {!isSuperAdmin && (
          <Button onClick={() => setIsAddOpen(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" /> Create Exam
          </Button>
        )}
      </div>

      {isSuperAdmin ? (
        <Card className="border-t-4 border-t-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" /> No School Linked to This Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              You are signed in as Super Admin. This account is not linked
              to any school, so there are no school exams to show here.
              First create a school from the Schools screen — after that,
              that school&apos;s Principal can sign in with their own
              account and manage exams.
            </p>
            <Link href="/schools">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <School className="h-4 w-4 mr-2" /> Go to Schools
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
      <>

      {/* Filters */}
      <Card className="shadow-sm relative z-10">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-[200px]">
              <Label>Class</Label>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[9999] shadow-lg border">
                  <SelectItem value="ALL">All Classes</SelectItem>
                  {CLASSES.map(c => (
                    <SelectItem key={c} value={c}>Class {c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <Label>Section</Label>
              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[9999] shadow-lg border">
                  <SelectItem value="ALL">All Sections</SelectItem>
                  {SECTIONS.map(s => (
                    <SelectItem key={s} value={s}>Section {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[250px]">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search exams..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Button variant="outline" onClick={fetchExams} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Exams Table */}
      <Card>
        <CardContent className="p-0">
          {filteredExams.length > 0 ? (
          <div className="overflow-x-auto">
<Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Exam Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Max Marks</TableHead>
                <TableHead>Passing</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExams.map((exam) => (
                  <TableRow key={exam.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">{exam.exam_name}</TableCell>
                    <TableCell>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                        {exam.exam_type}
                      </span>
                    </TableCell>
                    <TableCell>Class {exam.class_name} - {exam.section}</TableCell>
                    <TableCell>{exam.subject || "-"}</TableCell>
                    <TableCell>{exam.max_marks}</TableCell>
                    <TableCell>{exam.passing_marks}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="h-3 w-3" />
                        {new Date(exam.exam_date).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openMarksEntry(exam)}
                          title="Enter Marks"
                        >
                          <FileText className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(exam.id)}
                          title="Delete Exam"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          </div>
          ) : (
            <div className="py-12 text-center text-gray-500">
              {loading ? "Loading..." : "No exams found"}
            </div>
          )}
        </CardContent>
      </Card>

      </>
      )}

      {/* Add Exam Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl bg-white z-[9999]">
          <DialogHeader>
            <DialogTitle>Create New Exam</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Exam Name *</Label>
              <Input 
                value={formData.examName}
                onChange={(e) => setFormData({...formData, examName: e.target.value})}
                placeholder="e.g., First Unit Test 2026"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Exam Type *</Label>
                <Select 
                  value={formData.examType} 
                  onValueChange={(v: ExamType) => setFormData({...formData, examType: v})}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-[9999] shadow-lg border">
                    {EXAM_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input 
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  placeholder="e.g., Mathematics"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Class *</Label>
                <Select 
                  value={formData.className} 
                  onValueChange={(v: ClassType) => setFormData({...formData, className: v})}
                >
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent className="bg-white z-[9999] shadow-lg border">
                    {CLASSES.map(c => (
                      <SelectItem key={c} value={c}>Class {c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Select 
                  value={formData.section} 
                  onValueChange={(v: SectionType) => setFormData({...formData, section: v})}
                >
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Select section" /></SelectTrigger>
                  <SelectContent className="bg-white z-[9999] shadow-lg border">
                    {SECTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Max Marks *</Label>
                <Input 
                  type="number" 
                  min="1"
                  value={formData.maxMarks} 
                  onChange={(e) => setFormData({...formData, maxMarks: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>Passing Marks *</Label>
                <Input 
                  type="number" 
                  min="0"
                  value={formData.passingMarks} 
                  onChange={(e) => setFormData({...formData, passingMarks: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>Session</Label>
                <Input value={formData.session} disabled />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Exam Date *</Label>
              <Input 
                type="date" 
                value={formData.examDate} 
                onChange={(e) => setFormData({...formData, examDate: e.target.value})} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
              Create Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Marks Entry Dialog */}
      <Dialog open={isMarksOpen} onOpenChange={setIsMarksOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Enter Marks - {selectedExam?.exam_name}</span>
              <span className="text-sm font-normal text-gray-500">
                Class {selectedExam?.class_name} - {selectedExam?.section} | 
                Max: {selectedExam?.max_marks} | Pass: {selectedExam?.passing_marks}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          {loading ? (
            <div className="py-12 text-center text-gray-500">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              Loading students...
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                {students.length > 0 ? (
                <div className="overflow-x-auto">
<Table>
                  <TableHeader className="bg-slate-50 sticky top-0">
                    <TableRow>
                      <TableHead className="w-[80px]">Roll No</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead className="w-[150px]">Marks Obtained</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => {
                        const entry = marksData[student.id] || { marks: "", remarks: "" };
                        const status = getResultStatus(
                          entry.marks, 
                          selectedExam?.max_marks || 100, 
                          selectedExam?.passing_marks || 33
                        );
                        
                        return (
                          <TableRow key={student.id}>
                            <TableCell className="font-mono text-sm">{student.roll_number}</TableCell>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max={selectedExam?.max_marks}
                                value={entry.marks}
                                onChange={(e) => handleMarkChange(student.id, 'marks', e.target.value)}
                                className="w-24"
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                status === "Pass" ? "bg-green-100 text-green-700" :
                                status === "Fail" ? "bg-red-100 text-red-700" :
                                "bg-gray-100 text-gray-600"
                              }`}>
                                {status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={entry.remarks}
                                onChange={(e) => handleMarkChange(student.id, 'remarks', e.target.value)}
                                placeholder="Optional remarks"
                                className="text-sm"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
                </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    No students found for this class/section
                  </div>
                )}
              </div>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setIsMarksOpen(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  onClick={saveMarks} 
                  disabled={savingMarks || students.length === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {savingMarks ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Marks
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
