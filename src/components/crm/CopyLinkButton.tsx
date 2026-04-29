import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  /** Caminho relativo (ex: /comercial/leads/abc-123) */
  path: string;
  className?: string;
  label?: string;
}

/**
 * Botão discreto para copiar o link compartilhável do card atual.
 */
export const CopyLinkButton = ({ path, className, label = "Copiar link" }: Props) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copiado", description: "Cole onde quiser compartilhar." });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Erro ao copiar", description: "Tente novamente.", variant: "destructive" });
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2/60 transition-colors",
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
    </button>
  );
};
