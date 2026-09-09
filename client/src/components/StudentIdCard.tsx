import { type Student, type School } from "@shared/schema";
import { format } from "date-fns";

interface StudentIdCardProps {
  student: Student;
  school: School;
  sessionName?: string;
}

export function StudentIdCard({ student, school, sessionName }: StudentIdCardProps) {
  return (
    <div className="w-[350px] h-[520px] bg-white border border-gray-200 rounded-xl overflow-hidden shadow-lg relative print:shadow-none print:border-black print:w-[3.375in] print:h-[2.125in] print:rotate-90">
      {/* Header Pattern */}
      <div className="h-32 bg-gradient-to-r from-blue-600 to-blue-800 absolute top-0 w-full" />
      
      <div className="relative z-10 flex flex-col items-center pt-8 h-full px-6">
        {/* School Info */}
        <div className="text-center text-white mb-6">
          <h2 className="text-xl font-bold font-display uppercase tracking-wider">{school.name}</h2>
          <p className="text-xs opacity-90">{school.address}</p>
        </div>

        {/* Photo Area */}
        <div className="w-32 h-32 bg-white rounded-full p-1 shadow-xl mb-4">
          <div className="w-full h-full bg-slate-100 rounded-full overflow-hidden flex items-center justify-center border-4 border-white">
            <span className="text-4xl">🎓</span>
          </div>
        </div>

        {/* Student Name & Class */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-slate-800">{student.name}</h3>
          <span className="inline-block px-4 py-1 bg-blue-50 text-blue-700 font-semibold rounded-full text-sm mt-1">
            Class {student.class} - {student.section}
          </span>
        </div>

        {/* Details Grid */}
        <div className="w-full space-y-3 text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">Roll No</span>
            <span className="font-semibold text-slate-800">{student.rollNo || "-"}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">Admission No</span>
            <span className="font-semibold text-slate-800">{student.admissionNo}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">Father's Name</span>
            <span className="font-semibold text-slate-800">{student.fatherName}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">DOB</span>
            <span className="font-semibold text-slate-800">
              {student.dob ? format(new Date(student.dob), "dd MMM yyyy") : "-"}
            </span>
          </div>
          <div className="flex justify-between pb-2">
            <span className="text-slate-500">Contact</span>
            <span className="font-semibold text-slate-800">{student.contact}</span>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="absolute bottom-0 w-full bg-slate-900 h-12 flex items-center justify-center">
          <p className="text-white/80 text-xs font-mono tracking-widest uppercase">{sessionName || "Current academic session"}</p>
        </div>
      </div>
    </div>
  );
}
