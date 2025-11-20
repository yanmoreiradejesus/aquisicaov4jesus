import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

export interface SavedFilter {
  id: string;
  name: string;
  filters: any;
  createdAt: string;
}

interface FilterSaveDialogProps {
  currentFilters: any;
  onLoadFilter: (filters: any) => void;
}

export function FilterSaveDialog({ currentFilters, onLoadFilter }: FilterSaveDialogProps) {
  const [open, setOpen] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    loadSavedFilters();
  }, [open]);

  const loadSavedFilters = () => {
    const saved = localStorage.getItem("savedFilters");
    if (saved) {
      setSavedFilters(JSON.parse(saved));
    }
  };

  const saveFilter = () => {
    if (!filterName.trim()) {
      toast.error("Digite um nome para o filtro");
      return;
    }

    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: filterName,
      filters: { ...currentFilters },
      createdAt: new Date().toISOString(),
    };

    const saved = [...savedFilters, newFilter];
    localStorage.setItem("savedFilters", JSON.stringify(saved));
    setSavedFilters(saved);
    setFilterName("");
    toast.success(`Filtro "${filterName}" salvo com sucesso!`);
  };

  const deleteFilter = (id: string) => {
    const updated = savedFilters.filter((f) => f.id !== id);
    localStorage.setItem("savedFilters", JSON.stringify(updated));
    setSavedFilters(updated);
    toast.success("Filtro removido");
  };

  const loadFilter = (filter: SavedFilter) => {
    onLoadFilter(filter.filters);
    setOpen(false);
    toast.success(`Filtro "${filter.name}" aplicado`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          <Star className="mr-1 h-3 w-3" />
          Favoritos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Gerenciar Filtros Favoritos</DialogTitle>
          <DialogDescription>
            Salve combinações de filtros para reutilização rápida
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Save Current Filter */}
          <div className="space-y-2">
            <Label htmlFor="filterName">Salvar Filtro Atual</Label>
            <div className="flex gap-2">
              <Input
                id="filterName"
                placeholder="Nome do filtro..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveFilter();
                }}
              />
              <Button onClick={saveFilter} size="sm">
                Salvar
              </Button>
            </div>
          </div>

          {/* Saved Filters List */}
          {savedFilters.length > 0 && (
            <div className="space-y-2">
              <Label>Filtros Salvos ({savedFilters.length})</Label>
              <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-md border border-border/50 p-2">
                {savedFilters.map((filter) => (
                  <div
                    key={filter.id}
                    className="flex items-center justify-between rounded-md border border-border/30 bg-muted/20 p-2 transition-all hover:bg-muted/40"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{filter.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(filter.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => loadFilter(filter)}
                        className="h-8 px-2"
                      >
                        Aplicar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteFilter(filter.id)}
                        className="h-8 px-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {savedFilters.length === 0 && (
            <div className="rounded-md border border-border/50 bg-muted/20 p-8 text-center">
              <Star className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum filtro salvo ainda
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
