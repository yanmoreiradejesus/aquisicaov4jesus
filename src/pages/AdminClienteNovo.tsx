import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Upload,
  ExternalLink,
} from "lucide-react";
import { PAGE_CATALOG, PAGE_PRESETS, ALL_PAGE_PATHS } from "@/hooks/useTenantEnabledPages";

const STEPS = [
  { id: 1, label: "Identidade" },
  { id: 2, label: "Domínio" },
  { id: 3, label: "Branding" },
  { id: 4, label: "VoIP" },
  { id: 5, label: "Páginas" },
  { id: 6, label: "Revisão" },
];

type DnsState = "idle" | "checking" | "ok" | "propagating" | "error";

interface FormState {
  client_name: string;
  client_slug: string;
  v4_contact: string;
  internal_notes: string;
  subdominio: string;
  client_logo_url: string;
  voip_provider: "none" | "3cplus" | "api4com";
  enabled_pages: Set<string>;
}

const ROOT_DOMAIN = "v4jesus.com";

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hslToHex(hsl: string): string {
  const m = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!m) return "#3b82f6";
  const h = parseInt(m[1]);
  const s = parseInt(m[2]) / 100;
  const l = parseInt(m[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m2 = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m2) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export default function AdminClienteNovo() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isSuperAdminV4, loading, authResolved } = useAuth();

  const [step, setStep] = useState(1);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [dnsState, setDnsState] = useState<DnsState>("idle");
  const [dnsMsg, setDnsMsg] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    client_name: "",
    client_slug: "",
    v4_contact: "",
    internal_notes: "",
    subdominio: "",
    client_logo_url: "",
    primary_color_hsl: "217 91% 60%",
    voip_provider: "none",
    enabled_pages: new Set(PAGE_PRESETS.completo),
  });

  const fullDomain = `${form.subdominio || form.client_slug || "<slug>"}.${ROOT_DOMAIN}`;
  const appUrl = `https://${fullDomain}`;

  // ─── Validações por etapa ─────────────────────────────────────────────
  const stepValid = useMemo(() => {
    switch (step) {
      case 1:
        return form.client_name.trim().length >= 2 && /^[a-z0-9-]{2,}$/.test(form.client_slug);
      case 2:
        return /^[a-z0-9-]{2,}$/.test(form.subdominio);
      default:
        return true;
    }
  }, [step, form]);

  // ─── Auto slug ────────────────────────────────────────────────────────
  const onNameChange = (v: string) => {
    const autoSlug = v
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/v4\s*/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setForm((f) => ({
      ...f,
      client_name: v,
      client_slug: f.client_slug || autoSlug,
      subdominio: f.subdominio || autoSlug,
    }));
  };

  // ─── Checagem de slug duplicado ───────────────────────────────────────
  const checkSlugAndAdvance = async () => {
    setSlugError(null);
    const { data, error } = await supabase
      .from("tenants")
      .select("id")
      .eq("client_slug", form.client_slug)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      setSlugError(`Slug "${form.client_slug}" já está em uso. Escolha outro.`);
      return;
    }
    setStep(2);
  };

  // ─── DNS check ────────────────────────────────────────────────────────
  const checkDns = async () => {
    setDnsState("checking");
    setDnsMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("check-domain-dns", {
        body: { hostname: fullDomain },
      });
      if (error) throw error;
      if (data?.matches_lovable) {
        setDnsState("ok");
        setDnsMsg(`DNS apontando corretamente para ${data.expected_ip}.`);
      } else if ((data?.resolved_ips ?? []).length === 0) {
        setDnsState("propagating");
        setDnsMsg("Domínio ainda não resolve — provavelmente DNS ainda propagando.");
      } else {
        setDnsState("error");
        setDnsMsg(
          `Aponta para ${data.resolved_ips.join(", ")} (esperado: ${data.expected_ip}).`,
        );
      }
    } catch (e) {
      setDnsState("error");
      setDnsMsg(e instanceof Error ? e.message : "Erro ao consultar DNS.");
    }
  };

  // ─── Upload de logo ───────────────────────────────────────────────────
  const onLogoSelected = async (file: File) => {
    if (!form.client_slug) {
      toast.error("Defina o slug do cliente antes de subir a logo.");
      return;
    }
    setLogoUploading(true);
    setLogoFile(file);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `tenant-logos/${form.client_slug}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setForm((f) => ({ ...f, client_logo_url: data.publicUrl }));
      toast.success("Logo enviada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setLogoUploading(false);
    }
  };

  // ─── Toggle página ────────────────────────────────────────────────────
  const togglePage = (path: string) => {
    setForm((f) => {
      const next = new Set(f.enabled_pages);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { ...f, enabled_pages: next };
    });
  };

  const applyPreset = (preset: keyof typeof PAGE_PRESETS) => {
    setForm((f) => ({ ...f, enabled_pages: new Set(PAGE_PRESETS[preset]) }));
  };

  // ─── Criação final ────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: async () => {
      // 1) cria tenant
      const { data: tenant, error: tErr } = await supabase
        .from("tenants")
        .insert({
          client_name: form.client_name,
          client_slug: form.client_slug,
          app_base_url: appUrl,
          status: "setup",
          v4_contact: form.v4_contact || null,
          internal_notes: form.internal_notes || null,
          client_logo_url: form.client_logo_url || null,
          primary_color_hsl: form.primary_color_hsl || null,
          voip_provider: form.voip_provider === "none" ? null : form.voip_provider,
        })
        .select()
        .single();
      if (tErr) throw tErr;

      // 2) páginas habilitadas
      const pageRows = Array.from(form.enabled_pages).map((page_path) => ({
        tenant_id: tenant.id,
        page_path,
      }));
      if (pageRows.length > 0) {
        const { error: pErr } = await supabase
          .from("tenant_enabled_pages")
          .insert(pageRows);
        if (pErr) throw pErr;
      }

      return tenant;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Cliente criado com sucesso");
      navigate("/admin/clientes");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Guards ───────────────────────────────────────────────────────────
  if (loading || !authResolved) return <div className="container mx-auto py-10">Carregando...</div>;
  if (!isSuperAdminV4) {
    return (
      <div className="container mx-auto py-10 max-w-2xl">
        <Card className="p-8">
          <h1 className="font-heading text-2xl mb-2">Acesso restrito</h1>
          <p className="text-muted-foreground">Apenas super_admin_v4 pode criar clientes.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 max-w-4xl px-4">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/admin/clientes")}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
        >
          <ArrowLeft className="w-3 h-3" /> Voltar para clientes
        </button>
        <p className="text-xs font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-2">
          V4 Hub · Setup
        </p>
        <h1 className="font-heading text-4xl uppercase">Novo cliente</h1>
        <p className="text-muted-foreground mt-2">
          Setup guiado em {STEPS.length} etapas. O tenant é criado só na última.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const isCurrent = s.id === step;
          const isDone = s.id < step;
          return (
            <div key={s.id} className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => isDone && setStep(s.id)}
                disabled={!isDone}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isCurrent
                    ? "bg-primary text-primary-foreground"
                    : isDone
                    ? "bg-muted hover:bg-muted/80 text-foreground cursor-pointer"
                    : "bg-muted/40 text-muted-foreground"
                }`}
              >
                <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${
                  isCurrent ? "bg-primary-foreground/20" : isDone ? "bg-emerald-600/20 text-emerald-500" : "bg-background"
                }`}>
                  {isDone ? <Check className="w-3 h-3" /> : s.id}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && <div className="w-4 h-px bg-border" />}
            </div>
          );
        })}
      </div>

      {/* Conteúdo */}
      <Card className="p-6 md:p-8">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-heading text-xl mb-1">Identidade do cliente</h2>
              <p className="text-sm text-muted-foreground">Nome que aparece no header e slug usado nas URLs.</p>
            </div>
            <div>
              <Label>Nome do cliente *</Label>
              <Input
                placeholder="V4 Xyz"
                value={form.client_name}
                onChange={(e) => onNameChange(e.target.value)}
              />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input
                placeholder="xyz"
                value={form.client_slug}
                onChange={(e) =>
                  setForm({
                    ...form,
                    client_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Identificador curto, sem acentos. Mínimo 2 caracteres, só a-z, 0-9 e hífen.
              </p>
              {slugError && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {slugError}
                </p>
              )}
            </div>
            <div>
              <Label>Contato V4 responsável</Label>
              <Input
                placeholder="Nome ou e-mail do responsável V4"
                value={form.v4_contact}
                onChange={(e) => setForm({ ...form, v4_contact: e.target.value })}
              />
            </div>
            <div>
              <Label>Notas internas</Label>
              <Textarea
                placeholder="Observações para o time V4 (não aparece pro cliente)"
                value={form.internal_notes}
                onChange={(e) => setForm({ ...form, internal_notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-heading text-xl mb-1">Domínio do cliente</h2>
              <p className="text-sm text-muted-foreground">
                Cada cliente recebe um subdomínio de <code className="text-foreground">{ROOT_DOMAIN}</code>. A V4 controla o DNS.
              </p>
            </div>

            <div>
              <Label>Subdomínio *</Label>
              <div className="flex items-center">
                <Input
                  className="rounded-r-none"
                  placeholder="xyz"
                  value={form.subdominio}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      subdominio: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    })
                  }
                />
                <div className="px-3 h-10 flex items-center bg-muted border border-l-0 rounded-r-md text-sm text-muted-foreground">
                  .{ROOT_DOMAIN}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                URL final: <span className="text-foreground font-mono">{appUrl}</span>
              </p>
            </div>

            <div className="bg-muted/40 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold">Checklist (você faz fora do sistema)</h3>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                <li>
                  No Lovable: <strong>Project Settings → Domains → Connect Domain</strong> →{" "}
                  <code className="text-foreground">{fullDomain}</code>
                </li>
                <li>
                  No DNS do <code className="text-foreground">{ROOT_DOMAIN}</code>:
                  <ul className="ml-4 mt-1 space-y-0.5">
                    <li>
                      Registro <strong>A</strong>{" "}
                      <code className="text-foreground">{form.subdominio || "<sub>"}</code> →{" "}
                      <code className="text-foreground">185.158.133.1</code>
                    </li>
                    <li>
                      Registro <strong>TXT</strong>{" "}
                      <code className="text-foreground">_lovable.{form.subdominio || "<sub>"}</code> → valor fornecido pelo Lovable
                    </li>
                  </ul>
                </li>
                <li>Aguardar propagação (até 72h) + SSL automático.</li>
              </ol>
            </div>

            <div className="border rounded-lg p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Validar propagação DNS</p>
                {dnsMsg ? (
                  <p
                    className={`text-xs mt-1 ${
                      dnsState === "ok"
                        ? "text-emerald-500"
                        : dnsState === "error"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {dnsMsg}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Opcional. Não bloqueia o setup.
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={checkDns}
                disabled={dnsState === "checking" || !form.subdominio}
              >
                {dnsState === "checking" ? (
                  <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Verificando</>
                ) : dnsState === "ok" ? (
                  <><ShieldCheck className="w-3 h-3 mr-1" /> OK</>
                ) : (
                  "Validar DNS"
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-heading text-xl mb-1">Branding</h2>
              <p className="text-sm text-muted-foreground">Logo e cor primária do cliente. Ambos opcionais.</p>
            </div>

            <div>
              <Label>Logo do cliente</Label>
              <div className="mt-2 flex items-center gap-4">
                {form.client_logo_url ? (
                  <img
                    src={form.client_logo_url}
                    alt="Logo"
                    className="h-16 w-16 object-contain rounded border bg-muted/30 p-1"
                  />
                ) : (
                  <div className="h-16 w-16 rounded border border-dashed bg-muted/30 flex items-center justify-center text-muted-foreground">
                    <Upload className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    id="logo-upload"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onLogoSelected(f);
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("logo-upload")?.click()}
                    disabled={logoUploading || !form.client_slug}
                  >
                    {logoUploading ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Enviando</>
                    ) : (
                      <>Escolher arquivo</>
                    )}
                  </Button>
                  {!form.client_slug && (
                    <p className="text-xs text-muted-foreground mt-1">Defina o slug primeiro.</p>
                  )}
                  {logoFile && (
                    <p className="text-xs text-muted-foreground mt-1">{logoFile.name}</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label>Cor primária</Label>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="color"
                  value={hslToHex(form.primary_color_hsl)}
                  onChange={(e) =>
                    setForm({ ...form, primary_color_hsl: hexToHsl(e.target.value) })
                  }
                  className="h-10 w-16 rounded border bg-transparent cursor-pointer"
                />
                <Input
                  className="font-mono w-48"
                  value={form.primary_color_hsl}
                  onChange={(e) => setForm({ ...form, primary_color_hsl: e.target.value })}
                  placeholder="217 91% 60%"
                />
                <Button
                  style={{ backgroundColor: `hsl(${form.primary_color_hsl})` }}
                  className="text-white"
                  type="button"
                >
                  Preview
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Formato HSL: <code>H S% L%</code>.
              </p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-heading text-xl mb-1">VoIP (opcional)</h2>
              <p className="text-sm text-muted-foreground">
                Provider de chamadas que o CRM vai usar. Pode ficar em "Nenhum" e configurar depois.
              </p>
            </div>
            <div>
              <Label>Provider</Label>
              <Select
                value={form.voip_provider}
                onValueChange={(v: "none" | "3cplus" | "api4com") =>
                  setForm({ ...form, voip_provider: v })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  <SelectItem value="3cplus">3CPlus</SelectItem>
                  <SelectItem value="api4com">API4Com</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.voip_provider !== "none" && (
              <div className="bg-muted/40 rounded-lg p-4 text-xs text-muted-foreground">
                <p>
                  ℹ️ O token do provider vive em um secret global do projeto compartilhado entre tenants.
                  Se este cliente exigir token próprio, configure caso a caso depois.
                </p>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-heading text-xl mb-1">Páginas habilitadas</h2>
              <p className="text-sm text-muted-foreground">
                Marque o que esse cliente terá disponível no menu. Não-marcadas ficam invisíveis.
              </p>
            </div>

            {/* Atalhos */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground mr-1">Presets:</span>
              <Button size="sm" variant="outline" onClick={() => applyPreset("completo")}>Completo</Button>
              <Button size="sm" variant="outline" onClick={() => applyPreset("aquisicao-apenas")}>Aquisição apenas</Button>
              <Button size="sm" variant="outline" onClick={() => applyPreset("crm-apenas")}>CRM apenas</Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setForm((f) => ({ ...f, enabled_pages: new Set() }))}
              >
                Desmarcar tudo
              </Button>
              <Badge variant="secondary" className="ml-auto">
                {form.enabled_pages.size}/{ALL_PAGE_PATHS.length} marcadas
              </Badge>
            </div>

            <div className="space-y-5">
              {PAGE_CATALOG.map((group) => (
                <div key={group.group}>
                  <h3 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-2">
                    {group.group}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {group.pages.map((p) => (
                      <label
                        key={p.path}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={form.enabled_pages.has(p.path)}
                          onCheckedChange={() => togglePage(p.path)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{p.label}</div>
                          <code className="text-[10px] text-muted-foreground">{p.path}</code>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
              <strong>Sempre disponíveis</strong> (não desmarcáveis): Hub home (/), Admin (/admin), Perfil (/perfil).
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-heading text-xl mb-1">Revisão</h2>
              <p className="text-sm text-muted-foreground">
                Confira antes de criar. Você pode voltar e editar qualquer etapa.
              </p>
            </div>

            <div className="grid gap-3">
              <ReviewRow label="Cliente" value={form.client_name} />
              <ReviewRow label="Slug" value={form.client_slug} />
              <ReviewRow label="URL" value={appUrl} />
              <ReviewRow label="Contato V4" value={form.v4_contact || "—"} />
              <ReviewRow
                label="Logo"
                value={form.client_logo_url ? "Enviada" : "Sem logo (default)"}
              />
              <ReviewRow
                label="Cor primária"
                value={
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: `hsl(${form.primary_color_hsl})` }}
                    />
                    <code className="text-xs">{form.primary_color_hsl}</code>
                  </span>
                }
              />
              <ReviewRow
                label="VoIP"
                value={form.voip_provider === "none" ? "Nenhum" : form.voip_provider}
              />
              <ReviewRow
                label="Páginas habilitadas"
                value={`${form.enabled_pages.size} de ${ALL_PAGE_PATHS.length}`}
              />
              {form.internal_notes && (
                <ReviewRow label="Notas" value={form.internal_notes} />
              )}
            </div>

            <div className="bg-muted/40 rounded-lg p-4 text-xs text-muted-foreground space-y-1">
              <p className="text-foreground font-semibold mb-1">Próximos passos depois de criar:</p>
              <p>1. ⏳ Conectar <code>{fullDomain}</code> no Lovable + DNS</p>
              <p>2. ⏳ Enviar link <code>{appUrl}/login</code> pro cliente</p>
              <p>3. ⏳ Primeiro signup do cliente vira admin automaticamente</p>
              <p>4. ⏳ Mudar status para "Ativo" em /admin/clientes</p>
            </div>
          </div>
        )}
      </Card>

      {/* Navegação */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="ghost"
          onClick={() => (step === 1 ? navigate("/admin/clientes") : setStep(step - 1))}
          disabled={createMut.isPending}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> {step === 1 ? "Cancelar" : "Voltar"}
        </Button>

        {step < STEPS.length ? (
          <Button
            onClick={() => (step === 1 ? checkSlugAndAdvance() : setStep(step + 1))}
            disabled={!stepValid}
          >
            Avançar <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            {createMut.isPending ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Criando...</>
            ) : (
              <>Criar cliente <Check className="w-4 h-4 ml-1" /></>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/40">
      <span className="text-xs uppercase tracking-wider text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right break-words">{value}</span>
    </div>
  );
}
