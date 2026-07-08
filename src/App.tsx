import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import V4Header from "@/components/V4Header";
import Hub from "./pages/Hub";
import Index from "./pages/Index";
import Insights from "./pages/Insights";
import Admin from "./pages/Admin";
import AdminClientes from "./pages/AdminClientes";
import AdminClienteNovo from "./pages/AdminClienteNovo";
import AdminConsumoIA from "./pages/AdminConsumoIA";
import Perfil from "./pages/Perfil";
import Financeiro from "./pages/Financeiro";
import DashboardComercial from "./pages/DashboardComercial";
import MixCompra from "./pages/MixCompra";
import MetaCrm from "./pages/MetaCrm";
import AtividadesCrm from "./pages/AtividadesCrm";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import CrmLeads from "./pages/CrmLeads";
import Oportunidades from "./pages/Oportunidades";
import Onboarding from "./pages/Onboarding";
import LeadDetailPage from "./pages/LeadDetailPage";
import OportunidadeDetailPage from "./pages/OportunidadeDetailPage";
import OnboardingDetailPage from "./pages/OnboardingDetailPage";
import Projetos from "./pages/Projetos";
import ProjetoDetail from "./pages/ProjetoDetail";
import ComercialPlaceholder from "./pages/ComercialPlaceholder";
import AccountsList from "./pages/AccountsList";
import AccountDetail from "./pages/AccountDetail";
import FunilAnalytics from "./pages/FunilAnalytics";
import GoogleCallback from "./pages/GoogleCallback";
import { useAppVersion } from "@/hooks/useAppVersion";
import { AuthProvider } from "@/contexts/AuthContext";

// Routes that should NOT render the persistent V4Header
const HEADERLESS_PATHS = ["/login", "/auth/google-callback"];

const AppRoutes = () => {
  const location = useLocation();
  const showHeader = !HEADERLESS_PATHS.some((p) => location.pathname.startsWith(p));
  useAppVersion();

  return (
    <>
      {/* Persistent header — mounted ONCE outside <Routes> so it never re-mounts on navigation.
          This keeps the bar animation playing only on first load, and the logo stays in place. */}
      {showHeader && <V4Header />}

      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
        <Route path="/auth/google-callback" element={<GoogleCallback />} />

        {/* Hub (home) — full hero on landing */}
        <Route path="/" element={
          <ProtectedRoute>
            <PageTransition><Hub variant="full" /></PageTransition>
          </ProtectedRoute>
        } />
        {/* Compact apps menu — accessed via header logo */}
        <Route path="/apps" element={
          <ProtectedRoute>
            <PageTransition><Hub variant="compact" /></PageTransition>
          </ProtectedRoute>
        } />

        {/* Aquisição app */}
        <Route path="/aquisicao" element={<Navigate to="/aquisicao/funil" replace />} />
        <Route path="/aquisicao/funil" element={
          <ProtectedRoute requiredPath="/aquisicao/funil">
            <PageTransition><FunilAnalytics /></PageTransition>
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
        <Route path="/aquisicao/financeiro" element={
          <ProtectedRoute requiredPath="/aquisicao/financeiro">
            <PageTransition><Financeiro /></PageTransition>
          </ProtectedRoute>
        } />

        <Route path="/aquisicao/meta" element={
          <ProtectedRoute requiredPath="/aquisicao/meta">
            <PageTransition><MetaCrm /></PageTransition>
          </ProtectedRoute>
        } />

        <Route path="/aquisicao/atividades" element={
          <ProtectedRoute requiredPath="/aquisicao/atividades">
            <PageTransition><AtividadesCrm /></PageTransition>
          </ProtectedRoute>
        } />

        {/* Legado (Sheets) — submenu Data Analytics */}
        <Route path="/aquisicao/legado/funil" element={
          <ProtectedRoute requiredPath="/aquisicao/legado/funil">
            <PageTransition><Index /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/aquisicao/legado/meta" element={
          <ProtectedRoute requiredPath="/aquisicao/legado/meta">
            <PageTransition><MixCompra /></PageTransition>
          </ProtectedRoute>
        } />

        {/* Legacy redirects — keep saved links working */}
        <Route path="/dashboard-comercial" element={<Navigate to="/aquisicao/dashboard" replace />} />
        <Route path="/insights" element={<Navigate to="/aquisicao/insights" replace />} />
        <Route path="/mix-compra" element={<Navigate to="/aquisicao/legado/meta" replace />} />
        <Route path="/metas" element={<Navigate to="/aquisicao/legado/meta" replace />} />
        <Route path="/financeiro" element={<Navigate to="/aquisicao/financeiro" replace />} />

        {/* Comercial app */}
        <Route path="/comercial" element={<Navigate to="/comercial/leads" replace />} />
        {/* Funil CRM promovido para Data Analytics — mantém redirect */}
        <Route path="/comercial/funil-crm" element={<Navigate to="/aquisicao/funil" replace />} />
        <Route path="/comercial/leads" element={
          <ProtectedRoute requiredPath="/comercial/leads">
            <PageTransition><CrmLeads /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/comercial/leads/:leadId" element={
          <ProtectedRoute requiredPath="/comercial/leads">
            <PageTransition><LeadDetailPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/comercial/oportunidades" element={
          <ProtectedRoute requiredPath="/comercial/oportunidades">
            <PageTransition><Oportunidades /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/comercial/oportunidades/:oportunidadeId" element={
          <ProtectedRoute requiredPath="/comercial/oportunidades">
            <PageTransition><OportunidadeDetailPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/comercial/onboarding" element={
          <ProtectedRoute requiredPath="/comercial/onboarding">
            <PageTransition><Onboarding /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/comercial/onboarding/:accountId" element={
          <ProtectedRoute requiredPath="/comercial/onboarding">
            <PageTransition><OnboardingDetailPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/comercial/projetos" element={
          <ProtectedRoute requiredPath="/comercial/projetos">
            <PageTransition><Projetos /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/comercial/projetos/:projetoId" element={
          <ProtectedRoute requiredPath="/comercial/projetos">
            <PageTransition><ProjetoDetail /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/comercial/accounts" element={
          <ProtectedRoute requiredPath="/comercial/accounts">
            <PageTransition><AccountsList /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/comercial/accounts/:accountId" element={
          <ProtectedRoute requiredPath="/comercial/accounts">
            <PageTransition><AccountDetail /></PageTransition>
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
        <Route path="/admin/clientes" element={
          <ProtectedRoute>
            <PageTransition><AdminClientes /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/admin/clientes/novo" element={
          <ProtectedRoute>
            <PageTransition><AdminClienteNovo /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/admin/consumo-ia" element={
          <ProtectedRoute>
            <PageTransition><AdminConsumoIA /></PageTransition>
          </ProtectedRoute>
        } />

        {/* Perfil (auto-edição) */}
        <Route path="/perfil" element={
          <ProtectedRoute>
            <PageTransition><Perfil /></PageTransition>
          </ProtectedRoute>
        } />

        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </>
  );
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
