import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import defaultLogo from "@/assets/v4-logo.png";
import { useTenantConfig } from "@/hooks/useTenantConfig";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

const CARGOS = [
  "Account Manager",
  "Analista de Tech",
  "Analista Financeira",
  "BDR",
  "Closer",
  "Consultor",
  "Coordenador de PE&G",
  "Coordenadora ADM",
  "Copywriter",
  "Designer",
  "Gestor de Tráfego",
  "HRBP",
  "Líder de Expansão",
  "SDR",
  "Social Media",
] as const;

const DEPARTAMENTOS = ["Receitas", "Administrativo", "PE&G"] as const;

const fieldClass =
  "h-12 rounded-2xl border-0 bg-white/[0.06] backdrop-blur-xl px-4 text-base text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0 transition";

const selectTriggerClass =
  "h-12 rounded-2xl border-0 bg-white/[0.06] backdrop-blur-xl px-4 text-base text-foreground data-[placeholder]:text-muted-foreground/60 focus:ring-2 focus:ring-primary/40 focus:ring-offset-0 transition";

const Login = () => {
  const { user, loading: authLoading } = useAuth();
  const { config, isLoading: tenantLoading } = useTenantConfig();
  const logo = config.client_logo_url || defaultLogo;
  const clientName = config.client_name || "V4 Company";
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [cargo, setCargo] = useState<string>("");
  const [departamento, setDepartamento] = useState<string>("");
  const { toast } = useToast();

  if (authLoading || tenantLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({
        title: "Erro ao entrar",
        description:
          error.message === "Invalid login credentials"
            ? "Email ou senha incorretos"
            : error.message === "Email not confirmed"
              ? "Confirme seu email antes de entrar"
              : error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cargo || !departamento) {
      toast({
        title: "Preencha cargo e área",
        description: "Selecione as duas opções para continuar.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("full_name") as string;

    let tenantId: string | null = null;
    try {
      const host = window.location.hostname.toLowerCase();
      const rpcClient = supabase as unknown as {
        rpc: (
          fn: "resolve_tenant_by_hostname",
          args: { _hostname: string },
        ) => Promise<{ data: Array<{ id: string }> | null }>;
      };
      const { data: domainTenant } = await rpcClient.rpc("resolve_tenant_by_hostname", {
        _hostname: host,
      });
      tenantId = domainTenant?.[0]?.id ?? null;
    } catch (err) {
      console.warn("[signup] tenant lookup falhou, usando fallback:", err);
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          ...(cargo ? { cargo } : {}),
          ...(departamento ? { departamento } : {}),
          ...(tenantId ? { tenant_id: tenantId } : {}),
        },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast({
        title: "Erro ao cadastrar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setSignupSuccess(true);
    }
    setLoading(false);
  };

  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        <BackgroundAurora />
        <div className="relative w-full max-w-sm rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-8 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
          <img src={logo} alt={clientName} className="h-12 mx-auto mb-5 object-contain" />
          <h2 className="text-xl font-semibold text-foreground tracking-tight">Cadastro realizado</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Verifique seu email para confirmar a conta. Depois disso, um administrador precisa aprovar seu acesso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <BackgroundAurora />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt={clientName} className="h-14 object-contain mb-3" />
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
          </p>
        </div>

        {/* iOS segmented control */}
        <div className="mx-auto mb-5 inline-flex w-full p-1 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/5">
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-xl transition-all",
                mode === m
                  ? "bg-white/10 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground/80",
              )}
            >
              {m === "login" ? "Entrar" : "Cadastrar"}
            </button>
          ))}
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <Field id="login-email" label="Email" name="email" type="email" required placeholder="seu@email.com" />
              <Field id="login-password" label="Senha" name="password" type="password" required placeholder="••••••••" />
              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-muted-foreground hover:text-foreground transition underline-offset-4 hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
              <SubmitButton loading={loading} label="Entrar" loadingLabel="Entrando..." />
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-3">
              <Field id="signup-name" label="Nome completo" name="full_name" required placeholder="Seu nome" />
              <Field id="signup-email" label="Email" name="email" type="email" required placeholder="seu@email.com" />
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  id="signup-cargo"
                  label="Cargo"
                  placeholder="Selecione"
                  value={cargo}
                  onChange={setCargo}
                  options={CARGOS as unknown as string[]}
                />
                <SelectField
                  id="signup-dep"
                  label="Área"
                  placeholder="Selecione"
                  value={departamento}
                  onChange={setDepartamento}
                  options={DEPARTAMENTOS as unknown as string[]}
                />
              </div>
              <Field
                id="signup-password"
                label="Senha"
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
              />
              <SubmitButton loading={loading} label="Cadastrar" loadingLabel="Cadastrando..." />
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          {mode === "login" ? "Novo por aqui? " : "Já tem conta? "}
          <button
            type="button"
            className="text-foreground/80 underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
};

const SelectField = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-xs font-medium text-muted-foreground pl-1">
      {label}
    </Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className={selectTriggerClass}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-2xl border-white/10 bg-popover/95 backdrop-blur-xl max-h-72">
        {options.map((opt) => (
          <SelectItem key={opt} value={opt} className="rounded-xl text-sm">
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const Field = ({
  id,
  label,
  ...props
}: { id: string; label: string } & React.ComponentProps<typeof Input>) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-xs font-medium text-muted-foreground pl-1">
      {label}
    </Label>
    <Input id={id} className={fieldClass} {...props} />
  </div>
);

const SubmitButton = ({
  loading,
  label,
  loadingLabel,
}: {
  loading: boolean;
  label: string;
  loadingLabel: string;
}) => (
  <Button
    type="submit"
    disabled={loading}
    className="w-full h-12 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.5)] transition-all active:scale-[0.98]"
  >
    {loading ? loadingLabel : label}
  </Button>
);

const BackgroundAurora = () => (
  <>
    <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-[hsl(0_85%_55%/0.18)] blur-[120px]" />
    <div className="pointer-events-none absolute -bottom-32 -right-24 h-[420px] w-[420px] rounded-full bg-[hsl(12_80%_50%/0.12)] blur-[120px]" />
  </>
);

export default Login;
