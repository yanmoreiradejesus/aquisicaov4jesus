import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";

interface FilterBarProps {
  filters: {
    dateRange: string;
    canal: string;
    tier: string;
    urgency: string;
    cargo: string;
    periodo: string;
    emailType: string;
    hasDescription: string;
  };
  onFilterChange: (key: string, value: string) => void;
}

const FilterBar = ({ filters, onFilterChange }: FilterBarProps) => {
  return (
    <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6 transition-all duration-300 hover:shadow-lg">
      <div className="mb-4">
        <h3 className="font-body text-lg font-semibold text-foreground">Filtros</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Data</label>
          <Input
            type="date"
            value={filters.dateRange}
            onChange={(e) => onFilterChange("dateRange", e.target.value)}
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
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
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
              <SelectItem value="0-100k">0-100k</SelectItem>
              <SelectItem value="100k-500k">100k-500k</SelectItem>
              <SelectItem value="500k+">500k+</SelectItem>
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
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
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
              <SelectItem value="dono">Dono</SelectItem>
              <SelectItem value="gestor">Gestor</SelectItem>
              <SelectItem value="outros">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Período</label>
          <Select value={filters.periodo} onValueChange={(v) => onFilterChange("periodo", v)}>
            <SelectTrigger className="h-9 border-border/50 bg-background text-sm transition-all duration-300 focus:border-primary">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="manha">Manhã</SelectItem>
              <SelectItem value="tarde">Tarde</SelectItem>
              <SelectItem value="noite">Noite</SelectItem>
              <SelectItem value="madrugada">Madrugada</SelectItem>
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
