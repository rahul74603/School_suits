import { useState, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Save, CheckCircle, XCircle, Calculator, School } from "lucide-react";

const SUBJECTS: Record<string, string[]> = {
  "1-5": ["Hindi", "English", "Math", "EVS", "GK"],
  "6-8": ["Hindi", "English", "Math", "Science", "Social Science", "Sanskrit"],
  "9-10": ["Hindi", "English", "Math", "Science", "Social Science"],
  "11-12": ["Physics", "Chemistry", "Math", "Biology", "English"]
};

// --- REST adapters (Phase 3 Batch C) ---------------------------------------
// REST exam camelCase hai; page snake_case padhta hai.
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

// Electron ke main process wala grade scale (calculateGrade) — REST
// server computed grade nahi deta, isliye wahi scale yahan rakha hai.
function gradeForPercentage(percentage: number): string {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "F";
}

interface StudentMarks {
  [subject: string]: string | undefined;
  _result?: string;
  _grade?: string;
  _percentage?: string;
}

interface MarksMap {
  [studentId: number]: StudentMarks;
}

export default function ExamResults() {
  const { toast } = useToast();
  // Super Admin ka khud ka koi school nahi hota — GET /api/exams
  // server par uske liye 403 deta hai (requireRole me super_admin
  // hai hi nahi; routes se verify). Pehle ye fail bina catch ke
  // khamoshi se hota tha aur exam list khali dikhti thi. Isliye SA
  // par API call hi nahi karte — Settings wala no-school card
  // dikhega.
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [exams, setExams] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [marks, setMarks] = useState<MarksMap>({});
  const [loading, setLoading] = useState(false);

  const fetchExams = async () => {
    // Super Admin: koi school nahi — koi API call nahi (upar wala note).
    if (isSuperAdmin) return;
    // REST: GET /api/exams — IPC session="2026-27" filter deta tha;
    // session khali wali rows bahar nahi karte (REST par optional hai).
    const data = await apiGet<any[]>("/api/exams");
    setExams((data || []).map(adaptExam).filter((e: any) => !e.session || e.session === "2026-27"));
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const loadStudents = async (exam: any) => {
    setSelectedExam(exam);
    setLoading(true);
    
    // Get students of this class/section
    // REST: GET /api/students?class=&section= — admission_no <- admissionNo.
    const studentParams = new URLSearchParams({ class: exam.class_name });
    if (exam.section) studentParams.set("section", exam.section);
    const rawStudents = await apiGet<any[]>(`/api/students?${studentParams.toString()}`);
    const allStudents = (rawStudents || []).map((st: any) => ({ ...st, admission_no: st.admissionNo }));
    
    // Get existing marks
    // REST: GET /api/exams/:id/marks — REST marks model me ek exam =
    // ek subject, isliye row ka marksObtained exam ke apne subject
    // wale column me jata hai (IPC ke subject_marks fallback jaisa
    // hi). Result/grade/percentage server nahi deta — IPC ke formulas
    // se yahin gine hain.
    const rawExamMarks = await apiGet<any[]>(`/api/exams/${exam.id}/marks`);
    const existingMarks = (rawExamMarks || []).map((row: any) => {
      const obtained = row.marksObtained;
      const maxM = exam.max_marks || 100;
      const passM = exam.passing_marks ?? 33;
      const pct = obtained == null || maxM <= 0 ? null : (obtained * 100) / maxM;
      return {
        student_id: row.studentId,
        subject_marks: obtained == null ? "{}" : JSON.stringify({ [(exam.subject || "").trim() || "Marks"]: obtained }),
        marks_obtained: obtained,
        result_status: obtained == null ? undefined : (obtained >= passM ? "Pass" : "Fail"),
        grade: pct == null ? undefined : gradeForPercentage(pct),
        percentage: pct == null ? undefined : Number(pct.toFixed(2)),
      };
    });
    
    // Merge
    const marksMap: MarksMap = {};
    existingMarks.forEach((m: any) => {
      let parsedMarks: Record<string, number | string> = {};
      try {
        parsedMarks = JSON.parse(m.subject_marks || "{}");
      } catch {
        parsedMarks = {};
      }
      if (Object.keys(parsedMarks).length === 0 && m.marks_obtained !== null && m.marks_obtained !== undefined) {
        parsedMarks = { Marks: m.marks_obtained };
      }

      marksMap[m.student_id] = {
        ...Object.fromEntries(
          Object.entries(parsedMarks).map(([key, value]) => [key, String(value ?? "")])
        ),
        _result: m.result_status,
        _grade: m.grade,
        _percentage: m.percentage !== null && m.percentage !== undefined ? String(m.percentage) : undefined,
      };
    });
    
    setStudents(allStudents);
    setMarks(marksMap);
    setLoading(false);
  };

  const updateMark = (studentId: number, subject: string, value: string) => {
    setMarks((prev: MarksMap) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subject]: value
      }
    }));
  };

  const saveMarks = async (studentId: number) => {
    try {
      const studentMarks = marks[studentId] || {};
      const subjects = Object.keys(studentMarks).filter(k => !k.startsWith("_"));
      
      const marksData = {
        marks: {} as Record<string, number>,
        maxMarks: {} as Record<string, number>,
        passingMarks: {} as Record<string, number>,
        remarks: ""
      };

      subjects.forEach(sub => {
        marksData.marks[sub] = parseFloat(studentMarks[sub] ?? "") || 0;
        marksData.maxMarks[sub] = 100;
        marksData.passingMarks[sub] = 33;
      });

      // REST: POST /api/exams/:id/marks — REST model me ek exam = ek
      // subject, isliye sirf exam ke apne subject ka number save hota
      // hai; baaki subject columns me bhara data REST par save NAHI
      // hota (NOTES.md me seema saaf likhi hai). Result/grade/
      // percentage IPC wale formulas se yahin gine jate hain.
      const subjectKey = (selectedExam.subject || "").trim() || "Marks";
      const obtainedRaw = studentMarks[subjectKey];
      const obtained = obtainedRaw === undefined || obtainedRaw === "" ? null : parseFloat(obtainedRaw);
      await apiPost(`/api/exams/${selectedExam.id}/marks`, {
        marks: [{ studentId, marksObtained: obtained, remarks: "" }],
      });
      const maxM = selectedExam.max_marks || 100;
      const passM = selectedExam.passing_marks ?? 33;
      const pct = obtained == null || maxM <= 0 ? 0 : (obtained * 100) / maxM;
      const result = {
        resultStatus: obtained != null && obtained >= passM ? "Pass" : "Fail",
        grade: gradeForPercentage(pct),
        percentage: Number(pct.toFixed(2)),
      };

      // Update local state with result
      setMarks((prev: MarksMap) => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          _result: result.resultStatus,
          _grade: result.grade,
          _percentage: String(result.percentage)
        }
      }));

      toast({ 
        title: "Saved", 
        description: `${result.resultStatus} - Grade: ${result.grade}` 
      });
    } catch (e) {
      toast({ title: "Error", description: "Failed to save marks", variant: "destructive" });
    }
  };

  const getSubjectsForClass = (className: string): string[] => {
    const cls = parseInt(className) || 0;
    if (cls >= 11) return SUBJECTS["11-12"];
    if (cls >= 9) return SUBJECTS["9-10"];
    if (cls >= 6) return SUBJECTS["6-8"];
    return SUBJECTS["1-5"];
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Calculator className="h-8 w-8 text-blue-600" /> Marks Entry
      </h1>

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
              to any school, so there are no school exams to enter marks
              for here. First create a school from the Schools screen —
              after that, that school&apos;s Principal can sign in with
              their own account and manage marks entry.
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

      {/* Select Exam */}
      <Card>
        <CardContent className="pt-6">
          <Label>Select Exam</Label>
          <Select onValueChange={(v) => loadStudents(exams.find(e => e.id === parseInt(v)))}>
            <SelectTrigger className="w-full max-w-[400px]">
              <SelectValue placeholder="Choose exam..." />
            </SelectTrigger>
            <SelectContent>
              {exams.map(e => (
                <SelectItem key={e.id} value={e.id.toString()}>
                  {e.exam_name} - Class {e.class_name}-{e.section}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Marks Entry Table */}
      {selectedExam && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedExam.exam_name} 
              <span className="text-sm font-normal text-gray-500 ml-4">
                (Max: {selectedExam.max_marks}, Passing: {selectedExam.passing_marks})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Adm No</TableHead>
                    {getSubjectsForClass(selectedExam.class_name).map(sub => (
                      <TableHead key={sub} className="text-center w-[100px]">{sub}</TableHead>
                    ))}
                    <TableHead>Result</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.admission_no}</TableCell>
                      
                      {getSubjectsForClass(selectedExam.class_name).map(sub => (
                        <TableCell key={sub}>
                          <Input
                            type="number"
                            className="w-[80px] text-center"
                            value={marks[student.id]?.[sub] || ""}
                            onChange={(e) => updateMark(student.id, sub, e.target.value)}
                          />
                        </TableCell>
                      ))}
                      
                      <TableCell>
                        {marks[student.id]?._result && (
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            marks[student.id]._result === "Pass" 
                              ? "bg-green-100 text-green-700" 
                              : "bg-red-100 text-red-700"
                          }`}>
                            {marks[student.id]._result === "Pass" ? (
                              <CheckCircle className="h-3 w-3 inline mr-1" />
                            ) : (
                              <XCircle className="h-3 w-3 inline mr-1" />
                            )}
                            {marks[student.id]._result}
                          </span>
                        )}
                      </TableCell>
                      
                      <TableCell className="font-bold">
                        {marks[student.id]?._grade || "-"}
                      </TableCell>
                      
                      <TableCell>
                        {marks[student.id]?._percentage ? `${marks[student.id]._percentage}%` : "-"}
                      </TableCell>
                      
                      <TableCell>
                        <Button size="sm" onClick={() => saveMarks(student.id)}>
                          <Save className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      </>
      )}
    </div>
  );
}
