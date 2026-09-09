import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import { useAuth } from "@/hooks/use-auth";

import Dashboard from "@/pages/Dashboard";
import Students from "@/pages/Students";
import Fees from "@/pages/Fees";
import Staff from "@/pages/Staff";
import Admissions from "@/pages/Admissions";
import StudentProfile from "@/pages/StudentProfile";
import StudentEdit from "@/pages/StudentEdit";
import { ModulePlaceholder } from "@/pages/ModulePlaceholder";
import Attendance from "@/pages/Attendance";
import Exams from "@/pages/Exams";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/students" component={Students} />
      <Route path="/students/:id/edit" component={StudentEdit} />
      <Route path="/students/:id" component={StudentProfile} />
      <Route path="/attendance" component={Attendance} />
      <Route path="/exams" component={Exams} />
      <Route path="/fees" component={Fees} />
      <Route path="/staff" component={Staff} />
      <Route path="/admissions" component={Admissions} />
      <Route path="/reports"><ModulePlaceholder title="Reports" description="Reporting is not available yet. No fabricated financial or operational data is shown." /></Route>
      <Route path="/settings"><ModulePlaceholder title="Settings" description="Settings are limited to authenticated session and school data in this phase." /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApplication() {
  const [location, setLocation] = useLocation();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.data && location !== "/login") {
      setLocation("/login");
    }
  }, [auth.data, auth.isLoading, location, setLocation]);

  if (location === "/login") return <Login />;
  if (auth.isError) return <div className="min-h-screen flex items-center justify-center p-6 text-red-700">Unable to verify your session. Refresh and try again.</div>;
  if (auth.isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Checking session...</div>;
  }
  if (!auth.data) return null;
  return <Router />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthenticatedApplication />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
