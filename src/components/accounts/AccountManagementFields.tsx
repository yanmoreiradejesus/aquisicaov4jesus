import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProfileLite } from "@/hooks/useProfilesList";
import { profileLabel } from "@/hooks/useProfilesList";

export interface AccountFieldsValue {
  squad?: "strikers" | "fenix" | "saber" | null;
  gt_id?: string | null;
  designer_id?: string | null;
  social_media_id?: string | null;
  playbook_url?: string | null;
  growthpack_url?: string | null;
  drive_url?: string | null;
  ekyte_workspace_id?: number | null;
}

interface Props {
  value: AccountFieldsValue;
  onChange: (patch: Partial<AccountFieldsValue>) => void;
  profiles: ProfileLite[];
}

export function AccountManagementFields({ value, onChange, profiles }: Props) {
  const teamFields: { key: keyof AccountFieldsValue; label: string }[] = [
    { key: "gt_id", label: "GT (Gestor de Tráfego)" },
    { key: "designer_id", label: "Designer" },
    { key: "social_media_id", label: "Social Media" },
  ];
  const linkFields: { key: keyof AccountFieldsValue; label: string }[] = [
    { key: "playbook_url", label: "Playbook" },
    { key: "growthpack_url", label: "Growthpack" },
    { key: "drive_url", label: "Drive" },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border/40 bg-background/40 p-4">
        <Label className="text-xs text-muted-foreground">Squad</Label>
        <Select
          value={value.squad ?? "none"}
          onValueChange={(v) => onChange({ squad: v === "none" ? null : (v as any) })}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder="Selecione o squad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem squad</SelectItem>
            <SelectItem value="strikers">Strikers</SelectItem>
            <SelectItem value="fenix">Fênix</SelectItem>
            <SelectItem value="saber">Saber</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground mt-2">
          MRR e escopo contratado agora vêm automaticamente da oportunidade e do cadastro do projeto.
        </p>
      </div>

      <div className="rounded-lg border border-border/40 bg-background/40 p-4 space-y-3">
        <h3 className="font-display text-sm font-semibold tracking-[-0.01em] text-foreground/90">Time</h3>
        {teamFields.map((f) => (
          <div key={f.key as string}>
            <Label className="text-xs text-muted-foreground">{f.label}</Label>
            <Select
              value={(value[f.key] as string) ?? "none"}
              onValueChange={(v) => onChange({ [f.key]: v === "none" ? null : v } as any)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{profileLabel(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border/40 bg-background/40 p-4 space-y-3">
        <h3 className="font-display text-sm font-semibold tracking-[-0.01em] text-foreground/90">Links</h3>
        {linkFields.map((f) => (
          <div key={f.key as string}>
            <Label className="text-xs text-muted-foreground">{f.label}</Label>
            <Input
              type="url"
              placeholder="https://..."
              className="mt-1.5"
              value={(value[f.key] as string) ?? ""}
              onChange={(e) => onChange({ [f.key]: e.target.value || null } as any)}
            />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border/40 bg-background/40 p-4">
        <Label className="text-xs text-muted-foreground">eKyte workspace ID</Label>
        <Input
          type="number"
          className="mt-1.5"
          value={value.ekyte_workspace_id ?? ""}
          onChange={(e) =>
            onChange({ ekyte_workspace_id: e.target.value === "" ? null : Number(e.target.value) })
          }
        />
        <p className="text-[11px] text-muted-foreground mt-1.5">Usado na integração eKyte.</p>
      </div>
    </div>
  );
}
