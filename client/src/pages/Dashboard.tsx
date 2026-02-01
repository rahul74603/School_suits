import { useStudents } from "@/hooks/use-students";
import { usePayments, useDefaulters } from "@/hooks/use-fees";
import { Sidebar } from "@/components/Sidebar";
import { StatCard } from "@/components/StatCard";
import { Users, CreditCard, UserPlus, AlertCircle, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: students, isLoading: isLoadingStudents } = useStudents();
  const { data: payments, isLoading: isLoadingPayments } = usePayments();
  const { data: defaulters, isLoading: isLoadingDefaulters } = useDefaulters({ 
    month: format(new Date(), 'MMMM'), // Current month
    class: undefined
  });

  const totalStudents = students?.length || 0;
  const todayCollection = payments
    ?.filter(p => new Date(p.paymentDate!).toDateString() === new Date().toDateString())
    .reduce((sum, p) => sum + p.amount, 0) || 0;
  const pendingCount = defaulters?.length || 0;

  // Mock chart data - in real app, aggregate from backend
  const chartData = [
    { name: "Mon", amount: 12000 },
    { name: "Tue", amount: 15000 },
    { name: "Wed", amount: 8000 },
    { name: "Thu", amount: 22000 },
    { name: "Fri", amount: 18000 },
    { name: "Sat", amount: 5000 },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back to SchoolMate</p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {isLoadingStudents ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : (
            <StatCard
              title="Total Students"
              value={totalStudents}
              icon={Users}
              trend="+12"
              trendUp={true}
            />
          )}

          {isLoadingPayments ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : (
            <StatCard
              title="Today's Collection"
              value={`₹${todayCollection.toLocaleString()}`}
              icon={CreditCard}
              trend="+5%"
              trendUp={true}
            />
          )}

          {isLoadingDefaulters ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : (
            <StatCard
              title="Fee Defaulters"
              value={pendingCount}
              icon={AlertCircle}
              trend="-2"
              trendUp={true}
              className="border-red-100"
            />
          )}

          <StatCard
            title="New Admissions"
            value="24"
            icon={UserPlus}
            trend="+4"
            trendUp={true}
          />
        </div>

        {/* Charts & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart Section */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Fee Collection Trends</h3>
              <div className="flex items-center text-sm text-green-600 font-medium">
                <TrendingUp className="w-4 h-4 mr-1" />
                +12.5% vs last week
              </div>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 12 }} 
                    tickFormatter={(value) => `₹${value/1000}k`}
                  />
                  <Tooltip 
                    cursor={{ fill: '#F1F5F9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Actions / Recent Activity */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-border">
            <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center p-3 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                    RS
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-slate-900">Rahul Sharma</p>
                    <p className="text-xs text-slate-500">Paid Fees - Class 10A</p>
                  </div>
                  <span className="ml-auto text-xs text-slate-400 font-medium">2m ago</span>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-2.5 text-sm font-medium text-primary bg-primary/10 rounded-xl hover:bg-primary/20 transition-colors">
              View All Activity
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
