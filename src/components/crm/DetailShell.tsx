import { useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Props {
  /** Quando true, renderiza como página full-screen ao invés de sheet lateral */
  fullPage?: boolean;
  /** Para sheet lateral */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Caminho pra onde voltar quando em modo página */
  backTo?: string;
  /** Classes do container do conteúdo (mesmas do SheetContent original) */
  contentClassName?: string;
  /** Navegação para item anterior/próximo (somente em fullPage) */
  onPrev?: () => void;
  onNext?: () => void;
  /** Texto opcional indicando posição (ex.: "3 / 12") */
  positionLabel?: string;
  children: React.ReactNode;
}

/**
 * Wrapper que renderiza o mesmo conteúdo como Sheet lateral OU página full-screen.
 * Mantém a UX consistente entre ambas as visualizações.
 */
export const DetailShell = ({
  fullPage = false,
  open,
  onOpenChange,
  backTo,
  contentClassName,
  onPrev,
  onNext,
  positionLabel,
  children,
}: Props) => {
  const navigate = useNavigate();

  // Atalhos de teclado: ← → navegam entre itens
  useEffect(() => {
    if (!fullPage) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "ArrowLeft" && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" && onNext) {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullPage, onPrev, onNext]);

  if (fullPage) {
    return (
      <div className="min-h-screen bg-background animate-fade-in">
        <div className="sticky top-0 z-30 border-b border-border/40 bg-background/85 backdrop-blur-xl">
          <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-3 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
              className="h-8 px-2.5 -ml-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
            </Button>
            {(onPrev || onNext) && (
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPrev?.()}
                  disabled={!onPrev}
                  className="h-8 px-2 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  title="Anterior (←)"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1 text-xs">Anterior</span>
                </Button>
                {positionLabel && (
                  <span className="text-[11px] tabular-nums text-muted-foreground px-1.5">
                    {positionLabel}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNext?.()}
                  disabled={!onNext}
                  className="h-8 px-2 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  title="Próximo (→)"
                  aria-label="Próximo"
                >
                  <span className="hidden sm:inline mr-1 text-xs">Próximo</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        <main className={cn("max-w-[1400px] mx-auto px-4 lg:px-8 py-6", contentClassName)}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={contentClassName}>
        {children}
      </SheetContent>
    </Sheet>
  );
};
