import { useStudents } from "@/hooks/use-students";
import { usePayments, useDefaulters } from "@/hooks/use-fees";
import { useActiveSession } from "@/hooks/use-core";
import { Sidebar } from "@/components/Sidebar";
import { StatCard } from "@/components/StatCard";
import { QueryError } from "@/components/QueryState";
import { Users, CreditCard, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const students = useStudents(); const payments = usePayments(); const session = useActiveSession();
  const defaulters = useDefaulters({ month: format(new Date(), "MMMM"), year: new Date().getFullYear() });
  const errors = [students, payments, defaulters, session].filter((query) => query.isError);
  const today = new Date().toDateString();
  const todayCollection = payments.data?.filter((payment) => new Date(payment.paymentDate).toDateString() === today).reduce((sum, payment) => sum + payment.amount, 0) ?? 0;
  return <div className="flex min-h-screen bg-slate-50"><Sidebar /><main className="flex-1 ml-64 p-8"><header className="mb-8"><h1 className="text-3xl font-bold">Dashboard</h1><p className="text-slate-500 mt-1">{session.data?.name || "Active academic session"}</p></header>
    {errors.length > 0 && <QueryError message="Some dashboard data could not be loaded. Refresh and try again." onRetry={() => errors.forEach((query) => query.refetch())} />}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"><StatCard title="Active Students" value={students.data?.length ?? "Not available"} icon={Users} /><StatCard title="Today's Collection" value={payments.data ? `₹${todayCollection.toLocaleString()}` : "Not available"} icon={CreditCard} /><StatCard title="Current Defaulters" value={defaulters.data?.length ?? "Not available"} icon={AlertCircle} /></div>
    <div className="bg-white p-6 rounded-2xl border"><h2 className="text-lg font-bold mb-4">Recent payments</h2>{payments.isLoading ? <p>Loading payments...</p> : payments.data?.length ? <div className="space-y-3">{payments.data.slice(0, 8).map((payment) => <div key={payment.id} className="flex justify-between border-b pb-3"><span>Receipt {payment.receiptNo}</span><span className="font-semibold">₹{payment.amount.toLocaleString()}</span></div>)}</div> : <p className="text-slate-500">No payments recorded in the active session.</p>}</div>
  </main></div>;
}
