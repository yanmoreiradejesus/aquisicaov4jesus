import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
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
  children,
}: Props) => {
  const navigate = useNavigate();

  if (fullPage) {
    return (
      <div className="min-h-screen bg-background animate-fade-in">
        <div className="sticky top-0 z-30 border-b border-border/40 bg-background/85 backdrop-blur-xl">
          <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
              className="h-8 px-2.5 -ml-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
            </Button>
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
