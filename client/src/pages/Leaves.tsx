import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { LeaveRequest } from "@shared/schema";

const leaveTypes = ["sick", "casual", "personal", "medical", "emergency"] as const;

export default function Leaves() {
  const { data: user } = useAuth();
  const qc = useQueryClient();
  const canReview = ["admin", "principal", "teacher"].includes(user?.role ?? "");
  const today = new Date().toISOString().slice(0, 10);

  const [leaveType, setLeaveType] = useState<string>("sick");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reason, setReason] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");

  const leaves = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leaves", statusFilter],
    queryFn: async () => {
      const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      return (await fetch(`/api/leaves${qs}`, { credentials: "include" })).json();
    },
    enabled: !!user,
  });

  const submitLeave = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/leaves", {
        leaveType,
        fromDate,
        toDate,
        reason,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/leaves"] });
      setReason("");
      setMessage("Leave application submitted successfully.");
    },
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
      setMessage("Leave request status updated.");
    },
  });

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Leave Applications & Approvals</h1>
            <p className="text-slate-500 mt-1">
              Submit student or staff leave requests and manage approvals.
            </p>
          </div>
          <select
            className="h-10 rounded-md border bg-white px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Requests</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {message}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Apply for Leave</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Leave Type</label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                >
                  {leaveTypes.map((t) => (
                    <option key={t} value={t}>
                      {t.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">From Date</label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">To Date</label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
            <Input
              placeholder="Reason for leave (e.g., Medical appointment / Family function)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button
              onClick={() => submitLeave.mutate()}
              disabled={submitLeave.isPending || !reason.trim()}
            >
              {submitLeave.isPending ? "Submitting..." : "Submit Leave Application"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave History & Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-3 text-left">Applicant</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Dates</th>
                    <th className="p-3 text-left">Reason</th>
                    <th className="p-3 text-left">Status</th>
                    {canReview && <th className="p-3 text-left">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {leaves.isLoading ? (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={6}>
                        Loading leave applications...
                      </td>
                    </tr>
                  ) : !leaves.data?.length ? (
                    <tr>
                      <td className="p-6 text-center text-slate-500" colSpan={6}>
                        No leave requests found.
                      </td>
                    </tr>
                  ) : (
                    leaves.data.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-3">
                          <div className="font-medium text-slate-900">{item.applicantName}</div>
                          <div className="text-xs text-slate-500 capitalize">
                            {item.applicantType}
                            {item.className ? ` · Class ${item.className}-${item.section}` : ""}
                          </div>
                        </td>
                        <td className="p-3 uppercase text-xs font-semibold text-slate-700">
                          {item.leaveType}
                        </td>
                        <td className="p-3">
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
                        {canReview && (
                          <td className="p-3">
                            {item.status === "pending" ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    reviewLeave.mutate({ id: item.id, status: "approved" })
                                  }
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    reviewLeave.mutate({ id: item.id, status: "rejected" })
                                  }
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">Reviewed</span>
                            )}
                          </td>
                        )}
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
