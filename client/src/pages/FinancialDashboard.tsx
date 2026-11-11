import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { 
  TrendingUp, 
  TrendingDown, 
  IndianRupee, 
  Users, 
  CreditCard,
  Wallet,
  School
} from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface FinancialSummary {
  income: number;
  salaryExpense: number;
  otherExpense: number;
  totalExpense: number;
  netProfit: number;
  profitMargin: string;
}

interface TrendData {
  month: string;
  year: number;
  income: number;
  expense: number;
  profit: number;
}

export default function FinancialDashboard() {
  // Super Admin ka khud ka koi school nahi hota — /api/reports/*
  // server par uske liye 403 dete hain (requireRole principal/
  // accountant only; routes se verify). Pehle ye fail khamoshi se
  // hota tha aur SA ko ek jhoota zero-wala dashboard dikhta tha.
  // Isliye SA par API call hi nahi karte — Settings wala no-school
  // card dikhega.
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState<FinancialSummary>({
    income: 0,
    salaryExpense: 0,
    otherExpense: 0,
    totalExpense: 0,
    netProfit: 0,
    profitMargin: "0"
  });
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFinancialData();
    fetchTrendData();
  }, [selectedMonth, selectedYear]);

  // REST: /api/reports/financial-summary month/year filter NAHI leta —
  // wo bina filter ke kul (all-time) jod deta hai. Page ko chuney hue
  // mahine ka hisaab chahiye, isliye summary bhi mahina-dar trend rows
  // (/api/reports/financial-trend) se nikala jata hai — IPC wala
  // month-wise matlab bilkul barkaraar rehta hai (NOTES.md).
  const loadTrendRows = async (): Promise<any[]> =>
    (await apiGet<any[]>("/api/reports/financial-trend")) || [];

  const fetchFinancialData = async () => {
    // Super Admin: koi school nahi — koi API call nahi (upar wala note).
    if (isSuperAdmin) return;
    setLoading(true);
    try {
      const rows = await loadTrendRows();
      const row = rows.find(
        (r) => r.month === selectedMonth && r.year === selectedYear
      );
      const income = row?.feesCollected ?? 0;
      const salaryExpense = row?.salaryPaid ?? 0;
      const otherExpense = row?.expenses ?? 0;
      const totalExpense = salaryExpense + otherExpense;
      const netProfit = income - totalExpense;
      setSummary({
        income,
        salaryExpense,
        otherExpense,
        totalExpense,
        netProfit,
        profitMargin: income > 0 ? ((netProfit / income) * 100).toFixed(1) : "0",
      });
    } catch (e) {
      console.error("Failed to load financial data", e);
    }
    setLoading(false);
  };

  const fetchTrendData = async () => {
    // Super Admin: koi school nahi — koi API call nahi (upar wala note).
    if (isSuperAdmin) return;
    try {
      const rows = await loadTrendRows();
      // Adapter: server { feesCollected, salaryPaid, expenses } deta
      // hai; page { income, expense, profit } padhta hai.
      setTrendData(
        rows.map((r) => ({
          month: r.month,
          year: r.year,
          income: r.feesCollected ?? 0,
          expense: (r.salaryPaid ?? 0) + (r.expenses ?? 0),
          profit: (r.feesCollected ?? 0) - ((r.salaryPaid ?? 0) + (r.expenses ?? 0)),
        }))
      );
    } catch (e) {
      console.error("Failed to load trend data", e);
    }
  };

  const expenseData = [
    { name: 'Salary', value: summary.salaryExpense },
    { name: 'Other Expenses', value: summary.otherExpense },
  ];

  const isProfit = summary.netProfit >= 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-slate-800">
            <TrendingUp className="h-8 w-8 text-blue-600" /> Financial Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Track income, expenses and profitability</p>
        </div>
        
        {!isSuperAdmin && (
        <div className="flex gap-4">
          <div className="w-[150px]">
            <Label>Month</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white z-[9999]">
                {MONTHS.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[120px]">
            <Label>Year</Label>
            <Select 
              value={selectedYear.toString()} 
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white z-[9999]">
                {[2024, 2025, 2026, 2027].map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        )}
      </div>

      {isSuperAdmin ? (
        <Card className="border-t-4 border-t-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" /> No School Linked to This Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              You are signed in as Super Admin. This account is not linked
              to any school, so there is no school financial data to show
              here. First create a school from the Schools screen — after
              that, that school&apos;s Principal can sign in with their
              own account and see the financial report.
            </p>
            <Link href="/schools">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <School className="h-4 w-4 mr-2" /> Go to Schools
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
      <>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Total Income</p>
                <p className="text-2xl font-bold text-green-700">₹{summary.income.toLocaleString()}</p>
                <p className="text-xs text-green-600 mt-1">Fee Collection</p>
              </div>
              <IndianRupee className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Total Expenses</p>
                <p className="text-2xl font-bold text-red-700">₹{summary.totalExpense.toLocaleString()}</p>
                <p className="text-xs text-red-600 mt-1">Salary + Others</p>
              </div>
              <CreditCard className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className={isProfit ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${isProfit ? "text-blue-600" : "text-orange-600"}`}>
                  Net {isProfit ? "Profit" : "Loss"}
                </p>
                <p className={`text-2xl font-bold ${isProfit ? "text-blue-700" : "text-orange-700"}`}>
                  ₹{Math.abs(summary.netProfit).toLocaleString()}
                </p>
                <p className={`text-xs mt-1 ${isProfit ? "text-blue-600" : "text-orange-600"}`}>
                  {summary.profitMargin}% margin
                </p>
              </div>
              {isProfit ? (
                <TrendingUp className="h-8 w-8 text-blue-600" />
              ) : (
                <TrendingDown className="h-8 w-8 text-orange-600" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Salary Expense</p>
                <p className="text-2xl font-bold text-purple-700">₹{summary.salaryExpense.toLocaleString()}</p>
                <p className="text-xs text-purple-600 mt-1">Staff payments</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>6 Months Trend - Income vs Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="income" fill="#10b981" name="Income" />
                <Bar dataKey="expense" fill="#ef4444" name="Expense" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown - {selectedMonth}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expenseData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expenseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Profit Trend Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Profit/Loss Trend (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
              <Bar 
                dataKey="profit" 
                fill="#3b82f6" 
                name="Net Profit/Loss"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      </>
      )}
    </div>
  );
}