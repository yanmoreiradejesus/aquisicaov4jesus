import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface InsightsDateFilterProps {
  startDate: string;
  endDate: string;
  onDateChange: (startDate: string, endDate: string) => void;
}

const InsightsDateFilter = ({ startDate, endDate, onDateChange }: InsightsDateFilterProps) => {
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string>("total");

  const formatDateForState = (date: Date): string => {
    return format(date, "yyyy-MM-dd") + "T00:00:00";
  };

  const parseDate = (dateStr: string): Date => {
    return new Date(dateStr.split("T")[0] + "T12:00:00");
  };

  const setPreset = (preset: string) => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (preset) {
      case "currentMonth":
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case "currentYear":
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      case "lastYear":
        const lastYear = subYears(now, 1);
        start = startOfYear(lastYear);
        end = endOfYear(lastYear);
        break;
      case "total":
        start = subYears(now, 1);
        end = now;
        break;
      default:
        return;
    }

    setActivePreset(preset);
    onDateChange(formatDateForState(start), formatDateForState(end));
  };

  return (
    <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-4 transition-all duration-300 hover:shadow-lg">
      <div className="flex flex-wrap items-center gap-3">
        {/* Preset Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activePreset === "currentMonth" ? "default" : "outline"}
            size="sm"
            onClick={() => setPreset("currentMonth")}
            className="text-xs"
          >
            Mês Atual
          </Button>
          <Button
            variant={activePreset === "lastMonth" ? "default" : "outline"}
            size="sm"
            onClick={() => setPreset("lastMonth")}
            className="text-xs"
          >
            Mês Anterior
          </Button>
          <Button
            variant={activePreset === "currentYear" ? "default" : "outline"}
            size="sm"
            onClick={() => setPreset("currentYear")}
            className="text-xs"
          >
            Ano Atual
          </Button>
          <Button
            variant={activePreset === "lastYear" ? "default" : "outline"}
            size="sm"
            onClick={() => setPreset("lastYear")}
            className="text-xs"
          >
            Ano Anterior
          </Button>
          <Button
            variant={activePreset === "total" ? "default" : "outline"}
            size="sm"
            onClick={() => setPreset("total")}
            className="text-xs"
          >
            Período Total
          </Button>
        </div>

        <div className="h-6 w-px bg-border/50 hidden md:block" />

        {/* Date Pickers */}
        <div className="flex items-center gap-2">
          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-[140px] justify-start text-left font-normal text-xs",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {startDate
                  ? format(parseDate(startDate), "dd/MM/yyyy", { locale: ptBR })
                  : "Data início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parseDate(startDate)}
                onSelect={(date) => {
                  if (date) {
                    onDateChange(formatDateForState(date), endDate);
                    setStartOpen(false);
                  }
                }}
                locale={ptBR}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground text-xs">até</span>

          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-[140px] justify-start text-left font-normal text-xs",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {endDate
                  ? format(parseDate(endDate), "dd/MM/yyyy", { locale: ptBR })
                  : "Data fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parseDate(endDate)}
                onSelect={(date) => {
                  if (date) {
                    onDateChange(startDate, formatDateForState(date));
                    setEndOpen(false);
                  }
                }}
                locale={ptBR}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};

export default InsightsDateFilter;
