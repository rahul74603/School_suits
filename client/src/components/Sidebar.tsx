import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  UserPlus,
  Settings,
  FileText,
  School,
  LogOut,
  ClipboardCheck,
  Bell,
  BookOpen,
  Calendar,
  Award,
  Bus,
  FileCheck,
  FolderOpen,
  BarChart3,
  Upload,
  DatabaseBackup,
  Briefcase,
  IdCard,
  GraduationCap,
} from "lucide-react";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["admin", "principal", "accountant", "staff", "teacher", "student"] },
  { name: "Notice Board", href: "/notices", icon: Bell, roles: ["admin", "principal", "accountant", "staff", "teacher", "student"] },
  { name: "Students", href: "/students", icon: Users, roles: ["admin", "principal", "accountant", "staff", "teacher", "student"] },
  { name: "Admissions", href: "/admissions", icon: UserPlus, roles: ["admin", "principal", "accountant", "staff", "teacher"] },
  { name: "Attendance", href: "/attendance", icon: ClipboardCheck, roles: ["admin", "principal", "teacher", "student"] },
  { name: "Timetable", href: "/timetable", icon: Calendar, roles: ["admin", "principal", "teacher", "student"] },
  { name: "Homework & Diary", href: "/homework", icon: BookOpen, roles: ["admin", "principal", "teacher", "student"] },
  { name: "Exams", href: "/exams", icon: GraduationCap, roles: ["admin", "principal", "teacher", "student"] },
  { name: "Exam Results", href: "/exam-results", icon: FileCheck, roles: ["admin", "principal", "teacher", "student"] },
  { name: "Report Cards", href: "/report-cards", icon: Award, roles: ["admin", "principal", "teacher", "student"] },
  { name: "Student ID Cards", href: "/student-id-cards", icon: IdCard, roles: ["admin", "principal", "accountant", "teacher", "student"] },
  { name: "Certificates & TC", href: "/certificates", icon: FileText, roles: ["admin", "principal", "accountant", "staff", "student"] },
  { name: "Leave Requests", href: "/leaves", icon: Calendar, roles: ["admin", "principal", "accountant", "staff", "teacher", "student"] },
  { name: "Fees & Receipts", href: "/fees", icon: CreditCard, roles: ["admin", "principal", "accountant", "staff", "student"] },
  { name: "Transport", href: "/transport", icon: Bus, roles: ["admin", "principal", "accountant", "staff", "student"] },
  { name: "Staff Directory", href: "/staff", icon: School, roles: ["admin", "principal", "accountant"] },
  { name: "Staff Payroll", href: "/payroll", icon: Briefcase, roles: ["admin", "principal", "accountant", "staff", "teacher"] },
  { name: "Financial Dashboard", href: "/financial", icon: BarChart3, roles: ["admin", "principal", "accountant"] },
  { name: "Documents", href: "/documents", icon: FolderOpen, roles: ["admin", "principal", "accountant", "teacher", "staff"] },
  { name: "Reports", href: "/reports", icon: FileText, roles: ["admin", "principal", "accountant", "staff", "teacher", "student"] },
  { name: "Import / Export", href: "/import-export", icon: Upload, roles: ["admin", "principal", "accountant"] },
  { name: "Settings & Users", href: "/settings", icon: Settings, roles: ["admin", "principal", "accountant", "staff", "teacher", "student"] },
  { name: "Backup & Restore", href: "/backup-restore", icon: DatabaseBackup, roles: ["admin", "principal"] },
];

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { data: user } = useAuth();
  const logout = useLogout();
  const visibleNavigation = navigation.filter((item) => !user || item.roles.includes(user.role));

  async function handleLogout() {
    await logout.mutateAsync();
    setLocation("/login");
  }

  return (
    <div className="flex h-screen flex-col bg-slate-900 w-64 text-white no-print fixed left-0 top-0 z-30">
      <div className="flex h-16 items-center px-6 border-b border-slate-800">
        <School className="h-6 w-6 text-indigo-400 mr-2.5" />
        <div>
          <span className="text-lg font-bold tracking-tight block leading-none">SchoolSuite</span>
          <span className="text-[11px] text-slate-400">Complete School ERP</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <nav className="space-y-0.5 px-3">
          {visibleNavigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 cursor-pointer",
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white",
                  )}
                >
                  <item.icon
                    className={cn(
                      "mr-3 h-4 w-4 flex-shrink-0 transition-colors",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-white",
                    )}
                  />
                  <span className="truncate">{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name || "School User"}</p>
            <p className="text-xs text-indigo-300 capitalize truncate">
              {user?.role || "Authenticated"} {user?.username ? `(@${user.username})` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logout.isPending}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
