import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarIcon, Inbox, Send, Users } from "lucide-react";
import { format, subDays } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useProfilesList } from "@/hooks/useProfilesList";

export interface AtividadesFiltersValue {
  start: string;
  end: string;
  pipe: "all" | "inbound" | "outbound";
  userId: "all" | string;
}

interface Props {
  value: AtividadesFiltersValue;
  onChange: (v: AtividadesFiltersValue) => void;
  onReset: () => void;
}

const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const fmtDate = (s: string) =>
  s ? format(new Date(s + "T00:00:00"), "dd/MM/yyyy", { locale: pt }) : "Selecione";

const monthRange = (offset: number) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
  return { start: ymd(start), end: ymd(end) };
};

export const AtividadesFilters = ({ value, onChange, onReset }: Props) => {
  const { profiles } = useProfilesList({ departamento: "Receitas" });

  const setRange = (start: string, end: string) =>
    onChange({ ...value, start, end });

  const presets = [
    { label: "7 dias", run: () => setRange(ymd(subDays(new Date(), 6)), ymd(new Date())) },
    { label: "30 dias", run: () => setRange(ymd(subDays(new Date(), 29)), ymd(new Date())) },
    { label: "Mês atual", run: () => { const r = monthRange(0); setRange(r.start, r.end); } },
    { label: "Mês passado", run: () => { const r = monthRange(1); setRange(r.start, r.end); } },
    { label: "Últimos 3 meses", run: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        setRange(ymd(start), ymd(now));
      },
    },
    { label: "Ano atual", run: () => {
        const now = new Date();
        setRange(ymd(new Date(now.getFullYear(), 0, 1)), ymd(now));
      },
    },
  ];

  const PipeBtn = ({ v, icon: Icon, label }: { v: "all" | "inbound" | "outbound"; icon: any; label: string }) => (
    <button
      onClick={() => onChange({ ...value, pipe: v })}
      className={cn(
        "h-9 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 transition-all",
        value.pipe === v
          ? "bg-foreground text-background shadow-ios-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-surface-2/60",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  return (
    <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-4 lg:p-6">
      {/* Presets + limpar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <Button key={p.label} size="sm" variant="outline" onClick={p.run} className="h-8 text-xs">
              {p.label}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={onReset} className="h-8 text-xs">
          Limpar
        </Button>
      </div>

      {/* Datas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4 mb-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Data Início</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 w-full justify-start text-left font-normal border-border/50 bg-background text-sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {fmtDate(value.start)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value.start ? new Date(value.start + "T00:00:00") : undefined}
                onSelect={(d) => d && onChange({ ...value, start: ymd(d) })}
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
              <Button variant="outline" className="h-9 w-full justify-start text-left font-normal border-border/50 bg-background text-sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {fmtDate(value.end)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value.end ? new Date(value.end + "T00:00:00") : undefined}
                onSelect={(d) => d && onChange({ ...value, end: ymd(d) })}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Pipe + usuário */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl glass shadow-ios-sm">
          <PipeBtn v="all" icon={Users} label="Todos" />
          <PipeBtn v="inbound" icon={Inbox} label="Inbound" />
          <PipeBtn v="outbound" icon={Send} label="Outbound" />
        </div>
        <div className="min-w-[220px]">
          <Select value={value.userId} onValueChange={(v) => onChange({ ...value, userId: v })}>
            <SelectTrigger className="h-9 bg-background border-border/50 text-sm">
              <SelectValue placeholder="Usuário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os usuários</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
