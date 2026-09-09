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
import { Save, CheckCircle, XCircle, Calculator } from "lucide-react";

const SUBJECTS: Record<string, string[]> = {
  "1-5": ["Hindi", "English", "Math", "EVS", "GK"],
  "6-8": ["Hindi", "English", "Math", "Science", "Social Science", "Sanskrit"],
  "9-10": ["Hindi", "English", "Math", "Science", "Social Science"],
  "11-12": ["Physics", "Chemistry", "Math", "Biology", "English"]
};

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
  const [exams, setExams] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [marks, setMarks] = useState<MarksMap>({});
  const [loading, setLoading] = useState(false);

  const fetchExams = async () => {
    const data = await (window as any).electronAPI.invoke("get-exams", {
      className: "ALL",
      section: "ALL",
      session: "2026-27",
    });
    setExams(data || []);
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const loadStudents = async (exam: any) => {
    setSelectedExam(exam);
    setLoading(true);
    
    // Get students of this class/section
    const allStudents = await (window as any).electronAPI.invoke("get-students", {
      search: "",
      classStr: exam.class_name,
      section: exam.section,
    });
    
    // Get existing marks
    const existingMarks = await (window as any).electronAPI.invoke("get-exam-marks", exam.id) || [];
    
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

      const result = await (window as any).electronAPI.invoke("save-exam-marks", {
        examId: selectedExam.id,
        studentId,
        marksData
      });

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
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Calculator className="h-8 w-8 text-blue-600" /> Marks Entry
      </h1>

      {/* Select Exam */}
      <Card>
        <CardContent className="pt-6">
          <Label>Select Exam</Label>
          <Select onValueChange={(v) => loadStudents(exams.find(e => e.id === parseInt(v)))}>
            <SelectTrigger className="w-[400px]">
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
    </div>
  );
}
