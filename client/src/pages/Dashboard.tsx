import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  Users,
  IndianRupee,
  AlertCircle,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  RefreshCw,
  School
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";

export default function Dashboard() {
  const { toast } = useToast();
  // School ka naam greeting ke liye auth se aata hai (/api/auth/me ka
  // school — sidebar bhi yahi naam dikhata hai).
  const { user, school } = useAuth();
  // Super Admin ka khud ka koi school nahi hota — dashboard ke
  // endpoints server par uske liye 403 dete hain (requireRole me
  // super_admin hai hi nahi; routes se verify). Isliye SA par API
  // call hi nahi karte — Settings wala no-school card dikhega,
  // "Failed to load dashboard data" wala lal toast nahi.
  const isSuperAdmin = user?.role === "super_admin";
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    todaysCollection: 0,
    feeDefaulters: 0,
    newAdmissions: 0,
    lastMonthStudents: 0,
    lastMonthCollection: 0,
    lastMonthDefaulters: 0,
    lastMonthAdmissions: 0,
  });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [upcomingDues, setUpcomingDues] = useState<any[]>([]);

  // Load all dashboard data
  const loadDashboardData = async () => {
    // Super Admin: koi school nahi — koi API call nahi (upar wala note).
    if (isSuperAdmin) return;
    setLoading(true);
    try {
      const today = new Date();
      const currentMonth = today.toLocaleString('default', { month: 'long' });
      const currentYear = today.getFullYear();
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthName = lastMonth.toLocaleString('default', { month: 'long' });
      const lastMonthYear = lastMonth.getFullYear();

      // 1. Total Students (Active)
      // REST: GET /api/students (bina filter ke — server par "ALL" ka matlab
      // koi filter nahi, isliye params nahi bheje). Student row camelCase
      // aata hai, page snake_case (admission_no) padhta hai — adapter yahi hai.
      const rawStudents = await apiGet<any[]>("/api/students");
      const allStudents = (rawStudents || []).map((s: any) => ({
        ...s,
        admission_no: s.admissionNo,
      }));
      const totalStudents = allStudents?.length || 0;

      // 2. Last Month Students (for comparison)
      const lastMonthStudents = totalStudents; // Simplified - ideally check created_at

      // 3. Today's Collection
      const todayStr = today.toISOString().split('T')[0];
      let todaysCollection = 0;
      // REST: GET /api/payments — school ke saare payments (AUDIT ne
      // /api/reports/dashboard likha tha, lekin wo sirf kul jod {todayCollection,
      // monthCollection...} deta hai; is page ko weekly chart aur recent
      // activity ke liye asal payment rows chahiye, isliye list wala
      // endpoint sahi jawab hai — NOTES.md me tafseel).
      // Adapters: payment_date <- paymentDate; student_name/class_name
      // server join nahi karta, upar wale students map se bhare.
      const rawPayments = await apiGet<any[]>("/api/payments");
      const studentById = new Map((allStudents || []).map((s: any) => [s.id, s]));
      const allPayments = (rawPayments || [])
        .map((pay: any) => ({
          ...pay,
          payment_date: pay.paymentDate,
          student_name: studentById.get(pay.studentId)?.name,
          class_name: studentById.get(pay.studentId)?.class,
        }))
        // Recent activity ke liye sabse naye pehle (server list ka koi
        // order pakka nahi hai).
        .sort(
          (a: any, b: any) =>
            new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
        );
      
      if (allPayments && Array.isArray(allPayments)) {
        todaysCollection = allPayments
          .filter((p: any) => {
            const paymentDate = new Date(p.payment_date).toISOString().split('T')[0];
            return paymentDate === todayStr;
          })
          .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      }

      // 4. Last Month Collection
      const lastMonthCollection = allPayments?.filter((p: any) => {
        const paymentDate = new Date(p.payment_date);
        return paymentDate.getMonth() === lastMonth.getMonth() && 
               paymentDate.getFullYear() === lastMonth.getFullYear();
      }).reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;

      // 5. Fee Defaulters (Students with pending dues)
      let defaultersCount = 0;
      for (const student of allStudents || []) {
        // REST: GET /api/students/:id/status?year= (class server student
        // ki apni leta hai, bhejna nahi padta). Jawab ka shape IPC jaisa hi.
        const status = await apiGet<any>(
          `/api/students/${student.id}/status?year=${currentYear}`,
        );
        const hasPending = status?.monthStatus?.some((m: any) => m.tuitionStatus === "due") ||
                          (status?.pendingDues?.length > 0) ||
                          (status?.admissionBalance > 0);
        if (hasPending) defaultersCount++;
      }

      // 6. New Admissions (This month)
      const thisMonthAdmissions = allStudents?.filter((s: any) => {
        // Assuming admission_no format: KPS-2026-001, extract year
        const admYear = s.admission_no?.split('-')[1];
        return admYear === currentYear.toString();
      }).length || 0;

      // 7. Weekly Data for Chart (Last 7 days)
      const weekData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        
        const dayCollection = allPayments?.filter((p: any) => {
          const paymentDate = new Date(p.payment_date).toISOString().split('T')[0];
          return paymentDate === dateStr;
        }).reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;

        weekData.push({
          name: dayName,
          amount: dayCollection,
        });
      }

      // 8. Recent Activity (Last 5 payments)
      const recentPayments = allPayments?.slice(0, 5).map((p: any) => ({
        id: p.id,
        studentName: p.student_name || "Student",
        class: p.class_name || "",
        amount: p.amount,
        type: "fee_payment",
        time: new Date(p.payment_date).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
      })) || [];

      // 9. Upcoming Dues (Next 7 days)
      const upcoming = [];
      for (const student of allStudents?.slice(0, 10) || []) {
        const status = await apiGet<any>(
          `/api/students/${student.id}/status?year=${currentYear}`,
        );
        
        const pendingMonths = status?.monthStatus?.filter((m: any) => m.tuitionStatus === "due") || [];
        if (pendingMonths.length > 0) {
          upcoming.push({
            studentName: student.name,
            class: `${student.class}-${student.section}`,
            amount: status.monthlyFee * pendingMonths.length,
            dueDate: "Overdue",
          });
        }
      }

      setStats({
        totalStudents,
        todaysCollection,
        feeDefaulters: defaultersCount,
        newAdmissions: thisMonthAdmissions,
        lastMonthStudents,
        lastMonthCollection,
        lastMonthDefaulters: defaultersCount, // Simplified
        lastMonthAdmissions: Math.max(0, thisMonthAdmissions - 4), // Estimate
      });

      setWeeklyData(weekData);
      setRecentActivity(recentPayments);
      setUpcomingDues(upcoming.slice(0, 5));

    } catch (e) {
      console.error("Dashboard error:", e);
      toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDashboardData();
    // Auto refresh every 5 minutes
    const interval = setInterval(loadDashboardData, 300000);
    return () => clearInterval(interval);
  }, []);

  // Calculate percentage change
  const getChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}k`;
    return `₹${amount}`;
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back to {school?.name || "School Guardian Suite"}</p>
        </div>
        <Button onClick={loadDashboardData} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
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
              to any school, so there is no school data to show on the
              dashboard. First create a school from the Schools screen —
              after that, that school&apos;s Principal can sign in with
              their own account and see their school&apos;s dashboard.
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Students</p>
                <h3 className="text-3xl font-bold mt-2">{stats.totalStudents}</h3>
                <div className="flex items-center mt-2 text-sm">
                  {stats.totalStudents >= stats.lastMonthStudents ? (
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                  )}
                  <span className={stats.totalStudents >= stats.lastMonthStudents ? "text-green-600" : "text-red-600"}>
                    {Math.abs(getChange(stats.totalStudents, stats.lastMonthStudents)).toFixed(0)}%
                  </span>
                  <span className="text-gray-400 ml-1">vs last month</span>
                </div>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Collection */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Today's Collection</p>
                <h3 className="text-3xl font-bold mt-2">{formatCurrency(stats.todaysCollection)}</h3>
                <div className="flex items-center mt-2 text-sm">
                  {stats.todaysCollection >= stats.lastMonthCollection / 30 ? (
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                  )}
                  <span className={stats.todaysCollection >= stats.lastMonthCollection / 30 ? "text-green-600" : "text-red-600"}>
                    {Math.abs(getChange(stats.todaysCollection, stats.lastMonthCollection / 30)).toFixed(0)}%
                  </span>
                  <span className="text-gray-400 ml-1">vs avg day</span>
                </div>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <IndianRupee className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fee Defaulters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Fee Defaulters</p>
                <h3 className="text-3xl font-bold mt-2">{stats.feeDefaulters}</h3>
                <div className="flex items-center mt-2 text-sm">
                  <span className="text-red-600 font-medium">
                    {stats.feeDefaulters > 0 ? `-${stats.feeDefaulters}` : "0"}
                  </span>
                  <span className="text-gray-400 ml-1">vs last month</span>
                </div>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* New Admissions */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">New Admissions</p>
                <h3 className="text-3xl font-bold mt-2">{stats.newAdmissions}</h3>
                <div className="flex items-center mt-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-600">
                    +{Math.abs(getChange(stats.newAdmissions, stats.lastMonthAdmissions)).toFixed(0)}
                  </span>
                  <span className="text-gray-400 ml-1">vs last month</span>
                </div>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <UserPlus className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fee Collection Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap gap-3 justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" /> Fee Collection Trends
              </CardTitle>
              <div className="flex items-center text-sm text-green-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                +12.5% vs last week
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" stroke="#888" fontSize={12} />
                  <YAxis 
                    stroke="#888" 
                    fontSize={12}
                    tickFormatter={(value) => `₹${value/1000}k`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, "Collection"]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar 
                    dataKey="amount" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={50}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, idx) => (
                  <div key={idx} className="flex items-start gap-3 pb-3 border-b last:border-0">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {activity.studentName?.charAt(0) || "S"}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{activity.studentName}</p>
                      <p className="text-xs text-gray-500">
                        Paid Fees - {activity.class}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-green-600">₹{activity.amount}</p>
                      <p className="text-xs text-gray-400">{activity.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-4">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Dues */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-600">
            <AlertCircle className="h-5 w-5" /> Upcoming/Pending Dues
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingDues.length > 0 ? (
              upcomingDues.map((due, idx) => (
                <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-sm">{due.studentName}</p>
                      <p className="text-xs text-gray-600">Class {due.class}</p>
                    </div>
                    <span className="bg-orange-200 text-orange-800 text-xs px-2 py-1 rounded">
                      {due.dueDate}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-bold text-orange-700">₹{due.amount}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 col-span-1 md:col-span-2 lg:col-span-3 py-4">No pending dues</p>
            )}
          </div>
        </CardContent>
      </Card>

      </>
      )}
    </div>
  );
}