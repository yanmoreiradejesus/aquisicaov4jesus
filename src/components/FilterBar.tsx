import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";
import { Calendar as CalendarIcon, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ValueWithCount } from "@/utils/dataProcessor";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
interface FilterBarProps {
  filters: {
    startDate: string;
    endDate: string;
    canal: string[];
    tier: string[];
    urgency: string[];
    cargo: string[];
    periodo: string[];
    emailType: string;
    hasDescription: string;
  };
  onFilterChange: (key: string, value: string | string[]) => void;
  uniqueValues: {
    canais: ValueWithCount[];
    tiers: ValueWithCount[];
    urgencias: ValueWithCount[];
    cargos: ValueWithCount[];
    periodos: ValueWithCount[];
  };
}
const FilterBar = ({
  filters,
  onFilterChange,
  uniqueValues
}: FilterBarProps) => {
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const getCurrentMonthRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };
  const getDatePreset = (preset: string) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    switch (preset) {
      case 'last7':
        const last7 = new Date(now);
        last7.setDate(last7.getDate() - 7);
        return {
          start: last7.toISOString().split('T')[0],
          end: today
        };
      case 'last30':
        const last30 = new Date(now);
        last30.setDate(last30.getDate() - 30);
        return {
          start: last30.toISOString().split('T')[0],
          end: today
        };
      case 'lastQuarter':
        const lastQuarter = new Date(now);
        lastQuarter.setMonth(lastQuarter.getMonth() - 3);
        return {
          start: lastQuarter.toISOString().split('T')[0],
          end: today
        };
      case 'last6months':
        const last6 = new Date(now);
        last6.setMonth(last6.getMonth() - 6);
        return {
          start: last6.toISOString().split('T')[0],
          end: today
        };
      case 'thisYear':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        return {
          start: yearStart.toISOString().split('T')[0],
          end: today
        };
      case 'lastYear':
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
        return {
          start: lastYearStart.toISOString().split('T')[0],
          end: lastYearEnd.toISOString().split('T')[0]
        };
      default:
        return getCurrentMonthRange();
    }
  };
  const getMonthRange = (monthsAgo: number) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };
  const setMonthPreset = (monthsAgo: number) => {
    const range = getMonthRange(monthsAgo);
    onFilterChange("startDate", range.start);
    onFilterChange("endDate", range.end);
  };
  const setDatePreset = (preset: string) => {
    const range = getDatePreset(preset);
    onFilterChange("startDate", range.start);
    onFilterChange("endDate", range.end);
  };
  const countActiveFilters = () => {
    let count = 0;
    if (filters.canal.length > 0) count++;
    if (filters.tier.length > 0) count++;
    if (filters.urgency.length > 0) count++;
    if (filters.cargo.length > 0) count++;
    if (filters.periodo.length > 0) count++;
    if (filters.emailType !== "all") count++;
    if (filters.hasDescription !== "all") count++;
    return count;
  };
  const clearAllFilters = () => {
    const currentMonth = getCurrentMonthRange();
    onFilterChange("startDate", currentMonth.start);
    onFilterChange("endDate", currentMonth.end);
    onFilterChange("canal", []);
    onFilterChange("tier", []);
    onFilterChange("urgency", []);
    onFilterChange("cargo", []);
    onFilterChange("periodo", []);
    onFilterChange("emailType", "all");
    onFilterChange("hasDescription", "all");
  };
  const setTotalPeriod = () => {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    onFilterChange("startDate", oneYearAgo.toISOString().split('T')[0]);
    onFilterChange("endDate", now.toISOString().split('T')[0]);
  };
  const activeCount = countActiveFilters();
  const hasActiveFilters = activeCount > 0;
  const convertToMultiSelectOptions = (values: ValueWithCount[]): MultiSelectOption[] => {
    return values.map(v => ({
      value: v.value,
      label: v.value,
      count: v.count
    }));
  };
  return <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-4 lg:p-6 transition-all duration-300 hover:shadow-lg">
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Date Presets */}
          <Button size="sm" variant="outline" onClick={() => setMonthPreset(0)} className="h-8 text-xs">
            Mês Atual
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMonthPreset(1)} className="h-8 text-xs">
            Mês Passado
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDatePreset('thisYear')} className="h-8 text-xs">
            Ano Atual
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDatePreset('lastYear')} className="h-8 text-xs">
            Ano Passado
          </Button>
          <Button size="sm" variant="outline" onClick={setTotalPeriod} className="h-8 text-xs">
            Período Total
          </Button>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="h-8 text-xs gap-2"
        >
          Filtros Avançados
          {showAdvancedFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {hasActiveFilters && <Badge variant="secondary" className="h-4 px-1.5 text-[10px] ml-1">
            {activeCount}
          </Badge>}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4 md:grid-cols-3">
        <div className="sm:col-span-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Data Início
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-9 w-full justify-start text-left font-normal border-border/50 bg-background text-sm transition-all duration-300 hover:border-primary",
                  !filters.startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.startDate ? format(new Date(filters.startDate + "T00:00:00"), "dd/MM/yyyy", { locale: pt }) : "Selecione"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.startDate ? new Date(filters.startDate + "T00:00:00") : undefined}
                onSelect={(date) => date && onFilterChange("startDate", format(date, "yyyy-MM-dd"))}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Data Fim
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-9 w-full justify-start text-left font-normal border-border/50 bg-background text-sm transition-all duration-300 hover:border-primary",
                  !filters.endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.endDate ? format(new Date(filters.endDate + "T00:00:00"), "dd/MM/yyyy", { locale: pt }) : "Selecione"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.endDate ? new Date(filters.endDate + "T00:00:00") : undefined}
                onSelect={(date) => date && onFilterChange("endDate", format(date, "yyyy-MM-dd"))}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {showAdvancedFilters && (
        <div className="mt-4 pt-4 border-t border-border/30 grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4 md:grid-cols-3 animate-in fade-in duration-300">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Canal {filters.canal.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{filters.canal.length}</Badge>}
            </label>
          <MultiSelect options={convertToMultiSelectOptions(uniqueValues.canais)} selected={filters.canal} onChange={values => onFilterChange("canal", values)} placeholder="Todos" />
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Tier {filters.tier.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{filters.tier.length}</Badge>}
          </label>
          <MultiSelect options={convertToMultiSelectOptions(uniqueValues.tiers)} selected={filters.tier} onChange={values => onFilterChange("tier", values)} placeholder="Todos" />
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Urgência {filters.urgency.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{filters.urgency.length}</Badge>}
          </label>
          <MultiSelect options={convertToMultiSelectOptions(uniqueValues.urgencias)} selected={filters.urgency} onChange={values => onFilterChange("urgency", values)} placeholder="Todos" />
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Cargo {filters.cargo.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{filters.cargo.length}</Badge>}
          </label>
          <MultiSelect options={convertToMultiSelectOptions(uniqueValues.cargos)} selected={filters.cargo} onChange={values => onFilterChange("cargo", values)} placeholder="Todos" />
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Período {filters.periodo.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{filters.periodo.length}</Badge>}
          </label>
          <MultiSelect options={convertToMultiSelectOptions(uniqueValues.periodos)} selected={filters.periodo} onChange={values => onFilterChange("periodo", values)} placeholder="Todos" />
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            E-mail {filters.emailType !== "all" && <Check className="ml-1 h-3 w-3 text-success" />}
          </label>
          <Select value={filters.emailType} onValueChange={v => onFilterChange("emailType", v)}>
            <SelectTrigger className="h-9 border-border/50 bg-background text-sm transition-all duration-300 focus:border-primary">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all" className="font-semibold">Todos</SelectItem>
              <SelectItem value="dominio">Domínio</SelectItem>
              <SelectItem value="gratuito">Gratuito</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Descrição {filters.hasDescription !== "all" && <Check className="ml-1 h-3 w-3 text-success" />}
          </label>
          <Select value={filters.hasDescription} onValueChange={v => onFilterChange("hasDescription", v)}>
            <SelectTrigger className="h-9 border-border/50 bg-background text-sm transition-all duration-300 focus:border-primary">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all" className="font-semibold">Todos</SelectItem>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>
        </div>
      )}
    </div>;
};
export default FilterBar;