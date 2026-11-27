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
// 👨‍👩‍👧 Parent App build flag (v2.1) — VITE_PARENT_APP=1 wale build me
// Gate sirf parent ka hissa deta hai (neeche ParentShell dekho).
import { PARENT_APP } from "./lib/parentApp";
// 👑 Master App build flag (v2.2) — VITE_MASTER_APP=1 wale build me
// Gate sirf Super Admin ka hissa deta hai (neeche MasterShell dekho).
import { MASTER_APP } from "./lib/masterApp";
// 🔢 Is build ka version (v3.0) — ek hi jagah (lib/appVersion);
// neeche teeno shells ke version-text yahi se aate hain.
import { APP_VERSION_NAME } from "./lib/appVersion";
// 🔄 Update check (v3.0) — har shell me mount; naya version
// released ho to sandesh deta hai.
import UpdateCheck from "@/components/UpdateCheck";
// 🔙 Modal stack (v3.1) — back button pehle khule overlay (jaise
// PrintViewer) ko band karta hai, history baad me.
import { closeTopModal, modalStackSize } from "./lib/modalStack";
// 📲 Master App: App Update publish card (v3.0).
import AppUpdateCard from "@/components/AppUpdateCard";
// 💾 Master App: Backup card (v3.0) + School App ka backup banner.
import BackupCard from "@/components/BackupCard";
import BackupBanner from "@/components/BackupBanner";
import Login from "@/pages/Login";
// 👨‍👩‍👧 Parent App ki APNI login screen (v2.2) — School ID (Code) +
// Mobile + Password wali seedhi screen; school wali Login se alag.
import ParentLogin from "@/pages/ParentLogin";
// 🧪 Master App: Demo School (test data) banane wala card.
import DemoSchoolCard from "@/components/DemoSchoolCard";

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

// 📚 Homework (v3.0): teacher/principal homework dete hain, parent
// apne app me wahi dekhta hai.
import Homework from "@/pages/Homework";
// 🌴 Leaves (v3.0): students/staff ki chutti — record + principal
// ka faisla (approve/reject).
import Leaves from "@/pages/Leaves";
// 📜 Certificates page (v3.0): baccha chuno → 8 certificates —
// pehle ye sirf Student Profile ke andar chhupe the.
import CertificatesPage from "@/pages/CertificatesPage";

