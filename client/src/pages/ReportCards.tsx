import { useState, useEffect, useRef } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Printer, Search, FileText, Award, TrendingUp, Calendar, User } from "lucide-react";

interface ExamResult {
  exam_name: string;
  exam_type: string;
  subject_marks: string;
  total_marks: number;
  percentage: number;
  grade: string;
  result_status: string;
  class_name: string;
  session: string;
}

interface StudentInfo {
  id: number;
  name: string;
  admission_no: string;
  father_name: string;
  mother_name: string;
  class: string;
  section: string;
  dob: string;
  contact: string;
  address: string;
}

export default function ReportCards() {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [searchAdmNo, setSearchAdmNo] = useState("");
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamResult | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    loadSchoolInfo();
  }, []);

  const loadSchoolInfo = async () => {
    const info = await (window as any).electronAPI.invoke("get-school-info");
    setSchoolInfo(info);
  };

  const searchStudent = async () => {
    if (!searchAdmNo.trim()) {
      toast({ title: "Error", description: "Enter admission number", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const studentData = await (window as any).electronAPI.invoke("get-student-by-admno", searchAdmNo.trim());
      
      if (!studentData) {
        toast({ title: "Not Found", description: "No student found with this admission number", variant: "destructive" });
        setStudent(null);
        setResults([]);
        return;
      }

      setStudent(studentData);

      // Get all results for this student
      const allResults = await (window as any).electronAPI.invoke("get-student-all-results", studentData.id);
      setResults(allResults || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load student data", variant: "destructive" });
    }
    setLoading(false);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const printContent = printRef.current.innerHTML;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Report Card - ${student?.name}</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .report-card { border: 3px double #333; padding: 20px; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
            .school-name { font-size: 24px; font-weight: bold; color: #1e40af; }
            .school-info { font-size: 12px; color: #666; margin-top: 5px; }
            .title { font-size: 18px; font-weight: bold; text-align: center; margin: 15px 0; background: #f3f4f6; padding: 8px; }
            .student-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; font-size: 13px; }
            .info-row { display: flex; }
            .info-label { font-weight: bold; width: 120px; color: #374151; }
            .marks-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
            .marks-table th { background: #1e40af; color: white; padding: 8px; text-align: left; border: 1px solid #333; }
            .marks-table td { padding: 8px; border: 1px solid #333; }
            .marks-table .text-center { text-align: center; }
            .result-box { display: flex; justify-content: space-around; margin: 20px 0; padding: 15px; background: #f9fafb; border: 2px solid #e5e7eb; }
            .result-item { text-align: center; }
            .result-label { font-size: 12px; color: #6b7280; }
            .result-value { font-size: 20px; font-weight: bold; color: #1e40af; }
            .pass { color: #059669; }
            .fail { color: #dc2626; }
            .grade-a-plus { color: #059669; }
            .grade-a { color: #2563eb; }
            .grade-b { color: #7c3aed; }
            .grade-c { color: #ea580c; }
            .grade-d { color: #dc2626; }
            .grade-f { color: #991b1b; font-weight: bold; }
            .remarks { margin-top: 20px; padding: 10px; border: 1px solid #e5e7eb; min-height: 60px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
            .signature-box { text-align: center; width: 150px; }
            .signature-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 5px; font-size: 12px; }
            .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #6b7280; }
            @media print { .no-print { display: none; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          ${printContent}
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  const openPreview = (result: ExamResult) => {
    setSelectedExam(result);
    setIsPreviewOpen(true);
  };

  const getGradeClass = (grade: string): string => {
    switch(grade) {
      case "A+": return "grade-a-plus";
      case "A": return "grade-a";
      case "B": return "grade-b";
      case "C": return "grade-c";
      case "D": return "grade-d";
      case "F": return "grade-f";
      default: return "";
    }
  };

  const parseMarks = (marksJson: string): Record<string, number> => {
    try {
      return JSON.parse(marksJson || "{}");
    } catch {
      return {};
    }
  };

  const calculateDivision = (percentage: number): string => {
    if (percentage >= 60) return "First Division";
    if (percentage >= 45) return "Second Division";
    if (percentage >= 33) return "Third Division";
    return "Fail";
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-slate-800">
            <FileText className="h-8 w-8 text-blue-600" /> Report Cards
          </h1>
          <p className="text-gray-500 mt-1">Generate and print student report cards</p>
        </div>
      </div>

      {/* Search */}
      <Card className="border-t-4 border-t-blue-600">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1 max-w-md">
              <Label>Admission Number</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter admission number (e.g., KPS-2026-001)"
                  value={searchAdmNo}
                  onChange={(e) => setSearchAdmNo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchStudent()}
                />
                <Button onClick={searchStudent} disabled={loading} className="bg-blue-600">
                  <Search className="h-4 w-4 mr-2" />
                  {loading ? "Searching..." : "Search"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student Info & Results */}
      {student && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Student Details */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Student Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center mb-4">
                <div className="h-20 w-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-3xl font-bold text-blue-600">
                    {student.name.charAt(0)}
                  </span>
                </div>
                <h3 className="font-bold text-lg">{student.name}</h3>
                <p className="text-gray-500 text-sm">{student.admission_no}</p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Class:</span>
                  <span className="font-medium">{student.class}-{student.section}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Father's Name:</span>
                  <span className="font-medium">{student.father_name || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mother's Name:</span>
                  <span className="font-medium">{student.mother_name || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date of Birth:</span>
                  <span className="font-medium">{student.dob || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Contact:</span>
                  <span className="font-medium">{student.contact}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exam Results List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" /> Examination Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results.length > 0 ? (
                <div className="space-y-3">
                  {results.map((result, idx) => (
                    <div 
                      key={idx} 
                      className="border rounded-lg p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => openPreview(result)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-lg">{result.exam_name}</h4>
                          <p className="text-sm text-gray-500">{result.exam_type} • Session {result.session}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-2xl font-bold ${getGradeClass(result.grade)}`}>
                            {result.grade}
                          </span>
                          <p className="text-sm text-gray-500">{result.percentage}%</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          result.result_status === "Pass" 
                            ? "bg-green-100 text-green-700" 
                            : "bg-red-100 text-red-700"
                        }`}>
                          {result.result_status}
                        </span>
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openPreview(result); }}>
                          <Printer className="h-4 w-4 mr-2" /> Print
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Award className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No results found for this student</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Card Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center">
              <span>Report Card Preview</span>
              <Button onClick={handlePrint} className="bg-blue-600">
                <Printer className="h-4 w-4 mr-2" /> Print Report Card
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {/* Hidden Print Content */}
          <div ref={printRef} className="bg-white">
            {selectedExam && student && schoolInfo && (
              <div className="report-card">
                {/* School Header */}
                <div className="header">
                  <div className="school-name">{schoolInfo.name}</div>
                  <div className="school-info">
                    {schoolInfo.address}<br/>
                    Phone: {schoolInfo.phone || "N/A"} | Email: {schoolInfo.email || "N/A"}<br/>
                    Session: {selectedExam.session}
                  </div>
                </div>

                {/* Report Card Title */}
                <div className="title">ACADEMIC REPORT CARD</div>

                {/* Student Information */}
                <div className="student-info">
                  <div className="info-row">
                    <span className="info-label">Student Name:</span>
                    <span>{student.name}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Admission No:</span>
                    <span>{student.admission_no}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Father's Name:</span>
                    <span>{student.father_name || "N/A"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Mother's Name:</span>
                    <span>{student.mother_name || "N/A"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Class & Section:</span>
                    <span>{student.class}-{student.section}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Date of Birth:</span>
                    <span>{student.dob || "N/A"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Examination:</span>
                    <span>{selectedExam.exam_name}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Exam Type:</span>
                    <span>{selectedExam.exam_type}</span>
                  </div>
                </div>

                {/* Marks Table */}
                <table className="marks-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th className="text-center">Max Marks</th>
                      <th className="text-center">Obtained</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(parseMarks(selectedExam.subject_marks)).map(([subject, marks]: [string, any]) => {
                      const obtained = parseFloat(marks) || 0;
                      const passMark = 33;
                      return (
                        <tr key={subject}>
                          <td>{subject}</td>
                          <td className="text-center">100</td>
                          <td className="text-center font-bold">{obtained}</td>
                          <td className="text-center">
                            <span className={obtained >= passMark ? "pass" : "fail"}>
                              {obtained >= passMark ? "Pass" : "Fail"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Result Summary */}
                <div className="result-box">
                  <div className="result-item">
                    <div className="result-label">Total Marks</div>
                    <div className="result-value">{selectedExam.total_marks}</div>
                  </div>
                  <div className="result-item">
                    <div className="result-label">Percentage</div>
                    <div className="result-value">{selectedExam.percentage}%</div>
                  </div>
                  <div className="result-item">
                    <div className="result-label">Grade</div>
                    <div className={`result-value ${getGradeClass(selectedExam.grade)}`}>
                      {selectedExam.grade}
                    </div>
                  </div>
                  <div className="result-item">
                    <div className="result-label">Result</div>
                    <div className={`result-value ${selectedExam.result_status === "Pass" ? "pass" : "fail"}`}>
                      {selectedExam.result_status}
                    </div>
                  </div>
                </div>

                <div style={{textAlign: 'center', marginTop: '10px', fontWeight: 'bold', color: '#374151'}}>
                  Division: {calculateDivision(selectedExam.percentage)}
                </div>

                {/* Remarks */}
                <div className="remarks">
                  <strong>Remarks:</strong>
                  <p style={{marginTop: '5px', color: '#4b5563'}}>
                    {selectedExam.result_status === "Pass" 
                      ? "Congratulations! Keep up the good work." 
                      : "Needs improvement. Please work harder."}
                  </p>
                </div>

                {/* Signatures */}
                <div className="signatures">
                  <div className="signature-box">
                    <div className="signature-line">Class Teacher</div>
                  </div>
                  <div className="signature-box">
                    <div className="signature-line">Principal</div>
                  </div>
                  <div className="signature-box">
                    <div className="signature-line">Parent's Signature</div>
                  </div>
                </div>

                {/* Footer */}
                <div className="footer">
                  This is a computer generated report card and does not require signature.
                  <br/>Generated on: {new Date().toLocaleDateString('en-IN')}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}