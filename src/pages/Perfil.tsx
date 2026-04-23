import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { User, Camera, Loader2 } from "lucide-react";
import { VoipAccountsCard } from "@/components/VoipAccountsCard";
import { GoogleSyncCard } from "@/components/GoogleSyncCard";

const Perfil = () => {
  const { user, profile, loading } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [telefone, setTelefone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setTelefone(profile.telefone ?? "");
      setAvatarUrl(profile.avatar_url ?? null);
    }
  }, [profile]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null, telefone: telefone.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado" });
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Envie uma imagem", variant: "destructive" });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (upErr) {
      setUploading(false);
      toast({ title: "Erro no upload", description: upErr.message, variant: "destructive" });
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = data.publicUrl;

    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);
    setUploading(false);

    if (updErr) {
      toast({ title: "Erro", description: updErr.message, variant: "destructive" });
    } else {
      setAvatarUrl(publicUrl);
      toast({ title: "Foto atualizada" });
    }
  };

  const initials = (fullName || profile.email)
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 lg:px-8 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-6">
          <User className="h-6 w-6" /> Meu Perfil
        </h1>

        <Card>
          <CardHeader>
            <CardTitle>Dados pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
                  <AvatarFallback className="bg-primary/15 text-primary text-lg font-semibold">
                    {initials || "?"}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:scale-105 transition-transform disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAvatarUpload(f);
                    e.target.value = "";
                  }}
                />
              </div>
              <div>
                <p className="font-medium text-foreground">{profile.email}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {profile.cargo && (
                    <Badge variant="secondary" className="text-xs">
                      {profile.cargo}
                    </Badge>
                  )}
                  {profile.departamento && (
                    <Badge variant="outline" className="text-xs">
                      {profile.departamento}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Editáveis */}
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome completo</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="text-xs text-muted-foreground">
              Cargo, departamento e e-mail são gerenciados pelo administrador.
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar alterações
            </Button>
          </CardContent>
        </Card>

        <div className="mt-6">
          <GoogleSyncCard />
        </div>

        <div className="mt-6">
          <VoipAccountsCard userId={user.id} />
        </div>
      </div>
    </div>
  );
};

export default Perfil;
