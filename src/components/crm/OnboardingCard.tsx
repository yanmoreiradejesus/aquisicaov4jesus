import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Calendar, GraduationCap, Package, ExternalLink, Link2, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Sheet, SheetPortal, SheetOverlay } from "@/components/ui/sheet";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  buildOnboardingMenuActions,
  OnboardingCardMenuList,
} from "./OnboardingCardMenu";

const CATEGORIA_PRODUTOS_LABEL: Record<string, string> = {
  saber: "Saber",
  ter: "Ter",
  executar: "Executar",
  potencializar: "Potencializar",
};

interface Props {
  account: any;
  onClick: () => void;
  onOpenInNewTab?: () => void;
  overlay?: boolean;
}

const fmtBRL = (v?: number | null) => {
  if (!v) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(v));
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

export const OnboardingCard = ({ account, onClick, onOpenInNewTab, overlay = false }: Props) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: account.id,
    disabled: overlay,
  });

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.metaKey || e.ctrlKey) && onOpenInNewTab) {
      e.preventDefault();
      onOpenInNewTab();
      return;
    }
    onClick();
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1 && onOpenInNewTab) {
      e.preventDefault();
      onOpenInNewTab();
    }
  };

  const style: React.CSSProperties | undefined = overlay
    ? undefined
    : transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0 : 1,
      }
    : { opacity: isDragging ? 0 : 1 };

  const op = account.oportunidade;
  const lead = op?.lead;
  const titulo = account.cliente_nome || op?.nome_oportunidade || lead?.empresa || lead?.nome;
  const subtitulo = [lead?.empresa, lead?.nome].filter((v) => v && v !== titulo)[0];
  const valorTotal = (Number(op?.valor_ef) || 0) + (Number(op?.valor_fee) || 0);
  const valorFmt = valorTotal > 0 ? fmtBRL(valorTotal) : null;

  const gcAgendada = account.growth_class_data_agendada;
  const gcRealizada = account.growth_class_data_realizada;
  const isAtrasada = account.onboarding_status === "atrasada";
  const isChurn = account.onboarding_status === "churn_m0";

  // GC pendente se agendada está no passado e não foi realizada
  const gcPendente =
    gcAgendada && !gcRealizada && new Date(gcAgendada) < new Date();

  const copyLink = async () => {
    const url = `${window.location.origin}/comercial/onboarding/${account.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado", description: "Cole onde quiser compartilhar." });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const actions = onOpenInNewTab
    ? buildOnboardingMenuActions({
        onOpenInNewTab: () => onOpenInNewTab(),
        onCopyLink: copyLink,
      })
    : [];

  // Stops pointerdown from initiating drag on the ⋯ button
  const stopDrag = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
  };

  const menuButton = !overlay && onOpenInNewTab ? (
    isMobile ? (
      <button
        type="button"
        aria-label="Mais opções"
        onPointerDown={stopDrag}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(true);
        }}
        className="shrink-0 h-7 w-7 -mr-1 -mt-0.5 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] active:bg-foreground/10 transition-colors"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    ) : (
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Mais opções"
            onPointerDown={stopDrag}
            onClick={stopDrag}
            className="shrink-0 h-7 w-7 -mr-1 -mt-0.5 inline-flex items-center justify-center rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 hover:text-foreground hover:bg-foreground/[0.06] active:bg-foreground/10 transition-all"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-56 p-0 rounded-xl border-border/60 bg-surface-1/90 backdrop-blur-xl shadow-ios-xl"
        >
          <OnboardingCardMenuList
            actions={actions}
            variant="popover"
            onAfterSelect={() => setMenuOpen(false)}
          />
        </PopoverContent>
      </Popover>
    )
  ) : null;

  const cardInner = (
    <div ref={overlay ? undefined : setNodeRef} style={style} {...(overlay ? {} : attributes)}>
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border bg-surface-1/80 backdrop-blur-sm",
          overlay
            ? "border-primary/50 shadow-ios-xl ring-1 ring-primary/30 rotate-[1.5deg] scale-[1.04] cursor-grabbing"
            : "border-border/50 card-lift shadow-ios-sm hover:border-primary/40 hover:bg-surface-2/80"
        )}
      >
        <span
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[3px]",
            isChurn
              ? "bg-red-500"
              : gcRealizada
              ? "bg-emerald-500"
              : isAtrasada || gcPendente
              ? "bg-amber-500"
              : "bg-blue-500"
          )}
        />

        <div
          {...(overlay ? {} : listeners)}
          onClick={overlay ? undefined : handleCardClick}
          onAuxClick={overlay ? undefined : handleAuxClick}
          className={cn("pl-3.5 pr-3 py-3", overlay ? "cursor-grabbing" : "cursor-grab active:cursor-grabbing")}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-display font-semibold text-[13px] leading-snug text-foreground truncate tracking-[-0.01em]">
                {titulo}
              </div>
              {subtitulo && (
                <p className="font-display font-normal text-[11px] text-muted-foreground truncate mt-0.5">
                  {subtitulo}
                </p>
              )}
            </div>
            <div className="flex items-start gap-1.5 shrink-0">
              {valorFmt && (
                <span className="text-[11px] font-semibold tabular-nums text-foreground/90 leading-snug">
                  {valorFmt}
                </span>
              )}
              {menuButton}
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {gcRealizada ? (
              <span className="text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                <GraduationCap className="h-2.5 w-2.5" />
                GC {fmtDate(gcRealizada)}
              </span>
            ) : gcAgendada ? (
              <span
                className={cn(
                  "text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide inline-flex items-center gap-1 tabular-nums",
                  gcPendente
                    ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                    : "bg-blue-500/10 text-blue-300 border-blue-500/30"
                )}
              >
                <Calendar className="h-2.5 w-2.5" />
                GC {fmtDate(gcAgendada)}
              </span>
            ) : null}
            {op?.nivel_consciencia &&
              String(op.nivel_consciencia)
                .split(",")
                .map((s: string) => s.trim())
                .filter((c: string) => CATEGORIA_PRODUTOS_LABEL[c])
                .map((c: string) => (
                  <span key={c} className="text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide inline-flex items-center gap-1 bg-primary/10 text-primary border-primary/30">
                    <Package className="h-2.5 w-2.5" />
                    {CATEGORIA_PRODUTOS_LABEL[c]}
                  </span>
                ))}
            {account.data_inicio_contrato && (
              <span className="text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide inline-flex items-center gap-1 tabular-nums bg-foreground/5 text-foreground/70 border-border/40">
                <Calendar className="h-2.5 w-2.5" />
                Início {fmtDate(account.data_inicio_contrato)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (overlay || !onOpenInNewTab) return cardInner;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{cardInner}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onSelect={() => onOpenInNewTab()}>
            <ExternalLink className="h-3.5 w-3.5 mr-2" />
            Abrir em nova aba
          </ContextMenuItem>
          <ContextMenuItem onSelect={copyLink}>
            <Link2 className="h-3.5 w-3.5 mr-2" />
            Copiar link
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isMobile && (
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetPortal>
            <SheetOverlay className="bg-black/50 backdrop-blur-sm" />
            <SheetPrimitive.Content
              className={cn(
                "fixed inset-x-0 bottom-0 z-50",
                "rounded-t-2xl border-t border-border/60",
                "bg-surface-1/95 backdrop-blur-xl shadow-ios-xl",
                "px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
                "data-[state=closed]:duration-200 data-[state=open]:duration-300"
              )}
            >
              <div className="mx-auto mb-2 mt-1 h-1 w-9 rounded-full bg-foreground/20" />
              {titulo && (
                <div className="px-4 pb-2 text-center text-[12px] font-medium text-muted-foreground truncate">
                  {titulo}
                </div>
              )}
              <OnboardingCardMenuList
                actions={actions}
                variant="sheet"
                onAfterSelect={() => setMenuOpen(false)}
              />
              <SheetPrimitive.Title className="sr-only">Opções do card</SheetPrimitive.Title>
            </SheetPrimitive.Content>
          </SheetPortal>
        </Sheet>
      )}
    </>
  );
};
