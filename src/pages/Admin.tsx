import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantConfig } from "@/hooks/useTenantConfig";
import { useTenantEnabledPages } from "@/hooks/useTenantEnabledPages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  UserPlus,
  Send,
  Wand2,
  Pencil,
  Search,
  Clock,
  Building2,
  ArrowRight,
  Check,
  X,
  Trash2,
  Cpu,
} from "lucide-react";
import { AdminVoipAccountsCard } from "@/components/admin/AdminVoipAccountsCard";
import { AdminFixLeadsCard } from "@/components/admin/AdminFixLeadsCard";
import { AdminBackfill3CPlusCard } from "@/components/admin/AdminBackfill3CPlusCard";
import { AdminVersionsPanel } from "@/components/admin/AdminVersionsPanel";
import { DeleteUserDialog } from "@/components/admin/DeleteUserDialog";
import {
  CARGOS_BY_AREA,
  CARGO_OPTIONS,
  DEPARTAMENTO_OPTIONS,
  AVAILABLE_PAGES,
  PAGE_GROUPS,
} from "@/lib/cargos";

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

const getInitials = (name: string | null, email: string) =>
  (name || email)
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const Admin = () => {
  const { user: currentUser, isAdmin, isSuperAdminV4 } = useAuth();
  const { config } = useTenantConfig();
  const { pages: enabledPagesSet } = useTenantEnabledPages();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Páginas disponíveis para este tenant — usado em todos os checkboxes de acesso
  const tenantPages = useMemo(() => {
    if (!enabledPagesSet || enabledPagesSet.size === 0) return AVAILABLE_PAGES;
    return AVAILABLE_PAGES.filter((p) => enabledPagesSet.has(p.path));
  }, [enabledPagesSet]);
  const tenantPageGroups = useMemo(
    () => PAGE_GROUPS.filter((g) => tenantPages.some((p) => p.group === g)),
    [tenantPages],
  );

  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCargo, setFilterCargo] = useState<string>("__all__");
  const [filterDepto, setFilterDepto] = useState<string>("__all__");
  const [filterStatus, setFilterStatus] = useState<string>("__all__");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);

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

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast({ title: "Erro", description: "Informe o email", variant: "destructive" });
      return;
    }
    setInviting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { email: inviteEmail.trim(), full_name: inviteName.trim(), pages: [] },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Convite enviado!", description: `Email enviado para ${inviteEmail}` });
      setInviteEmail("");
      setInviteName("");
      setInviteOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro ao convidar", description: err.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const updateTemplate = async (cargo: string, pages: string[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("tenant_id, active_tenant_id").eq("id", user.id).maybeSingle();
    const tenant_id = profile?.active_tenant_id ?? profile?.tenant_id;
    if (!tenant_id) {
      toast({ title: "Erro", description: "Tenant não identificado", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("role_access_templates")
      .upsert({ cargo, pages, tenant_id, updated_at: new Date().toISOString() }, { onConflict: "tenant_id,cargo" });
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

  // Aprovar inline
  const handleApproveInline = async (id: string) => {
    const { error } = await supabase.from("profiles").update({ approved: true }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Usuário aprovado" });
    fetchAll();
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (search) {
        const q = search.toLowerCase();
        if (!(u.full_name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))) {
          return false;
        }
      }
      if (filterCargo !== "__all__" && u.cargo !== filterCargo) return false;
      if (filterDepto !== "__all__" && u.departamento !== filterDepto) return false;
      if (filterStatus === "pending" && (u.approved || u.roles.includes("admin"))) return false;
      if (filterStatus === "approved" && !u.approved) return false;
      if (filterStatus === "admin" && !u.roles.includes("admin")) return false;
      return true;
    });
  }, [users, search, filterCargo, filterDepto, filterStatus]);

  const editingUser = users.find((u) => u.id === editingUserId) ?? null;
  const deletingUser = users.find((u) => u.id === deletingUserId) ?? null;
  const pendingCount = users.filter((u) => !u.approved && !u.roles.includes("admin")).length;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Acesso negado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6" /> Painel Administrativo
          </h1>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Convidar usuário
          </Button>
        </div>

        {isSuperAdminV4 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors group"
              onClick={() => navigate("/admin/clientes")}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Clientes V4</p>
                    <p className="text-sm text-muted-foreground">Gerenciar tenants e provisionar novos clientes</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors group"
              onClick={() => navigate("/admin/consumo-ia")}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Cpu className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Consumo de IA</p>
                    <p className="text-sm text-muted-foreground">Tokens e custo por subconta, função e usuário</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">
              Usuários
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="templates">Templates de cargo</TabsTrigger>
            <TabsTrigger value="voip">Contas VoIP</TabsTrigger>
            <TabsTrigger value="fix-leads">Corrigir Leads</TabsTrigger>
            <TabsTrigger value="versions">Versões</TabsTrigger>
          </TabsList>

          {/* ========== TAB USUÁRIOS ========== */}
          <TabsContent value="users" className="space-y-4 mt-4">
            <Card>
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar por nome ou email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={filterCargo} onValueChange={setFilterCargo}>
                  <SelectTrigger><SelectValue placeholder="Cargo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os cargos</SelectItem>
                    {CARGO_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterDepto} onValueChange={setFilterDepto}>
                  <SelectTrigger><SelectValue placeholder="Departamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos departamentos</SelectItem>
                    {DEPARTAMENTO_OPTIONS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="md:col-span-4 flex gap-2 flex-wrap">
                  {[
                    { v: "__all__", label: "Todos" },
                    { v: "pending", label: `Pendentes (${pendingCount})` },
                    { v: "approved", label: "Aprovados" },
                    { v: "admin", label: "Admins" },
                  ].map((s) => (
                    <Button
                      key={s.v}
                      size="sm"
                      variant={filterStatus === s.v ? "default" : "outline"}
                      onClick={() => setFilterStatus(s.v)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <p className="text-muted-foreground p-6">Carregando...</p>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-muted-foreground p-6">Nenhum usuário encontrado</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead className="hidden md:table-cell">Cargo</TableHead>
                        <TableHead className="hidden md:table-cell">Departamento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => {
                        const initials = getInitials(user.full_name, user.email);
                        const isUserAdmin = user.roles.includes("admin");
                        const isSelf = currentUser?.id === user.id;
                        const isPending = !user.approved && !isUserAdmin;
                        return (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name ?? ""} />}
                                  <AvatarFallback className="bg-primary/15 text-primary text-xs">{initials || "?"}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="font-medium text-foreground truncate">{user.full_name || "Sem nome"}</p>
                                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {user.cargo ? <Badge variant="outline">{user.cargo}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {user.departamento ? <Badge variant="secondary">{user.departamento}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              {isUserAdmin ? (
                                <Badge className="bg-primary/20 text-primary border-primary/30">Admin</Badge>
                              ) : user.approved ? (
                                <Badge variant="outline" className="border-green-500/50 text-green-500">Ativo</Badge>
                              ) : (
                                <Badge variant="outline" className="border-orange-500/50 text-orange-500">
                                  <Clock className="h-3 w-3 mr-1" /> Pendente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex items-center gap-1">
                                {isPending && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                                      onClick={() => handleApproveInline(user.id)}
                                      title="Aprovar"
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                      onClick={() => setDeletingUserId(user.id)}
                                      title="Recusar e excluir"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => setEditingUserId(user.id)}>
                                  <Pencil className="h-4 w-4 mr-1" /> Editar
                                </Button>
                                {!isSelf && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    onClick={() => setDeletingUserId(user.id)}
                                    title="Excluir usuário"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== TAB TEMPLATES ========== */}
          <TabsContent value="templates" className="space-y-6 mt-4">
            <p className="text-sm text-muted-foreground">
              Define quais páginas cada cargo recebe ao aplicar o template no usuário.
              Apenas páginas habilitadas para <strong>{config?.client_name ?? "este cliente"}</strong> aparecem aqui.
            </p>
            {Object.entries(CARGOS_BY_AREA).map(([area, cargos]) => (
              <div key={area} className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">{area}</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {cargos.map((cargo) => {
                    const tpl = templates.find((t) => t.cargo === cargo);
                    const pages = tpl?.pages ?? [];
                    return (
                      <Card key={cargo}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center justify-between">
                            <span>{cargo}</span>
                            <Badge variant="secondary" className="text-xs">{pages.length} página(s)</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {tenantPageGroups.map((group) => {
                            const groupPages = tenantPages.filter((p) => p.group === group);
                            if (groupPages.length === 0) return null;
                            return (
                              <div key={group} className="space-y-1.5">
                                <p className="text-xs text-muted-foreground font-medium">{group}</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {groupPages.map((page) => (
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
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* ========== TAB VOIP ========== */}
          <TabsContent value="voip" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Mapeie o <code className="text-xs bg-muted px-1 py-0.5 rounded">operador_id</code> da
              API4com (ou 3CPlus) ao usuário do sistema. Assim, as ligações desse operador são
              atribuídas ao vendedor correto e aparecem no filtro "Minhas chamadas".
            </p>
            <AdminVoipAccountsCard />
            <AdminBackfill3CPlusCard />
          </TabsContent>

          <TabsContent value="fix-leads" className="space-y-4 mt-4">
            <AdminFixLeadsCard />
          </TabsContent>

          <TabsContent value="versions" className="space-y-4 mt-4">
            <AdminVersionsPanel />
          </TabsContent>
        </Tabs>
      </div>

      {/* Sheet de edição de usuário */}
      <UserEditSheet
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUserId(null)}
        templates={templates}
        tenantPages={tenantPages}
        tenantPageGroups={tenantPageGroups}
        isSuperAdminV4={isSuperAdminV4}
        currentUserId={currentUser?.id ?? null}
        onSaved={fetchAll}
        onRequestDelete={(id) => {
          setEditingUserId(null);
          setDeletingUserId(id);
        }}
      />

      {/* Dialog de exclusão */}
      <DeleteUserDialog
        open={!!deletingUser}
        onOpenChange={(open) => !open && setDeletingUserId(null)}
        user={deletingUser}
        onDeleted={fetchAll}
      />

      {/* Sheet de convite */}
      <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Convidar novo usuário</SheetTitle>
            <SheetDescription>
              O usuário receberá um email para definir senha. Configure cargo e acessos depois pela edição.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input id="invite-email" type="email" placeholder="email@exemplo.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">Nome</Label>
              <Input id="invite-name" placeholder="Nome completo" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              <Send className="h-4 w-4 mr-2" />
              {inviting ? "Enviando..." : "Enviar convite"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};

// ============= COMPONENTE: Sheet de edição =============
interface UserEditSheetProps {
  user: UserWithAccess | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: RoleTemplate[];
  tenantPages: typeof AVAILABLE_PAGES;
  tenantPageGroups: string[];
  isSuperAdminV4: boolean;
  currentUserId: string | null;
  onSaved: () => void;
  onRequestDelete: (id: string) => void;
}

const UserEditSheet = ({
  user,
  open,
  onOpenChange,
  templates,
  tenantPages,
  tenantPageGroups,
  isSuperAdminV4,
  currentUserId,
  onSaved,
  onRequestDelete,
}: UserEditSheetProps) => {
  const { toast } = useToast();
  const [cargo, setCargo] = useState<string>("");
  const [departamento, setDepartamento] = useState<string>("");
  const [telefone, setTelefone] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [approved, setApproved] = useState(false);
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setCargo(user.cargo ?? "");
      setDepartamento(user.departamento ?? "");
      setTelefone(user.telefone ?? "");
      setFullName(user.full_name ?? "");
      setApproved(user.approved);
      setMakeAdmin(user.roles.includes("admin"));
      setPages(user.pages);
    }
  }, [user]);

  if (!user) return null;

  const isSelf = currentUserId === user.id;
  const initials = getInitials(user.full_name, user.email);
  const willBeAdmin = makeAdmin;

  const togglePage = (path: string) => {
    setPages((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]));
  };

  const handleApplyTemplate = () => {
    if (!cargo) {
      toast({ title: "Selecione um cargo primeiro", variant: "destructive" });
      return;
    }
    const tpl = templates.find((t) => t.cargo === cargo);
    if (!tpl) {
      toast({ title: "Sem template", description: `Não há template para "${cargo}"`, variant: "destructive" });
      return;
    }
    // Aplica apenas páginas habilitadas no tenant
    const enabled = tpl.pages.filter((p) => tenantPages.some((tp) => tp.path === p));
    setPages(enabled);
    toast({ title: "Template aplicado", description: `${enabled.length} página(s) selecionada(s). Clique em Salvar para confirmar.` });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Update profile
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          cargo: cargo || null,
          departamento: departamento || null,
          telefone: telefone.trim() || null,
          approved: willBeAdmin ? true : approved,
        })
        .eq("id", user.id);
      if (profErr) throw profErr;

      // 2. Sync admin role (apenas super_admin pode mudar)
      if (isSuperAdminV4) {
        const wasAdmin = user.roles.includes("admin");
        if (willBeAdmin && !wasAdmin) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("tenant_id")
            .eq("id", user.id)
            .maybeSingle();
          if (prof?.tenant_id) {
            await supabase
              .from("user_roles")
              .insert({ user_id: user.id, role: "admin", tenant_id: prof.tenant_id });
          }
        } else if (!willBeAdmin && wasAdmin) {
          await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", user.id)
            .eq("role", "admin");
        }
      }

      // 3. Sync page_access (apenas se NÃO for admin — admin tem tudo)
      if (!willBeAdmin) {
        const { error: delErr } = await supabase.from("user_page_access").delete().eq("user_id", user.id);
        if (delErr) throw delErr;
        if (pages.length > 0) {
          const rows = pages.map((p) => ({ user_id: user.id, page_path: p }));
          const { error: insErr } = await supabase.from("user_page_access").insert(rows);
          if (insErr) throw insErr;
        }
      }

      toast({ title: "Salvo", description: "Alterações aplicadas com sucesso" });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name ?? ""} />}
              <AvatarFallback className="bg-primary/15 text-primary text-base">{initials || "?"}</AvatarFallback>
            </Avatar>
            <div className="text-left min-w-0">
              <SheetTitle className="truncate">{user.full_name || "Sem nome"}</SheetTitle>
              <SheetDescription className="truncate">{user.email}</SheetDescription>
              {user.cargo && (
                <div className="flex gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[10px]">{user.cargo}</Badge>
                  {user.departamento && <Badge variant="secondary" className="text-[10px]">{user.departamento}</Badge>}
                </div>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* STATUS & PAPEL */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Status & papel</h3>
            <label className="flex items-center justify-between gap-3 text-sm cursor-pointer rounded-md border border-border/50 p-3">
              <div>
                <p className="font-medium">Usuário aprovado</p>
                <p className="text-xs text-muted-foreground">Pode acessar o sistema</p>
              </div>
              <Switch checked={willBeAdmin || approved} onCheckedChange={(v) => setApproved(v)} disabled={willBeAdmin} />
            </label>
            {isSuperAdminV4 && (
              <label className="flex items-center justify-between gap-3 text-sm cursor-pointer rounded-md border border-border/50 p-3">
                <div>
                  <p className="font-medium flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    Administrador
                  </p>
                  <p className="text-xs text-muted-foreground">Acesso total: todas as páginas, todos os usuários</p>
                </div>
                <Switch checked={makeAdmin} onCheckedChange={setMakeAdmin} disabled={isSelf} />
              </label>
            )}
            {willBeAdmin && (
              <p className="text-xs text-muted-foreground">
                Administradores têm acesso a todas as páginas. A seleção individual abaixo é ignorada.
              </p>
            )}
          </section>

          <Separator />

          {/* PERFIL */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Dados do perfil</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs">Nome completo</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Telefone</Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </div>
          </section>

          <Separator />

          {/* CARGO & DEPTO */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Cargo & departamento</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Cargo</Label>
                <Select value={cargo} onValueChange={setCargo}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CARGOS_BY_AREA).map(([area, cargos]) => (
                      <div key={area}>
                        <div className="px-2 py-1 text-xs text-muted-foreground font-semibold">{area}</div>
                        {cargos.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </div>
                    ))}
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Departamento</Label>
                <Select value={departamento} onValueChange={setDepartamento}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {DEPARTAMENTO_OPTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!willBeAdmin && (
              <Button size="sm" variant="outline" onClick={handleApplyTemplate} disabled={!cargo} className="w-full">
                <Wand2 className="h-3.5 w-3.5 mr-2" />
                Aplicar template do cargo
              </Button>
            )}
          </section>

          {!willBeAdmin && (
            <>
              <Separator />
              {/* ACESSOS */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Acessos individuais</h3>
                {tenantPageGroups.map((group) => {
                  const groupPages = tenantPages.filter((p) => p.group === group);
                  if (groupPages.length === 0) return null;
                  return (
                    <div key={group} className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">{group}</p>
                      <div className="grid grid-cols-1 gap-1.5 pl-1">
                        {groupPages.map((page) => (
                          <label key={page.path} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={pages.includes(page.path)}
                              onCheckedChange={() => togglePage(page.path)}
                            />
                            {page.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            </>
          )}
        </div>

        <SheetFooter className="gap-2 flex sm:justify-between">
          {!isSelf ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={() => onRequestDelete(user.id)}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Excluir usuário
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default Admin;
