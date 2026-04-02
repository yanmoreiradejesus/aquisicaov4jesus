import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Insights from "./pages/Insights";
import Metas from "./pages/Metas";
import Admin from "./pages/Admin";
import Financeiro from "./pages/Financeiro";
import DashboardComercial from "./pages/DashboardComercial";
import MixCompra from "./pages/MixCompra";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const AppRoutes = () => {
  const location = useLocation();
  
  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
      <Route path="/dashboard-comercial" element={
        <ProtectedRoute requiredPath="/dashboard-comercial">
          <PageTransition><DashboardComercial /></PageTransition>
        </ProtectedRoute>
      } />
      <Route path="/" element={
        <ProtectedRoute requiredPath="/">
          <PageTransition><Index /></PageTransition>
        </ProtectedRoute>
      } />
      <Route path="/insights" element={
        <ProtectedRoute requiredPath="/insights">
          <PageTransition><Insights /></PageTransition>
        </ProtectedRoute>
      } />
      <Route path="/metas" element={
        <ProtectedRoute requiredPath="/metas">
          <PageTransition><Metas /></PageTransition>
        </ProtectedRoute>
      } />
      <Route path="/financeiro" element={
        <ProtectedRoute requiredPath="/financeiro">
          <PageTransition><Financeiro /></PageTransition>
        </ProtectedRoute>
      } />
      <Route path="/mix-compra" element={
        <ProtectedRoute requiredPath="/mix-compra">
          <PageTransition><MixCompra /></PageTransition>
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute requiredPath="/admin">
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
