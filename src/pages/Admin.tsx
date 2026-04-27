import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Shield, UserPlus, Send, Wand2, Pencil, Search, Clock } from "lucide-react";
import { AdminVoipAccountsCard } from "@/components/admin/AdminVoipAccountsCard";
import { AdminFixLeadsCard } from "@/components/admin/AdminFixLeadsCard";
import { AdminBackfill3CPlusCard } from "@/components/admin/AdminBackfill3CPlusCard";

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
  { path: "/aquisicao/funil", label: "Funil", group: "Data Analytics" },
  { path: "/aquisicao/dashboard", label: "Dashboard", group: "Data Analytics" },
  { path: "/aquisicao/insights", label: "Insights", group: "Data Analytics" },
  { path: "/aquisicao/meta", label: "Meta", group: "Data Analytics" },
  { path: "/aquisicao/financeiro", label: "Financeiro", group: "Data Analytics" },
  { path: "/comercial/leads", label: "CRM Leads", group: "Comercial" },
  { path: "/comercial/oportunidades", label: "CRM Oportunidades", group: "Comercial" },
  { path: "/comercial/accounts", label: "Accounts", group: "Comercial" },
  { path: "/comercial/cobrancas", label: "Cobranças", group: "Comercial" },
  { path: "/app-v4", label: "App V4", group: "Outros" },
];

const PAGE_GROUPS = ["Data Analytics", "Comercial", "Outros"];

const CARGOS_BY_AREA: Record<string, string[]> = {
  Receitas: ["SDR", "Closer", "BDR", "Líder de Expansão"],
  "PE&G": [
    "Coordenador de PE&G",
    "Account Manager",
    "Gestor de Tráfego",
    "Designer",
    "Copywriter",
    "Social Media",
    "Consultor",
    "Analista de Tech",
  ],
  ADM: ["Coordenadora ADM", "HRBP", "Analista Financeira"],
};

const CARGO_OPTIONS = [
  ...CARGOS_BY_AREA.Receitas,
  ...CARGOS_BY_AREA["PE&G"],
  ...CARGOS_BY_AREA.ADM,
  "Outro",
];
const DEPARTAMENTO_OPTIONS = ["Receitas", "PE&G", "ADM", "Outro"];

const getInitials = (name: string | null, email: string) =>
  (name || email)
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const Admin = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCargo, setFilterCargo] = useState<string>("__all__");
  const [filterDepto, setFilterDepto] = useState<string>("__all__");
  const [filterStatus, setFilterStatus] = useState<string>("__all__");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();

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
                <div className="md:col-span-4 flex gap-2">
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
                              <Button size="sm" variant="ghost" onClick={() => setEditingUserId(user.id)}>
                                <Pencil className="h-4 w-4 mr-1" /> Editar
                              </Button>
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
                          {PAGE_GROUPS.map((group) => {
                            const groupPages = AVAILABLE_PAGES.filter((p) => p.group === group);
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
          </TabsContent>

          {/* ========== TAB CORRIGIR LEADS ========== */}
          <TabsContent value="fix-leads" className="space-y-4 mt-4">
            <AdminFixLeadsCard />
          </TabsContent>
        </Tabs>
      </div>

      {/* Sheet de edição de usuário */}
      <UserEditSheet
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUserId(null)}
        templates={templates}
        onSaved={fetchAll}
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
  onSaved: () => void;
}

const UserEditSheet = ({ user, open, onOpenChange, templates, onSaved }: UserEditSheetProps) => {
  const { toast } = useToast();
  const [cargo, setCargo] = useState<string>("");
  const [departamento, setDepartamento] = useState<string>("");
  const [telefone, setTelefone] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [approved, setApproved] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setCargo(user.cargo ?? "");
      setDepartamento(user.departamento ?? "");
      setTelefone(user.telefone ?? "");
      setFullName(user.full_name ?? "");
      setApproved(user.approved);
      setPages(user.pages);
    }
  }, [user]);

  if (!user) return null;

  const isUserAdmin = user.roles.includes("admin");
  const initials = getInitials(user.full_name, user.email);

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
    setPages(tpl.pages);
    toast({ title: "Template aplicado", description: `${tpl.pages.length} página(s) selecionada(s). Clique em Salvar para confirmar.` });
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
          approved,
        })
        .eq("id", user.id);
      if (profErr) throw profErr;

      // 2. Sync page_access (delete all, re-insert)
      const { error: delErr } = await supabase.from("user_page_access").delete().eq("user_id", user.id);
      if (delErr) throw delErr;
      if (pages.length > 0) {
        const rows = pages.map((p) => ({ user_id: user.id, page_path: p }));
        const { error: insErr } = await supabase.from("user_page_access").insert(rows);
        if (insErr) throw insErr;
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
            <Avatar className="h-12 w-12">
              {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name ?? ""} />}
              <AvatarFallback className="bg-primary/15 text-primary">{initials || "?"}</AvatarFallback>
            </Avatar>
            <div className="text-left">
              <SheetTitle>{user.full_name || "Sem nome"}</SheetTitle>
              <SheetDescription>{user.email}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* STATUS */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Status</h3>
            {isUserAdmin ? (
              <Badge className="bg-primary/20 text-primary border-primary/30">Administrador</Badge>
            ) : (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={approved} onCheckedChange={(v) => setApproved(!!v)} />
                Usuário aprovado (pode acessar o sistema)
              </label>
            )}
          </section>

          <Separator />

          {/* PERFIL */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Dados do perfil</h3>
            <div className="space-y-2">
              <Label className="text-xs">Nome completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          </section>

          <Separator />

          {/* CARGO */}
          {!isUserAdmin && (
            <>
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
                <Button size="sm" variant="outline" onClick={handleApplyTemplate} disabled={!cargo} className="w-full">
                  <Wand2 className="h-3.5 w-3.5 mr-2" />
                  Aplicar template do cargo
                </Button>
              </section>

              <Separator />

              {/* ACESSOS */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Acessos individuais</h3>
                {PAGE_GROUPS.map((group) => {
                  const groupPages = AVAILABLE_PAGES.filter((p) => p.group === group);
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

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default Admin;
