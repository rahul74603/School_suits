import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-core";
import { Printer } from "lucide-react";
import type { PayrollRecord, SalaryStructure, Staff } from "@shared/schema";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok)
    throw new Error((await response.json().catch(() => null))?.message ?? "Payroll request failed");
  return response.json();
}

export default function Payroll() {
  const { data: user } = useAuth();
  const school = useSchool();
  const manager = user?.role === "admin" || user?.role === "accountant";
  const qc = useQueryClient();
  const [staffId, setStaffId] = useState("");
  const [basic, setBasic] = useState("");
  const [allowances, setAllowances] = useState("0");
  const [deductions, setDeductions] = useState("0");
  const [advance, setAdvance] = useState("0");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);
  const [message, setMessage] = useState("");

  const staff = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
    queryFn: () => api("/api/staff"),
    enabled: user?.role === "admin" || user?.role === "principal",
  });
  const structures = useQuery<SalaryStructure[]>({
    queryKey: ["/api/payroll/salary-structures"],
    queryFn: () => api("/api/payroll/salary-structures"),
  });
  const payroll = useQuery<PayrollRecord[]>({
    queryKey: ["/api/payroll", month, year],
    queryFn: () => api(`/api/payroll?month=${month}&year=${year}`),
  });
  const summary = useQuery<{ count: number; totalNet: number; paid: number; pending: number }>({
    queryKey: ["/api/payroll/summary", month, year],
    queryFn: () => api(`/api/payroll/summary?month=${month}&year=${year}`),
    enabled: manager || user?.role === "principal",
  });

  const staffById = new Map((staff.data ?? []).map((s) => [s.id, s]));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/payroll"] });
  };
  const createStructure = useMutation({
    mutationFn: () =>
      api("/api/payroll/salary-structures", {
        method: "POST",
        body: JSON.stringify({
          staffId: Number(staffId),
          basicSalary: Number(basic),
          allowances: Number(allowances),
          deductions: Number(deductions),
          advanceOutstanding: Number(advance),
          effectiveDate: `${year}-${month.padStart(2, "0")}-01`,
          isActive: true,
        }),
      }),
    onSuccess: () => {
      invalidate();
      setMessage("Salary structure saved.");
    },
  });
  const createPayroll = useMutation({
    mutationFn: () =>
      api("/api/payroll", {
        method: "POST",
        body: JSON.stringify({
          staffId: Number(staffId),
          payrollMonth: Number(month),
          payrollYear: Number(year),
          allowances: Number(allowances),
          deductions: Number(deductions),
          advanceDeduction: Number(advance),
          remarks: null,
        }),
      }),
    onSuccess: () => {
      invalidate();
      setMessage("Payroll created as draft. Net salary was calculated by the server.");
    },
  });
  const status = useMutation({
    mutationFn: ({ id, value }: { id: number; value: string }) =>
      api(`/api/payroll/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: value }),
      }),
    onSuccess: invalidate,
  });

  const error =
    structures.error ??
    payroll.error ??
    summary.error ??
    createStructure.error ??
    createPayroll.error ??
    status.error;

  const slipStaff = selectedPayslip ? staffById.get(selectedPayslip.staffId) : undefined;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-3xl font-bold">Staff Salary & Payroll</h1>
            <p className="mt-1 text-slate-500">
              Net salary = basic + allowances − deductions − advance deduction. Server calculations are authoritative.
            </p>
          </div>
          {selectedPayslip && (
            <div className="flex gap-2">
              <Button onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" /> Print Payslip
              </Button>
              <Button variant="outline" onClick={() => setSelectedPayslip(null)}>
                Close Payslip
              </Button>
            </div>
          )}
        </div>

        {selectedPayslip && (
          <div className="rounded-xl border-2 border-slate-800 bg-white p-8 shadow-md">
            <div className="border-b pb-4 text-center">
              <h2 className="text-xl font-bold uppercase">
                {school.data?.name || "SchoolSuite Academy"}
              </h2>
              <p className="text-xs text-slate-600">{school.data?.address}</p>
              <div className="mt-2 inline-block rounded bg-slate-900 px-4 py-1 text-xs font-bold uppercase text-white">
                Monthly Salary Slip ({selectedPayslip.payrollMonth}/{selectedPayslip.payrollYear})
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <b>Employee:</b> {slipStaff?.name || `Staff #${selectedPayslip.staffId}`}
              </div>
              <div>
                <b>Designation:</b> {slipStaff?.designation || "Staff"}
              </div>
              <div>
                <b>Payroll Status:</b>{" "}
                <span className="uppercase font-semibold">{selectedPayslip.status}</span>
              </div>
              <div>
                <b>Payment Date:</b>{" "}
                {selectedPayslip.paymentDate
                  ? new Date(selectedPayslip.paymentDate).toLocaleDateString()
                  : "Pending"}
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded bg-slate-50 p-3 border">
                <div className="text-xs text-slate-500">Basic Salary</div>
                <div className="font-bold">₹{selectedPayslip.basicAmount.toLocaleString()}</div>
              </div>
              <div className="rounded bg-green-50 p-3 border border-green-100">
                <div className="text-xs text-green-700">+ Allowances</div>
                <div className="font-bold text-green-800">
                  ₹{selectedPayslip.allowances.toLocaleString()}
                </div>
              </div>
              <div className="rounded bg-red-50 p-3 border border-red-100">
                <div className="text-xs text-red-700">- Deductions & Advance</div>
                <div className="font-bold text-red-800">
                  ₹
                  {(
                    selectedPayslip.deductions + selectedPayslip.advanceDeduction
                  ).toLocaleString()}
                </div>
              </div>
              <div className="rounded bg-indigo-50 p-3 border border-indigo-200">
                <div className="text-xs text-indigo-700">Net Payable Salary</div>
                <div className="text-lg font-extrabold text-indigo-900">
                  ₹{selectedPayslip.netSalary.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700 print:hidden">
            {(error as Error).message}
          </div>
        )}
        {message && (
          <div className="rounded border border-green-200 bg-green-50 p-3 text-green-700 print:hidden">
            {message}
          </div>
        )}

        {manager && (
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle>Salary Structure and Payroll Generation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <select
                className="h-10 rounded border bg-background px-3 text-sm"
                value={staffId}
                onChange={(e) => {
                  setStaffId(e.target.value);
                  const member = staffById.get(Number(e.target.value));
                  if (member) setBasic(String(member.basicSalary));
                }}
              >
                <option value="">Select Staff Member...</option>
                {(staff.data ?? []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} — {member.designation} (₹{member.basicSalary})
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min="0"
                placeholder="Basic salary"
                value={basic}
                onChange={(e) => setBasic(e.target.value)}
              />
              <Input
                type="number"
                min="0"
                placeholder="Allowances"
                value={allowances}
                onChange={(e) => setAllowances(e.target.value)}
              />
              <Input
                type="number"
                min="0"
                placeholder="Deductions"
                value={deductions}
                onChange={(e) => setDeductions(e.target.value)}
              />
              <Input
                type="number"
                min="0"
                placeholder="Advance / advance deduction"
                value={advance}
                onChange={(e) => setAdvance(e.target.value)}
              />
              <Input
                type="number"
                min="1"
                max="12"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={() => createStructure.mutate()} disabled={!staffId || !basic}>
                  Save Structure
                </Button>
                <Button variant="outline" onClick={() => createPayroll.mutate()} disabled={!staffId}>
                  Create Payroll
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {summary.data && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 print:hidden">
            <div className="rounded bg-white p-4 shadow-sm border">
              <small className="text-slate-500">Records</small>
              <div className="text-xl font-bold">{summary.data.count}</div>
            </div>
            <div className="rounded bg-white p-4 shadow-sm border">
              <small className="text-slate-500">Total Net</small>
              <div className="text-xl font-bold">₹{summary.data.totalNet.toLocaleString()}</div>
            </div>
            <div className="rounded bg-white p-4 shadow-sm border">
              <small className="text-slate-500">Paid</small>
              <div className="text-xl font-bold text-green-700">
                ₹{summary.data.paid.toLocaleString()}
              </div>
            </div>
            <div className="rounded bg-white p-4 shadow-sm border">
              <small className="text-slate-500">Pending</small>
              <div className="text-xl font-bold text-amber-700">
                ₹{summary.data.pending.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>{manager ? "Monthly Payroll Register" : "My Salary History"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-3 text-left">Staff Member</th>
                    <th className="p-3 text-left">Month</th>
                    <th className="p-3 text-left">Basic</th>
                    <th className="p-3 text-left">Allowances</th>
                    <th className="p-3 text-left">Deductions</th>
                    <th className="p-3 text-left">Net Salary</th>
                    <th className="p-3 text-left">Status & Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.isLoading ? (
                    <tr>
                      <td className="p-3" colSpan={7}>
                        Loading payroll...
                      </td>
                    </tr>
                  ) : (
                    (payroll.data ?? []).map((record) => {
                      const member = staffById.get(record.staffId);
                      return (
                        <tr className="border-t" key={record.id}>
                          <td className="p-3 font-medium">
                            {member
                              ? `${member.name} (${member.designation})`
                              : `Staff #${record.staffId}`}
                          </td>
                          <td className="p-3">
                            {record.payrollMonth}/{record.payrollYear}
                          </td>
                          <td className="p-3">₹{record.basicAmount.toLocaleString()}</td>
                          <td className="p-3">₹{record.allowances.toLocaleString()}</td>
                          <td className="p-3">
                            ₹{(record.deductions + record.advanceDeduction).toLocaleString()}
                          </td>
                          <td className="p-3 font-semibold">
                            ₹{record.netSalary.toLocaleString()}
                          </td>
                          <td className="p-3 flex items-center gap-2">
                            {manager && record.status === "draft" ? (
                              <Button
                                size="sm"
                                onClick={() =>
                                  status.mutate({ id: record.id, value: "finalized" })
                                }
                              >
                                Finalize
                              </Button>
                            ) : manager && record.status === "finalized" ? (
                              <Button
                                size="sm"
                                onClick={() => status.mutate({ id: record.id, value: "paid" })}
                              >
                                Mark Paid
                              </Button>
                            ) : (
                              <span className="capitalize font-medium text-green-700">
                                {record.status}
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedPayslip(record)}
                            >
                              <Printer className="h-3.5 w-3.5 mr-1" /> Payslip
                            </Button>
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