// 🏠 Parent Home (v2.0): parent login ke baad ki pehli screen —
// bacche ki hajri/fees/notices/results/timetable ek hi jagah
// (GET /api/parent/overview). Sirf parent role ke liye.
import ParentHome from "@/pages/ParentHome";

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
  CalendarOff,      // 🌴 Leaves (v3.0)
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
    // 🏠 Parent Home sirf parent ko — uski pehli screen yahi hai.
    ...(user?.role === "parent"
      ? [{ href: "/parent", label: "Parent Home", icon: Home }]
      : []),
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/students", label: "Students", icon: Users },
    { href: "/attendance", label: "Attendance", icon: CalendarCheck },
    { href: "/timetable", label: "Timetable", icon: BookOpen },
    { href: "/notices", label: "Notices", icon: Megaphone },
    { href: "/homework", label: "Homework", icon: BookOpen },
    { href: "/leaves", label: "Leaves (Chutti)", icon: CalendarOff },
    { href: "/library", label: "Library", icon: BookOpen },
    { href: "/admissions", label: "Admissions", icon: UserPlus },
    { href: "/student-profile", label: "Student Profile", icon: FileText },
    { href: "/fees", label: "Fees & Payments", icon: Banknote },
    
    // 🟢 EXAM MENU LINKS
    { href: "/exams", label: "Examinations", icon: GraduationCap },
    { href: "/exam-results", label: "Marks Entry", icon: Calculator },
    { href: "/report-cards", label: "Report Cards", icon: Award },
    { href: "/certificates", label: "Certificates", icon: Award },
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

      <div className="px-4 pb-4 text-[11px] text-slate-500">Version {APP_VERSION_NAME}</div>
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
  // v3.0: School App build me super_admin Gate par hi ruk jata hai
  // (SuperAdminGateScreen), isliye ye route yahan asal me Master/
  // web ke purane bartav ke liye bacha hai — SA is build me Router
  // tak aata hi nahi.
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

      <div className="flex min-w-0 w-full flex-1 flex-col h-screen overflow-hidden overflow-x-clip md:ml-64">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-clip p-2">
          {/* 🔄💾 v3.0: update check (har shell me) + principal ke
              liye backup-due banner (24 ghante se backup na hua ho). */}
          <UpdateCheck />
          <BackupBanner />
          <Switch>
            {user?.role === "super_admin" && (
              <Route path="/schools" component={Schools} />
            )}
            {/* 🏠 Parent login ke baad seedha Parent Home par utarta
                hai (office Dashboard uske kaam ka nahi) — /schools
                wale role-gate wala hi pattern. */}
            {user?.role === "parent" && (
              <Route path="/parent" component={ParentHome} />
            )}
            <Route
              path="/"
              component={user?.role === "parent" ? ParentHome : Dashboard}
            />
            <Route path="/students" component={Students} />
            <Route path="/attendance" component={Attendance} />
            <Route path="/timetable" component={Timetable} />
            <Route path="/notices" component={Notices} />
            <Route path="/homework" component={Homework} />
            <Route path="/leaves" component={Leaves} />
            <Route path="/library" component={Library} />
            <Route path="/admissions" component={Admissions} />
            <Route path="/student-profile" component={StudentProfile} />
            <Route path="/fees" component={Fees} />
            
            {/* 🟢 EXAM ROUTES */}
            <Route path="/exams" component={Exams} />
            <Route path="/exam-results" component={ExamResults} />
            <Route path="/report-cards" component={ReportCards} />
            <Route path="/certificates" component={CertificatesPage} />
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

// 👨‍👩‍👧 Parent App ki khaali chaukhat (v2.1) — Parent App build me koi
// sidebar/office-menu nahi hota: upar sirf school ka naam + parent ka
// naam + Logout, neeche Parent Home. ParentHome ka "Report Card" wala
// link /report-cards kholta hai, isliye wo ek route yahan bhi hai —
// uske alawa har rasta Parent Home par hi aata hai (staff/school ki
// koi screen is build me khulti hi nahi).
function ParentShell() {
  const { school, user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans">
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b bg-white px-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-2xl">🎓</span>
          <div className="min-w-0 leading-tight">
            <div className="truncate font-bold text-slate-800">
              {school?.name || "Guardian Parent"}
            </div>
            <div className="text-[11px] text-slate-400">Guardian Parent</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-sm font-medium text-gray-700">
              {user?.name || user?.username}
            </div>
            <div className="text-xs capitalize text-gray-400">Parent</div>
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
      </div>

      <main className="mx-auto w-full min-w-0 max-w-3xl flex-1 overflow-x-clip p-2">
        <UpdateCheck />
        <Switch>
          <Route path="/report-cards" component={ReportCards} />
          <Route path="/" component={ParentHome} />
          <Route component={ParentHome} />
        </Switch>
      </main>

      <div className="pb-3 text-center text-[11px] text-slate-400">
        Version {APP_VERSION_NAME}
      </div>
    </div>
  );
}

// 🚫 Parent App me galti se koi staff/office account login kar jaye to
// ye vinamr screen — is build me unke liye kuch hai hi nahi; school
// (office) wala app alag hai, wahi istemal karne ko kaho.
function ParentOnlyScreen() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl space-y-4">
        <div className="text-4xl">👨‍👩‍👧</div>
        <h1 className="text-xl font-bold text-slate-800">
          Ye app sirf parents ke liye hai
        </h1>
        <p className="text-sm text-gray-600">
          Ye <b>Guardian Parent</b> app hai — isme parents sirf apne bacche
          ki jaankari dekhte hain. Aapka account
          {user?.role ? (
            <>
              {" "}
              (<b>{user.role.replace("_", " ")}</b>)
            </>
          ) : (
            ""
          )}{" "}
          school ke office app ke liye hai — kripya wahi wala{" "}
          <b>School Guardian Suite</b> app kholein.
        </p>
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

