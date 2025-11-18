interface FunnelCardProps {
  title: string;
  value: number;
  variant?: "large" | "small";
  isPercentage?: boolean;
}

const FunnelCard = ({ title, value, variant = "large", isPercentage = false }: FunnelCardProps) => {
  return (
    <div className="group relative overflow-hidden rounded-sm border border-primary/30 bg-card p-6 transition-all hover:border-primary hover:shadow-[0_0_20px_rgba(198,166,103,0.2)]">
      <div className="relative z-10">
        <h3 className="mb-2 font-heading text-sm tracking-wider text-foreground">{title}</h3>
        <p className={`font-heading ${variant === "large" ? "text-5xl" : "text-3xl"} text-primary`}>
          {isPercentage ? `${value.toFixed(1)}%` : value.toLocaleString("pt-BR")}
        </p>
      </div>
      <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-primary to-transparent opacity-50" />
    </div>
  );
};

export default FunnelCard;
