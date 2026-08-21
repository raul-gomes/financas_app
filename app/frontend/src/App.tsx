// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Financial from "./pages/Financial";
import Investments from "./pages/Investments";
import Limits from "./pages/Limits";
import RecurrentBills from "./pages/RecurrentBills";
import Settings from "./pages/Settings";
import BankExtract from "./pages/BankExtract";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const guarded = (node: React.ReactNode) => (
  <ErrorBoundary>{node}</ErrorBoundary>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Layout rodando sempre */}
          <Route element={<AppLayout />}>
            <Route path="/" element={guarded(<Index />)} />
            <Route path="/financial" element={guarded(<Financial />)} />
            <Route path="/investments" element={guarded(<Investments />)} />
            <Route path="/limits" element={guarded(<Limits />)} />
            <Route path="/recorrentes" element={guarded(<RecurrentBills />)} />
            <Route path="/configuracoes" element={guarded(<Settings />)} />
            <Route path="/extrato-bancario" element={guarded(<BankExtract />)} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
