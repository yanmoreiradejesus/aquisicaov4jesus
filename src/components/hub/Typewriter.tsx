import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TypewriterProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  cursor?: boolean;
  onDone?: () => void;
}

/**
 * Classic letter-by-letter typewriter.
 * Reserves final width with an invisible ghost layer to avoid layout shift.
 */
export function Typewriter({
  text,
  speed = 45,
  delay = 0,
  className,
  cursor = false,
  onDone,
}: TypewriterProps) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(delay === 0);

  useEffect(() => {
    setCount(0);
    setStarted(delay === 0);
    if (delay > 0) {
      const t = setTimeout(() => setStarted(true), delay);
      return () => clearTimeout(t);
    }
  }, [text, delay]);

  useEffect(() => {
    if (!started) return;
    if (count >= text.length) {
      onDone?.();
      return;
    }
    const t = setTimeout(() => setCount((c) => c + 1), speed);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, count, text.length, speed]);

  const visible = text.slice(0, count);
  const done = count >= text.length;

  return (
    <span className={cn("relative inline-block", className)} aria-label={text}>
      <span aria-hidden="true" className="invisible">
        {text || "\u00A0"}
      </span>
      <span aria-hidden="true" className="absolute inset-0">
        {visible}
        {cursor && (
          <span
            className={cn(
              "inline-block w-[0.06em] align-middle ml-1 bg-current",
              done ? "animate-pulse" : ""
            )}
            style={{ height: "0.8em" }}
          />
        )}
      </span>
    </span>
  );
}
