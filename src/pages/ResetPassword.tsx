import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import defaultLogo from "@/assets/v4-logo.png";
import { useTenantConfig } from "@/hooks/useTenantConfig";

const fieldClass =
  "h-12 rounded-2xl border-0 bg-white/[0.06] backdrop-blur-xl px-4 text-base text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0 transition";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config } = useTenantConfig();
  const logo = config.client_logo_url || defaultLogo;
  const clientName = config.client_name || "V4 Company";
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase emite SIGNED_IN/PASSWORD_RECOVERY ao seguir o link de recovery
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Caso a sessão já esteja restaurada (refresh)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const password = fd.get("password") as string;
    const confirm = fd.get("confirm") as string;
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Use no mínimo 6 caracteres", variant: "destructive" });
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao atualizar senha", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Senha atualizada", description: "Você já pode entrar com a nova senha." });
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-[hsl(0_85%_55%/0.18)] blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-[420px] w-[420px] rounded-full bg-[hsl(12_80%_50%/0.12)] blur-[120px]" />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt={clientName} className="h-14 object-contain mb-3" />
          <p className="text-sm text-muted-foreground">Definir nova senha</p>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
          {!ready ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Abra esta página pelo link enviado no seu email para redefinir a senha.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs font-medium text-muted-foreground pl-1">
                  Nova senha
                </Label>
                <Input id="new-password" name="password" type="password" required minLength={6} className={fieldClass} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs font-medium text-muted-foreground pl-1">
                  Confirmar senha
                </Label>
                <Input id="confirm-password" name="confirm" type="password" required minLength={6} className={fieldClass} placeholder="Repita a senha" />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.5)] transition-all active:scale-[0.98]"
              >
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
