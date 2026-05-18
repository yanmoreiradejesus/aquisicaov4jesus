import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, ExternalLink, Trash2, LogIn } from "lucide-react";

interface Tenant {
  id: string;
  client_name: string;
  client_slug: string;
  app_base_url: string | null;
  status: string;
  v4_contact: string | null;
  internal_notes: string | null;
  provisioned_at: string | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: "setup", label: "Em setup", variant: "secondary" as const },
  { value: "active", label: "Ativo", variant: "default" as const },
  { value: "paused", label: "Pausado", variant: "outline" as const },
  { value: "closed", label: "Encerrado", variant: "destructive" as const },
];

export default function AdminClientes() {
  const { isSuperAdminV4, loading, authResolved, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState({
    client_name: "",
    client_slug: "",
    app_base_url: "",
    status: "setup",
    v4_contact: "",
    internal_notes: "",
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Tenant[];
    },
    enabled: isSuperAdminV4,
  });

  const upsertMut = useMutation({
    mutationFn: async () => {
      const payload = {
        client_name: form.client_name,
        client_slug: form.client_slug,
        app_base_url: form.app_base_url || null,
        status: form.status,
        v4_contact: form.v4_contact || null,
        internal_notes: form.internal_notes || null,
        provisioned_at:
          form.status === "active" && !editing?.provisioned_at
            ? new Date().toISOString()
            : editing?.provisioned_at ?? null,
      };
      if (editing) {
        const { error } = await supabase
          .from("tenants")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tenants").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast.success(editing ? "Cliente atualizado" : "Cliente adicionado");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tenants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Cliente removido");
    },
  });

  
  const enterAsMut = useMutation({
    mutationFn: async (tenantId: string) => {
      if (!user) throw new Error("Sem sessão");
      const { error } = await supabase
        .from("profiles")
        .update({ active_tenant_id: tenantId })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries();
      toast.success("Tenant ativo trocado");
      navigate("/apps");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function resetForm() {
    setDialogOpen(false);
    setEditing(null);
    setForm({
      client_name: "",
      client_slug: "",
      app_base_url: "",
      status: "setup",
      v4_contact: "",
      internal_notes: "",
    });
  }

  function openEdit(c: Tenant) {
    setEditing(c);
    setForm({
      client_name: c.client_name,
      client_slug: c.client_slug,
      app_base_url: c.app_base_url ?? "",
      status: c.status,
      v4_contact: c.v4_contact ?? "",
      internal_notes: c.internal_notes ?? "",
    });
    setDialogOpen(true);
  }

  if (loading || !authResolved) {
    return <div className="container mx-auto py-10">Carregando...</div>;
  }

  if (!isSuperAdminV4) {
    return (
      <div className="container mx-auto py-10 max-w-2xl">
        <Card className="p-8">
          <h1 className="font-heading text-2xl mb-2">Acesso restrito</h1>
          <p className="text-muted-foreground mb-4">
            Esta página é exclusiva do time V4 (role <code>super_admin_v4</code>).
          </p>
          <Button onClick={() => navigate("/")}>Voltar ao início</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 max-w-6xl px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-2">
            V4 Hub · Painel V4
          </p>
          <h1 className="font-heading text-4xl uppercase">Clientes V4</h1>
          <p className="text-muted-foreground mt-2">
            Cada cliente é um tenant isolado dentro deste mesmo projeto. Criar = liberar acesso.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(o) => (o ? setDialogOpen(true) : resetForm())}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Novo cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar cliente" : "Novo cliente V4"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome do cliente</Label>
                <Input
                  placeholder="V4 Xyz"
                  value={form.client_name}
                  onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Slug (identificador curto)</Label>
                <Input
                  placeholder="xyz"
                  value={form.client_slug}
                  onChange={(e) =>
                    setForm({ ...form, client_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
                  }
                />
              </div>
              <div>
                <Label>URL do app</Label>
                <Input
                  placeholder="https://app.v4xyz.com"
                  value={form.app_base_url}
                  onChange={(e) => setForm({ ...form, app_base_url: e.target.value })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contato V4 responsável</Label>
                <Input
                  placeholder="Nome / e-mail"
                  value={form.v4_contact}
                  onChange={(e) => setForm({ ...form, v4_contact: e.target.value })}
                />
              </div>
              <div>
                <Label>Notas internas</Label>
                <Textarea
                  placeholder="Observações sobre setup, customizações, integrações..."
                  value={form.internal_notes}
                  onChange={(e) => setForm({ ...form, internal_notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
              <Button
                onClick={() => upsertMut.mutate()}
                disabled={!form.client_name || !form.client_slug || upsertMut.isPending}
              >
                {editing ? "Salvar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-6 mb-8 bg-muted/30">
        <h2 className="font-heading uppercase text-sm tracking-wider mb-3">
          Como adicionar um cliente
        </h2>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Clicar em "Novo cliente" e preencher nome, slug e URL</li>
          <li>Salvar — o tenant fica isolado automaticamente via RLS</li>
          <li>Convidar o admin do cliente (próxima fase: seletor de tenant no convite)</li>
        </ol>
      </Card>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando clientes...</div>
      ) : clients.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Nenhum cliente cadastrado ainda. Clique em "Novo cliente" para começar.
        </Card>
      ) : (
        <div className="grid gap-4">
          {clients.map((c) => {
            const statusCfg = STATUS_OPTIONS.find((s) => s.value === c.status) ?? STATUS_OPTIONS[0];
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-heading text-xl">{c.client_name}</h3>
                      <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                      <span className="text-xs text-muted-foreground">/{c.client_slug}</span>
                    </div>
                    {c.app_base_url && (
                      <a
                        href={c.app_base_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {c.app_base_url} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {c.v4_contact && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Responsável V4: {c.v4_contact}
                      </p>
                    )}
                    {c.internal_notes && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {c.internal_notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Remover ${c.client_name} do catálogo?`)) deleteMut.mutate(c.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
