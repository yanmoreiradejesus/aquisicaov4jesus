import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProfileLite } from "@/hooks/useProfilesList";
import { profileLabel } from "@/hooks/useProfilesList";

export interface AccountFieldsValue {
  squad?: "strikers" | "fenix" | "saber" | null;
  mrr?: number | null;
  mrr_variavel?: number | null;
  gt_id?: string | null;
  designer_id?: string | null;
  social_media_id?: string | null;
  playbook_url?: string | null;
  growthpack_url?: string | null;
  drive_url?: string | null;
  ekyte_workspace_id?: number | null;
}

export interface ScopeItem {
  item: string;
  quantidade: number;
  ordem: number;
}

interface Props {
  value: AccountFieldsValue;
  onChange: (patch: Partial<AccountFieldsValue>) => void;
  profiles: ProfileLite[];
  scope: ScopeItem[];
  onScopeChange: (next: ScopeItem[]) => void;
}

export function AccountManagementFields({ value, onChange, profiles, scope, onScopeChange }: Props) {
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
      <div className="rounded-lg border border-border/40 bg-background/40 p-4 space-y-4">
        <div>
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
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">MRR (R$)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="mt-1.5"
              value={value.mrr ?? ""}
              onChange={(e) => onChange({ mrr: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">MRR variável (R$)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="mt-1.5"
              value={value.mrr_variavel ?? ""}
              onChange={(e) =>
                onChange({ mrr_variavel: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </div>
        </div>
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

      <div className="rounded-lg border border-border/40 bg-background/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold tracking-[-0.01em] text-foreground/90">
            Escopo contratado / mês
          </h3>
          {!value.squad && (
            <span className="text-[11px] text-muted-foreground">Selecione o squad primeiro</span>
          )}
        </div>
        {scope.length === 0 ? (
          <p className="text-[12px] text-muted-foreground py-2">
            Nenhum entregável configurado para este squad.
          </p>
        ) : (
          <div className="space-y-2">
            {scope.map((s, i) => (
              <div key={s.item} className="flex items-center gap-3">
                <span className="flex-1 text-[13px] text-foreground/90">{s.item}</span>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  className="w-24 text-right tabular-nums"
                  value={s.quantidade}
                  onChange={(e) => {
                    const v = e.target.value === "" ? 0 : Number(e.target.value);
                    const next = [...scope];
                    next[i] = { ...next[i], quantidade: v };
                    onScopeChange(next);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
