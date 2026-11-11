import { useEffect, useState } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

// 📱 Android ka hardware back button (@capacitor/app) — sirf native
// platform par; web/Electron par iska koi asar nahi (neeche guard hai).
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { toast } from "@/hooks/use-toast";

// 🔐 Phase 3: asal login (REST + JWT) — pehle app me koi login tha hi nahi.
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "@/pages/Login";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Students from "@/pages/Students";
import Admissions from "@/pages/Admissions";
import Fees from "@/pages/Fees";
import Staff from "@/pages/Staff";
import Settings from "@/pages/Settings";
import StudentProfile from "@/pages/StudentProfile";

// 📅 Attendance (v1.5): roz ki hajri — class-wise bulk marking
import Attendance from "@/pages/Attendance";

// 📢 Notices (v1.6): school ki suchnayein — server API Phase 2 se thi,
// screen ab bani (list sab roles ko, banana principal/teacher ko)
import Notices from "@/pages/Notices";

// 🗓️ Timetable (v1.7): class ka hafta-grid — dekhna sab roles ko,
// badalna principal/teacher ko (page ke andar gating hai)
import Timetable from "@/pages/Timetable";

// 📊 Broadsheet (v1.7): poori class ka subject-wise marks matrix,
// office screen (principal/teacher/accountant)
import Broadsheet from "@/pages/Broadsheet";
// 📚 Library (v1.7): kitabon ka catalog + issue/return
import Library from "@/pages/Library";

// 🟢 EXAM PAGES IMPORT
import Exams from "@/pages/Exams";
import ExamResults from "@/pages/ExamResults";
import ReportCards from "@/pages/ReportCards";

// 🟢 SALARY & FINANCIAL IMPORTS (NEW)
import StaffSalary from "@/pages/StaffSalary";
import FinancialDashboard from "@/pages/FinancialDashboard";

// 🏫 Super Admin: Schools management (sirf super_admin ko dikhta hai)
import Schools from "@/pages/Schools";

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
  CalendarCheck,    // 📅 Attendance (v1.5)
  BookOpen,         // 🗓️ Timetable (v1.7)
  LayoutGrid,       // 📊 Broadsheet (v1.7)
  Megaphone,        // 📢 Notices (v1.6)
  Award,
  Calculator,
  IndianRupee,      // 🟢 NEW ICON
  TrendingUp,       // 🟢 NEW ICON
  Building2,        // 🏫 Super Admin: Schools
  LogOut,           // 🔐 Phase 3: logout button
  Menu              // 📱 Mobile: hamburger (sidebar drawer kholne ke liye)
} from "lucide-react";

