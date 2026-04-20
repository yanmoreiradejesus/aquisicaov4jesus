import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserCheck, UserX, Shield, UserPlus, Send, Wand2, Settings2 } from "lucide-react";

interface UserWithAccess {
  id: string;
  email: string;
  full_name: string | null;
  approved: boolean;
  created_at: string;
  cargo: string | null;
  departamento: string | null;
  telefone: string | null;
  avatar_url: string | null;
  roles: string[];
  pages: string[];
}

interface RoleTemplate {
  cargo: string;
  pages: string[];
}

const AVAILABLE_PAGES = [
  { path: "/aquisicao/funil", label: "Data Analytics · Funil" },
  { path: "/aquisicao/dashboard", label: "Data Analytics · Dashboard" },
  { path: "/aquisicao/insights", label: "Data Analytics · Insights" },
  { path: "/aquisicao/meta", label: "Data Analytics · Meta" },
  { path: "/aquisicao/financeiro", label: "Data Analytics · Financeiro" },
  { path: "/comercial/leads", label: "Comercial · CRM Leads" },
  { path: "/comercial/oportunidades", label: "Comercial · CRM Oportunidades" },
  { path: "/comercial/accounts", label: "Comercial · Accounts" },
  { path: "/comercial/cobrancas", label: "Comercial · Cobranças" },
  { path: "/app-v4", label: "App V4 (app.v4jesus.com)" },
];

const CARGO_OPTIONS = [
  // Receitas
  "SDR", "Closer", "BDR", "Líder de Expansão",
  // PE&G
  "Coordenador de PE&G", "Account Manager", "Gestor de Tráfego", "Designer", "Copywriter", "Social Media", "Consultor", "Analista de Tech",
  // ADM
  "Coordenadora ADM", "HRBP", "Analista Financeira",
  // Outro
  "Outro"
];
const DEPARTAMENTO_OPTIONS = ["Receitas", "PE&G", "ADM", "Outro"];

