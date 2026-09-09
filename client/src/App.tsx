import { Switch, Route, Link, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Students from "@/pages/Students";
import Admissions from "@/pages/Admissions";
import Fees from "@/pages/Fees";
import Staff from "@/pages/Staff";
import Settings from "@/pages/Settings";
import StudentProfile from "@/pages/StudentProfile";

// 🟢 EXAM PAGES IMPORT
import Exams from "@/pages/Exams";
import ExamResults from "@/pages/ExamResults";
import ReportCards from "@/pages/ReportCards";

// 🟢 SALARY & FINANCIAL IMPORTS (NEW)
import StaffSalary from "@/pages/StaffSalary";
import FinancialDashboard from "@/pages/FinancialDashboard";

import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Banknote,
  Briefcase,
  ArrowLeft,
  Home,
  Settings as SettingsIcon,
  FileText,
  GraduationCap,
  Award,
  Calculator,
  IndianRupee,      // 🟢 NEW ICON
  TrendingUp        // 🟢 NEW ICON
} from "lucide-react";

function Sidebar() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/students", label: "Students", icon: Users },
    { href: "/admissions", label: "Admissions", icon: UserPlus },
    { href: "/student-profile", label: "Student Profile", icon: FileText },
    { href: "/fees", label: "Fees & Payments", icon: Banknote },
    
    // 🟢 EXAM MENU LINKS
    { href: "/exams", label: "Examinations", icon: GraduationCap },
    { href: "/exam-results", label: "Marks Entry", icon: Calculator },
    { href: "/report-cards", label: "Report Cards", icon: Award },
    
    { href: "/staff", label: "Staff", icon: Briefcase },
    
    // 🟢 NEW MENU ITEMS (STAFF KE NEECHE)
    { href: "/staff-salary", label: "Staff Salary", icon: IndianRupee },
    { href: "/financial-dashboard", label: "Financial Report", icon: TrendingUp },
    
    { href: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-xl z-50">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-blue-500">🎓</span> SchoolMate
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location === link.href;

          return (
            <Link key={link.href} href={link.href}>
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{link.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function TopBar() {
  const [location] = useLocation();

  return (
    <div className="h-16 bg-white border-b flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm ml-64">
      <div className="flex items-center gap-4">
        {location !== "/" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.history.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        )}

        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <Home className="h-4 w-4" /> Home
          </Button>
        </Link>
      </div>

      <span className="font-bold text-gray-500 capitalize">
        {location.replace("/", "") || "Dashboard"}
      </span>
    </div>
  );
}

function Router() {
  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-2">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/students" component={Students} />
            <Route path="/admissions" component={Admissions} />
            <Route path="/student-profile" component={StudentProfile} />
            <Route path="/fees" component={Fees} />
            
            {/* 🟢 EXAM ROUTES */}
            <Route path="/exams" component={Exams} />
            <Route path="/exam-results" component={ExamResults} />
            <Route path="/report-cards" component={ReportCards} />
            
            <Route path="/staff" component={Staff} />
            
            {/* 🟢 NEW ROUTES */}
            <Route path="/staff-salary" component={StaffSalary} />
            <Route path="/financial-dashboard" component={FinancialDashboard} />
            
            <Route path="/settings" component={Settings} />

            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}