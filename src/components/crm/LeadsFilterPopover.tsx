import { useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, X } from "lucide-react";
import { LEAD_ETAPAS } from "@/hooks/useCrmLeads";
import { DateRange } from "@/components/crm/OportunidadesFilterPopover";

export interface LeadFilters {
  dateFrom: string;
  dateTo: string;
  etapa: string;
  origem: string;
  canal: string;
  tier: string;
  responsavel: string;
  temperatura: string;
  estado: string;
  segmento: string;
}

export const EMPTY_FILTERS: LeadFilters = {
  dateFrom: "",
  dateTo: "",
  etapa: "all",
  origem: "all",
  canal: "all",
  tier: "all",
  responsavel: "all",
  temperatura: "all",
  estado: "all",
  segmento: "all",
};

interface Props {
  filters: LeadFilters;
  onChange: (f: LeadFilters) => void;
  leads: any[];
}

export const LeadsFilterPopover = ({ filters, onChange, leads }: Props) => {
  const uniques = useMemo(() => {
    const get = (key: string) =>
      Array.from(new Set(leads.map((l: any) => l[key]).filter((v: any) => v && String(v).trim())))
        .sort()
        .map((v) => String(v));
    return {
      origem: get("origem"),
      canal: get("canal"),
      tier: get("tier"),
      responsavel: get("responsavel_id"),
      temperatura: get("temperatura"),
      estado: get("estado"),
      segmento: get("segmento"),
    };
  }, [leads]);

  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === "dateFrom" || k === "dateTo") return !!v;
    return v && v !== "all";
  }).length;

  const update = (patch: Partial<LeadFilters>) => onChange({ ...filters, ...patch });
  const clear = () => onChange(EMPTY_FILTERS);

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
      <PopoverContent align="end" className="w-[360px] p-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">Filtrar leads</h4>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clear}>
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <DateRange
            label="Data de criação do lead"
            from={filters.dateFrom}
            to={filters.dateTo}
            onFrom={(v) => update({ dateFrom: v })}
            onTo={(v) => update({ dateTo: v })}
          />

          <FilterSelect
            label="Etapa"
            value={filters.etapa}
            options={LEAD_ETAPAS.map((e) => ({ value: e.id, label: e.label }))}
            onChange={(v) => update({ etapa: v })}
          />
          <FilterSelect label="Origem" value={filters.origem} options={uniques.origem} onChange={(v) => update({ origem: v })} />
          <FilterSelect label="Canal" value={filters.canal} options={uniques.canal} onChange={(v) => update({ canal: v })} />
          <FilterSelect label="Tier" value={filters.tier} options={uniques.tier} onChange={(v) => update({ tier: v })} />
          <FilterSelect label="Temperatura" value={filters.temperatura} options={uniques.temperatura} onChange={(v) => update({ temperatura: v })} />
          <FilterSelect label="Segmento" value={filters.segmento} options={uniques.segmento} onChange={(v) => update({ segmento: v })} />
          <FilterSelect label="Estado" value={filters.estado} options={uniques.estado} onChange={(v) => update({ estado: v })} />
        </div>
      </PopoverContent>
    </Popover>
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
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
