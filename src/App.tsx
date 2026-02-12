import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AgentDirectory from "./pages/AgentDirectory";
import ImportAgents from "./pages/ImportAgents";
import Reports from "./pages/Reports";
import Payments from "./pages/Payments";
import Broadcasts from "./pages/Broadcasts";
 import NotFound from "./pages/NotFound";
 import Search from "./pages/Search";
 import WhatsApp from "./pages/WhatsApp";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/agents" element={<AgentDirectory />} />
              <Route path="/import" element={<ImportAgents />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/payments" element={<Payments />} />
               <Route path="/broadcasts" element={<Broadcasts />} />
               <Route path="/whatsapp" element={<WhatsApp />} />
               <Route path="/search" element={<Search />} />
            </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