function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const [location] = useLocation();
  // 🔐 School ka naam login ke baad /api/auth/me se aata hai (branding).
  const { school, user } = useAuth();

  const links = [
    // 🏫 Schools sirf Super Admin ko — dusre roles ke liye link hi nahi banta.
    ...(user?.role === "super_admin"
      ? [{ href: "/schools", label: "Schools", icon: Building2 }]
      : []),
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/students", label: "Students", icon: Users },
    { href: "/attendance", label: "Attendance", icon: CalendarCheck },
    { href: "/timetable", label: "Timetable", icon: BookOpen },
    { href: "/notices", label: "Notices", icon: Megaphone },
    { href: "/library", label: "Library", icon: BookOpen },
    { href: "/admissions", label: "Admissions", icon: UserPlus },
    { href: "/student-profile", label: "Student Profile", icon: FileText },
    { href: "/fees", label: "Fees & Payments", icon: Banknote },
    
    // 🟢 EXAM MENU LINKS
    { href: "/exams", label: "Examinations", icon: GraduationCap },
    { href: "/exam-results", label: "Marks Entry", icon: Calculator },
    { href: "/report-cards", label: "Report Cards", icon: Award },
    { href: "/broadsheet", label: "Broadsheet", icon: LayoutGrid },
    
    { href: "/staff", label: "Staff", icon: Briefcase },
    
    // 🟢 NEW MENU ITEMS (STAFF KE NEECHE)
    { href: "/staff-salary", label: "Staff Salary", icon: IndianRupee },
    { href: "/financial-dashboard", label: "Financial Report", icon: TrendingUp },
    
    { href: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    // 📱 Mobile: sidebar ek overlay drawer hai — default band
    // (-translate-x-full), hamburger se khulta hai. md+ par hamesha
    // dikhne wala static sidebar (translate-x-0) pehle jaisa hi hai.
    <div
      className={`w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-xl z-50 transform transition-transform duration-200 md:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-blue-500">🎓</span> {school?.name || "School Guardian Suite"}
        </h1>
        {school?.name && (
          <p className="text-xs text-slate-400 mt-1">School Guardian Suite</p>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location === link.href;

          return (
            <Link key={link.href} href={link.href}>
              <div
                onClick={onClose}
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

      <div className="px-4 pb-4 text-[11px] text-slate-500">Version 1.8</div>
    </div>
  );
}

function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const [location] = useLocation();
  // 🔐 Phase 3: login kiya user + logout (bina iske user band hi nahi ho sakta tha).
  const { user, logout } = useAuth();

  return (
    <div className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-40 shadow-sm">
      <div className="flex items-center gap-4">
        {/* 📱 Mobile par sidebar band rehta hai — ye button use drawer
            ki tarah kholta hai. Desktop (md+) par button dikhta hi nahi. */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={onMenuClick}
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

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

      <div className="flex items-center gap-4">
        <span className="hidden font-bold text-gray-500 capitalize md:inline">
          {location.replace("/", "") || "Dashboard"}
        </span>

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-medium text-gray-700">
                {user.name || user.username}
              </div>
              <div className="text-xs text-gray-400 capitalize">
                {user.role.replace("_", " ")}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                void logout();
              }}
            >
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Router() {
  // 🏫 Schools ka route bhi sirf super_admin ke liye register hota hai —
  // dusra role /schools khole to NotFound milega (server bhi 403 dega).
  const { user } = useAuth();
  const [location] = useLocation();

  // 📱 Mobile drawer ki haalat: default band. Route badlte hi band ho
  // jata hai (link par onClose bhi hai, ye doosra suraksha jaal hai).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* 📱 Drawer khula ho to peeche kaala parda — tap karne par band.
          Sirf mobile par (md:hidden); desktop par sidebar static hai. */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[45] bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden md:ml-64">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-2">
          <Switch>
            {user?.role === "super_admin" && (
              <Route path="/schools" component={Schools} />
            )}
            <Route path="/" component={Dashboard} />
            <Route path="/students" component={Students} />
            <Route path="/attendance" component={Attendance} />
            <Route path="/timetable" component={Timetable} />
            <Route path="/notices" component={Notices} />
            <Route path="/library" component={Library} />
            <Route path="/admissions" component={Admissions} />
            <Route path="/student-profile" component={StudentProfile} />
            <Route path="/fees" component={Fees} />
            
            {/* 🟢 EXAM ROUTES */}
            <Route path="/exams" component={Exams} />
            <Route path="/exam-results" component={ExamResults} />
            <Route path="/report-cards" component={ReportCards} />
            <Route path="/broadsheet" component={Broadsheet} />
            
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

// 🔐 Phase 3 gate: yahi ek jagah hai jahan login ka faisla hota hai.
//  - session check chal raha hai  → loading screen
//  - login nahi                    → Login screen
//  - pehla login (password badalna lazmi) → Login screen ka change-password hissa
//  - sab theek                      → purana layout (Router) — pages abhi bhi
//    IPC par hain, unki migration alag batches me hogi.
// 🔒 License lock screen (v1.7): school ka license khatm ho jaye to
// data-API server par band hai (403 LICENSE_EXPIRED) — yahan poori
// app ki jagah sirf ye sandesh + Logout dikhega, taaki user atka na
// rahe aur Super Admin se sampark kar sake. Super Admin par ye kabhi
// nahi aata (auth.tsx me licenseExpired uske liye hamesha false hai).
function LicenseLockScreen() {
  const { school, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl space-y-4">
        <div className="text-4xl">🔒</div>
        <h1 className="text-xl font-bold text-slate-800">
          License Khatm Ho Gaya Hai
        </h1>
        <p className="text-sm text-gray-600">
          Aapke school ka license khatm ho gaya hai — kripya apne
          seller/Super Admin se sampark karein.
        </p>
        {school?.name && (
          <p className="text-xs text-gray-400">
            School: {school.name}
            {school.licenseExpiry
              ? ` • License expiry: ${school.licenseExpiry}`
              : ""}
            {school.plan ? ` • Plan: ${school.plan}` : ""}
          </p>
        )}
        <Button
          className="w-full min-h-[44px] gap-2"
          variant="outline"
          onClick={() => {
            void logout();
          }}
        >
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>
    </div>
  );
}

function Gate() {
  const { user, loading, licenseExpired } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-3 text-white">
        <span className="text-4xl">🎓</span>
        <p className="text-slate-300 text-sm">School Guardian Suite — session check ho raha hai…</p>
      </div>
    );
  }

  if (!user || user.mustChangePassword) {
    return <Login />;
  }

  // 🔒 License band ho to Router ki jagah lock screen (v1.7).
  if (licenseExpired) {
    return <LicenseLockScreen />;
  }

  return <Router />;
}

// 📱 Android back button ka bartav (v1.3):
//  - Andar ke kisi page par ho (history me peeche ja sakte ho) → ek kadam
//    peeche (window.history.back()) — pehle back dabate hi poori app
//    minimize/band ho jati thi, wo marz yahin theek hota hai.
//  - Sabse pehle (root/home) page par: pehla back → toast "App band karne
//    ke liye ek baar aur back dabao"; 2 second ke andar dusra back →
//    App.exitApp(). Galti se ek back par app band nahi hogi.
//  - Sirf native (Android) par lagta hai; web/Electron par listener hi
//    nahi lagta, isliye wahan ka bartav bilkul pehle jaisa.
function useAndroidBackButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let lastRootBackAt = 0;
    let handle: { remove: () => Promise<void> | void } | null = null;
    let cancelled = false;

    CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
        return;
      }
      const now = Date.now();
      if (now - lastRootBackAt < 2000) {
        void CapacitorApp.exitApp();
        return;
      }
      lastRootBackAt = now;
      toast({
        title: "App band karein?",
        description: "App band karne ke liye ek baar aur back dabao.",
      });
    })
      .then((h) => {
        if (cancelled) {
          void h.remove();
        } else {
          handle = h;
        }
      })
      .catch(() => {
        // Plugin na mile (purana build) to kuch nahi — app pehle jaise chalegi.
      });

    return () => {
      cancelled = true;
      if (handle) void handle.remove();
    };
  }, []);
}

export default function App() {
  useAndroidBackButton();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Gate />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}