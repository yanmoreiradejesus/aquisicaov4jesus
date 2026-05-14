import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPath?: string;
}

export const ProtectedRoute = ({ children, requiredPath }: ProtectedRouteProps) => {
  const { user, profile, loading, isApproved, isAdmin, hasPageAccess, authResolved } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (authResolved && !isApproved && !isAdmin && profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold text-foreground">Aguardando aprovação</h2>
          <p className="text-muted-foreground">
            Seu cadastro foi recebido. Um administrador precisa aprovar seu acesso.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-primary underline"
          >
            Verificar novamente
          </button>
        </div>
      </div>
    );
  }

  if (requiredPath && !hasPageAccess(requiredPath)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Você não tem acesso a esta página</p>
      </div>
    );
  }

  return <>{children}</>;
};
