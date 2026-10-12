import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStudentSchema } from "@shared/schema";
import { useCreateStudent } from "@/hooks/use-students";
import { useSchoolCatalog } from "@/hooks/use-school-catalog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { readFileAsDataUrl } from "@/pages/Documents";
import { z } from "zod";
import { useLocation } from "wouter";
import {
  Bus,
  BookOpen,
  UserCheck,
  School,
  FileCheck2,
  Landmark,
  Upload,
} from "lucide-react";

const DEFAULT_STREAMS = [
  {
    id: -1,
    code: "PCM",
    name: "Science — Mathematics Group (PCM / गणित संकाय)",
    compulsorySubjects: "Hindi, English",
    coreSubjects: "Physics, Chemistry, Mathematics",
    electiveOptions: "Computer Science, Informatics Practices, Physical Education, Sanskrit",
    maxElectives: 1,
  },
  {
    id: -2,
    code: "PCB",
    name: "Science — Biology Group (PCB / जीव विज्ञान संकाय)",
    compulsorySubjects: "Hindi, English",
    coreSubjects: "Physics, Chemistry, Biology",
    electiveOptions:
      "Informatics Practices, Physical Education, Biotechnology, Mathematics (Additional)",
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
    name: "Commerce Group (वाणिज्य संकाय)",
    compulsorySubjects: "Hindi, English",
    coreSubjects: "Book Keeping & Accountancy, Business Studies",
    electiveOptions:
      "Economics, Informatics Practices, Business Mathematics, Industrial Organisation, Physical Education",
    maxElectives: 2,
  },
  {
    id: -5,
    code: "ARTS",
    name: "Arts / Humanities Group (कला संकाय)",
    compulsorySubjects: "Hindi, English",
    coreSubjects: "History, Political Science",
    electiveOptions:
      "Geography, Economics, Sociology, Psychology, Sanskrit, Home Science, Drawing & Painting",
    maxElectives: 2,
  },
  {
    id: -6,
    code: "AGRICULTURE",
    name: "Agriculture Group (कृषि संकाय)",
    compulsorySubjects: "Hindi, English",
    coreSubjects:
      "Elements of Science & Maths for Agriculture, Crop Production & Horticulture, Animal Husbandry & Poultry Farming",
    electiveOptions: "Physical Education, Computer Basics",
    maxElectives: 1,
  },
];

const INDIAN_STATES = [
  "Madhya Pradesh",
  "Uttar Pradesh",
  "Rajasthan",
  "Maharashtra",
  "Chhattisgarh",
  "Gujarat",
  "Bihar",
  "Delhi (NCT)",
  "Haryana",
  "Punjab",
  "Uttarakhand",
  "Jharkhand",
  "West Bengal",
  "Odisha",
  "Karnataka",
  "Tamil Nadu",
  "Telangana",
  "Andhra Pradesh",
  "Kerala",
  "Assam",
  "Other State / UT",
];

const EDUCATION_BOARDS = [
  "MP Board (MPBSE)",
  "CBSE (Central Board of Secondary Education)",
  "ICSE / CISCE",
  "UP Board (UPMSP)",
  "RBSE (Rajasthan Board)",
  "CG Board (CGBSE)",
  "Maharashtra State Board (MSBSHSE)",
  "Bihar Board (BSEB)",
  "Gujarat Board (GSEB)",
  "NIOS (Open School)",
  "Other State Board",
];

type PendingDocUpload = {
  documentType: string;
  label: string;
  file: File;
  dataUrl: string;
};

