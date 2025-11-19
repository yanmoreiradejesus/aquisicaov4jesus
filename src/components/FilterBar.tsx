import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

interface FilterBarProps {
  filters: {
    startDate: string;
    endDate: string;
    canal: string;
    tier: string;
    urgency: string;
    cargo: string;
    periodo: string;
    emailType: string;
    hasDescription: string;
  };
  onFilterChange: (key: string, value: string) => void;
  uniqueValues: {
    canais: string[];
    tiers: string[];
    urgencias: string[];
    cargos: string[];
    periodos: string[];
  };
}

const FilterBar = ({ filters, onFilterChange, uniqueValues }: FilterBarProps) => {
  const getCurrentMonthRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
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

  return (
    <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6 transition-all duration-300 hover:shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-body text-lg font-semibold text-foreground">Filtros</h3>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setMonthPreset(0)}
            className="h-7 text-xs"
          >
            Mês Atual
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setMonthPreset(1)}
            className="h-7 text-xs"
          >
            Mês Passado
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setMonthPreset(2)}
            className="h-7 text-xs"
          >
            2 Meses Atrás
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-9">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Data Início</label>
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange("startDate", e.target.value)}
            className="h-9 border-border/50 bg-background text-sm transition-all duration-300 focus:border-primary"
          />
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Data Fim</label>
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) => onFilterChange("endDate", e.target.value)}
            className="h-9 border-border/50 bg-background text-sm transition-all duration-300 focus:border-primary"
          />
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Canal</label>
          <Select value={filters.canal} onValueChange={(v) => onFilterChange("canal", v)}>
            <SelectTrigger className="h-9 border-border/50 bg-background text-sm transition-all duration-300 focus:border-primary">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {uniqueValues.canais.map((canal) => (
                <SelectItem key={canal} value={canal}>{canal}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Tier</label>
          <Select value={filters.tier} onValueChange={(v) => onFilterChange("tier", v)}>
            <SelectTrigger className="h-9 border-border/50 bg-background text-sm transition-all duration-300 focus:border-primary">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {uniqueValues.tiers.map((tier) => (
                <SelectItem key={tier} value={tier}>{tier}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Urgência</label>
          <Select value={filters.urgency} onValueChange={(v) => onFilterChange("urgency", v)}>
            <SelectTrigger className="h-9 border-border/50 bg-background text-sm transition-all duration-300 focus:border-primary">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {uniqueValues.urgencias.map((urgencia) => (
                <SelectItem key={urgencia} value={urgencia}>{urgencia}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Cargo</label>
          <Select value={filters.cargo} onValueChange={(v) => onFilterChange("cargo", v)}>
            <SelectTrigger className="h-9 border-border/50 bg-background text-sm transition-all duration-300 focus:border-primary">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {uniqueValues.cargos.map((cargo) => (
                <SelectItem key={cargo} value={cargo}>{cargo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Período de Compra</label>
          <Select value={filters.periodo} onValueChange={(v) => onFilterChange("periodo", v)}>
            <SelectTrigger className="h-9 border-border/50 bg-background text-sm transition-all duration-300 focus:border-primary">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {uniqueValues.periodos.map((periodo) => (
                <SelectItem key={periodo} value={periodo}>{periodo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail</label>
          <Select value={filters.emailType} onValueChange={(v) => onFilterChange("emailType", v)}>
            <SelectTrigger className="h-9 border-border/50 bg-background text-sm transition-all duration-300 focus:border-primary">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="dominio">Domínio</SelectItem>
              <SelectItem value="gratuito">Gratuito</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição</label>
          <Select value={filters.hasDescription} onValueChange={(v) => onFilterChange("hasDescription", v)}>
            <SelectTrigger className="h-9 border-border/50 bg-background text-sm transition-all duration-300 focus:border-primary">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
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
