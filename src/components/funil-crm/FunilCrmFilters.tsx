import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MultiSelect } from "@/components/ui/multi-select";
import { Calendar as CalendarIcon, ChevronDown, ChevronUp, Inbox, Send, Users } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { CrmFunnelFilters, CrmUniqueValues, Lente, Pipe } from "@/utils/crmFunnelCalculator";

export interface FunilCrmFiltersState {
  startDate: string;
  endDate: string;
  pipe: Pipe;
  lente: Lente;
  filters: CrmFunnelFilters;
}

interface Props {
  state: FunilCrmFiltersState;
  setState: (patch: Partial<FunilCrmFiltersState>) => void;
  setFilter: <K extends keyof CrmFunnelFilters>(key: K, value: CrmFunnelFilters[K]) => void;
  uniqueValues: CrmUniqueValues;
}

const fmtDate = (s: string) =>
  s ? format(new Date(s + "T00:00:00"), "dd/MM/yyyy", { locale: pt }) : "Selecione";

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

const monthRange = (offset: number) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
  return { start: ymd(start), end: ymd(end) };
};

const FunilCrmFilters = ({ state, setState, setFilter, uniqueValues }: Props) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const setRange = (start: string, end: string) =>
    setState({ startDate: start, endDate: end });

  const presets = [
    { label: "Mês Atual", run: () => { const r = monthRange(0); setRange(r.start, r.end); } },
    { label: "Mês Passado", run: () => { const r = monthRange(1); setRange(r.start, r.end); } },
    { label: "Últimos 3 meses", run: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        setRange(ymd(start), ymd(now));
      },
    },
    { label: "Últimos 6 meses", run: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        setRange(ymd(start), ymd(now));
      },
    },
    { label: "Ano Atual", run: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        setRange(ymd(start), ymd(now));
      },
    },
    { label: "Ano Passado", run: () => {
        const y = new Date().getFullYear() - 1;
        setRange(ymd(new Date(y, 0, 1)), ymd(new Date(y, 11, 31)));
      },
    },
    { label: "Período Total", run: () => {
        const now = new Date();
        const start = new Date(now);
        start.setFullYear(start.getFullYear() - 2);
        setRange(ymd(start), ymd(now));
      },
    },
  ];

  const f = state.filters;
  const activeCount =
    (f.origem?.length ?? 0 ? 1 : 0) +
    (f.tier?.length ?? 0 ? 1 : 0) +
    (f.urgencia?.length ?? 0 ? 1 : 0) +
    (f.segmento?.length ?? 0 ? 1 : 0) +
    (f.canal?.length ?? 0 ? 1 : 0) +
    (f.qualificacao?.length ?? 0 ? 1 : 0) +
    (f.responsavelId?.length ?? 0 ? 1 : 0) +
    (f.temperatura?.length ?? 0 ? 1 : 0) +
    (f.tipoProduto?.length ?? 0 ? 1 : 0) +
    (f.estado?.length ?? 0 ? 1 : 0) +
    (f.pais?.length ?? 0 ? 1 : 0) +
    (f.faturamento?.length ?? 0 ? 1 : 0);

  const clearAll = () => {
    const r = monthRange(0);
    setState({
      startDate: r.start,
      endDate: r.end,
      pipe: "todos",
      lente: "evento",
      filters: {},
    });
  };

  const PipeBtn = ({ value, icon: Icon, label }: { value: Pipe; icon: any; label: string }) => (
    <button
      onClick={() => setState({ pipe: value })}
      className={cn(
        "h-9 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 transition-all",
        state.pipe === value
          ? "bg-foreground text-background shadow-ios-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-surface-2/60",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  const LenteBtn = ({ value, label, hint }: { value: Lente; label: string; hint: string }) => (
    <button
      onClick={() => setState({ lente: value })}
      title={hint}
      className={cn(
        "h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all",
        state.lente === value
          ? "bg-primary text-primary-foreground shadow-ios-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-surface-2/60",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-4 lg:p-6">
      {/* Linha 1: presets + advanced toggle */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <Button key={p.label} size="sm" variant="outline" onClick={p.run} className="h-8 text-xs">
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Button size="sm" variant="ghost" onClick={clearAll} className="h-8 text-xs">
              Limpar
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAdvanced((v) => !v)}
            className="h-8 text-xs gap-2"
          >
            Filtros Avançados
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {activeCount > 0 && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] ml-1">
                {activeCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Linha 2: datas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4 mb-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Data Início</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-9 w-full justify-start text-left font-normal border-border/50 bg-background text-sm",
                  !state.startDate && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {fmtDate(state.startDate)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={state.startDate ? new Date(state.startDate + "T00:00:00") : undefined}
                onSelect={(d) => d && setState({ startDate: ymd(d) })}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Data Fim</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-9 w-full justify-start text-left font-normal border-border/50 bg-background text-sm",
                  !state.endDate && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {fmtDate(state.endDate)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={state.endDate ? new Date(state.endDate + "T00:00:00") : undefined}
                onSelect={(d) => d && setState({ endDate: ymd(d) })}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Linha 3: pipe + lente */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl glass shadow-ios-sm">
          <PipeBtn value="todos" icon={Users} label="Todos" />
          <PipeBtn value="inbound" icon={Inbox} label="Inbound" />
          <PipeBtn value="outbound" icon={Send} label="Outbound" />
        </div>
        <div className="inline-flex items-center gap-1 p-1 rounded-xl glass shadow-ios-sm">
          <LenteBtn
            value="evento"
            label="Por evento"
            hint="Cada etapa conta na data do seu próprio evento"
          />
          <LenteBtn
            value="coorte"
            label="Por coorte"
            hint="Conta a safra de leads que entraram no período"
          />
        </div>
      </div>

      {/* Linha 4: Multi-selects principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4">
        <FilterMS label="Origem" selected={f.origem ?? []} options={uniqueValues.origens} onChange={(v) => setFilter("origem", v)} />
        <FilterMS label="Tier" selected={f.tier ?? []} options={uniqueValues.tiers} onChange={(v) => setFilter("tier", v)} />
        <FilterMS label="Urgência" selected={f.urgencia ?? []} options={uniqueValues.urgencias} onChange={(v) => setFilter("urgencia", v)} />
        <FilterMS label="Segmento" selected={f.segmento ?? []} options={uniqueValues.segmentos} onChange={(v) => setFilter("segmento", v)} />
        <FilterMS label="Canal" selected={f.canal ?? []} options={uniqueValues.canais} onChange={(v) => setFilter("canal", v)} />
        <FilterMS label="Qualificação" selected={f.qualificacao ?? []} options={uniqueValues.qualificacoes} onChange={(v) => setFilter("qualificacao", v)} />
        <FilterMS label="Responsável" selected={f.responsavelId ?? []} options={uniqueValues.responsaveis} onChange={(v) => setFilter("responsavelId", v)} />
      </div>

      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-border/30 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4 animate-in fade-in duration-300">
          <FilterMS label="Temperatura" selected={f.temperatura ?? []} options={uniqueValues.temperaturas} onChange={(v) => setFilter("temperatura", v)} />
          <FilterMS label="Tipo de Produto" selected={f.tipoProduto ?? []} options={uniqueValues.tiposProduto} onChange={(v) => setFilter("tipoProduto", v)} />
          <FilterMS label="Estado" selected={f.estado ?? []} options={uniqueValues.estados} onChange={(v) => setFilter("estado", v)} />
          <FilterMS label="País" selected={f.pais ?? []} options={uniqueValues.paises} onChange={(v) => setFilter("pais", v)} />
          <FilterMS label="Faturamento" selected={f.faturamento ?? []} options={uniqueValues.faturamentos} onChange={(v) => setFilter("faturamento", v)} />
        </div>
      )}
    </div>
  );
};

const FilterMS = ({
  label,
  selected,
  options,
  onChange,
}: {
  label: string;
  selected: string[];
  options: { value: string; label: string; count: number }[];
  onChange: (v: string[]) => void;
}) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-muted-foreground">
      {label}
      {selected.length > 0 && (
        <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
          {selected.length}
        </Badge>
      )}
    </label>
    <MultiSelect options={options} selected={selected} onChange={onChange} placeholder="Todos" />
  </div>
);

export default FunilCrmFilters;