// 👑 Master App ki chaukhat (v2.2) — Master App build me Super Admin
// ke liye SIRF do cheezein: Demo School (test data) wala card aur
// Schools screen (saare schools, approve/block, har school ke
// accounts, School Code). Koi school-data screen (Students/Fees/...)
// is build me hai hi nahi — Master ka kaam control hai, roz ka
// daftar wala kaam School App ka hai.
function MasterShell() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans">
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b bg-white px-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-2xl">👑</span>
          <div className="min-w-0 leading-tight">
            <div className="truncate font-bold text-slate-800">
              Guardian Master
            </div>
            <div className="text-[11px] text-slate-400">
              Saare schools ka control
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-sm font-medium text-gray-700">
              {user?.name || user?.username}
            </div>
            <div className="text-xs capitalize text-gray-400">
              Super Admin
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
      </div>

      <main className="w-full min-w-0 flex-1 overflow-x-clip">
        <UpdateCheck />
        <div className="p-4 sm:p-6 pb-0 max-w-[1600px] mx-auto w-full min-w-0 space-y-6">
          <DemoSchoolCard />
          {/* 📲💾 v3.0: update publish + backup (apni testing ke liye) */}
          <AppUpdateCard />
          <BackupCard />
        </div>
        <Switch>
          <Route path="/" component={Schools} />
          <Route component={Schools} />
        </Switch>
      </main>

      <div className="pb-3 text-center text-[11px] text-slate-400">
        Version {APP_VERSION_NAME}
      </div>
    </div>
  );
}

// 🚫 Master App me Super Admin ke alawa koi login kar jaye to ye
// vinamr screen — is build me unke liye kuch hai hi nahi.
function MasterOnlyScreen() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl space-y-4">
        <div className="text-4xl">👑</div>
        <h1 className="text-xl font-bold text-slate-800">
          Ye app sirf Master (Super Admin) ke liye hai
        </h1>
        <p className="text-sm text-gray-600">
          Ye <b>Guardian Master</b> app hai — isse saare schools control
          hote hain. Aapka account
          {user?.role ? (
            <>
              {" "}
              (<b>{user.role.replace("_", " ")}</b>)
            </>
          ) : (
            ""
          )}{" "}
          iske liye nahi hai — kripya apna wala app kholein (school ke
          kaam ke liye <b>School Guardian Suite</b>, bacche ki jaankari
          ke liye <b>Guardian Parent</b>).
        </p>
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

