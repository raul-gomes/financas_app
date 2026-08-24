// src/App.tsx
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageSkeleton } from "@/components/layout/PageSkeleton";

// Code-splitting por rota: cada página vira um chunk separado no build
const Index = lazy(() => import("./pages/Index"));
const Financial = lazy(() => import("./pages/Financial"));
const Investments = lazy(() => import("./pages/Investments"));
const Limits = lazy(() => import("./pages/Limits"));
const RecurrentBills = lazy(() => import("./pages/RecurrentBills"));
const Settings = lazy(() => import("./pages/Settings"));
const BankExtract = lazy(() => import("./pages/BankExtract"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min — evita refetch a cada mount
      gcTime: 1000 * 60 * 30, // 30 min — cache em memória após desmontar
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const guarded = (node: React.ReactNode) => (
  <ErrorBoundary>{node}</ErrorBoundary>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageSkeleton />}>
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
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
