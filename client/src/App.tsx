import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

// Page Imports
import Dashboard from "@/pages/Dashboard";
import Students from "@/pages/Students";
import Fees from "@/pages/Fees";
import Staff from "@/pages/Staff";
import Admissions from "@/pages/Admissions";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/students" component={Students} />
      <Route path="/fees" component={Fees} />
      <Route path="/staff" component={Staff} />
      <Route path="/admissions" component={Admissions} />
      
      {/* Placeholders for routes not fully implemented in prompt but in Nav */}
      <Route path="/reports" component={Dashboard} /> 
      <Route path="/settings" component={Dashboard} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
