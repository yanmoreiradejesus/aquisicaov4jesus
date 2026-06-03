import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useProfilesList } from "@/hooks/useProfilesList";

export interface AtividadesFiltersValue {
  start: string; // yyyy-mm-dd
  end: string;
  pipe: "all" | "inbound" | "outbound";
  userId: "all" | string;
}

interface Props {
  value: AtividadesFiltersValue;
  onChange: (v: AtividadesFiltersValue) => void;
  onReset: () => void;
}

export const AtividadesFilters = ({ value, onChange, onReset }: Props) => {
  const { profiles } = useProfilesList({ departamento: "Receitas" });

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 flex flex-wrap items-end gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">De</Label>
        <Input
          type="date"
          value={value.start}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
          className="w-[160px]"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Até</Label>
        <Input
          type="date"
          value={value.end}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
          className="w-[160px]"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Pipe</Label>
        <Select
          value={value.pipe}
          onValueChange={(v) => onChange({ ...value, pipe: v as any })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Usuário</Label>
        <Select
          value={value.userId}
          onValueChange={(v) => onChange({ ...value, userId: v })}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name || p.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button variant="ghost" size="sm" onClick={onReset}>
        Limpar
      </Button>
    </div>
  );
};
