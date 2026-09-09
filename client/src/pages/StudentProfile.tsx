import { useParams, useLocation } from "wouter";
import { Sidebar } from "@/components/Sidebar";
import { QueryError } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudent, useDeactivateStudent } from "@/hooks/use-students";
import { useActiveSession } from "@/hooks/use-core";
import { ArrowLeft, Pencil } from "lucide-react";

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const studentQuery = useStudent(Number(id));
  const sessionQuery = useActiveSession();
  const deactivate = useDeactivateStudent();
  return <div className="flex min-h-screen bg-slate-50"><Sidebar /><main className="flex-1 ml-64 p-8"><Button variant="ghost" onClick={() => setLocation("/students")}><ArrowLeft className="mr-2 h-4 w-4" /> Back to students</Button>
    {studentQuery.isLoading ? <p className="mt-8">Loading student...</p> : studentQuery.isError ? <QueryError message={studentQuery.error.message} onRetry={() => studentQuery.refetch()} /> : !studentQuery.data ? <QueryError message="Student not found." /> : <div className="mt-6 max-w-3xl"><div className="flex items-center justify-between mb-6"><div><h1 className="text-3xl font-bold">{studentQuery.data.name}</h1><p className="text-slate-500">{studentQuery.data.isActive ? "Active student" : "Inactive student"}</p></div><div className="flex gap-2"><Button onClick={() => setLocation(`/students/${studentQuery.data!.id}/edit`)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>{studentQuery.data.isActive && <Button variant="destructive" disabled={deactivate.isPending} onClick={async () => { if (window.confirm("Deactivate this student?")) { await deactivate.mutateAsync(studentQuery.data!.id); await studentQuery.refetch(); } }}>Deactivate</Button>}</div></div><Card><CardHeader><CardTitle>Student details</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">{[["Admission number", studentQuery.data.admissionNo],["Class", `${studentQuery.data.class} - ${studentQuery.data.section}`],["Roll number", studentQuery.data.rollNo || "—"],["Father/guardian", studentQuery.data.fatherName],["Contact", studentQuery.data.contact],["Address", studentQuery.data.address || "—"],["Date of birth", studentQuery.data.dob || "—"],["Academic session", sessionQuery.data?.name || "Active session"]].map(([label,value]) => <div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="font-medium">{value}</dd></div>)}</CardContent></Card></div>}
  </main></div>;
}
