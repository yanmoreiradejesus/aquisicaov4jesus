import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DateTimePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minuteStep?: number;
  disabled?: boolean;
  className?: string;
  /** Disable past dates */
  disablePast?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Selecionar data e hora",
  minuteStep = 5,
  disabled,
  className,
  disablePast,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const minutes = React.useMemo(
    () => Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep),
    [minuteStep],
  );

  const selectedHour = value ? value.getHours() : 9;
  const selectedMinute = value
    ? Math.round(value.getMinutes() / minuteStep) * minuteStep
    : 0;

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const next = new Date(date);
    next.setHours(selectedHour, selectedMinute, 0, 0);
    onChange(next);
  };

  const handleTimeChange = (h: number, m: number) => {
    const base = value ? new Date(value) : new Date();
    base.setHours(h, m, 0, 0);
    onChange(base);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-9",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? (
            format(value, "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={handleDateSelect}
            initialFocus
            locale={ptBR}
            disabled={
              disablePast
                ? (date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return date < today;
                  }
                : undefined
            }
            className={cn("p-3 pointer-events-auto")}
          />
          <div className="flex border-t sm:border-t-0 sm:border-l">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                <Clock className="h-3 w-3" />
                Hora
              </div>
              <ScrollArea className="h-[220px] w-14">
                <div className="flex flex-col p-1">
                  {HOURS.map((h) => (
                    <Button
                      key={h}
                      type="button"
                      variant={h === selectedHour ? "default" : "ghost"}
                      size="sm"
                      className="h-8 px-2 text-xs justify-center font-mono"
                      onClick={() => handleTimeChange(h, selectedMinute)}
                    >
                      {String(h).padStart(2, "0")}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div className="flex flex-col border-l">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                Min
              </div>
              <ScrollArea className="h-[220px] w-14">
                <div className="flex flex-col p-1">
                  {minutes.map((m) => (
                    <Button
                      key={m}
                      type="button"
                      variant={m === selectedMinute ? "default" : "ghost"}
                      size="sm"
                      className="h-8 px-2 text-xs justify-center font-mono"
                      onClick={() => handleTimeChange(selectedHour, m)}
                    >
                      {String(m).padStart(2, "0")}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center gap-2 p-2 border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              const now = new Date();
              const m = Math.round(now.getMinutes() / minuteStep) * minuteStep;
              now.setMinutes(m, 0, 0);
              onChange(now);
            }}
          >
            Agora
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            Confirmar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
