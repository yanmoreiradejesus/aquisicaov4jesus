import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Hub from "./pages/Hub";
import Index from "./pages/Index";
import Insights from "./pages/Insights";
import Admin from "./pages/Admin";
import Financeiro from "./pages/Financeiro";
import DashboardComercial from "./pages/DashboardComercial";
import MixCompra from "./pages/MixCompra";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import CrmLeads from "./pages/CrmLeads";
import ComercialPlaceholder from "./pages/ComercialPlaceholder";
import GoogleCallback from "./pages/GoogleCallback";

const AppRoutes = () => {
  const location = useLocation();

  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
      <Route path="/auth/google-callback" element={<GoogleCallback />} />

      {/* Hub (home) */}
      <Route path="/" element={
        <ProtectedRoute>
          <PageTransition><Hub /></PageTransition>
        </ProtectedRoute>
      } />

      {/* Aquisição app */}
      <Route path="/aquisicao" element={<Navigate to="/aquisicao/funil" replace />} />
      <Route path="/aquisicao/funil" element={
        <ProtectedRoute requiredPath="/aquisicao/funil">
          <PageTransition><Index /></PageTransition>
        </ProtectedRoute>
      } />
      <Route path="/aquisicao/dashboard" element={
        <ProtectedRoute requiredPath="/aquisicao/dashboard">
          <PageTransition><DashboardComercial /></PageTransition>
        </ProtectedRoute>
      } />
      <Route path="/aquisicao/insights" element={
        <ProtectedRoute requiredPath="/aquisicao/insights">
          <PageTransition><Insights /></PageTransition>
        </ProtectedRoute>
      } />
      <Route path="/aquisicao/meta" element={
        <ProtectedRoute requiredPath="/aquisicao/meta">
          <PageTransition><MixCompra /></PageTransition>
        </ProtectedRoute>
      } />
      <Route path="/aquisicao/financeiro" element={
        <ProtectedRoute requiredPath="/aquisicao/financeiro">
          <PageTransition><Financeiro /></PageTransition>
        </ProtectedRoute>
      } />

      {/* Legacy redirects — keep saved links working */}
      <Route path="/dashboard-comercial" element={<Navigate to="/aquisicao/dashboard" replace />} />
      <Route path="/insights" element={<Navigate to="/aquisicao/insights" replace />} />
      <Route path="/mix-compra" element={<Navigate to="/aquisicao/meta" replace />} />
      <Route path="/metas" element={<Navigate to="/aquisicao/meta" replace />} />
      <Route path="/financeiro" element={<Navigate to="/aquisicao/financeiro" replace />} />

      {/* Comercial app */}
      <Route path="/comercial" element={<Navigate to="/comercial/leads" replace />} />
      <Route path="/comercial/leads" element={
        <ProtectedRoute requiredPath="/comercial/leads">
          <PageTransition><CrmLeads /></PageTransition>
        </ProtectedRoute>
      } />
      <Route path="/comercial/oportunidades" element={
        <ProtectedRoute requiredPath="/comercial/oportunidades">
          <PageTransition><ComercialPlaceholder titulo="CRM Oportunidades" descricao="Pipeline de oportunidades (proposta, negociação, fechado, follow-up, perdido). Em breve." /></PageTransition>
        </ProtectedRoute>
      } />
      <Route path="/comercial/accounts" element={
        <ProtectedRoute requiredPath="/comercial/accounts">
          <PageTransition><ComercialPlaceholder titulo="Account Managing" descricao="Gestão de contas ativas, health score e renovações. Em breve." /></PageTransition>
        </ProtectedRoute>
      } />
      <Route path="/comercial/cobrancas" element={
        <ProtectedRoute requiredPath="/comercial/cobrancas">
          <PageTransition><ComercialPlaceholder titulo="Cobranças" descricao="Conciliação de parcelas geradas automaticamente a partir de contratos fechados. Em breve." /></PageTransition>
        </ProtectedRoute>
      } />

      {/* Admin */}
      <Route path="/admin" element={
        <ProtectedRoute>
          <PageTransition><Admin /></PageTransition>
        </ProtectedRoute>
      } />

      <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
    </Routes>
  );
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
