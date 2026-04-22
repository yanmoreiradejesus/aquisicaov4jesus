import { useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OportunidadeFilters {
  opDateFrom: string;
  opDateTo: string;
  leadDateFrom: string;
  leadDateTo: string;
  responsavel: string;
  temperatura: string;
  canal: string;
  tier: string;
}

export const EMPTY_OP_FILTERS: OportunidadeFilters = {
  opDateFrom: "",
  opDateTo: "",
  leadDateFrom: "",
  leadDateTo: "",
  responsavel: "all",
  temperatura: "all",
  canal: "all",
  tier: "all",
};

const TEMPERATURA_OPTS: Array<{ value: string; label: string; dot: string }> = [
  { value: "quente", label: "Quente", dot: "bg-red-500" },
  { value: "morno", label: "Morno", dot: "bg-amber-500" },
  { value: "frio", label: "Frio", dot: "bg-sky-500" },
];

interface Props {
  filters: OportunidadeFilters;
  onChange: (f: OportunidadeFilters) => void;
  oportunidades: any[];
}

export const OportunidadesFilterPopover = ({ filters, onChange, oportunidades }: Props) => {
  const uniques = useMemo(() => {
    const getStr = (fn: (op: any) => any) =>
      Array.from(new Set(oportunidades.map(fn).filter((v: any) => v && String(v).trim())))
        .sort()
        .map((v) => String(v));

    const respMap = new Map<string, string>();
    oportunidades.forEach((op: any) => {
      const id = op.responsavel_id || op.responsavel?.id;
      if (!id) return;
      const label = op.responsavel?.full_name || op.responsavel?.email || id;
      if (!respMap.has(id)) respMap.set(id, label);
    });
    const responsavel = Array.from(respMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      canal: getStr((op) => op.lead?.canal),
      tier: getStr((op) => op.lead?.tier),
      responsavel,
    };
  }, [oportunidades]);

  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k.endsWith("DateFrom") || k.endsWith("DateTo")) return !!v;
    return v && v !== "all";
  }).length;

  const update = (patch: Partial<OportunidadeFilters>) => onChange({ ...filters, ...patch });
  const clear = () => onChange(EMPTY_OP_FILTERS);

  const toggleTemperatura = (val: string) => {
    update({ temperatura: filters.temperatura === val ? "all" : val });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-9 rounded-xl hover:bg-surface-2/80 relative">
          <Filter className="h-4 w-4 mr-1.5" /> Filtros
          {activeCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">Filtrar oportunidades</h4>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clear}>
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <DateRange
            label="Criação da oportunidade"
            from={filters.opDateFrom}
            to={filters.opDateTo}
            onFrom={(v) => update({ opDateFrom: v })}
            onTo={(v) => update({ opDateTo: v })}
          />
          <DateRange
            label="Criação do lead"
            from={filters.leadDateFrom}
            to={filters.leadDateTo}
            onFrom={(v) => update({ leadDateFrom: v })}
            onTo={(v) => update({ leadDateTo: v })}
          />

          <div>
            <Label className="text-xs text-muted-foreground">Temperatura</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {TEMPERATURA_OPTS.map((t) => {
                const active = filters.temperatura === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => toggleTemperatura(t.value)}
                    className={cn(
                      "h-9 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 border transition-all",
                      active
                        ? "border-primary bg-primary/10 text-foreground shadow-ios-sm"
                        : "border-border bg-surface-2/40 text-muted-foreground hover:text-foreground hover:bg-surface-2/80"
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", t.dot)} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <FilterSelect
            label="Responsável"
            value={filters.responsavel}
            options={uniques.responsavel}
            onChange={(v) => update({ responsavel: v })}
          />
          <FilterSelect
            label="Canal (lead)"
            value={filters.canal}
            options={uniques.canal}
            onChange={(v) => update({ canal: v })}
          />
          <FilterSelect
            label="Tier (lead)"
            value={filters.tier}
            options={uniques.tier}
            onChange={(v) => update({ tier: v })}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

const fmt = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const buildPresets = (): Array<{ key: string; label: string; range: () => [string, string] }> => {
  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return [
    { key: "today", label: "Hoje", range: () => [fmt(today), fmt(today)] },
    {
      key: "yesterday",
      label: "Ontem",
      range: () => {
        const y = startOfDay(today);
        y.setDate(y.getDate() - 1);
        return [fmt(y), fmt(y)];
      },
    },
    {
      key: "7d",
      label: "Últimos 7 dias",
      range: () => {
        const f = startOfDay(today);
        f.setDate(f.getDate() - 6);
        return [fmt(f), fmt(today)];
      },
    },
    {
      key: "30d",
      label: "Últimos 30 dias",
      range: () => {
        const f = startOfDay(today);
        f.setDate(f.getDate() - 29);
        return [fmt(f), fmt(today)];
      },
    },
    {
      key: "thisMonth",
      label: "Mês atual",
      range: () => {
        const f = new Date(today.getFullYear(), today.getMonth(), 1);
        return [fmt(f), fmt(today)];
      },
    },
    {
      key: "lastMonth",
      label: "Mês passado",
      range: () => {
        const f = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const t = new Date(today.getFullYear(), today.getMonth(), 0);
        return [fmt(f), fmt(t)];
      },
    },
    {
      key: "90d",
      label: "Últimos 90 dias",
      range: () => {
        const f = startOfDay(today);
        f.setDate(f.getDate() - 89);
        return [fmt(f), fmt(today)];
      },
    },
    {
      key: "thisYear",
      label: "Este ano",
      range: () => {
        const f = new Date(today.getFullYear(), 0, 1);
        return [fmt(f), fmt(today)];
      },
    },
  ];
};

const DateRange = ({
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) => {
  const presets = useMemo(buildPresets, []);
  const activePreset = useMemo(() => {
    if (!from && !to) return "";
    return presets.find((p) => {
      const [pf, pt] = p.range();
      return pf === from && pt === to;
    })?.key ?? "custom";
  }, [from, to, presets]);

  const apply = (key: string) => {
    if (key === "clear") {
      onFrom("");
      onTo("");
      return;
    }
    const p = presets.find((x) => x.key === key);
    if (!p) return;
    const [f, t] = p.range();
    onFrom(f);
    onTo(t);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {(from || to) && (
          <button
            type="button"
            onClick={() => apply("clear")}
            className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
          >
            <X className="h-3 w-3" /> limpar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1 mt-1.5">
        {presets.map((p) => {
          const active = activePreset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => apply(p.key)}
              className={cn(
                "h-7 px-2.5 rounded-md text-[11px] font-medium border transition-all",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-surface-2/40 text-muted-foreground hover:text-foreground hover:bg-surface-2/80"
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <Input
          type="date"
          value={from}
          onChange={(e) => onFrom(e.target.value)}
          className="h-9 text-xs"
          placeholder="De"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => onTo(e.target.value)}
          className="h-9 text-xs"
          placeholder="Até"
        />
      </div>
    </div>
  );
};

const FilterSelect = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<string | { value: string; label: string }>;
  onChange: (v: string) => void;
}) => {
  if (options.length === 0) return null;
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-popover z-50">
          <SelectItem value="all">Todos</SelectItem>
          {opts.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
