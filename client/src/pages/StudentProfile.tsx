import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { QueryError } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStudent, useDeactivateStudent } from "@/hooks/use-students";
import { useActiveSession } from "@/hooks/use-core";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { DOCUMENT_TYPE_OPTIONS, readFileAsDataUrl } from "@/pages/Documents";
import {
  ArrowLeft,
  Pencil,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Eye,
  Download,
  Award,
  FileText,
  IdCard,
  ShieldCheck,
  School,
} from "lucide-react";

const QUICK_REJECTION_REASONS = [
  "Document blur hai / saaf nahi dikh raha, कृपया साफ़ फोटो या PDF दोबारा अपलोड करें",
  "Galat document upload kiya gaya hai (Wrong document uploaded)",
  "Original TC ke dono side (आगे-पीछे) ka scan upload karein",
  "Aadhaar / Marksheet me naam ya जन्म तिथि अधूरी दिख रही है",
  "Inter-State Transfer ke liye DEO Countersigned TC ya Migration Certificate upload karein",
];

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const studentId = Number(id);
  const [, setLocation] = useLocation();
  const { data: user } = useAuth();
  const qc = useQueryClient();

  const studentQuery = useStudent(studentId);
  const sessionQuery = useActiveSession();
  const deactivate = useDeactivateStudent();

  const canManage = ["admin", "principal", "accountant", "staff", "teacher"].includes(
    user?.role ?? "",
  );
  const canReviewDocs = ["admin", "principal", "accountant"].includes(user?.role ?? "");

  const [documentType, setDocumentType] = useState("aadhaar-card");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState("");
  const [remarks, setRemarks] = useState("");
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [rejectingDoc, setRejectingDoc] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [docMessage, setDocMessage] = useState("");

  const studentDocs = useQuery<any[]>({
    queryKey: ["/api/documents", "student", studentId],
    queryFn: async () => {
      const res = await fetch(`/api/documents?ownerType=student&ownerId=${studentId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!studentId && !!user,
  });

  const docTypeLabel = new Map(DOCUMENT_TYPE_OPTIONS.map((d) => [d.value, d.label]));

  const uploadStudentDoc = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !fileDataUrl) throw new Error("Please select a file first.");
      const normalizedMime =
        selectedFile.type === "image/jpg"
          ? "image/jpeg"
          : ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(selectedFile.type)
            ? selectedFile.type
            : "image/jpeg";
      return apiRequest("POST", "/api/documents", {
        ownerType: "student",
        ownerId: studentId,
        documentType,
        filename: selectedFile.name.replace(/[\\/]/g, "_"),
        mimeType: normalizedMime,
        sizeBytes: selectedFile.size,
        fileData: fileDataUrl,
        remarks: remarks.trim() || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/documents", "student", studentId] });
      qc.invalidateQueries({ queryKey: ["/api/documents"] });
      setSelectedFile(null);
      setFileDataUrl("");
      setRemarks("");
      setDocMessage("Document uploaded to student profile.");
    },
  });

  const reviewDoc = useMutation({
    mutationFn: ({
      docId,
      status,
      reason,
    }: {
      docId: number;
      status: "approved" | "rejected";
      reason?: string;
    }) =>
      apiRequest("PATCH", `/api/documents/${docId}/review`, {
        status,
        rejectionReason: status === "rejected" ? reason : null,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/documents", "student", studentId] });
      qc.invalidateQueries({ queryKey: ["/api/documents"] });
      setRejectingDoc(null);
      setRejectionReason("");
      setDocMessage(
        vars.status === "approved"
          ? "Document Approved & Verified ✅"
          : "Document Rejected with reason — Student/Parent will see this reason in their portal.",
      );
    },
  });

  const st: any = studentQuery.data;

  const admissionTypeBadge = (type?: string) => {
    if (type === "inter_state_transfer") {
      return (
        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">
          Inter-State / Other Board Transfer (अंतर-राज्यीय स्थानांतरण)
        </span>
      );
    }
    if (type === "same_state_transfer" || st?.previousSchoolName || st?.tcNumber) {
      return (
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
          Transfer from Old School (पुराने स्कूल से टीसी द्वारा प्रवेश)
        </span>
      );
    }
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
        Fresh / New Admission (नया प्रवेश)
      </span>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button variant="ghost" onClick={() => setLocation("/students")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Students Directory
          </Button>
          {st && (
            <div className="flex flex-wrap gap-2">
              <Link href="/report-cards">
                <Button variant="outline" size="sm">
                  <Award className="mr-1.5 h-4 w-4 text-indigo-600" /> Report Card
                </Button>
              </Link>
              <Link href="/student-id-cards">
                <Button variant="outline" size="sm">
                  <IdCard className="mr-1.5 h-4 w-4 text-indigo-600" /> ID Card
                </Button>
              </Link>
              <Link href="/certificates">
                <Button variant="outline" size="sm">
                  <FileText className="mr-1.5 h-4 w-4 text-indigo-600" /> Issue TC / Certificate
                </Button>
              </Link>
              {canManage && (
                <Button size="sm" onClick={() => setLocation(`/students/${st.id}/edit`)}>
                  <Pencil className="mr-1.5 h-4 w-4" /> Edit Full Admission Record
                </Button>
              )}
              {canManage && st.isActive && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deactivate.isPending}
                  onClick={async () => {
                    if (window.confirm("Deactivate this student?")) {
                      await deactivate.mutateAsync(st.id);
                      await studentQuery.refetch();
                    }
                  }}
                >
                  Deactivate
                </Button>
              )}
            </div>
          )}
        </div>

        {studentQuery.isLoading ? (
          <p className="mt-8">Loading student profile...</p>
        ) : studentQuery.isError ? (
          <QueryError message={studentQuery.error.message} onRetry={() => studentQuery.refetch()} />
        ) : !st ? (
          <QueryError message="Student not found." />
        ) : (
          <div className="space-y-6">
            {/* Top Student Banner */}
            <Card className="border-indigo-200 bg-white shadow-sm">
              <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-full border-2 border-indigo-200 bg-indigo-50 flex items-center justify-center overflow-hidden text-2xl font-bold text-indigo-700">
                    {st.photo ? (
                      <img src={st.photo} alt={st.name} className="h-full w-full object-cover" />
                    ) : (
                      st.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold text-slate-900">{st.name}</h1>
                      {admissionTypeBadge(st.admissionType)}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          st.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {st.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      <b>Admission No:</b> {st.admissionNo} · <b>Class:</b> {st.class}-
                      {st.section} {st.rollNo ? `(Roll No: ${st.rollNo})` : ""} ·{" "}
                      <b>Session:</b> {sessionQuery.data?.name || "Active"}
                    </p>
                    {st.stream && (
                      <p className="text-xs font-semibold text-indigo-700">
                        Stream: {st.stream} · Subjects: {st.electedSubjects || "—"}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SECTION 1: STUDENT UPLOADED DOCUMENTS & DIRECT VERIFICATION (APPROVE / REJECT) */}
            <Card className="border-indigo-300 shadow-sm">
              <CardHeader className="bg-indigo-50/50 border-b">
                <CardTitle className="flex items-center gap-2 text-indigo-950">
                  <ShieldCheck className="h-5 w-5 text-indigo-600" />
                  Student Uploaded Documents & Direct Verification (प्रोफ़ाइल के अंदर से दस्तावेज़ देखें एवं Approve / Reject करें)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                {docMessage && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                    {docMessage}
                  </div>
                )}

                {/* Upload Document directly into this student's profile */}
                <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                  <div className="text-xs font-bold uppercase text-slate-600">
                    Upload New Document for {st.name}
                  </div>
                  <div className="grid gap-3 md:grid-cols-4 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        1. Document Type (दस्तावेज़ का प्रकार) *
                      </label>
                      <select
                        className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={documentType}
                        onChange={(e) => setDocumentType(e.target.value)}
                      >
                        {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        2. Choose File (Photo या PDF चुनें) *
                      </label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={async (e) => {
                          const f = e.target.files?.[0] ?? null;
                          setSelectedFile(f);
                          setFileDataUrl(f ? await readFileAsDataUrl(f) : "");
                        }}
                        className="block w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 border rounded-md bg-white p-1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        3. Document Number / Note (वैकल्पिक)
                      </label>
                      <Input
                        className="bg-white"
                        placeholder="e.g., TC No / Aadhaar Verified"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                      />
                    </div>
                    <Button
                      className="h-10 bg-indigo-600 hover:bg-indigo-700"
                      disabled={!selectedFile || uploadStudentDoc.isPending}
                      onClick={() => uploadStudentDoc.mutate()}
                    >
                      <Upload className="h-4 w-4 mr-1.5" />
                      {uploadStudentDoc.isPending ? "Uploading..." : "Upload to Profile"}
                    </Button>
                  </div>
                </div>

                {/* List of Student's Uploaded Documents with Approve / Reject */}
                {studentDocs.isLoading ? (
                  <p className="text-sm text-slate-500">Loading student documents...</p>
                ) : !studentDocs.data?.length ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
                    No documents uploaded for {st.name} yet. Parents/Students can upload from their portal, or you can upload above.
                  </div>
                ) : (
                  <div className="divide-y rounded-lg border bg-white">
                    {studentDocs.data.map((d) => {
                      const status = d.status || "pending";
                      return (
                        <div
                          key={d.id}
                          className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-900">
                                {docTypeLabel.get(d.documentType) || d.documentType}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  status === "approved"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : status === "rejected"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {status === "approved" ? (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Approved / Verified
                                  </>
                                ) : status === "rejected" ? (
                                  <>
                                    <XCircle className="h-3.5 w-3.5" /> Rejected
                                  </>
                                ) : (
                                  <>
                                    <Clock className="h-3.5 w-3.5" /> Pending Verification
                                  </>
                                )}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600">
                              File: <b>{d.filename}</b> (
                              {Math.max(1, Math.round((d.sizeBytes || 0) / 1024))} KB)
                              {d.remarks ? ` · Note: ${d.remarks}` : ""}
                            </div>
                            {status === "rejected" && d.rejectionReason && (
                              <div className="mt-1 rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-900">
                                <b>Rejection Reason:</b> {d.rejectionReason}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {d.fileData && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setPreviewDoc(d)}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" /> View Document
                                </Button>
                                <a
                                  href={d.fileData}
                                  download={d.filename || "document"}
                                  className="inline-flex items-center justify-center rounded-md border bg-white px-3 h-9 text-xs font-medium hover:bg-slate-50"
                                >
                                  <Download className="h-3.5 w-3.5 mr-1" /> Download
                                </a>
                              </>
                            )}
                            {canReviewDocs && (
                              <>
                                {status !== "approved" && (
                                  <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() =>
                                      reviewDoc.mutate({ docId: d.id, status: "approved" })
                                    }
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                                  </Button>
                                )}
                                {status !== "rejected" && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setRejectingDoc(d);
                                      setRejectionReason(d.rejectionReason || "");
                                    }}
                                  >
                                    <XCircle className="h-3.5 w-3.5 mr-1" /> Reject with Reason
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SECTION 2: PERSONAL & GOVERNMENT IDS */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Personal, Academic & Government IDs (व्यक्तिगत एवं सरकारी आईडी)
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    ["Gender (लिंग)", st.gender || "—"],
                    ["Date of Birth (जन्म तिथि)", st.dob || "—"],
                    ["Blood Group (ब्लड ग्रुप)", st.bloodGroup || "—"],
                    ["Category (जाति वर्ग)", st.category || "General"],
                    ["Religion (धर्म)", st.religion || "—"],
                    ["Medium (माध्यम)", st.medium || "Hindi"],
                    ["Aadhaar No (आधार नंबर)", st.aadhaar || "—"],
                    ["Samagra ID (समग्र आईडी)", st.samagraId || "—"],
                    ["UDISE+ PEN No (11-Digit PEN)", st.penNumber || "—"],
                    ["APAAR / ABC ID", st.apaarId || "—"],
                    ["Birth Certificate No", st.birthCertificateNo || "—"],
                    ["RTE 25% Quota Admission", st.rteAdmission ? "Yes (RTE)" : "No"],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="font-semibold text-slate-900">{val}</dd>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Family, Contact & Bank Details (माता-पिता एवं छात्रवृत्ति बैंक विवरण)
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    ["Father's Name (पिता का नाम)", st.fatherName || "—"],
                    ["Father's Occupation", st.fatherOccupation || "—"],
                    ["Mother's Name (माता का नाम)", st.motherName || "—"],
                    ["Mother's Occupation", st.motherOccupation || "—"],
                    [
                      "Annual Family Income",
                      st.annualIncome ? `₹${Number(st.annualIncome).toLocaleString()}` : "—",
                    ],
                    ["Primary Mobile", st.contact || "—"],
                    ["Alternate Mobile", st.alternateContact || "—"],
                    ["Parent Email", st.parentEmail || "—"],
                    ["Bank Account No", st.bankAccountNo || "—"],
                    ["Bank IFSC & Name", `${st.bankIfsc || "—"} (${st.bankName || "—"})`],
                    ["Address (पता)", st.address || "—"],
                  ].map(([label, val]) => (
                    <div key={label} className={label.startsWith("Address") ? "col-span-2" : ""}>
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="font-semibold text-slate-900">{val}</dd>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* SECTION 3: OLD SCHOOL TRANSFER & INTER-STATE MIGRATION RECORDS */}
            <Card className="border-amber-200 bg-amber-50/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <School className="h-5 w-5 text-amber-700" />
                  Previous School, Transfer Certificate (TC) & Inter-State Migration Record (पूर्व विद्यालय एवं स्थानांतरण रिकॉर्ड)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {[
                    ["Admission Type", st.admissionType || "new"],
                    ["Previous School Name (पूर्व विद्यालय)", st.previousSchoolName || "—"],
                    ["Previous School UDISE Code", st.previousSchoolUdise || "—"],
                    ["Previous Board (पूर्व बोर्ड)", st.previousSchoolBoard || "—"],
                    ["Previous State (पूर्व राज्य)", st.previousSchoolState || "—"],
                    ["Previous District (पूर्व जिला)", st.previousSchoolDistrict || "—"],
                    ["Last Class Passed (अंतिम उत्तीर्ण कक्षा)", st.previousClass || "—"],
                    [
                      "Passing Year & %",
                      `${st.previousPassingYear || "—"} (${st.previousPercentage || "—"})`,
                    ],
                    ["Transfer Certificate (TC) No", st.tcNumber || "—"],
                    ["TC Issue Date (टीसी दिनांक)", st.tcIssueDate || "—"],
                    ["Migration Certificate No", st.migrationCertificateNo || "—"],
                    ["Migration Issue Date", st.migrationIssueDate || "—"],
                    [
                      "DEO Countersigned TC (Inter-State)",
                      st.deoCountersigned ? "Yes (Verified)" : "No",
                    ],
                    ["Reason for Leaving Old School", st.leavingReason || "—"],
                    ["Previous School Conduct", st.previousConduct || "Good"],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="font-semibold text-slate-900">{val}</dd>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t flex flex-wrap gap-2 text-xs">
                  <span className="font-semibold text-slate-700 mr-1">
                    Submitted Documents Checklist:
                  </span>
                  {[
                    ["Original TC Submitted", st.tcSubmitted],
                    ["Previous Report Card / Marksheet", st.reportCardSubmitted],
                    ["Birth Certificate", st.birthCertificateSubmitted],
                    ["Aadhaar Card", st.aadhaarSubmitted],
                    ["Caste / Samagra Certificate", st.casteCertificateSubmitted],
                    ["Migration Certificate", st.migrationSubmitted],
                    ["Passport Photos", st.photoSubmitted],
                  ].map(([name, ok]) => (
                    <span
                      key={String(name)}
                      className={`rounded-full px-2.5 py-0.5 font-semibold ${
                        ok
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {ok ? "✓ " : "○ "}
                      {name}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Document Preview Modal */}
        <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {previewDoc
                  ? `${docTypeLabel.get(previewDoc.documentType) || previewDoc.documentType} — ${previewDoc.filename}`
                  : "Preview"}
              </DialogTitle>
            </DialogHeader>
            {previewDoc && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-slate-100 p-4 flex justify-center">
                  {previewDoc.fileData?.startsWith("data:application/pdf") ? (
                    <iframe
                      src={previewDoc.fileData}
                      title={previewDoc.filename}
                      className="w-full h-[65vh] rounded border bg-white"
                    />
                  ) : previewDoc.fileData ? (
                    <img
                      src={previewDoc.fileData}
                      alt={previewDoc.filename}
                      className="max-h-[65vh] object-contain rounded border bg-white"
                    />
                  ) : null}
                </div>
                {canReviewDocs && (
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        reviewDoc.mutate({ docId: previewDoc.id, status: "approved" });
                        setPreviewDoc(null);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Approve Document
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setRejectingDoc(previewDoc);
                        setRejectionReason(previewDoc.rejectionReason || "");
                        setPreviewDoc(null);
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reject with Reason
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Modal */}
        <Dialog open={!!rejectingDoc} onOpenChange={(open) => !open && setRejectingDoc(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Reject Document & Write Reason for Parent/Student</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_REJECTION_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRejectionReason(r)}
                    className="rounded border bg-slate-50 px-2.5 py-1 text-left text-xs text-slate-700 hover:bg-indigo-50"
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rejection Reason (अस्वीकृत करने का कारण लिखें) *
                </label>
                <textarea
                  className="w-full min-h-[90px] rounded-md border p-3 text-sm"
                  placeholder="Write why this document is rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRejectingDoc(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={!rejectionReason.trim() || reviewDoc.isPending}
                  onClick={() =>
                    rejectingDoc &&
                    reviewDoc.mutate({
                      docId: rejectingDoc.id,
                      status: "rejected",
                      reason: rejectionReason.trim(),
                    })
                  }
                >
                  Confirm Reject
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