export default function Admissions() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { classOptions, sectionOptions } = useSchoolCatalog();
  const [, setLocation] = useLocation();
  const createStudent = useCreateStudent();
  const today = new Date().toISOString().slice(0, 10);

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
  });

  const streamsQuery = useQuery<any[]>({
    queryKey: ["/api/academic-streams"],
    queryFn: async () => {
      const res = await fetch("/api/academic-streams", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const availableStreams =
    streamsQuery.data && streamsQuery.data.length > 0 ? streamsQuery.data : DEFAULT_STREAMS;

  const form = useForm({
    resolver: zodResolver(insertStudentSchema),
    defaultValues: {
      admissionNo: "",
      admissionDate: today,
      admissionType: "new",
      name: "",
      gender: "Male",
      dob: undefined as string | undefined,
      bloodGroup: "",
      category: "General",
      religion: "Hindu",
      nationality: "Indian",
      motherTongue: "Hindi",
      medium: "Hindi",
      cwsnStatus: "No",
      rteAdmission: false,
      class: "1",
      section: "A",
      rollNo: "",
      aadhaar: "",
      samagraId: "",
      penNumber: "",
      apaarId: "",
      birthCertificateNo: "",
      fatherName: "",
      fatherOccupation: "",
      motherName: "",
      motherOccupation: "",
      annualIncome: undefined as number | undefined,
      contact: "",
      alternateContact: "",
      parentEmail: "",
      address: "",
      bankAccountNo: "",
      bankIfsc: "",
      bankName: "",
      previousSchoolName: "",
      previousSchoolUdise: "",
      previousSchoolBoard: "MP Board (MPBSE)",
      previousSchoolAddress: "",
      previousSchoolState: "Madhya Pradesh",
      previousSchoolDistrict: "",
      previousClass: "",
      previousPassingYear: String(new Date().getFullYear()),
      previousPercentage: "",
      tcNumber: "",
      tcIssueDate: undefined as string | undefined,
      migrationCertificateNo: "",
      migrationIssueDate: undefined as string | undefined,
      deoCountersigned: false,
      leavingReason: "Passed Previous Class / Higher Studies",
      previousConduct: "Good",
      tcSubmitted: false,
      reportCardSubmitted: false,
      birthCertificateSubmitted: false,
      aadhaarSubmitted: false,
      casteCertificateSubmitted: false,
      migrationSubmitted: false,
      photoSubmitted: false,
      photo: null as string | null,
      transportId: null as number | null,
      stream: null as string | null,
      streamId: null as number | null,
      electedSubjects: null as string | null,
    },
  });

  const selectedClass = form.watch("class");
  const admissionType = form.watch("admissionType");
  const isHigherSecondary = selectedClass === "11" || selectedClass === "12";
  const isTransferAdmission =
    admissionType === "same_state_transfer" || admissionType === "inter_state_transfer";

  const [selectedStreamCode, setSelectedStreamCode] = useState<string>("");
  const [selectedElectives, setSelectedElectives] = useState<string[]>([]);
  const [pendingDocs, setPendingDocs] = useState<PendingDocUpload[]>([]);

  const currentStreamObj = availableStreams.find((s) => s.code === selectedStreamCode);

  useEffect(() => {
    if (!isHigherSecondary) {
      setSelectedStreamCode("");
      setSelectedElectives([]);
      form.setValue("stream", null);
      form.setValue("streamId", null);
      form.setValue("electedSubjects", null);
    } else if (!selectedStreamCode && availableStreams.length > 0) {
      setSelectedStreamCode(availableStreams[0].code);
    }
  }, [isHigherSecondary, availableStreams, selectedStreamCode, form]);

  useEffect(() => {
    if (!isHigherSecondary || !currentStreamObj) return;
    const compulsory = (currentStreamObj.compulsorySubjects || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const core = (currentStreamObj.coreSubjects || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const combined = [...compulsory, ...core, ...selectedElectives].join(", ");
    form.setValue("stream", `${currentStreamObj.code} - ${currentStreamObj.name}`);
    form.setValue("streamId", currentStreamObj.id > 0 ? currentStreamObj.id : null);
    form.setValue("electedSubjects", combined);
  }, [isHigherSecondary, currentStreamObj, selectedElectives, form]);

  const toggleElective = (subj: string) => {
    setSelectedElectives((prev) =>
      prev.includes(subj) ? prev.filter((item) => item !== subj) : [...prev, subj],
    );
  };

  const handleAttachDoc = async (
    documentType: string,
    label: string,
    file: File | null,
  ) => {
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setPendingDocs((prev) => [
      ...prev.filter((d) => d.documentType !== documentType),
      { documentType, label, file, dataUrl },
    ]);
  };

  const onSubmit = (rawData: z.infer<typeof insertStudentSchema>) => {
    const cleanedData: any = {
      ...rawData,
      dob: rawData.dob || null,
      admissionDate: (rawData as any).admissionDate || null,
      tcIssueDate: rawData.tcIssueDate || null,
      migrationIssueDate: (rawData as any).migrationIssueDate || null,
      annualIncome: (rawData as any).annualIncome
        ? Number((rawData as any).annualIncome)
        : null,
    };

    createStudent.mutate(cleanedData, {
      onSuccess: async (createdStudent: any) => {
        // Upload any attached documents directly to the newly admitted student's profile!
        for (const doc of pendingDocs) {
          try {
            const mime =
              doc.file.type === "image/jpg"
                ? "image/jpeg"
                : ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
                      doc.file.type,
                    )
                  ? doc.file.type
                  : "image/jpeg";
            await apiRequest("POST", "/api/documents", {
              ownerType: "student",
              ownerId: createdStudent.id,
              documentType: doc.documentType,
              filename: doc.file.name.replace(/[\\/]/g, "_"),
              mimeType: mime,
              sizeBytes: doc.file.size,
              fileData: doc.dataUrl,
              remarks: "Uploaded at the time of admission",
            });
          } catch {
            // Continue even if one attachment fails
          }
        }
        qc.invalidateQueries({ queryKey: ["/api/documents"] });
        toast({
          title: "Admission Completed Successfully",
          description: `Student ${rawData.name} admitted to Class ${rawData.class}-${rawData.section}.`,
        });
        setLocation(`/students/${createdStudent.id}`);
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Admission Error",
          description: err.message || "Failed to save admission record.",
        });
      },
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <header className="mb-6 max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900">
            Complete Student Admission Form (प्रवेश आवेदन पत्र — UDISE+ / Board Standard)
          </h1>
          <p className="text-slate-500 mt-1">
            Supports Fresh Admission, Old School Transfer (TC), and Inter-State / Other Board Migration with direct document upload.
          </p>
        </header>

        <div className="max-w-5xl mx-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* SECTION 1: ADMISSION TYPE & CLASS DETAILS */}
              <Card className="border-indigo-200 shadow-sm">
                <CardHeader className="bg-indigo-50/50 border-b pb-4">
                  <CardTitle className="text-lg flex items-center gap-2 text-indigo-950">
                    <UserCheck className="w-5 h-5 text-indigo-600" />
                    1. Admission Type & Class Details (प्रवेश का प्रकार एवं कक्षा विवरण)
                  </CardTitle>
                  <CardDescription>
                    यदि बच्चा पुराने स्कूल से टीसी लेकर आया है या दूसरे राज्य (State/Board) से ट्रांसफर होकर आया है, तो नीचे सही विकल्प चुनें।
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      {
                        value: "new",
                        title: "1. Fresh / New Admission",
                        sub: "नया प्रवेश (पहली बार स्कूल में प्रवेश — Nursery/KG/Class 1)",
                      },
                      {
                        value: "same_state_transfer",
                        title: "2. Old School Transfer (TC)",
                        sub: "पुराने स्कूल से टीसी द्वारा प्रवेश (एक ही राज्य के अंदर)",
                      },
                      {
                        value: "inter_state_transfer",
                        title: "3. Inter-State / Other Board Transfer",
                        sub: "दूसरे राज्य या दूसरे बोर्ड से स्थानांतरण (TC + Migration / DEO)",
                      },
                    ].map((opt) => {
                      const active = admissionType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            form.setValue("admissionType" as any, opt.value);
                            if (opt.value === "inter_state_transfer") {
                              form.setValue("previousSchoolState" as any, "Rajasthan");
                            }
                          }}
                          className={`rounded-xl border-2 p-4 text-left transition ${
                            active
                              ? "border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div className="font-bold text-sm text-slate-900">{opt.title}</div>
                          <div className="text-xs text-slate-600 mt-1">{opt.sub}</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="admissionNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Admission No (प्रवेश क्रमांक - वैकल्पिक)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Auto-generated if blank" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"admissionDate" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Admission Date (प्रवेश दिनांक) *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="class"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Admitted Class (प्रवेश कक्षा) *</FormLabel>
                          <FormControl>
                            <select
                              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm font-medium"
                              {...field}
                            >
                              {classOptions.map((c) => (
                                <option key={c} value={c}>
                                  Class {c}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="section"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Section (सेक्शन) *</FormLabel>
                          <FormControl>
                            <select
                              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm font-medium"
                              {...field}
                            >
                              {sectionOptions.map((sec) => (
                                <option key={sec} value={sec}>
                                  Section {sec}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <FormField
                      control={form.control}
                      name="rollNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Roll Number (रोल नंबर - वैकल्पिक)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., 101"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"medium" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medium of Study (माध्यम)</FormLabel>
                          <FormControl>
                            <select
                              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                              {...field}
                              value={field.value || "Hindi"}
                            >
                              <option value="Hindi">Hindi Medium (हिंदी माध्यम)</option>
                              <option value="English">English Medium (अंग्रेजी माध्यम)</option>
                              <option value="Bilingual">Bilingual (द्विभाषी)</option>
                            </select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"rteAdmission" as any}
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 rounded-lg border bg-slate-50 px-3 h-10 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={Boolean(field.value)}
                              onChange={(e) => field.onChange(e.target.checked)}
                            />
                          </FormControl>
                          <FormLabel className="text-xs font-semibold cursor-pointer">
                            RTE 25% Free Admission Quota (आरटीई नि:शुल्क प्रवेश)
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Class 11 & 12 Stream & Subject Selection */}
                  {isHigherSecondary && (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-4">
                      <div className="flex items-center gap-2 font-bold text-indigo-950 text-sm">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                        Higher Secondary Stream & Elective Subjects (कक्षा {selectedClass} संकाय एवं विषय चुनाव)
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Select Stream / Faculty (संकाय चुनें — PCM / PCB / Commerce / Arts / Agriculture) *
                        </label>
                        <select
                          className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm font-medium"
                          value={selectedStreamCode}
                          onChange={(e) => {
                            setSelectedStreamCode(e.target.value);
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

                      {currentStreamObj && (
                        <div className="space-y-3 rounded-lg border bg-white p-4 text-sm">
                          <div className="flex flex-wrap gap-2">
                            <span className="text-xs font-semibold text-slate-500">
                              Compulsory + Core Subjects:
                            </span>
                            {[
                              ...(currentStreamObj.compulsorySubjects || "").split(","),
                              ...(currentStreamObj.coreSubjects || "").split(","),
                            ]
                              .map((s: string) => s.trim())
                              .filter(Boolean)
                              .map((subj: string) => (
                                <span
                                  key={subj}
                                  className="rounded bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-900"
                                >
                                  ✓ {subj}
                                </span>
                              ))}
                          </div>
                          {currentStreamObj.electiveOptions && (
                            <div>
                              <span className="text-xs font-semibold text-slate-600 block mb-1.5">
                                Choose Optional / Elective Subject (ऐच्छिक विषय चुनें - Max{" "}
                                {currentStreamObj.maxElectives || 1}):
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {currentStreamObj.electiveOptions
                                  .split(",")
                                  .map((s: string) => s.trim())
                                  .filter(Boolean)
                                  .map((subj: string) => {
                                    const checked = selectedElectives.includes(subj);
                                    return (
                                      <button
                                        key={subj}
                                        type="button"
                                        onClick={() => toggleElective(subj)}
                                        className={`rounded-md border px-3 py-1 text-xs font-medium transition ${
                                          checked
                                            ? "border-indigo-600 bg-indigo-600 text-white"
                                            : "bg-slate-50 text-slate-700 hover:bg-slate-100"
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
                          <div className="pt-2 border-t text-xs text-slate-600">
                            <b>Final Subjects:</b> {form.watch("electedSubjects") || "—"}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* SECTION 2: PERSONAL DETAILS & GOVERNMENT / UDISE+ IDS */}
              <Card className="shadow-sm">
                <CardHeader className="bg-slate-50 border-b pb-4">
                  <CardTitle className="text-lg">
                    2. Student Personal Details & Mandatory Govt IDs (व्यक्तिगत जानकारी एवं सरकारी/UDISE+ आईडी)
                  </CardTitle>
                  <CardDescription>
                    Aadhaar, Samagra ID, UDISE+ 11-Digit PEN (Permanent Education Number) और APAAR ID भरें।
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Student Full Name (छात्र/छात्रा का पूरा नाम) *</FormLabel>
                            <FormControl>
                              <Input placeholder="As per Birth Certificate / TC" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name={"gender" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender (लिंग) *</FormLabel>
                          <FormControl>
                            <select
                              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                              {...field}
                              value={field.value || "Male"}
                            >
                              <option value="Male">Male (बालक)</option>
                              <option value="Female">Female (बालिका)</option>
                              <option value="Other">Other (अन्य)</option>
                            </select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dob"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth (जन्म तिथि) *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Social Category (जाति वर्ग) *</FormLabel>
                          <FormControl>
                            <select
                              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                              {...field}
                              value={field.value || "General"}
                            >
                              <option value="General">General (सामान्य)</option>
                              <option value="OBC">OBC (अन्य पिछड़ा वर्ग)</option>
                              <option value="SC">SC (अनुसूचित जाति)</option>
                              <option value="ST">ST (अनुसूचित जनजाति)</option>
                              <option value="EWS">EWS (आर्थिक रूप से कमजोर)</option>
                            </select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"religion" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Religion (धर्म)</FormLabel>
                          <FormControl>
                            <select
                              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                              {...field}
                              value={field.value || "Hindu"}
                            >
                              <option value="Hindu">Hindu</option>
                              <option value="Muslim">Muslim</option>
                              <option value="Sikh">Sikh</option>
                              <option value="Christian">Christian</option>
                              <option value="Jain">Jain</option>
                              <option value="Buddhist">Buddhist</option>
                              <option value="Other">Other</option>
                            </select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"bloodGroup" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Blood Group (ब्लड ग्रुप)</FormLabel>
                          <FormControl>
                            <select
                              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                              {...field}
                              value={field.value || ""}
                            >
                              <option value="">-- Select --</option>
                              {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                                <option key={bg} value={bg}>
                                  {bg}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"cwsnStatus" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Divyang / CWSN (दिव्यांगता)</FormLabel>
                          <FormControl>
                            <select
                              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                              {...field}
                              value={field.value || "No"}
                            >
                              <option value="No">No (नहीं)</option>
                              <option value="Physical">Locomotor / Physical</option>
                              <option value="Visual">Visual Impairment</option>
                              <option value="Hearing">Hearing Impairment</option>
                              <option value="Learning">Specific Learning Disability</option>
                            </select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-2 border-t">
                    <FormField
                      control={form.control}
                      name="aadhaar"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Aadhaar No (12-अंक आधार)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="12-digit Aadhaar"
                              maxLength={14}
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"samagraId" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Samagra ID (9-अंक समग्र आईडी)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="9-digit Member ID"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"penNumber" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UDISE+ PEN (11-Digit PEN)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Permanent Edu No."
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"apaarId" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>APAAR / ABC ID (12-अंक)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="APAAR ID"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="birthCertificateNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Birth Cert. No (जन्म प्रमाण नं.)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Certificate No"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* SECTION 3: OLD SCHOOL TRANSFER (TC) & INTER-STATE MIGRATION RECORDS */}
              <Card
                className={
                  isTransferAdmission
                    ? "border-2 border-amber-400 bg-amber-50/30 shadow-md"
                    : "border-slate-200 shadow-sm"
                }
              >
                <CardHeader className="border-b bg-amber-50/60 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2 text-amber-950">
                    <School className="w-5 h-5 text-amber-700" />
                    3. Previous School, Transfer Certificate (TC) & Inter-State Migration Details (जब बच्चा पुराना स्कूल छोड़कर या दूसरे राज्य से आता है)
                  </CardTitle>
                  <CardDescription className="text-amber-900">
                    <b>नियम (CBSE / MP Board / UDISE+):</b> जब बच्चा पुराना स्कूल छोड़कर आता है, तो{" "}
                    <b>Original TC क्रमांक, पूर्व स्कूल का 11-अंकीय UDISE कोड, Student PEN</b> और{" "}
                    <b>अंतिम उत्तीर्ण कक्षा की अंकसूची</b> अनिवार्य है। यदि बच्चा{" "}
                    <b>दूसरे राज्य (Inter-State) या दूसरे बोर्ड</b> से आया है, तो{" "}
                    <b>Migration Certificate</b> या <b>DEO (जिला शिक्षा अधिकारी) द्वारा प्रतिहस्ताक्षरित TC</b> भी दर्ज करें।
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <FormField
                        control={form.control}
                        name="previousSchoolName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Previous School Name (पूर्व विद्यालय का पूरा नाम){" "}
                              {isTransferAdmission ? "*" : ""}
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="bg-white"
                                placeholder="e.g., Govt Model Higher Secondary School, Bhopal"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name={"previousSchoolUdise" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Previous School UDISE+ Code (पूर्व विद्यालय का 11-अंक UDISE कोड)
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="bg-white"
                              placeholder="11-digit UDISE Code"
                              maxLength={11}
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name={"previousSchoolBoard" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Previous Education Board (पूर्व बोर्ड)</FormLabel>
                          <FormControl>
                            <select
                              className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm"
                              {...field}
                              value={field.value || "MP Board (MPBSE)"}
                            >
                              {EDUCATION_BOARDS.map((b) => (
                                <option key={b} value={b}>
                                  {b}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"previousSchoolState" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Previous School State (पूर्व राज्य — Inter-State हेतु)
                          </FormLabel>
                          <FormControl>
                            <select
                              className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm"
                              {...field}
                              value={field.value || "Madhya Pradesh"}
                            >
                              {INDIAN_STATES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"previousSchoolDistrict" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Previous District / City (पूर्व जिला/शहर)</FormLabel>
                          <FormControl>
                            <Input
                              className="bg-white"
                              placeholder="e.g., Indore / Kota / Nagpur"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="previousClass"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Class Passed (अंतिम उत्तीर्ण कक्षा)</FormLabel>
                          <FormControl>
                            <Input
                              className="bg-white"
                              placeholder="e.g., Class 8 / Class 10"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name={"previousPassingYear" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Passing Year (उत्तीर्ण वर्ष)</FormLabel>
                          <FormControl>
                            <Input
                              className="bg-white"
                              placeholder="e.g., 2026"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"previousPercentage" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Previous Result % / Grade (प्रतिशत / ग्रेड)</FormLabel>
                          <FormControl>
                            <Input
                              className="bg-white"
                              placeholder="e.g., 82.5% / A+"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tcNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Transfer Certificate (TC) No (टीसी क्रमांक){" "}
                            {isTransferAdmission ? "*" : ""}
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="bg-white"
                              placeholder="TC / SLC Book & Serial No"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tcIssueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>TC Issue Date (टीसी जारी होने की तिथि)</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              className="bg-white"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-amber-200 items-end">
                    <FormField
                      control={form.control}
                      name={"migrationCertificateNo" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Migration Certificate No (माइग्रेशन क्र. — अन्य राज्य/बोर्ड)
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="bg-white"
                              placeholder="Migration No (if Inter-State/Board)"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"migrationIssueDate" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Migration Issue Date (माइग्रेशन तिथि)</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              className="bg-white"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"leavingReason" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reason for Leaving Old School (छोड़ने का कारण)</FormLabel>
                          <FormControl>
                            <Input
                              className="bg-white"
                              placeholder="e.g., Parent Transfer / Higher Class"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"deoCountersigned" as any}
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 rounded-lg border bg-white px-3 h-10 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={Boolean(field.value)}
                              onChange={(e) => field.onChange(e.target.checked)}
                            />
                          </FormControl>
                          <FormLabel className="text-xs font-semibold cursor-pointer">
                            DEO / RO Countersigned TC (जिला शिक्षा अधिकारी प्रतिहस्ताक्षरित)
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* SECTION 4: PARENTS, GUARDIAN, CONTACT & SCHOLARSHIP BANK DETAILS */}
              <Card className="shadow-sm">
                <CardHeader className="bg-slate-50 border-b pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-indigo-600" />
                    4. Parents, Contact, Address & Scholarship Bank Details (माता-पिता, पता एवं छात्रवृत्ति बैंक विवरण)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="fatherName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Father&apos;s Name (पिता का नाम) *</FormLabel>
                          <FormControl>
                            <Input placeholder="Father's Full Name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"fatherOccupation" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Father&apos;s Occupation (पिता का व्यवसाय)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Farmer / Business / Govt Job"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="motherName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mother&apos;s Name (माता का नाम) *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Mother's Full Name"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"motherOccupation" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mother&apos;s Occupation (माता का व्यवसाय)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Homemaker / Teacher"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="contact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Mobile / WhatsApp (मोबाइल नंबर) *</FormLabel>
                          <FormControl>
                            <Input placeholder="10-digit mobile number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"alternateContact" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alternate / Emergency Mobile (वैकल्पिक नंबर)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Optional second number"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"parentEmail" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parent Email ID (ईमेल - वैकल्पिक)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="parent@example.com"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"annualIncome" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Annual Family Income (वार्षिक आय ₹)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="e.g., 120000"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? Number(e.target.value) : undefined,
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complete Residential Address (पूरा स्थायी एवं वर्तमान पता) *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="House No, Ward/Colony, Tehsil, District, State, PIN Code"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
                    <FormField
                      control={form.control}
                      name={"bankAccountNo" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Student/Parent Bank Account No (छात्रवृत्ति हेतु खाता संख्या)
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Bank Account Number"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"bankIfsc" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank IFSC Code (आईएफएससी कोड)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., SBIN0001234"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"bankName" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Name & Branch (बैंक का नाम व शाखा)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., State Bank of India, MP Nagar"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* SECTION 5: DOCUMENTS CHECKLIST & DIRECT FILE UPLOAD DURING ADMISSION */}
              <Card className="border-emerald-200 shadow-sm">
                <CardHeader className="bg-emerald-50/50 border-b pb-4">
                  <CardTitle className="text-lg flex items-center gap-2 text-emerald-950">
                    <FileCheck2 className="w-5 h-5 text-emerald-700" />
                    5. Admission Documents Checklist & Direct File Upload (दस्तावेज़ जांच सूची एवं स्कैन अपलोड)
                  </CardTitle>
                  <CardDescription>
                    प्रवेश के समय कौन-कौन से मूल दस्तावेज़ जमा किए गए हैं उन पर टिक करें और नीचे से सीधे फ़ाइल (Photo / PDF) अपलोड भी कर सकते हैं।
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {[
                      {
                        name: "tcSubmitted",
                        label: "Original Transfer Certificate (मूल टीसी जमा)",
                      },
                      {
                        name: "reportCardSubmitted",
                        label: "Previous Marksheet / Report Card (अंकसूची जमा)",
                      },
                      {
                        name: "birthCertificateSubmitted",
                        label: "Birth Certificate (जन्म प्रमाण पत्र जमा)",
                      },
                      {
                        name: "aadhaarSubmitted",
                        label: "Student & Parent Aadhaar (आधार कार्ड जमा)",
                      },
                      {
                        name: "casteCertificateSubmitted",
                        label: "Caste / Samagra / Income Cert. (जाति/समग्र जमा)",
                      },
                      {
                        name: "migrationSubmitted",
                        label: "Migration Certificate (अन्य राज्य/बोर्ड माइग्रेशन)",
                      },
                      {
                        name: "photoSubmitted",
                        label: "Passport Size Photos (पासपोर्ट फोटो जमा)",
                      },
                    ].map((item) => (
                      <FormField
                        key={item.name}
                        control={form.control}
                        name={item.name as any}
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2 rounded-lg border bg-white p-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={Boolean(field.value)}
                                onChange={(e) => field.onChange(e.target.checked)}
                              />
                            </FormControl>
                            <FormLabel className="text-xs font-medium cursor-pointer leading-snug">
                              {item.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>

                  {/* Direct Scan / File Uploads right inside Admission Form */}
                  <div className="rounded-xl border bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-700">
                      <Upload className="h-4 w-4 text-indigo-600" />
                      Optional: Upload Scanned Documents / Student Photo Right Now (सीधे फोटो या PDF संलग्न करें)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          1. Student Passport Photo (छात्र का फोटो)
                        </label>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={async (e) => {
                            const f = e.target.files?.[0] ?? null;
                            if (f) {
                              const url = await readFileAsDataUrl(f);
                              form.setValue("photo", url);
                              form.setValue("photoSubmitted" as any, true);
                              await handleAttachDoc("passport-photo", "Passport Photo", f);
                            }
                          }}
                          className="block w-full text-xs border rounded bg-white p-1.5"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          2. Transfer Certificate (TC) Scan (टीसी की फोटो/PDF)
                        </label>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={async (e) => {
                            const f = e.target.files?.[0] ?? null;
                            if (f) {
                              form.setValue("tcSubmitted", true);
                              await handleAttachDoc("transfer-certificate", "Transfer Certificate", f);
                            }
                          }}
                          className="block w-full text-xs border rounded bg-white p-1.5"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          3. Aadhaar / Marksheet / Birth Cert (आधार या अंकसूची)
                        </label>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={async (e) => {
                            const f = e.target.files?.[0] ?? null;
                            if (f) {
                              form.setValue("aadhaarSubmitted" as any, true);
                              await handleAttachDoc("aadhaar-card", "Aadhaar / Marksheet", f);
                            }
                          }}
                          className="block w-full text-xs border rounded bg-white p-1.5"
                        />
                      </div>
                    </div>
                    {pendingDocs.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 text-xs">
                        {pendingDocs.map((d) => (
                          <span
                            key={d.documentType}
                            className="rounded-md bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800"
                          >
                            ✓ Attached: {d.label} ({d.file.name})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* SECTION 6: TRANSPORT */}
              <Card className="border border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bus className="w-4 h-4" />
                    6. Transport / Bus Service (स्कूल बस सुविधा - वैकल्पिक)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="transportId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Bus Route (बस रूट चुनें)</FormLabel>
                        <FormControl>
                          <select
                            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                            value={field.value == null ? "" : String(field.value)}
                            onChange={(e) =>
                              field.onChange(e.target.value ? Number(e.target.value) : null)
                            }
                          >
                            <option value="">No Transport (स्वयं का साधन)</option>
                            {transportRoutes.data?.map((route) => (
                              <option key={route.id} value={route.id}>
                                {route.routeName} — ₹{route.amount.toLocaleString()}/month
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex gap-4 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => setLocation("/students")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-base font-semibold"
                  disabled={createStudent.isPending}
                >
                  {createStudent.isPending
                    ? "Saving Complete Admission Record..."
                    : "Complete Admission & Open Student Profile"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </main>
    </div>
  );
}
