import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useStudents } from "@/hooks/use-students";
import { useStaff } from "@/hooks/use-staff";
import { apiRequest } from "@/lib/queryClient";
import { FolderOpen, Trash2 } from "lucide-react";

export default function Documents() {
  const { data: user } = useAuth();
  const { data: students } = useStudents();
  const { data: staffList } = useStaff();
  const qc = useQueryClient();
  const isManager = ["admin", "principal"].includes(user?.role ?? "");

  const [ownerType, setOwnerType] = useState<"student" | "staff" | "school">("student");
  const [ownerId, setOwnerId] = useState("");
  const [documentType, setDocumentType] = useState("birth-certificate");
  const [filename, setFilename] = useState("");
  const [mimeType, setMimeType] = useState("application/pdf");
  const [sizeBytes] = useState("102400");
  const [message, setMessage] = useState("");

  const docs = useQuery<any[]>({
    queryKey: ["/api/documents"],
    queryFn: async () => (await fetch("/api/documents", { credentials: "include" })).json(),
    enabled: !!user,
  });

  const studentById = new Map((students ?? []).map((s) => [s.id, s]));
  const staffById = new Map((staffList ?? []).map((st) => [st.id, st]));

  const createDoc = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/documents", {
        ownerType,
        ownerId: ownerType === "school" ? null : Number(ownerId),
        documentType,
        filename,
        mimeType,
        sizeBytes: Number(sizeBytes),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/documents"] });
      setFilename("");
      setMessage("Document record registered.");
    },
  });

  const deleteDoc = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/documents"] }),
  });

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Documents & Verification Registry</h1>
          <p className="mt-1 text-slate-500">
            Select Student or Staff from connected dropdowns to register verified documents.
          </p>
        </div>

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {message}
          </div>
        )}

        {isManager && (
          <Card>
            <CardHeader>
              <CardTitle>Register Verified Document Record</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-6">
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm font-medium"
                value={ownerType}
                onChange={(e) => {
                  setOwnerType(e.target.value as "student" | "staff" | "school");
                  setOwnerId("");
                }}
              >
                <option value="student">Student Document</option>
                <option value="staff">Staff Document</option>
                <option value="school">School Document</option>
              </select>

              {ownerType === "student" && (
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm md:col-span-2"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                >
                  <option value="">Select Student...</option>
                  {(students ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Class {s.class}-{s.section} · Father: {s.fatherName} · {s.admissionNo})
                    </option>
                  ))}
                </select>
              )}

              {ownerType === "staff" && (
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm md:col-span-2"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                >
                  <option value="">Select Staff / Teacher...</option>
                  {(staffList ?? []).map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.designation} · {st.contact})
                    </option>
                  ))}
                </select>
              )}

              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                <option value="birth-certificate">Birth Certificate</option>
                <option value="transfer-certificate">Transfer Certificate (TC)</option>
                <option value="report-card">Previous Report Card</option>
                <option value="id-proof">ID / Address Proof</option>
                <option value="qualification">Staff Qualification</option>
                <option value="affiliation">School Affiliation</option>
              </select>
              <Input
                placeholder="File Name (e.g., tc-scan.pdf)"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
              <Button
                onClick={() => createDoc.mutate()}
                disabled={
                  createDoc.isPending ||
                  !filename.trim() ||
                  (ownerType !== "school" && !ownerId)
                }
              >
                Register
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Registered Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {docs.isLoading ? (
              <p className="text-slate-500">Loading documents...</p>
            ) : !docs.data?.length ? (
              <div className="p-8 text-center text-slate-500">
                <FolderOpen className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                No documents registered yet.
              </div>
            ) : (
              <div className="divide-y rounded-lg border bg-white">
                {docs.data.map((d) => {
                  const stu = d.ownerType === "student" ? studentById.get(d.ownerId) : undefined;
                  const stf = d.ownerType === "staff" ? staffById.get(d.ownerId) : undefined;
                  return (
                    <div key={d.id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{d.filename}</div>
                        <div className="text-xs text-slate-500">
                          {d.documentType} · Owner:{" "}
                          {stu
                            ? `${stu.name} (Class ${stu.class}-${stu.section} · ${stu.admissionNo})`
                            : stf
                              ? `${stf.name} (${stf.designation})`
                              : `${d.ownerType}${d.ownerId ? ` #${d.ownerId}` : ""}`}{" "}
                          · {d.mimeType} · {Math.round((d.sizeBytes || 0) / 1024)} KB
                        </div>
                      </div>
                      {isManager && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => deleteDoc.mutate(d.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
