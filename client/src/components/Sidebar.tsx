import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  UserPlus, 
  Settings, 
  FileText,
  School,
  LogOut
} from "lucide-react";
import { useLogout } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Students", href: "/students", icon: Users },
  { name: "Admissions", href: "/admissions", icon: UserPlus },
  { name: "Fees & Payments", href: "/fees", icon: CreditCard },
  { name: "Staff", href: "/staff", icon: School },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const logout = useLogout();

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
          {navigation.map((item) => {
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
