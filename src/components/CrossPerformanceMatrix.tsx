import { CrossPerformanceCell } from "@/utils/insightsCalculator";
import { cn } from "@/lib/utils";

interface CrossPerformanceMatrixProps {
  title: string;
  cells: CrossPerformanceCell[];
  fieldALabel: string;
  fieldBLabel: string;
}

const CrossPerformanceMatrix = ({
  title,
  cells,
  fieldALabel,
  fieldBLabel,
}: CrossPerformanceMatrixProps) => {
  // Get unique values for rows and columns
  const rowValues = [...new Set(cells.map((c) => c.fieldA))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
  const colValues = [...new Set(cells.map((c) => c.fieldB))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );

  // Create lookup map for quick access
  const cellMap = new Map<string, CrossPerformanceCell>();
  cells.forEach((cell) => {
    cellMap.set(`${cell.fieldA}-${cell.fieldB}`, cell);
  });

  // Get color based on conversion rate
  const getColorClass = (rate: number): string => {
    if (rate >= 30) return "bg-green-500/30 text-green-300";
    if (rate >= 20) return "bg-green-500/20 text-green-400";
    if (rate >= 10) return "bg-yellow-500/20 text-yellow-300";
    if (rate >= 5) return "bg-orange-500/20 text-orange-300";
    if (rate > 0) return "bg-red-500/20 text-red-300";
    return "bg-muted/30 text-muted-foreground";
  };

  return (
    <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6 transition-all duration-300 hover:shadow-lg">
      <h3 className="mb-4 font-body text-lg font-semibold text-foreground">{title}</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left text-xs font-medium text-muted-foreground border-b border-border/30">
                {fieldALabel} / {fieldBLabel}
              </th>
              {colValues.map((col) => (
                <th
                  key={col}
                  className="p-2 text-center text-xs font-medium text-muted-foreground border-b border-border/30 min-w-[80px]"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowValues.map((row) => (
              <tr key={row}>
                <td className="p-2 text-xs font-medium text-foreground border-b border-border/20">
                  {row}
                </td>
                {colValues.map((col) => {
                  const cell = cellMap.get(`${row}-${col}`);
                  const rate = cell?.conversionRate || 0;
                  const leads = cell?.leads || 0;
                  
                  return (
                    <td
                      key={col}
                      className={cn(
                        "p-2 text-center border-b border-border/20 transition-colors",
                        getColorClass(rate)
                      )}
                    >
                      {leads > 0 ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">{rate.toFixed(0)}%</span>
                          <span className="text-[10px] opacity-70">({leads} leads)</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        <span className="text-muted-foreground">Conversão:</span>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-green-500/30" />
          <span className="text-muted-foreground">≥30%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-green-500/20" />
          <span className="text-muted-foreground">≥20%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-yellow-500/20" />
          <span className="text-muted-foreground">≥10%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-orange-500/20" />
          <span className="text-muted-foreground">≥5%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-red-500/20" />
          <span className="text-muted-foreground">&lt;5%</span>
        </div>
      </div>
    </div>
  );
};

export default CrossPerformanceMatrix;