const Admin = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePages, setInvitePages] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const { toast } = useToast();

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast({ title: "Erro", description: "Informe o email", variant: "destructive" });
      return;
    }
    setInviting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { email: inviteEmail.trim(), full_name: inviteName.trim(), pages: invitePages },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Convite enviado!", description: `Email enviado para ${inviteEmail}` });
      setInviteEmail("");
      setInviteName("");
      setInvitePages([]);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro ao convidar", description: err.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const toggleInvitePage = (path: string) => {
    setInvitePages((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const fetchAll = async () => {
    setLoading(true);
    const [profilesRes, rolesRes, accessRes, templatesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("user_page_access").select("*"),
      supabase.from("role_access_templates").select("*").order("cargo"),
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
      cargo: p.cargo,
      departamento: p.departamento,
      telefone: p.telefone,
      avatar_url: p.avatar_url,
      roles: roles.filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
      pages: access.filter((a: any) => a.user_id === p.id).map((a: any) => a.page_path),
    }));

    setUsers(mapped);
    setTemplates((templatesRes.data ?? []) as RoleTemplate[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin]);

  const toggleApproval = async (userId: string, approved: boolean) => {
    const { error } = await supabase.from("profiles").update({ approved }).eq("id", userId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: approved ? "Usuário aprovado" : "Acesso revogado" });
      fetchAll();
    }
  };

  const updateProfileField = async (userId: string, field: "cargo" | "departamento" | "telefone" | "full_name", value: string | null) => {
    const { error } = await supabase.from("profiles").update({ [field]: value }).eq("id", userId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      fetchAll();
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
    fetchAll();
  };

  const applyTemplate = async (userId: string, cargo: string | null) => {
    if (!cargo) {
      toast({ title: "Selecione um cargo primeiro", variant: "destructive" });
      return;
    }
    const tpl = templates.find((t) => t.cargo === cargo);
    if (!tpl) {
      toast({ title: "Sem template", description: `Não há template para o cargo "${cargo}"`, variant: "destructive" });
      return;
    }
    // Substitui acessos atuais
    const { error: delErr } = await supabase.from("user_page_access").delete().eq("user_id", userId);
    if (delErr) {
      toast({ title: "Erro", description: delErr.message, variant: "destructive" });
      return;
    }
    if (tpl.pages.length > 0) {
      const rows = tpl.pages.map((p) => ({ user_id: userId, page_path: p }));
      const { error: insErr } = await supabase.from("user_page_access").insert(rows);
      if (insErr) {
        toast({ title: "Erro", description: insErr.message, variant: "destructive" });
        return;
      }
    }
    toast({ title: "Template aplicado", description: `${tpl.pages.length} página(s) liberada(s) para ${cargo}` });
    fetchAll();
  };

  const updateTemplate = async (cargo: string, pages: string[]) => {
    const { error } = await supabase
      .from("role_access_templates")
      .upsert({ cargo, pages, updated_at: new Date().toISOString() });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      fetchAll();
    }
  };

  const toggleTemplatePage = (cargo: string, path: string) => {
    const tpl = templates.find((t) => t.cargo === cargo);
    const current = tpl?.pages ?? [];
    const next = current.includes(path) ? current.filter((p) => p !== path) : [...current, path];
    updateTemplate(cargo, next);
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
      <div className="container mx-auto px-4 lg:px-8 py-8 space-y-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6" /> Painel Administrativo
        </h1>

        {/* Templates de cargo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Templates de acesso por cargo
              </span>
              <Button size="sm" variant="outline" onClick={() => setShowTemplates((v) => !v)}>
                {showTemplates ? "Ocultar" : "Configurar"}
              </Button>
            </CardTitle>
          </CardHeader>
          {showTemplates && (
            <CardContent className="space-y-6">
              <p className="text-xs text-muted-foreground">
                Define quais páginas cada cargo recebe ao clicar em "Aplicar template" no card do usuário.
              </p>
              {CARGO_OPTIONS.filter((c) => c !== "Outro").map((cargo) => {
                const tpl = templates.find((t) => t.cargo === cargo);
                const pages = tpl?.pages ?? [];
                return (
                  <div key={cargo} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{cargo}</Badge>
                      <span className="text-xs text-muted-foreground">{pages.length} página(s)</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {AVAILABLE_PAGES.map((page) => (
                        <label key={page.path} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={pages.includes(page.path)}
                            onCheckedChange={() => toggleTemplatePage(cargo, page.path)}
                          />
                          {page.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>

        {/* Invite User */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Convidar Novo Usuário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email *</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-name">Nome</Label>
                <Input
                  id="invite-name"
                  placeholder="Nome completo"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label>Telas com acesso</Label>
              <div className="flex flex-wrap gap-4">
                {AVAILABLE_PAGES.map((page) => (
                  <label key={page.path} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <Checkbox
                      checked={invitePages.includes(page.path)}
                      onCheckedChange={() => toggleInvitePage(page.path)}
                    />
                    {page.label}
                  </label>
                ))}
              </div>
            </div>
            <Button
              className="mt-4"
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              {inviting ? "Enviando..." : "Enviar Convite"}
            </Button>
          </CardContent>
        </Card>

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
                {approvedUsers.map((user) => {
                  const initials = (user.full_name || user.email)
                    .split(" ")
                    .map((p) => p[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <div key={user.id} className="p-4 rounded-lg border border-border space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name ?? ""} />}
                            <AvatarFallback className="bg-primary/15 text-primary text-sm">{initials || "?"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground flex items-center gap-2">
                              {user.full_name || "Sem nome"}
                              {user.roles.includes("admin") && <Badge variant="secondary">Admin</Badge>}
                              {user.cargo && <Badge variant="outline">{user.cargo}</Badge>}
                              {user.departamento && <Badge variant="outline">{user.departamento}</Badge>}
                            </p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            {user.telefone && <p className="text-xs text-muted-foreground">{user.telefone}</p>}
                          </div>
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
                        <>
                          {/* Edição rápida de perfil */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Cargo</Label>
                              <div className="flex gap-2">
                                <Select
                                  value={user.cargo ?? ""}
                                  onValueChange={(v) => updateProfileField(user.id, "cargo", v || null)}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Selecionar" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CARGO_OPTIONS.map((c) => (
                                      <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => applyTemplate(user.id, user.cargo)}
                                  title="Aplicar template do cargo"
                                  disabled={!user.cargo}
                                >
                                  <Wand2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Departamento</Label>
                              <Select
                                value={user.departamento ?? ""}
                                onValueChange={(v) => updateProfileField(user.id, "departamento", v || null)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Selecionar" />
                                </SelectTrigger>
                                <SelectContent>
                                  {DEPARTAMENTO_OPTIONS.map((d) => (
                                    <SelectItem key={d} value={d}>{d}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Telefone</Label>
                              <Input
                                className="h-9"
                                defaultValue={user.telefone ?? ""}
                                placeholder="(11) 99999-9999"
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v !== (user.telefone ?? "")) {
                                    updateProfileField(user.id, "telefone", v || null);
                                  }
                                }}
                              />
                            </div>
                          </div>

                          {/* Acessos */}
                          <div className="flex flex-wrap gap-4 pt-2 border-t border-border">
                            <span className="text-sm text-muted-foreground w-full">Telas:</span>
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
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
