import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertStudentSchema } from "@shared/schema";
import { Sidebar } from "@/components/Sidebar";
import { QueryError } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStudent, useUpdateStudent } from "@/hooks/use-students";
import { useSchoolCatalog } from "@/hooks/use-school-catalog";
import { useToast } from "@/hooks/use-toast";

const schema = insertStudentSchema.partial();
type FormData = z.infer<typeof schema>;

export default function StudentEdit() {
  const { id } = useParams<{ id: string }>();
  const studentId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { classOptions, sectionOptions } = useSchoolCatalog();
  const studentQuery = useStudent(studentId);
  const update = useUpdateStudent();
  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (studentQuery.data) {
      const s: any = studentQuery.data;
      form.reset({
        admissionNo: s.admissionNo,
        admissionDate: s.admissionDate || undefined,
        admissionType: s.admissionType || "new",
        name: s.name,
        gender: s.gender || "Male",
        dob: s.dob || undefined,
        bloodGroup: s.bloodGroup || "",
        category: s.category || "General",
        religion: s.religion || "Hindu",
        medium: s.medium || "Hindi",
        fatherName: s.fatherName,
        fatherOccupation: s.fatherOccupation || "",
        motherName: s.motherName || "",
        motherOccupation: s.motherOccupation || "",
        annualIncome: s.annualIncome ?? undefined,
        class: s.class,
        section: s.section,
        rollNo: s.rollNo || "",
        contact: s.contact,
        alternateContact: s.alternateContact || "",
        parentEmail: s.parentEmail || "",
        address: s.address || "",
        aadhaar: s.aadhaar || "",
        samagraId: s.samagraId || "",
        penNumber: s.penNumber || "",
        apaarId: s.apaarId || "",
        birthCertificateNo: s.birthCertificateNo || "",
        bankAccountNo: s.bankAccountNo || "",
        bankIfsc: s.bankIfsc || "",
        bankName: s.bankName || "",
        previousSchoolName: s.previousSchoolName || "",
        previousSchoolUdise: s.previousSchoolUdise || "",
        previousSchoolBoard: s.previousSchoolBoard || "",
        previousSchoolState: s.previousSchoolState || "",
        previousSchoolDistrict: s.previousSchoolDistrict || "",
        previousClass: s.previousClass || "",
        previousPassingYear: s.previousPassingYear || "",
        previousPercentage: s.previousPercentage || "",
        tcNumber: s.tcNumber || "",
        tcIssueDate: s.tcIssueDate || undefined,
        migrationCertificateNo: s.migrationCertificateNo || "",
        migrationIssueDate: s.migrationIssueDate || undefined,
        deoCountersigned: Boolean(s.deoCountersigned),
        leavingReason: s.leavingReason || "",
        tcSubmitted: Boolean(s.tcSubmitted),
        reportCardSubmitted: Boolean(s.reportCardSubmitted),
        birthCertificateSubmitted: Boolean(s.birthCertificateSubmitted),
        aadhaarSubmitted: Boolean(s.aadhaarSubmitted),
        casteCertificateSubmitted: Boolean(s.casteCertificateSubmitted),
        migrationSubmitted: Boolean(s.migrationSubmitted),
        photoSubmitted: Boolean(s.photoSubmitted),
      } as any);
    }
  }, [studentQuery.data, form]);

  const onSubmit = (data: FormData) => {
    const cleaned: any = {
      ...data,
      dob: data.dob || null,
      admissionDate: (data as any).admissionDate || null,
      tcIssueDate: data.tcIssueDate || null,
      migrationIssueDate: (data as any).migrationIssueDate || null,
      annualIncome: (data as any).annualIncome ? Number((data as any).annualIncome) : null,
    };
    update.mutate({ id: studentId, ...cleaned }, {
      onSuccess: () => {
        toast({ title: "Student admission record updated" });
        setLocation(`/students/${studentId}`);
      },
      onError: (err) =>
        toast({
          variant: "destructive",
          title: "Update failed",
          description: err.message,
        }),
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        {studentQuery.isLoading ? (
          <p>Loading student...</p>
        ) : studentQuery.isError ? (
          <QueryError message={studentQuery.error.message} onRetry={() => studentQuery.refetch()} />
        ) : !studentQuery.data ? (
          <QueryError message="Student not found." />
        ) : (
          <Card className="max-w-4xl">
            <CardHeader>
              <CardTitle>
                Edit Complete Student & Transfer Record — {studentQuery.data.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <label className="text-xs font-semibold text-slate-700">
                    Admission Type (प्रवेश प्रकार)
                    <select
                      className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      {...form.register("admissionType" as any)}
                    >
                      <option value="new">Fresh / New Admission</option>
                      <option value="same_state_transfer">Old School Transfer (Same State)</option>
                      <option value="inter_state_transfer">Inter-State / Other Board Transfer</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Admission Number
                    <Input className="mt-1" {...form.register("admissionNo")} />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Class (क्लास)
                    <select
                      className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      {...form.register("class")}
                    >
                      {classOptions.map((c) => (
                        <option key={c} value={c}>
                          Class {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Section (सेक्शन)
                    <select
                      className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      {...form.register("section")}
                    >
                      {sectionOptions.map((sec) => (
                        <option key={sec} value={sec}>
                          Section {sec}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <label className="text-xs font-semibold text-slate-700 md:col-span-2">
                    Student Full Name (पूरा नाम)
                    <Input className="mt-1" {...form.register("name")} />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Gender (लिंग)
                    <select
                      className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      {...form.register("gender" as any)}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Date of Birth (जन्म तिथि)
                    <Input className="mt-1" type="date" {...form.register("dob")} />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <label className="text-xs font-semibold text-slate-700">
                    Roll Number
                    <Input className="mt-1" {...form.register("rollNo")} />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Category (जाति वर्ग)
                    <Input className="mt-1" {...form.register("category")} />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Blood Group
                    <Input className="mt-1" {...form.register("bloodGroup" as any)} />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Medium (माध्यम)
                    <Input className="mt-1" {...form.register("medium" as any)} />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-2 border-t">
                  <label className="text-xs font-semibold text-slate-700">
                    Aadhaar No (आधार नंबर)
                    <Input className="mt-1" {...form.register("aadhaar")} />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Samagra ID (समग्र आईडी)
                    <Input className="mt-1" {...form.register("samagraId" as any)} />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    UDISE+ PEN No (11-Digit)
                    <Input className="mt-1" {...form.register("penNumber" as any)} />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    APAAR / ABC ID
                    <Input className="mt-1" {...form.register("apaarId" as any)} />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Birth Certificate No
                    <Input className="mt-1" {...form.register("birthCertificateNo")} />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t">
                  <label className="text-xs font-semibold text-slate-700">
                    Father&apos;s Name (पिता का नाम)
                    <Input className="mt-1" {...form.register("fatherName")} />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Mother&apos;s Name (माता का नाम)
                    <Input className="mt-1" {...form.register("motherName")} />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Primary Contact (मोबाइल)
                    <Input className="mt-1" {...form.register("contact")} />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Alternate Mobile
                    <Input className="mt-1" {...form.register("alternateContact" as any)} />
                  </label>
                </div>

                <label className="block text-xs font-semibold text-slate-700">
                  Residential Address (पता)
                  <Input className="mt-1" {...form.register("address")} />
                </label>

                <div className="rounded-lg border bg-amber-50/40 p-4 space-y-3">
                  <div className="text-xs font-bold uppercase text-amber-900">
                    Previous School, Transfer Certificate (TC) & Inter-State Migration Record
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <label className="text-xs font-semibold text-slate-700 md:col-span-2">
                      Previous School Name (पूर्व विद्यालय)
                      <Input
                        className="mt-1 bg-white"
                        {...form.register("previousSchoolName")}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      Previous School UDISE Code
                      <Input
                        className="mt-1 bg-white"
                        {...form.register("previousSchoolUdise" as any)}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      Previous Board (पूर्व बोर्ड)
                      <Input
                        className="mt-1 bg-white"
                        {...form.register("previousSchoolBoard" as any)}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      Previous State (पूर्व राज्य)
                      <Input
                        className="mt-1 bg-white"
                        {...form.register("previousSchoolState" as any)}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      Previous District (पूर्व जिला)
                      <Input
                        className="mt-1 bg-white"
                        {...form.register("previousSchoolDistrict" as any)}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      Last Class Passed
                      <Input className="mt-1 bg-white" {...form.register("previousClass")} />
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      Previous Result % / Grade
                      <Input
                        className="mt-1 bg-white"
                        {...form.register("previousPercentage" as any)}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      TC Number (टीसी क्रमांक)
                      <Input className="mt-1 bg-white" {...form.register("tcNumber")} />
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      TC Issue Date
                      <Input
                        type="date"
                        className="mt-1 bg-white"
                        {...form.register("tcIssueDate")}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      Migration Certificate No
                      <Input
                        className="mt-1 bg-white"
                        {...form.register("migrationCertificateNo" as any)}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      Reason for Leaving Old School
                      <Input
                        className="mt-1 bg-white"
                        {...form.register("leavingReason" as any)}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={update.isPending}>
                    {update.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation(`/students/${studentId}`)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
