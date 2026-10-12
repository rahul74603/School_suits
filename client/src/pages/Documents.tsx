import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useStudents } from "@/hooks/use-students";
import { useStaff } from "@/hooks/use-staff";
import { apiRequest } from "@/lib/queryClient";
import {
  FolderOpen,
  Trash2,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Download,
  ExternalLink,
  Award,
  RefreshCw,
} from "lucide-react";

export const DOCUMENT_TYPE_OPTIONS = [
  { value: "aadhaar-card", label: "Aadhaar Card (आधार कार्ड)" },
  { value: "birth-certificate", label: "Birth Certificate (जन्म प्रमाण पत्र)" },
  { value: "transfer-certificate", label: "Transfer Certificate / TC (स्थानांतरण प्रमाण पत्र)" },
  { value: "report-card", label: "Previous Class Marksheet / Report Card (पूर्व कक्षा अंकसूची)" },
  { value: "migration-certificate", label: "Migration Certificate (माइग्रेशन प्रमाण पत्र - अन्य राज्य/बोर्ड)" },
  { value: "samagra-id", label: "Samagra ID / PEN / APAAR Card (समग्र / PEN कार्ड)" },
  { value: "caste-certificate", label: "Caste / Income Certificate (जाति / आय प्रमाण पत्र)" },
  { value: "passport-photo", label: "Student Passport Photo (छात्र का पासपोर्ट फोटो)" },
  { value: "bank-passbook", label: "Bank Passbook Copy (बैंक पासबुक - छात्रवृत्ति हेतु)" },
  { value: "qualification", label: "Staff Qualification Certificate (स्टाफ योग्यता प्रमाण पत्र)" },
  { value: "affiliation", label: "School Affiliation / Official Document" },
];

const QUICK_REJECTION_REASONS = [
  "Document blur hai / saaf nahi dikh raha, कृपया साफ़ फोटो या PDF दोबारा अपलोड करें",
  "Galat document upload kiya gaya hai (Wrong document uploaded)",
  "Original TC ke dono side (आगे-पीछे) ka scan upload karein",
  "Aadhaar / Marksheet me naam ya जन्म तिथि अधूरी दिख रही है",
  "Inter-State Transfer ke liye DEO Countersigned TC ya Migration Certificate upload karein",
];

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read selected file"));
    reader.readAsDataURL(file);
  });
}

