import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useActiveSession, useSchool } from "@/hooks/use-core";
import { Printer } from "lucide-react";
import type { PayrollRecord, Staff } from "@shared/schema";

const MONTHS = [
  { value: "1", label: "January (01)" },
  { value: "2", label: "February (02)" },
  { value: "3", label: "March (03)" },
  { value: "4", label: "April (04)" },
  { value: "5", label: "May (05)" },
  { value: "6", label: "June (06)" },
  { value: "7", label: "July (07)" },
  { value: "8", label: "August (08)" },
  { value: "9", label: "September (09)" },
  { value: "10", label: "October (10)" },
  { value: "11", label: "November (11)" },
  { value: "12", label: "December (12)" },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => null))?.message ?? "Payroll request failed",
    );
  return response.status === 204 ? (undefined as T) : response.json();
}

export default function Payroll() {
  const { data: user } = useAuth();
  const school = useSchool();
  const session = useActiveSession();
  const manager = user?.role === "admin" || user?.role === "accountant";
  const qc = useQueryClient();

  const [staffId, setStaffId] = useState("");
  const [basic, setBasic] = useState("13000");
  const [allowances, setAllowances] = useState("0");
  const [deductions, setDeductions] = useState("0");
  const [advance, setAdvance] = useState("0");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [message, setMessage] = useState("");
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);

  const staff = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
    queryFn: () => api("/api/staff"),
    enabled: manager,
  });
  const payroll = useQuery<PayrollRecord[]>({
    queryKey: ["/api/payroll"],
    queryFn: () => api("/api/payroll"),
    enabled: !!user,
  });
  const summary = useQuery<{
    count: number;
    totalNet: number;
    paid: number;
    pending: number;
  }>({
    queryKey: ["/api/payroll/summary"],
    queryFn: () => api("/api/payroll/summary"),
    enabled: !!user,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/payroll"] });
    qc.invalidateQueries({ queryKey: ["/api/payroll/summary"] });
  };

  const createStructure = useMutation({
    mutationFn: () =>
      api("/api/payroll/structures", {
        method: "POST",
        body: JSON.stringify({
          staffId: Number(staffId),
          basicSalary: Number(basic),
          allowances: Number(allowances),
          deductions: Number(deductions),
          effectiveFrom: new Date().toISOString().slice(0, 10),
        }),
      }),
    onSuccess: () => {
      invalidate();
      setMessage(
        "Step 1 Complete: Salary structure saved! Now click 'Step 2: Generate Monthly Payroll' to create the salary record.",
      );
    },
  });

  const createPayroll = useMutation({
    mutationFn: async () => {
      // Ensure salary structure exists or is updated before generating payroll
      await api("/api/payroll/structures", {
        method: "POST",
        body: JSON.stringify({
          staffId: Number(staffId),
          basicSalary: Number(basic),
          allowances: Number(allowances),
          deductions: Number(deductions),
          effectiveFrom: new Date().toISOString().slice(0, 10),
        }),
      }).catch(() => undefined);
      return api("/api/payroll", {
        method: "POST",
        body: JSON.stringify({
          staffId: Number(staffId),
          month: Number(month),
          year: Number(year),
          advanceDeduction: Number(advance),
        }),
      });
    },
    onSuccess: () => {
      invalidate();
      setMessage("Monthly payroll generated successfully! You can mark it Paid or print the Payslip below.");
    },
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api(`/api/payroll/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      invalidate();
      setMessage("Payroll status updated.");
    },
  });

  const error =
    staff.error ??
    payroll.error ??
    summary.error ??
    createStructure.error ??
    createPayroll.error ??
    setStatus.error;

  const staffById = new Map((staff.data ?? []).map((s) => [s.id, s]));
  const payslipStaff = selectedPayslip ? staffById.get(selectedPayslip.staffId) : undefined;

  const liveNetPreview = Math.max(
    0,
    Number(basic || 0) +
      Number(allowances || 0) -
      Number(deductions || 0) -
      Number(advance || 0),
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-3xl font-bold">Staff Salary & Payroll</h1>
            <p className="mt-1 text-slate-500">
              Select Staff Member, review Basic Salary, Allowances (+), Deductions (−), and generate monthly salary slips.
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

        {/* Printable Salary Slip */}
        {selectedPayslip && (
          <div className="rounded-xl border-2 border-slate-800 bg-white p-8 shadow-md">
            <div className="border-b pb-4 text-center">
              <h2 className="text-2xl font-bold uppercase">
                {school.data?.name || "SchoolSuite Academy"}
              </h2>
              <p className="text-sm text-slate-600">{school.data?.address}</p>
              <div className="mt-2 inline-block rounded bg-slate-900 px-4 py-1 text-xs font-bold uppercase text-white">
                Official Salary Payslip — {(selectedPayslip as any).month ?? selectedPayslip.payrollMonth}/{(selectedPayslip as any).year ?? selectedPayslip.payrollYear}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <b>Employee Name:</b>{" "}
                {payslipStaff?.name || `Staff #${selectedPayslip.staffId}`}
              </div>
              <div>
                <b>Designation:</b> {payslipStaff?.designation || "Staff"}
              </div>
              <div>
                <b>Academic Session:</b> {session.data?.name || "Active"}
              </div>
              <div>
                <b>Payment Status:</b>{" "}
                <span className="uppercase font-bold">{selectedPayslip.status}</span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded bg-slate-50 p-3 border">
                <div className="text-xs text-slate-500">Basic Salary</div>
                <div className="font-bold">₹{((selectedPayslip as any).basicSalary ?? selectedPayslip.basicAmount).toLocaleString()}</div>
              </div>
              <div className="rounded bg-green-50 p-3 border border-green-100">
                <div className="text-xs text-green-700">+ Allowances / Bonus</div>
                <div className="font-bold text-green-800">
                  ₹{selectedPayslip.allowances.toLocaleString()}
                </div>
              </div>
              <div className="rounded bg-red-50 p-3 border border-red-100">
                <div className="text-xs text-red-700">− Deductions & Advance</div>
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
              <CardTitle>Salary Structure & Monthly Payroll Generation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    1. Select Staff / Teacher (कर्मचारी चुनें) *
                  </label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
                    value={staffId}
                    onChange={(e) => {
                      setStaffId(e.target.value);
                      const member = staffById.get(Number(e.target.value));
                      if (member) setBasic(String(member.basicSalary));
                    }}
                  >
                    <option value="">-- Select Staff Member --</option>
                    {(staff.data ?? []).map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} — {member.designation} (₹{member.basicSalary})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    2. Monthly Basic Salary (मूल वेतन ₹)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="e.g., 15000"
                    value={basic}
                    onChange={(e) => setBasic(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-700 mb-1">
                    3. Extra Allowances / Bonus (+ भत्ता ₹)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0 (if none)"
                    value={allowances}
                    onChange={(e) => setAllowances(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-red-700 mb-1">
                    4. Leave / PF Deductions (− कटौती ₹)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0 (if none)"
                    value={deductions}
                    onChange={(e) => setDeductions(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-700 mb-1">
                    5. Advance Salary Cut (− एडवांस कटौती ₹)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0 (if none)"
                    value={advance}
                    onChange={(e) => setAdvance(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    6. Salary Month (महीना चुनें)
                  </label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    7. Salary Year (वर्ष)
                  </label>
                  <Input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  />
                </div>

                <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-2 flex flex-col justify-center">
                  <span className="text-[11px] font-semibold text-indigo-700">
                    Net Payable Salary (कुल देय वेतन):
                  </span>
                  <span className="text-lg font-extrabold text-indigo-950">
                    ₹{liveNetPreview.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <Button
                  variant="outline"
                  onClick={() => createStructure.mutate()}
                  disabled={!staffId || !basic || createStructure.isPending}
                >
                  Save Salary Structure Only
                </Button>
                <Button
                  onClick={() => createPayroll.mutate()}
                  disabled={!staffId || createPayroll.isPending}
                >
                  {createPayroll.isPending
                    ? "Generating..."
                    : "Save & Generate Monthly Salary Slip"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {summary.data && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 print:hidden">
            <div className="rounded bg-white p-4 shadow-sm border">
              <small className="text-slate-500">Total Salary Slips</small>
              <div className="text-xl font-bold">{summary.data.count}</div>
            </div>
            <div className="rounded bg-white p-4 shadow-sm border">
              <small className="text-slate-500">Total Net Payroll</small>
              <div className="text-xl font-bold">₹{summary.data.totalNet.toLocaleString()}</div>
            </div>
            <div className="rounded bg-white p-4 shadow-sm border">
              <small className="text-slate-500">Total Paid</small>
              <div className="text-xl font-bold text-green-700">
                ₹{summary.data.paid.toLocaleString()}
              </div>
            </div>
            <div className="rounded bg-white p-4 shadow-sm border">
              <small className="text-slate-500">Pending Payment</small>
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
                    <th className="p-3 text-left">Month / Year</th>
                    <th className="p-3 text-left">Basic Salary</th>
                    <th className="p-3 text-left">+ Allowances</th>
                    <th className="p-3 text-left">− Deductions</th>
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
                  ) : !payroll.data?.length ? (
                    <tr>
                      <td className="p-6 text-center text-slate-500" colSpan={7}>
                        No salary records generated yet. Select a Staff Member above and click &ldquo;Save &amp; Generate Monthly Salary Slip&rdquo;.
                      </td>
                    </tr>
                  ) : (
                    (payroll.data ?? []).map((row) => {
                      const member = staffById.get(row.staffId);
                      return (
                        <tr className="border-t" key={row.id}>
                          <td className="p-3 font-medium">
                            {member
                              ? `${member.name} (${member.designation})`
                              : `Staff #${row.staffId}`}
                          </td>
                          <td className="p-3">
                            {(row as any).month ?? row.payrollMonth}/{(row as any).year ?? row.payrollYear}
                          </td>
                          <td className="p-3">₹{((row as any).basicSalary ?? row.basicAmount).toLocaleString()}</td>
                          <td className="p-3 text-emerald-700">
                            +₹{row.allowances.toLocaleString()}
                          </td>
                          <td className="p-3 text-red-700">
                            −₹{(row.deductions + row.advanceDeduction).toLocaleString()}
                          </td>
                          <td className="p-3 font-bold text-slate-900">
                            ₹{row.netSalary.toLocaleString()}
                          </td>
                          <td className="p-3 flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                                row.status === "paid"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {row.status}
                            </span>
                            {manager && row.status !== "paid" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setStatus.mutate({
                                    id: row.id,
                                    status: row.status === "draft" ? "finalized" : "paid",
                                  })
                                }
                              >
                                {row.status === "draft" ? "Finalize" : "Mark Paid"}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedPayslip(row)}
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
