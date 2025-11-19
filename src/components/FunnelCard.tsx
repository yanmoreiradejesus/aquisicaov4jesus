interface FunnelCardProps {
  title: string;
  value: number;
  variant?: "large" | "small";
  isPercentage?: boolean;
}

const FunnelCard = ({ title, value, variant = "large", isPercentage = false }: FunnelCardProps) => {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6 transition-all duration-300 hover:shadow-lg hover:border-primary/50">
      <div className="relative z-10">
        <h3 className="mb-2 font-body text-sm font-medium text-muted-foreground">{title}</h3>
        <p className={`font-heading ${variant === "large" ? "text-4xl" : "text-2xl"} font-bold text-foreground`}>
          {isPercentage ? `${value.toFixed(1)}%` : value.toLocaleString("pt-BR")}
        </p>
      </div>
      <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-primary/50 to-transparent opacity-50" />
    </div>
  );
};

export default FunnelCard;