export default function Documents() {
  const { data: user } = useAuth();
  const { data: students } = useStudents();
  const { data: staffList } = useStaff();
  const qc = useQueryClient();

  const isStudent = user?.role === "student";
  const canReview = ["admin", "principal", "accountant"].includes(user?.role ?? "");
  const canUploadForOthers = ["admin", "principal", "accountant", "staff", "teacher"].includes(
    user?.role ?? "",
  );

  const [ownerType, setOwnerType] = useState<"student" | "staff" | "school">("student");
  const [ownerId, setOwnerId] = useState("");
  const [documentType, setDocumentType] = useState("aadhaar-card");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string>("");
  const [remarks, setRemarks] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterOwnerType, setFilterOwnerType] = useState<string>("all");
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Preview & Reject modal states
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [rejectingDoc, setRejectingDoc] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reuploadingDoc, setReuploadingDoc] = useState<any | null>(null);

  const docs = useQuery<any[]>({
    queryKey: ["/api/documents"],
    queryFn: async () => (await fetch("/api/documents", { credentials: "include" })).json(),
    enabled: !!user,
  });

  const studentById = new Map((students ?? []).map((s) => [s.id, s]));
  const staffById = new Map((staffList ?? []).map((st) => [st.id, st]));
  const docTypeLabel = new Map(DOCUMENT_TYPE_OPTIONS.map((d) => [d.value, d.label]));

  const handleFileSelection = async (file: File | null) => {
    setErrorMsg("");
    if (!file) {
      setSelectedFile(null);
      setFileDataUrl("");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("File size must be under 10 MB.");
      return;
    }
    setSelectedFile(file);
    const dataUrl = await readFileAsDataUrl(file);
    setFileDataUrl(dataUrl);
  };

  const uploadDoc = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !fileDataUrl) {
        throw new Error("कृपया अपलोड करने के लिए फ़ाइल (PDF या Photo) चुनें।");
      }
      const normalizedMime =
        selectedFile.type === "image/jpg"
          ? "image/jpeg"
          : ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(selectedFile.type)
            ? selectedFile.type
            : "image/jpeg";

      if (reuploadingDoc) {
        return apiRequest("PATCH", `/api/documents/${reuploadingDoc.id}/reupload`, {
          filename: selectedFile.name.replace(/[\\/]/g, "_"),
          mimeType: normalizedMime,
          sizeBytes: selectedFile.size,
          fileData: fileDataUrl,
          remarks: remarks.trim() || null,
        });
      }

      return apiRequest("POST", "/api/documents", {
        ownerType: isStudent ? "student" : ownerType,
        ownerId: isStudent
          ? undefined
          : ownerType === "school"
            ? null
            : Number(ownerId),
        documentType,
        filename: selectedFile.name.replace(/[\\/]/g, "_"),
        mimeType: normalizedMime,
        sizeBytes: selectedFile.size,
        fileData: fileDataUrl,
        remarks: remarks.trim() || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/documents"] });
      setSelectedFile(null);
      setFileDataUrl("");
      setRemarks("");
      setReuploadingDoc(null);
      setErrorMsg("");
      setMessage(
        isStudent
          ? "दस्तावेज़ सफलतापूर्वक अपलोड हो गया है! स्कूल प्रशासन (Principal / Accountant) इसकी जांच करके Approve करेगा।"
          : "Document uploaded and saved successfully.",
      );
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : "Failed to upload document.");
    },
  });

  const reviewDoc = useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: number;
      status: "approved" | "rejected";
      reason?: string;
    }) =>
      apiRequest("PATCH", `/api/documents/${id}/review`, {
        status,
        rejectionReason: status === "rejected" ? reason : null,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/documents"] });
      setRejectingDoc(null);
      setRejectionReason("");
      setMessage(
        vars.status === "approved"
          ? "Document Verified & Approved (स्वीकृत) ✅"
          : "Document Rejected with reason — Student/Parent will see the rejection message in their portal.",
      );
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update document status.");
    },
  });

  const deleteDoc = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/documents"] }),
  });

  const visibleDocs = (docs.data ?? []).filter((d) => {
    if (filterStatus !== "all" && (d.status || "pending") !== filterStatus) return false;
    if (filterOwnerType !== "all" && d.ownerType !== filterOwnerType) return false;
    return true;
  });

  const pendingCount = (docs.data ?? []).filter((d) => (d.status || "pending") === "pending").length;
  const approvedCount = (docs.data ?? []).filter((d) => d.status === "approved").length;
  const rejectedCount = (docs.data ?? []).filter((d) => d.status === "rejected").length;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {isStudent
                ? "My Documents & Verification Portal (दस्तावेज़ अपलोड पोर्टल)"
                : "Documents Upload & Verification Registry"}
            </h1>
            <p className="mt-1 text-slate-500">
              {isStudent
                ? "अपने स्कूल के आवश्यक दस्तावेज़ (Aadhaar, TC, Marksheet, Birth Certificate, Photo) यहाँ अपलोड करें और स्कूल वेरिफिकेशन स्थिति देखें।"
                : "Upload student/staff documents, preview uploaded scans/PDFs, and Approve or Reject with a clear reason."}
            </p>
          </div>

          {isStudent && (
            <div className="flex gap-2">
              <Link href="/report-cards">
                <Button className="bg-indigo-600 hover:bg-indigo-700">
                  <Award className="h-4 w-4 mr-2" /> Download / Print My Report Card
                </Button>
              </Link>
              <Link href="/exam-results">
                <Button variant="outline">View Subject Marks</Button>
              </Link>
            </div>
          )}
        </div>

        {/* Summary Counters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-amber-50/70 border-amber-200 p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase text-amber-800">
                Pending Verification (जांच बाकी)
              </div>
              <div className="text-2xl font-bold text-amber-900">{pendingCount}</div>
            </div>
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <div className="rounded-xl border bg-emerald-50/70 border-emerald-200 p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase text-emerald-800">
                Approved / Verified (स्वीकृत)
              </div>
              <div className="text-2xl font-bold text-emerald-900">{approvedCount}</div>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <div className="rounded-xl border bg-red-50/70 border-red-200 p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase text-red-800">
                Rejected — Needs Re-upload (अस्वीकृत)
              </div>
              <div className="text-2xl font-bold text-red-900">{rejectedCount}</div>
            </div>
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}
        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {message}
          </div>
        )}

        {/* Upload Document Card (Available to BOTH Student/Parent AND School Admin/Principal/Accountant/Staff) */}
        <Card className="border-indigo-200 shadow-sm">
          <CardHeader className="bg-indigo-50/40 border-b">
            <CardTitle className="flex items-center justify-between">
              <span>
                {reuploadingDoc
                  ? `Re-Upload Corrected Document: ${docTypeLabel.get(reuploadingDoc.documentType) || reuploadingDoc.documentType}`
                  : isStudent
                    ? "Upload My School Document (नया दस्तावेज़ अपलोड करें — PDF / Photo)"
                    : "Upload & Register Document (छात्र / स्टाफ दस्तावेज़ अपलोड करें)"}
              </span>
              {reuploadingDoc && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setReuploadingDoc(null);
                    setSelectedFile(null);
                    setFileDataUrl("");
                  }}
                >
                  Cancel Re-upload
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-4 items-end">
              {canUploadForOthers && !reuploadingDoc && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      1. Document Owner Type (किसका दस्तावेज़) *
                    </label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
                      value={ownerType}
                      onChange={(e) => {
                        setOwnerType(e.target.value as "student" | "staff" | "school");
                        setOwnerId("");
                      }}
                    >
                      <option value="student">Student Document (छात्र)</option>
                      <option value="staff">Staff Document (स्टाफ/टीचर)</option>
                      <option value="school">School Official Document</option>
                    </select>
                  </div>

                  {ownerType === "student" && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        2. Select Student (छात्र चुनें) *
                      </label>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={ownerId}
                        onChange={(e) => setOwnerId(e.target.value)}
                      >
                        <option value="">-- Select Student --</option>
                        {(students ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} (Class {s.class}-{s.section} · Father: {s.fatherName} ·{" "}
                            {s.admissionNo})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {ownerType === "staff" && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        2. Select Staff / Teacher (स्टाफ चुनें) *
                      </label>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={ownerId}
                        onChange={(e) => setOwnerId(e.target.value)}
                      >
                        <option value="">-- Select Staff / Teacher --</option>
                        {(staffList ?? []).map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name} ({st.designation} · {st.contact})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {!reuploadingDoc && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isStudent ? "1." : "3."} Select Document Type (दस्तावेज़ का प्रकार) *
                  </label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
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
              )}

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isStudent ? "2." : "4."} Choose File to Upload (Photo JPG/PNG या PDF चुनें - Max 10MB) *
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => handleFileSelection(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer border rounded-md bg-white p-1"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Optional Note / Document No (टिप्पणी / नंबर)
                </label>
                <Input
                  placeholder="e.g., TC No 4521 / Original Scan"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              <div>
                <Button
                  className="w-full h-10 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => uploadDoc.mutate()}
                  disabled={
                    uploadDoc.isPending ||
                    !selectedFile ||
                    (!isStudent &&
                      !reuploadingDoc &&
                      ownerType !== "school" &&
                      !ownerId)
                  }
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadDoc.isPending
                    ? "Uploading..."
                    : reuploadingDoc
                      ? "Submit Corrected File"
                      : "Upload Document"}
                </Button>
              </div>
            </div>

            {selectedFile && (
              <div className="rounded-lg border bg-slate-50 p-3 flex items-center justify-between text-xs text-slate-700">
                <div>
                  <b>Selected File:</b> {selectedFile.name} (
                  {Math.max(1, Math.round(selectedFile.size / 1024))} KB · {selectedFile.type})
                </div>
                {fileDataUrl.startsWith("data:image/") && (
                  <img
                    src={fileDataUrl}
                    alt="Preview"
                    className="h-14 w-20 object-cover rounded border bg-white"
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Registered & Uploaded Documents List */}
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>
              {isStudent
                ? "My Uploaded Documents & Verification Status"
                : "Uploaded Documents & Verification Queue"}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                  Filter by Verification Status
                </label>
                <select
                  className="h-9 rounded-md border bg-white px-3 text-xs font-medium"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Statuses ({docs.data?.length ?? 0})</option>
                  <option value="pending">Pending Verification ({pendingCount})</option>
                  <option value="approved">Approved / Verified ({approvedCount})</option>
                  <option value="rejected">Rejected ({rejectedCount})</option>
                </select>
              </div>
              {!isStudent && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                    Filter by Owner
                  </label>
                  <select
                    className="h-9 rounded-md border bg-white px-3 text-xs font-medium"
                    value={filterOwnerType}
                    onChange={(e) => setFilterOwnerType(e.target.value)}
                  >
                    <option value="all">All (Students + Staff + School)</option>
                    <option value="student">Students Only</option>
                    <option value="staff">Staff Only</option>
                    <option value="school">School Only</option>
                  </select>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {docs.isLoading ? (
              <p className="text-slate-500">Loading documents...</p>
            ) : !visibleDocs.length ? (
              <div className="p-8 text-center text-slate-500">
                <FolderOpen className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                No documents found. Use the upload box above to upload a PDF or Photo scan.
              </div>
            ) : (
              <div className="divide-y rounded-lg border bg-white">
                {visibleDocs.map((d) => {
                  const stu =
                    d.ownerType === "student" ? studentById.get(d.ownerId) : undefined;
                  const stf =
                    d.ownerType === "staff" ? staffById.get(d.ownerId) : undefined;
                  const status = d.status || "pending";

                  return (
                    <div
                      key={d.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60"
                    >
                      <div className="space-y-1.5">
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
                                <XCircle className="h-3.5 w-3.5" /> Rejected (अस्वीकृत)
                              </>
                            ) : (
                              <>
                                <Clock className="h-3.5 w-3.5" /> Pending Verification (जांच में)
                              </>
                            )}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600">
                          <b>File:</b> {d.filename} ({Math.max(1, Math.round((d.sizeBytes || 0) / 1024))} KB) ·{" "}
                          <b>Owner:</b>{" "}
                          {stu ? (
                            <span className="font-semibold text-indigo-700">
                              {stu.name} (Class {stu.class}-{stu.section} · Adm: {stu.admissionNo})
                            </span>
                          ) : stf ? (
                            <span className="font-semibold text-indigo-700">
                              {stf.name} ({stf.designation})
                            </span>
                          ) : (
                            `${d.ownerType}${d.ownerId ? ` #${d.ownerId}` : ""}`
                          )}
                          {d.remarks ? ` · Note: ${d.remarks}` : ""}
                        </div>

                        {status === "rejected" && d.rejectionReason && (
                          <div className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900">
                            <b>Rejection Reason (अस्वीकृत करने का कारण):</b> {d.rejectionReason}
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
                              <Eye className="h-3.5 w-3.5 mr-1" /> View / Preview
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

                        {!isStudent && d.ownerType === "student" && d.ownerId && (
                          <Link href={`/students/${d.ownerId}`}>
                            <Button size="sm" variant="outline" className="text-indigo-700 border-indigo-200">
                              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open Student Profile
                            </Button>
                          </Link>
                        )}

                        {/* Student Re-upload button if Rejected or Pending */}
                        {isStudent && status !== "approved" && (
                          <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => {
                              setReuploadingDoc(d);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-upload File
                          </Button>
                        )}

                        {/* School Approve / Reject Controls */}
                        {canReview && (
                          <>
                            {status !== "approved" && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                disabled={reviewDoc.isPending}
                                onClick={() =>
                                  reviewDoc.mutate({ id: d.id, status: "approved" })
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
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => deleteDoc.mutate(d.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

        {/* Document Preview Modal */}
        <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {previewDoc
                  ? `${docTypeLabel.get(previewDoc.documentType) || previewDoc.documentType} — ${previewDoc.filename}`
                  : "Document Preview"}
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
                  ) : (
                    <p className="text-slate-500 p-8">
                      This record only has metadata and no attached file preview.
                    </p>
                  )}
                </div>
                {canReview && (
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        reviewDoc.mutate({ id: previewDoc.id, status: "approved" });
                        setPreviewDoc(null);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Approve & Verify Document
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

        {/* Reject with Reason Modal */}
        <Dialog open={!!rejectingDoc} onOpenChange={(open) => !open && setRejectingDoc(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Reject Document & Send Reason to Parent/Student</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                Write or select the reason why this document is being rejected. The student/parent will see this message in their portal and can re-upload a clear copy.
              </p>
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-700">
                  Quick Reasons (Click to fill):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REJECTION_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRejectionReason(r)}
                      className="rounded border bg-slate-50 px-2.5 py-1 text-left text-xs text-slate-700 hover:bg-indigo-50 hover:border-indigo-300"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rejection Reason (अस्वीकृत करने का कारण लिखें) *
                </label>
                <textarea
                  className="w-full min-h-[90px] rounded-md border p-3 text-sm"
                  placeholder="e.g., Photo blur hai, kripya saaf photo upload karein..."
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
                      id: rejectingDoc.id,
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
