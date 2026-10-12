import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useStaff } from "@/hooks/use-staff";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, ShieldCheck, UserCheck, XCircle } from "lucide-react";

const leaveTypes = ["sick", "casual", "personal", "medical", "emergency"] as const;

export default function Leaves() {
  const { data: user } = useAuth();
  const { data: staffList } = useStaff();
  const qc = useQueryClient();

  // Only Principal (or Admin acting as Principal) can approve/reject leaves
  const isPrincipalApprover = user?.role === "principal" || user?.role === "admin";
  const isStudent = user?.role === "student";
  const today = new Date().toISOString().slice(0, 10);

  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [leaveType, setLeaveType] = useState<string>("casual");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reason, setReason] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const leaves = useQuery<any[]>({
    queryKey: ["/api/leaves", statusFilter],
    queryFn: async () => {
      const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/leaves${qs}`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!user,
  });

  const selectedStaffObj = (staffList ?? []).find(
    (st) => String(st.id) === selectedStaffId,
  );

  const submitLeave = useMutation({
    mutationFn: () => {
      setErrorMsg("");
      return apiRequest("POST", "/api/leaves", {
        applicantType: isStudent ? "student" : "staff",
        studentId: null,
        staffId: !isStudent && selectedStaffId ? Number(selectedStaffId) : null,
        leaveType,
        fromDate,
        toDate,
        reason,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/leaves"] });
      setReason("");
      setMessage(
        isStudent
          ? "आपकी छुट्टी का आवेदन (Student Leave Application) प्रिंसिपल को भेज दिया गया है।"
          : "Staff / Teacher leave application submitted for Principal approval.",
      );
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const reviewLeave = useMutation({
    mutationFn: ({
      id,
      status,
      reviewRemarks,
    }: {
      id: number;
      status: "approved" | "rejected";
      reviewRemarks?: string;
    }) => apiRequest("POST", `/api/leaves/${id}/review`, { status, reviewRemarks }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/leaves"] });
      setMessage("Leave status updated by Principal.");
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {isStudent
                ? "My Student Leave Applications (छुट्टी के लिए आवेदन करें)"
                : "Staff Leave Applications & Principal Approvals"}
            </h1>
            <p className="text-slate-500 mt-1">
              {isStudent
                ? "Parents / Students can directly apply for leave from here. Principal approves all leave requests."
                : "Teachers & Staff apply for their own leave here · Student leaves are applied directly by Parents from the Student Portal · Approval authority: Principal Only"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-amber-700" />
              Approval Authority: Principal Only
            </span>
            <div>
              <select
                className="h-10 rounded-md border bg-white px-3 text-sm font-medium"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Filter: All Leave Requests</option>
                <option value="pending">Pending Principal Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {message}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-indigo-600" />
              {isStudent
                ? "Apply for Student Leave (छात्र की छुट्टी का आवेदन भेजें)"
                : "Apply for Teacher / Staff Leave (टीचर / स्टाफ की छुट्टी का आवेदन)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isStudent && (staffList ?? []).length > 0 && (
              <div className="rounded-xl border bg-slate-50/80 p-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    1. Select Teacher / Staff Member (अपना नाम चुनें — यदि अकाउंट लिंक नहीं है)
                  </label>
                  <select
                    className="h-10 w-full rounded-md border bg-white px-3 text-sm font-medium"
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                  >
                    <option value="">
                      -- Logged-in Account ({user?.name}) or Select Staff Member --
                    </option>
                    {(staffList ?? []).map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} — {st.designation} — Mob: {st.contact}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedStaffObj && (
                  <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-950 grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-500 block">Staff Name:</span>
                      <b>{selectedStaffObj.name}</b>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Designation:</span>
                      <b>{selectedStaffObj.designation}</b>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Contact No:</span>
                      <b>{selectedStaffObj.contact}</b>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Leave Type (छुट्टी का प्रकार) *
                </label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                >
                  {leaveTypes.map((t) => (
                    <option key={t} value={t}>
                      {t.toUpperCase()} LEAVE
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  From Date (कब से) *
                </label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  To Date (कब तक) *
                </label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Leave (छुट्टी का कारण लिखें) *
              </label>
              <Input
                placeholder="e.g., Personal work / Family function / Medical rest"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <Button
              onClick={() => submitLeave.mutate()}
              disabled={submitLeave.isPending || !reason.trim()}
            >
              {submitLeave.isPending
                ? "Submitting..."
                : "Submit Leave Request for Principal Approval"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {isStudent
                ? "My Submitted Leave Requests"
                : "Leave Requests & Principal Approval Register (Staff & Student Leaves)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-left">Applicant Full Identity</th>
                    <th className="p-3 text-left">Leave Type</th>
                    <th className="p-3 text-left">Dates</th>
                    <th className="p-3 text-left">Reason</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Principal Approval</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.isLoading ? (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={7}>
                        Loading leave applications...
                      </td>
                    </tr>
                  ) : !leaves.data?.length ? (
                    <tr>
                      <td className="p-6 text-center text-slate-500" colSpan={7}>
                        No leave requests found.
                      </td>
                    </tr>
                  ) : (
                    leaves.data.map((item) => (
                      <tr key={item.id} className="border-t hover:bg-slate-50/50">
                        <td className="p-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                              item.applicantType === "student"
                                ? "bg-indigo-100 text-indigo-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {item.applicantType === "student" ? "Student" : "Staff / Teacher"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">
                            {item.applicantName}
                          </div>
                          {item.applicantType === "student" && (
                            <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap gap-2">
                              {item.className && (
                                <span className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700">
                                  Class {item.className}-{item.section}
                                </span>
                              )}
                              {item.fatherName && (
                                <span>
                                  Father: <b>{item.fatherName}</b>
                                </span>
                              )}
                              {item.admissionNo && (
                                <span className="font-mono text-slate-700">
                                  Reg/Adm: <b>{item.admissionNo}</b>
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3 uppercase text-xs font-semibold text-slate-700">
                          {item.leaveType}
                        </td>
                        <td className="p-3 text-xs font-medium">
                          {item.fromDate} → {item.toDate}
                        </td>
                        <td className="p-3">{item.reason}</td>
                        <td className="p-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                              item.status === "approved"
                                ? "bg-green-100 text-green-800"
                                : item.status === "rejected"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3">
                          {isPrincipalApprover ? (
                            item.status === "pending" ? (
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  className="h-7 bg-emerald-600 hover:bg-emerald-700 text-xs"
                                  disabled={reviewLeave.isPending}
                                  onClick={() =>
                                    reviewLeave.mutate({ id: item.id, status: "approved" })
                                  }
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
                                  disabled={reviewLeave.isPending}
                                  onClick={() =>
                                    reviewLeave.mutate({ id: item.id, status: "rejected" })
                                  }
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">
                                Decision recorded ({item.status})
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-amber-700 font-medium">
                              Principal Approval Only
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
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
