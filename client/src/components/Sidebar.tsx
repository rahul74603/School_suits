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
  ClipboardCheck
} from "lucide-react";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["admin", "principal", "accountant", "staff", "teacher", "student"] },
  { name: "Students", href: "/students", icon: Users, roles: ["admin", "principal", "staff", "teacher", "student"] },
  { name: "Attendance", href: "/attendance", icon: ClipboardCheck, roles: ["admin", "principal", "teacher", "student"] },
  { name: "Admissions", href: "/admissions", icon: UserPlus, roles: ["admin", "principal", "staff", "teacher"] },
  { name: "Fees & Payments", href: "/fees", icon: CreditCard, roles: ["admin", "principal", "accountant", "staff"] },
  { name: "Staff", href: "/staff", icon: School, roles: ["admin", "principal"] },
  { name: "Reports", href: "/reports", icon: FileText, roles: ["admin", "principal", "accountant", "staff", "teacher"] },
  { name: "Settings", href: "/settings", icon: Settings, roles: ["admin", "principal"] },
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
    <div className="flex h-screen flex-col bg-slate-900 w-64 text-white no-print fixed left-0 top-0">
      <div className="flex h-16 items-center px-6 border-b border-slate-800">
        <School className="h-6 w-6 text-primary-foreground mr-2" />
        <span className="text-xl font-bold tracking-tight">SchoolMate</span>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {visibleNavigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <div 
                  className={cn(
                    "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer",
                    isActive 
                      ? "bg-primary text-white shadow-lg shadow-primary/20" 
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <item.icon 
                    className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                    )} 
                  />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div className="ml-3">
            <p className="text-sm font-medium text-white">School User</p>
            <p className="text-xs text-slate-400">Authenticated account</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logout.isPending}
            className="p-2 text-slate-400 hover:text-white disabled:opacity-50"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
