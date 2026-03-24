import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import V4Header from "@/components/V4Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserCheck, UserX, Shield, UserPlus, Send } from "lucide-react";

interface UserWithAccess {
  id: string;
  email: string;
  full_name: string | null;
  approved: boolean;
  created_at: string;
  roles: string[];
  pages: string[];
}

const AVAILABLE_PAGES = [
  { path: "/", label: "Dashboard" },
  { path: "/insights", label: "Insights" },
  { path: "/metas", label: "Metas" },
  { path: "/financeiro", label: "Financeiro" },
];

const Admin = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    const [profilesRes, rolesRes, accessRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("user_page_access").select("*"),
    ]);

    const profiles = profilesRes.data ?? [];
    const roles = rolesRes.data ?? [];
    const access = accessRes.data ?? [];

    const mapped: UserWithAccess[] = profiles.map((p: any) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      approved: p.approved,
      created_at: p.created_at,
      roles: roles.filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
      pages: access.filter((a: any) => a.user_id === p.id).map((a: any) => a.page_path),
    }));

    setUsers(mapped);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  const toggleApproval = async (userId: string, approved: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ approved })
      .eq("id", userId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: approved ? "Usuário aprovado" : "Acesso revogado" });
      fetchUsers();
    }
  };

  const togglePageAccess = async (userId: string, pagePath: string, hasAccess: boolean) => {
    if (hasAccess) {
      const { error } = await supabase
        .from("user_page_access")
        .delete()
        .eq("user_id", userId)
        .eq("page_path", pagePath);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase
        .from("user_page_access")
        .insert({ user_id: userId, page_path: pagePath });
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
    fetchUsers();
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Acesso negado</p>
      </div>
    );
  }

  const pendingUsers = users.filter((u) => !u.approved && !u.roles.includes("admin"));
  const approvedUsers = users.filter((u) => u.approved || u.roles.includes("admin"));

  return (
    <div className="min-h-screen bg-background">
      <V4Header />
      <div className="container mx-auto px-4 lg:px-8 py-8 space-y-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6" /> Painel Administrativo
        </h1>

        {/* Pending Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-orange-500" />
              Usuários Pendentes ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : pendingUsers.length === 0 ? (
              <p className="text-muted-foreground">Nenhum usuário pendente</p>
            ) : (
              <div className="space-y-4">
                {pendingUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div>
                      <p className="font-medium text-foreground">{user.full_name || "Sem nome"}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Cadastro: {new Date(user.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-[#e50914] hover:bg-[#b8070f] text-white"
                      onClick={() => toggleApproval(user.id, true)}
                    >
                      Aprovar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approved Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-500" />
              Usuários Aprovados ({approvedUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : (
              <div className="space-y-6">
                {approvedUsers.map((user) => (
                  <div key={user.id} className="p-4 rounded-lg border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground flex items-center gap-2">
                          {user.full_name || "Sem nome"}
                          {user.roles.includes("admin") && (
                            <Badge variant="secondary">Admin</Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      {!user.roles.includes("admin") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => toggleApproval(user.id, false)}
                        >
                          Revogar
                        </Button>
                      )}
                    </div>
                    {!user.roles.includes("admin") && (
                      <div className="flex flex-wrap gap-4">
                        <span className="text-sm text-muted-foreground">Telas:</span>
                        {AVAILABLE_PAGES.map((page) => {
                          const hasAccess = user.pages.includes(page.path);
                          return (
                            <label key={page.path} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                              <Checkbox
                                checked={hasAccess}
                                onCheckedChange={() => togglePageAccess(user.id, page.path, hasAccess)}
                              />
                              {page.label}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
