import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";
import { FilterSaveDialog } from "@/components/FilterSaveDialog";
import { Calendar, X, Info, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ValueWithCount } from "@/utils/dataProcessor";

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

const filterTooltips = {
  startDate: "Data de início do período a ser analisado",
  endDate: "Data de fim do período a ser analisado",
  canal: "Origem do lead (ex: Google Ads, LinkedIn, Indicação)",
  tier: "Faixa de faturamento da empresa do lead",
  urgency: "Nível de urgência da necessidade do lead",
  cargo: "Cargo do decisor ou lead",
  periodo: "Período esperado para decisão de compra",
  emailType: "Tipo de e-mail: corporativo (domínio próprio) ou gratuito (Gmail, Hotmail, etc)",
  hasDescription: "Se o lead possui descrição detalhada preenchida"
};

const FilterBar = ({
  filters,
  onFilterChange,
  uniqueValues
}: FilterBarProps) => {
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});

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
    
    switch(preset) {
      case 'last7':
        const last7 = new Date(now);
        last7.setDate(last7.getDate() - 7);
        return { start: last7.toISOString().split('T')[0], end: today };
      
      case 'last30':
        const last30 = new Date(now);
        last30.setDate(last30.getDate() - 30);
        return { start: last30.toISOString().split('T')[0], end: today };
      
      case 'lastQuarter':
        const lastQuarter = new Date(now);
        lastQuarter.setMonth(lastQuarter.getMonth() - 3);
        return { start: lastQuarter.toISOString().split('T')[0], end: today };
      
      case 'last6months':
        const last6 = new Date(now);
        last6.setMonth(last6.getMonth() - 6);
        return { start: last6.toISOString().split('T')[0], end: today };
      
      case 'thisYear':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        return { start: yearStart.toISOString().split('T')[0], end: today };
      
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

  const loadSavedFilter = (savedFilters: any) => {
    Object.entries(savedFilters).forEach(([key, value]) => {
      onFilterChange(key, value as string | string[]);
    });
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

  const FilterLabel = ({ children, tooltip }: { children: React.ReactNode; tooltip: string }) => (
    <TooltipProvider>
      <Tooltip>
        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
          {children}
          <TooltipTrigger asChild>
            <Info className="h-3 w-3 cursor-help" />
          </TooltipTrigger>
        </label>
        <TooltipContent className="max-w-[250px]">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6 transition-all duration-300 hover:shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-body text-lg font-semibold text-foreground">Filtros</h3>
          {hasActiveFilters && (
            <Badge variant="secondary" className="h-5 px-2 text-xs">
              {activeCount}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {/* Quick Date Presets - First Row */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setMonthPreset(0)} className="h-7 text-xs">
              Mês Atual
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMonthPreset(1)} className="h-7 text-xs">
              Mês Passado
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDatePreset('last7')} className="h-7 text-xs">
              Últimos 7 dias
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDatePreset('last30')} className="h-7 text-xs">
              Últimos 30 dias
            </Button>
          </div>
          
          {/* Extended Presets - Second Row */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setDatePreset('lastQuarter')} className="h-7 text-xs">
              Último Trimestre
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDatePreset('last6months')} className="h-7 text-xs">
              Últimos 6 meses
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDatePreset('thisYear')} className="h-7 text-xs">
              Ano Atual
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDatePreset('lastYear')} className="h-7 text-xs">
              Ano Passado
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <FilterSaveDialog 
              currentFilters={filters}
              onLoadFilter={loadSavedFilter}
            />
            {hasActiveFilters && (
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={clearAllFilters}
                className="h-7 text-xs bg-[#e50914] hover:bg-[#c00812]"
              >
                <X className="mr-1 h-3 w-3" />
                Limpar Filtros
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-9">
        <div>
          <FilterLabel tooltip={filterTooltips.startDate}>
            Data Início
          </FilterLabel>
          <Input 
            type="date" 
            value={filters.startDate} 
            onChange={e => onFilterChange("startDate", e.target.value)} 
            className="h-9 border-border/50 bg-background text-sm transition-all duration-300 focus:border-primary" 
          />
        </div>
        
        <div>
          <FilterLabel tooltip={filterTooltips.endDate}>
            Data Fim
          </FilterLabel>
          <Input 
            type="date" 
            value={filters.endDate} 
            onChange={e => onFilterChange("endDate", e.target.value)} 
            className="h-9 border-border/50 bg-background text-sm transition-all duration-300 focus:border-primary" 
          />
        </div>
        
        <div>
          <FilterLabel tooltip={filterTooltips.canal}>
            Canal {filters.canal.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{filters.canal.length}</Badge>}
          </FilterLabel>
          <MultiSelect
            options={convertToMultiSelectOptions(uniqueValues.canais)}
            selected={filters.canal}
            onChange={(values) => onFilterChange("canal", values)}
            placeholder="Todos"
          />
        </div>
        
        <div>
          <FilterLabel tooltip={filterTooltips.tier}>
            Tier {filters.tier.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{filters.tier.length}</Badge>}
          </FilterLabel>
          <MultiSelect
            options={convertToMultiSelectOptions(uniqueValues.tiers)}
            selected={filters.tier}
            onChange={(values) => onFilterChange("tier", values)}
            placeholder="Todos"
          />
        </div>
        
        <div>
          <FilterLabel tooltip={filterTooltips.urgency}>
            Urgência {filters.urgency.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{filters.urgency.length}</Badge>}
          </FilterLabel>
          <MultiSelect
            options={convertToMultiSelectOptions(uniqueValues.urgencias)}
            selected={filters.urgency}
            onChange={(values) => onFilterChange("urgency", values)}
            placeholder="Todos"
          />
        </div>
        
        <div>
          <FilterLabel tooltip={filterTooltips.cargo}>
            Cargo {filters.cargo.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{filters.cargo.length}</Badge>}
          </FilterLabel>
          <MultiSelect
            options={convertToMultiSelectOptions(uniqueValues.cargos)}
            selected={filters.cargo}
            onChange={(values) => onFilterChange("cargo", values)}
            placeholder="Todos"
          />
        </div>
        
        <div>
          <FilterLabel tooltip={filterTooltips.periodo}>
            Período {filters.periodo.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{filters.periodo.length}</Badge>}
          </FilterLabel>
          <MultiSelect
            options={convertToMultiSelectOptions(uniqueValues.periodos)}
            selected={filters.periodo}
            onChange={(values) => onFilterChange("periodo", values)}
            placeholder="Todos"
          />
        </div>
        
        <div>
          <FilterLabel tooltip={filterTooltips.emailType}>
            E-mail {filters.emailType !== "all" && <Check className="ml-1 h-3 w-3 text-success" />}
          </FilterLabel>
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
          <FilterLabel tooltip={filterTooltips.hasDescription}>
            Descrição {filters.hasDescription !== "all" && <Check className="ml-1 h-3 w-3 text-success" />}
          </FilterLabel>
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
    </div>
  );
};

export default FilterBar;