// 🚫 School App build me Super Admin (v3.0) — Master App hai to
// School App me Super Admin ki jagah nahi (user ka design): SA
// login kare to ye vinamr screen — "Aap Master hain, Guardian
// Master App use karein" + Logout. Isi wajah se Router ka
// /schools route is build me SA tak pahunchta hi nahi (Gate hi
// rok deta hai). Server ke roles bilkul pehle jaise — Master App
// super_admin APIs hi istemal karta hai.
function SuperAdminGateScreen() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl space-y-4">
        <div className="text-4xl">👑</div>
        <h1 className="text-xl font-bold text-slate-800">
          Aap Master hain — kripya Guardian Master App use karein
        </h1>
        <p className="text-sm text-gray-600">
          Ye <b>School Guardian Suite</b> (School App) ek school ke
          roz ke kaam ke liye hai. Saare schools ka control — school
          banana, approve/block, accounts aur app updates — sirf{" "}
          <b>Guardian Master</b> app me hai, wahi aapka app hai.
        </p>
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
    // 👨‍👩‍👧 Parent App build me login bhi parent ki APNI screen hai
    // (v2.2 — School ID + Mobile + Password); baaki builds me aam
    // Login screen, pehle ki tarah.
    return PARENT_APP ? <ParentLogin /> : <Login />;
  }

  // 🔒 License band ho to Router ki jagah lock screen (v1.7).
  if (licenseExpired) {
    return <LicenseLockScreen />;
  }

  // 👨‍👩‍👧 Parent App build (v2.1): is build me SIRF parent ka hissa
  // hai — parent login ke baad ParentShell (Parent Home), aur koi
  // dusra role ghus aaye to ParentOnlyScreen. Aam build (flag off)
  // par is branch ka koi asar nahi — wahan hamesha Router hi chalta
  // hai, pehle ki tarah.
  if (PARENT_APP) {
    if (user.role !== "parent") {
      return <ParentOnlyScreen />;
    }
    return <ParentShell />;
  }

  // 👑 Master App build (v2.2): is build me SIRF Super Admin ka
  // control hissa hai — super_admin login ke baad MasterShell
  // (Schools + Demo School), koi dusra role ghus aaye to
  // MasterOnlyScreen. Aam build (flag off) par is branch ka koi
  // asar nahi — wahan hamesha Router hi chalta hai.
  if (MASTER_APP) {
    if (user.role !== "super_admin") {
      return <MasterOnlyScreen />;
    }
    return <MasterShell />;
  }

  // 👑 School App build (v3.0): Super Admin yahan nahi — uska
  // control panel Master App hai. SA ko gate screen milegi aur
  // Router (jisme /schools route hai) us tak pahunchega hi nahi.
  // Baaki roles bilkul pehle jaise.
  if (user.role === "super_admin") {
    return <SuperAdminGateScreen />;
  }

  return <Router />;
}

// 📱 Android back button ka bartav (v1.3, v3.1 me pakka):
//  Back dabane par is kram me faisla hota hai:
//  (i)   App ke andar koi overlay khula hai jo modal-stack me
//        register hai (PrintViewer — print page) → SABSE PEHLE wahi
//        band. (User ki shikayat thi: "table khol lia to ab close
//        nahi ho rahi" — print page Chrome ki window me khulta tha,
//        back use band hi nahi karta tha. Ab print app ke andar
//        khulta hai aur back use pakka band karta hai.)
//  (ii)  Stack khaali hai par koi Radix dialog khula dikh raha hai
//        ([data-state="open"]) → Escape key bhej kar band karo
//        (Radix Escape par khud band hota hai) — fallback rasta.
//  (iii) Andar ke kisi page par ho (history me peeche ja sakte ho)
//        → ek kadam peeche (window.history.back()).
//  (iv)  History bhi nahi aur home par bhi nahi (gehra link) →
//        home route par le jao (SPA ke andar hi, reload nahi).
//  (v)   Home par: pehla back → toast "App band karne ke liye ek
//        baar aur back dabao"; 2 second ke andar dusra back →
//        App.exitApp(). Galti se ek back par app band nahi hogi.
//  - Sirf native (Android) par lagta hai; web/Electron par listener
//    hi nahi lagta, isliye wahan ka bartav bilkul pehle jaisa.
function useAndroidBackButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let lastRootBackAt = 0;
    let handle: { remove: () => Promise<void> | void } | null = null;
    let cancelled = false;

    CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      // (i) Khula overlay (PrintViewer aadi) — sabse upar wala band.
      if (modalStackSize() > 0 && closeTopModal()) {
        return;
      }

      // (ii) Radix dialog fallback — Escape bhej kar band karo.
      try {
        const openDialog = document.querySelector(
          '[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"]',
        );
        if (openDialog) {
          document.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Escape",
              code: "Escape",
              bubbles: true,
            }),
          );
          return;
        }
      } catch {
        // DOM na mile to aage badho — back rukna nahi chahiye.
      }

      // (iii) History me ek kadam peeche.
      if (canGoBack) {
        window.history.back();
        return;
      }

      // (iv) Home par nahi ho aur history bhi nahi — home par jao
      // (wouter popstate sunta hai; poora reload nahi hota).
      if (window.location.pathname !== "/") {
        window.history.pushState(null, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
        return;
      }

      // (v) Home par double-back → exit (purana toast bartav).
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