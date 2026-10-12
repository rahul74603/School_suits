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
import Attendance from "@/pages/Attendance";
import Exams from "@/pages/Exams";
import ExamResults from "@/pages/ExamResults";
import ReportCards from "@/pages/ReportCards";
import StudentIdCards from "@/pages/StudentIdCards";
import Payroll from "@/pages/Payroll";
import Financial from "@/pages/Financial";
import Settings from "@/pages/Settings";
import Reports from "@/pages/Reports";
import ImportExport from "@/pages/ImportExport";
import Documents from "@/pages/Documents";
import BackupRestore from "@/pages/BackupRestore";
import Notices from "@/pages/Notices";
import Homework from "@/pages/Homework";
import Timetable from "@/pages/Timetable";
import Leaves from "@/pages/Leaves";
import Certificates from "@/pages/Certificates";
import Transport from "@/pages/Transport";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/notices" component={Notices} />
      <Route path="/students" component={Students} />
      <Route path="/students/:id/edit" component={StudentEdit} />
      <Route path="/students/:id" component={StudentProfile} />
      <Route path="/attendance" component={Attendance} />
      <Route path="/timetable" component={Timetable} />
      <Route path="/homework" component={Homework} />
      <Route path="/exams" component={Exams} />
      <Route path="/exam-results" component={ExamResults} />
      <Route path="/report-cards" component={ReportCards} />
      <Route path="/student-id-cards" component={StudentIdCards} />
      <Route path="/certificates" component={Certificates} />
      <Route path="/leaves" component={Leaves} />
      <Route path="/payroll" component={Payroll} />
      <Route path="/financial" component={Financial} />
      <Route path="/fees" component={Fees} />
      <Route path="/transport" component={Transport} />
      <Route path="/staff" component={Staff} />
      <Route path="/admissions" component={Admissions} />
      <Route path="/reports" component={Reports} />
      <Route path="/import-export" component={ImportExport} />
      <Route path="/documents" component={Documents} />
      <Route path="/settings" component={Settings} />
      <Route path="/backup-restore" component={BackupRestore} />
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
  if (auth.isError)
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-red-700">
        Unable to verify your session. Refresh and try again.
      </div>
    );
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
