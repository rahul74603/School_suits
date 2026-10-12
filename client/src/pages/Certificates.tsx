import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useActiveSession, useSchool } from "@/hooks/use-core";
import { apiRequest } from "@/lib/queryClient";
import { Award, Printer } from "lucide-react";
import type { Certificate, Student } from "@shared/schema";

const certificateTypes = [
  { value: "transfer", label: "Transfer Certificate (TC)" },
  { value: "bonafide", label: "Bonafide Student Certificate" },
  { value: "character", label: "Character & Conduct Certificate" },
  { value: "fee", label: "School Fee / Study Certificate" },
] as const;

export default function Certificates() {
  const { data: user } = useAuth();
  const qc = useQueryClient();
  const school = useSchool();
  const session = useActiveSession();
  const isManager = ["admin", "principal", "accountant"].includes(user?.role ?? "");
  const isStudent = user?.role === "student";
  const today = new Date().toISOString().slice(0, 10);

  const [studentId, setStudentId] = useState("");
  const [certificateType, setCertificateType] = useState<string>("bonafide");
  const [issueDate, setIssueDate] = useState(today);
  const [reason, setReason] = useState("Higher Studies / Parent Request");
  const [conduct, setConduct] = useState("Excellent");
  const [remarks, setRemarks] = useState("No dues pending against the student.");
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [message, setMessage] = useState("");

  const students = useQuery<Student[]>({
    queryKey: ["/api/students"],
    queryFn: async () => (await fetch("/api/students", { credentials: "include" })).json(),
    enabled: !!user,
  });

  const certs = useQuery<Certificate[]>({
    queryKey: ["/api/certificates"],
    queryFn: async () => (await fetch("/api/certificates", { credentials: "include" })).json(),
    enabled: !!user,
  });

  const studentById = new Map((students.data ?? []).map((s) => [s.id, s]));

  const issueCert = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/certificates", {
        studentId: Number(studentId),
        certificateType,
        issueDate,
        reason,
        conduct,
        remarks,
      });
      return res.json() as Promise<Certificate>;
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["/api/certificates"] });
      setSelectedCert(created);
      setMessage(`Certificate ${created.certificateNo} issued successfully.`);
    },
  });

  const revokeCert = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/certificates/${id}/revoke`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/certificates"] }),
  });

  const previewStudent = selectedCert ? studentById.get(selectedCert.studentId) : undefined;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Certificates & Transfer Certificate (TC)
            </h1>
            <p className="text-slate-500 mt-1">
              Issue, verify, and print official school Transfer, Bonafide, Character, and Fee Certificates.
            </p>
          </div>
          {selectedCert && (
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" /> Print Certificate
            </Button>
          )}
        </div>

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 print:hidden">
            {message}
          </div>
        )}

        {isManager && (
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle>Issue Official Certificate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Select Student</label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  >
                    <option value="">Choose student...</option>
                    {(students.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.admissionNo}) — Class {s.class}-{s.section}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Certificate Type</label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={certificateType}
                    onChange={(e) => setCertificateType(e.target.value)}
                  >
                    {certificateTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Issue Date</label>
                  <Input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    4. Purpose / Reason (प्रमाण पत्र लेने का कारण)
                  </label>
                  <Input
                    placeholder="e.g., Higher Studies / Parent Request"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    5. Character & Conduct (चरित्र और आचरण)
                  </label>
                  <Input
                    placeholder="e.g., Excellent / Good"
                    value={conduct}
                    onChange={(e) => setConduct(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    6. Remarks / Fee Status (अन्य टिप्पणी)
                  </label>
                  <Input
                    placeholder="e.g., No dues pending against the student."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
              </div>

              <Button
                onClick={() => issueCert.mutate()}
                disabled={issueCert.isPending || !studentId}
              >
                {issueCert.isPending ? "Generating..." : "Issue & Preview Certificate"}
              </Button>
            </CardContent>
          </Card>
        )}

        {selectedCert && (
          <div className="rounded-2xl border-4 border-double border-indigo-900 bg-white p-10 shadow-lg print:shadow-none">
            <div className="text-center border-b-2 border-slate-200 pb-6">
              <Award className="h-10 w-10 text-indigo-700 mx-auto mb-2" />
              <h2 className="text-2xl font-extrabold uppercase tracking-wide text-slate-900">
                {school.data?.name || "SchoolSuite Academy"}
              </h2>
              <p className="text-sm text-slate-600">{school.data?.address}</p>
              <p className="text-xs text-slate-500">Contact: {school.data?.contact}</p>
              <div className="mt-4 inline-block rounded-md bg-indigo-900 px-6 py-1.5 text-sm font-bold uppercase tracking-widest text-white">
                {certificateTypes.find((c) => c.value === selectedCert.certificateType)?.label ||
                  selectedCert.certificateType}
              </div>
            </div>

            <div className="mt-6 flex justify-between text-sm text-slate-600">
              <span>
                <b>Certificate No:</b> {selectedCert.certificateNo}
              </span>
              <span>
                <b>Academic Session:</b> {session.data?.name || "Current Session"}
              </span>
              <span>
                <b>Date of Issue:</b> {selectedCert.issueDate}
              </span>
            </div>

            <div className="mt-8 space-y-4 text-base leading-relaxed text-slate-800">
              <p>
                This is to certify that{" "}
                <b className="underline">{previewStudent?.name || `Student #${selectedCert.studentId}`}</b>,
                son/daughter of{" "}
                <b className="underline">{previewStudent?.fatherName || "Guardian"}</b>, holding
                Admission Number{" "}
                <b className="underline">{previewStudent?.admissionNo || "—"}</b>, is/was a
                bonafide student of this institution studying in{" "}
                <b>
                  Class {previewStudent?.class || "—"} (Section {previewStudent?.section || "—"})
                </b>{" "}
                during the academic session <b>{session.data?.name || "Active Session"}</b>.
              </p>

              {previewStudent?.dob && (
                <p>
                  According to the School Admission Register, the student&apos;s Date of Birth is{" "}
                  <b>{previewStudent.dob}</b>.
                </p>
              )}

              <p>
                <b>Reason / Purpose:</b> {selectedCert.reason || "Official Record"} <br />
                <b>General Conduct & Character:</b> {selectedCert.conduct || "Good"} <br />
                {selectedCert.remarks && (
                  <>
                    <b>Remarks:</b> {selectedCert.remarks}
                  </>
                )}
              </p>
            </div>

            <div className="mt-16 flex justify-between pt-8 text-sm font-semibold text-slate-700">
              <div className="border-t border-slate-400 pt-2 px-4">Class Teacher / Clerk</div>
              <div className="border-t border-slate-400 pt-2 px-4">School Seal</div>
              <div className="border-t border-slate-400 pt-2 px-4">Principal Signature</div>
            </div>
          </div>
        )}

        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>{isStudent ? "My Issued Certificates" : "Issued Certificates Register"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-3 text-left">Certificate No</th>
                    <th className="p-3 text-left">Student</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Issue Date</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {certs.isLoading ? (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={6}>
                        Loading certificates...
                      </td>
                    </tr>
                  ) : !certs.data?.length ? (
                    <tr>
                      <td className="p-6 text-center text-slate-500" colSpan={6}>
                        No certificates issued yet.
                      </td>
                    </tr>
                  ) : (
                    certs.data.map((cert) => {
                      const st = studentById.get(cert.studentId);
                      return (
                        <tr key={cert.id} className="border-t">
                          <td className="p-3 font-mono font-semibold">{cert.certificateNo}</td>
                          <td className="p-3">
                            {st ? `${st.name} (${st.class}-${st.section})` : `Student #${cert.studentId}`}
                          </td>
                          <td className="p-3 uppercase text-xs font-semibold">
                            {cert.certificateType}
                          </td>
                          <td className="p-3">{cert.issueDate}</td>
                          <td className="p-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                                cert.status === "issued"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {cert.status}
                            </span>
                          </td>
                          <td className="p-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedCert(cert)}
                            >
                              Preview / Print
                            </Button>
                            {isManager && cert.status === "issued" && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => revokeCert.mutate(cert.id)}
                              >
                                Revoke
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
