// src/App.tsx
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { RoleProvider, useRole } from "@/contexts/RoleContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import UpdatePassword from "./pages/UpdatePassword";

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

// Features gated behind admin role (UI-only gate; backend permanece acessível).
// Non-admin users are redirected away from these routes.
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, loading } = useRole();
  if (loading) return <PageSkeleton />;
  if (!isAdmin) return <Navigate to="/financial" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <RoleProvider>
          <BrowserRouter>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                {/* Rotas públicas (sem AuthGuard) */}
                <Route path="/login" element={<Login />} />
                <Route path="/cadastro" element={<SignUp />} />
                <Route path="/esqueci-senha" element={<ForgotPassword />} />
                <Route path="/redefinir-senha" element={<UpdatePassword />} />

                {/* Rotas autenticadas */}
                <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
                  <Route path="/" element={guarded(<Index />)} />
                  <Route path="/financial" element={guarded(<Financial />)} />
                  <Route path="/investments" element={guarded(<AdminRoute><Investments /></AdminRoute>)} />
                  <Route path="/limits" element={guarded(<Limits />)} />
                  <Route path="/recorrentes" element={guarded(<AdminRoute><RecurrentBills /></AdminRoute>)} />
                  <Route path="/configuracoes" element={guarded(<Settings />)} />
                  <Route path="/extrato-bancario" element={guarded(<AdminRoute><BankExtract /></AdminRoute>)} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </RoleProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;