import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantConfig } from "@/hooks/useTenantConfig";
import { ChevronDown, Building2, Check } from "lucide-react";
import { toast } from "sonner";

interface Tenant {
  id: string;
  client_name: string;
  client_slug: string;
  status: string;
}

interface Props {
  variant?: "header" | "mobile";
}

export function TenantSwitcher({ variant = "header" }: Props) {
  const { user, isSuperAdminV4 } = useAuth();
  const { config } = useTenantConfig();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  const isClientDomainLocked =
    host &&
    host !== "localhost" &&
    !host.endsWith(".lovable.app") &&
    host !== "v4jesus.com" &&
    host !== "www.v4jesus.com";

  const { data: tenants = [] } = useQuery({
    queryKey: ["tenants", "switcher"],
    enabled: !!user && isSuperAdminV4,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, client_name, client_slug, status")
        .order("client_name");
      if (error) throw error;
      return (data ?? []) as Tenant[];
    },
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!isSuperAdminV4 || !user) return null;

  if (isClientDomainLocked) {
    if (variant === "mobile") {
      return (
        <div className="px-3 py-2">
          <div className="px-3 text-foreground/40 text-[10px] font-semibold uppercase tracking-widest">
            Tenant ativo
          </div>
          <div className="mt-1.5 px-3 py-2 rounded-xl text-[13px] font-medium bg-white/[0.08] text-foreground">
            {config.client_name}
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-full text-[12px] font-medium text-white/85 bg-white/10 max-w-[180px]">
        <Building2 className="h-3 w-3 opacity-80 shrink-0" />
        <span className="truncate">{config.client_name}</span>
      </div>
    );
  }

  async function switchTo(tenantId: string) {
    if (switching) return;
    setSwitching(true);
    const { error } = await supabase
      .from("profiles")
      .update({ active_tenant_id: tenantId })
      .eq("id", user!.id);
    setSwitching(false);
    setOpen(false);
    if (error) {
      toast.error("Erro ao trocar de tenant: " + error.message);
      return;
    }
    toast.success("Tenant ativo trocado");
    await qc.invalidateQueries();
    navigate("/apps");
  }

  const current = tenants.find((t) => t.id === config.id);
  const label = current?.client_name ?? config.client_name;

  if (variant === "mobile") {
    return (
      <div className="px-3 py-2">
        <div className="px-3 text-foreground/40 text-[10px] font-semibold uppercase tracking-widest">
          Tenant ativo (V4)
        </div>
        <div className="mt-1.5 space-y-0.5">
          {tenants.map((t) => (
            <button
              key={t.id}
              onClick={() => switchTo(t.id)}
              className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                t.id === config.id
                  ? "bg-white/[0.08] text-foreground"
                  : "text-foreground/75 hover:bg-white/[0.05] hover:text-foreground"
              }`}
            >
              <span className="truncate">{t.client_name}</span>
              {t.id === config.id && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 h-8 rounded-full text-[12px] font-medium text-white/85 hover:text-white hover:bg-white/15 transition-all max-w-[180px]"
        title="Trocar de tenant"
      >
        <Building2 className="h-3 w-3 opacity-80 shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown
          className={`h-3 w-3 opacity-60 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2.5 min-w-[220px] z-50 rounded-2xl border border-white/[0.08] bg-popover/80 backdrop-blur-2xl backdrop-saturate-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.08)] p-1.5 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150">
          <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/40">
            Entrar como
          </div>
          {tenants.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-foreground/50">
              Nenhum cliente cadastrado
            </div>
          )}
          {tenants.map((t) => (
            <button
              key={t.id}
              onClick={() => switchTo(t.id)}
              className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-xl font-body text-[13px] font-medium tracking-tight transition-all duration-150 ${
                t.id === config.id
                  ? "bg-white/[0.08] text-foreground"
                  : "text-foreground/75 hover:bg-white/[0.05] hover:text-foreground"
              }`}
            >
              <span className="truncate">{t.client_name}</span>
              {t.id === config.id ? (
                <Check className="h-3.5 w-3.5 shrink-0 opacity-80" />
              ) : (
                <span className="text-[10px] opacity-50 shrink-0">/{t.client_slug}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
