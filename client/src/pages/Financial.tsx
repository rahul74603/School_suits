import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";

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
      (await response.json().catch(() => null))?.message ?? "Financial request failed",
    );
  return response.status === 204 ? (undefined as T) : response.json();
}

export default function Financial() {
  const { data: user } = useAuth();
  const manager = ["admin", "principal", "accountant"].includes(user?.role ?? "");
  const qc = useQueryClient();
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState("");

  const summary = useQuery<any>({
    queryKey: ["/api/financial/summary", month, year],
    queryFn: () => api(`/api/financial/summary?month=${month}&year=${year}`),
  });
  const categories = useQuery<any[]>({
    queryKey: ["/api/financial/expense-categories"],
    queryFn: () => api("/api/financial/expense-categories"),
  });
  const expenses = useQuery<any[]>({
    queryKey: ["/api/financial/expenses", month, year],
    queryFn: () =>
      api(
        `/api/financial/expenses?from=${year}-${month.padStart(2, "0")}-01&to=${new Date(
          Number(year),
          Number(month),
          0,
        )
          .toISOString()
          .slice(0, 10)}`,
      ),
  });

  const createCategory = useMutation({
    mutationFn: () =>
      api("/api/financial/expense-categories", {
        method: "POST",
        body: JSON.stringify({ name: newCategoryName }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/financial/expense-categories"] });
      setNewCategoryName("");
      setMessage("Expense category added.");
    },
  });

  const createExpense = useMutation({
    mutationFn: () =>
      api("/api/financial/expenses", {
        method: "POST",
        body: JSON.stringify({
          categoryId: Number(categoryId),
          description,
          amount: Number(amount),
          expenseDate,
          paymentReference: null,
          remarks: null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/financial"] });
      setMessage("Expense saved as draft. Finalize it to include it in the dashboard.");
      setDescription("");
      setAmount("");
    },
  });

  const finalizeExpense = useMutation({
    mutationFn: (id: number) =>
      api(`/api/financial/expenses/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: "finalized" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/financial"] });
      setMessage("Expense finalized and included in financial summary.");
    },
  });

  const deleteExpense = useMutation({
    mutationFn: (id: number) =>
      api(`/api/financial/expenses/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/financial"] }),
  });

  const error =
    summary.error ??
    categories.error ??
    expenses.error ??
    createExpense.error ??
    createCategory.error;

  const categoryById = new Map((categories.data ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Financial Dashboard & Expense Ledger</h1>
            <p className="mt-1 text-slate-500">
              Net balance = Fee Income − Finalized School Expenses − Paid Staff Payroll.
            </p>
          </div>

          <div className="flex gap-3 bg-white p-3 rounded-xl border shadow-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Filter Month (महीना)
              </label>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm font-medium"
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
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Filter Year (वर्ष)
              </label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-32 bg-white"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">
            {(error as Error).message}
          </div>
        )}
        {message && (
          <div className="rounded border border-green-200 bg-green-50 p-3 text-green-700">
            {message}
          </div>
        )}

        {summary.data && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <small className="text-slate-500">Fee Income (+ कुल फीस आय)</small>
              <div className="text-xl font-bold text-green-700">
                ₹{(summary.data.feeIncome ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <small className="text-slate-500">Finalized Expenses (− स्कूल खर्च)</small>
              <div className="text-xl font-bold text-amber-700">
                ₹{(summary.data.expenses ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <small className="text-slate-500">Paid Payroll (− स्टाफ सैलरी)</small>
              <div className="text-xl font-bold text-purple-700">
                ₹{(summary.data.paidPayroll ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <small className="text-slate-500">Net Balance (शुद्ध बचत)</small>
              <div className="text-xl font-bold text-slate-900">
                ₹{(summary.data.netBalance ?? 0).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {manager && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Add Expense Category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category Name (खर्च का प्रकार) *
                  </label>
                  <Input
                    placeholder="e.g., Electricity / Lab / Maintenance"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => createCategory.mutate()}
                  disabled={createCategory.isPending || !newCategoryName.trim()}
                >
                  Add Category
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Step 2: Record School Expense (स्कूल खर्च दर्ज करें)</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-5 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expense Category (प्रकार) *
                  </label>
                  <select
                    className="h-10 w-full rounded border bg-background px-3 text-sm"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">-- Select Category --</option>
                    {(categories.data ?? []).map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expense Details (विवरण) *
                  </label>
                  <Input
                    placeholder="e.g., October Electricity Bill"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount (राशि ₹) *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g., 4500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expense Date (तारीख) *
                  </label>
                  <Input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </div>
                <Button
                  className="h-10"
                  onClick={() => createExpense.mutate()}
                  disabled={!categoryId || !description || !amount}
                >
                  Save Expense
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>School Expense Register</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-left">Amount</th>
                    <th className="p-3 text-left">Status & Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.isLoading ? (
                    <tr>
                      <td className="p-3" colSpan={5}>
                        Loading expenses...
                      </td>
                    </tr>
                  ) : !expenses.data?.length ? (
                    <tr>
                      <td className="p-6 text-center text-slate-500" colSpan={5}>
                        No expenses recorded for this month.
                      </td>
                    </tr>
                  ) : (
                    (expenses.data ?? []).map((row) => (
                      <tr className="border-t" key={row.id}>
                        <td className="p-3">{row.expenseDate}</td>
                        <td className="p-3 font-medium">
                          {categoryById.get(row.categoryId) || `Category #${row.categoryId}`}
                        </td>
                        <td className="p-3">{row.description}</td>
                        <td className="p-3 font-semibold">₹{row.amount.toLocaleString()}</td>
                        <td className="p-3 flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                              row.status === "finalized"
                                ? "bg-green-100 text-green-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {row.status}
                          </span>
                          {manager && row.status === "draft" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => finalizeExpense.mutate(row.id)}
                              >
                                Finalize
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600"
                                onClick={() => deleteExpense.mutate(row.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
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
