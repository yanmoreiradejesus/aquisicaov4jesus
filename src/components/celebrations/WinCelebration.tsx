import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Bell } from "lucide-react";

interface WinCelebrationProps {
  oportunidade?: { nome_oportunidade: string; valor_total?: number };
  onComplete: () => void;
}

const CONFETTI_COLORS = [
  "bg-amber-300",
  "bg-amber-400",
  "bg-amber-500",
  "bg-yellow-300",
  "bg-yellow-500",
];

function formatBRL(v?: number) {
  if (v == null || isNaN(v)) return null;
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function ConfettiPiece({ index }: { index: number }) {
  // deterministic-ish randomness per index
  const rand = (seed: number) => {
    const x = Math.sin(seed * 9301 + index * 49297) * 233280;
    return x - Math.floor(x);
  };
  const lateralDrift = (rand(1) - 0.5) * 800; // -400 to 400 px
  const rotateEnd = (rand(2) - 0.5) * 1080; // up to ~3 spins
  const size = 4 + Math.floor(rand(3) * 9); // 4-12
  const isRect = rand(4) > 0.5;
  const width = size;
  const height = isRect ? Math.max(2, Math.floor(size / 2)) : size;
  const color = CONFETTI_COLORS[Math.floor(rand(5) * CONFETTI_COLORS.length)];
  const delay = rand(6) * 1.5; // 0 to 1500ms
  const duration = 1.6 + rand(7) * 1.0; // 1.6s - 2.6s
  const startX = (rand(8) - 0.5) * 80; // small spread at spawn

  return (
    <motion.div
      className={`absolute top-0 left-1/2 ${color} rounded-[2px] shadow-ios-sm`}
      style={{ width, height }}
      initial={{ x: startX, y: -20, opacity: 0, rotate: 0 }}
      animate={{
        x: startX + lateralDrift,
        y: typeof window !== "undefined" ? window.innerHeight + 40 : 1000,
        opacity: [0, 1, 1, 0.9, 0],
        rotate: rotateEnd,
      }}
      transition={{
        duration,
        delay: 0.4 + delay,
        ease: [0.45, 0, 0.55, 1],
        opacity: { duration, delay: 0.4 + delay, times: [0, 0.05, 0.6, 0.85, 1] },
      }}
    />
  );
}

export default function WinCelebration({ oportunidade, onComplete }: WinCelebrationProps) {
  const prefersReducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);

  const totalDuration = prefersReducedMotion ? 1500 : 3000;
  const fadeStart = prefersReducedMotion ? 1200 : 2700;

  useEffect(() => {
    const fadeT = setTimeout(() => setVisible(false), fadeStart);
    const doneT = setTimeout(() => onComplete(), totalDuration);
    return () => {
      clearTimeout(fadeT);
      clearTimeout(doneT);
    };
  }, [fadeStart, totalDuration, onComplete]);

  const confetti = useMemo(
    () => (prefersReducedMotion ? [] : Array.from({ length: 50 }, (_, i) => i)),
    [prefersReducedMotion]
  );

  const valorFmt = formatBRL(oportunidade?.valor_total);
  const subtitle = oportunidade
    ? `${oportunidade.nome_oportunidade}${valorFmt ? ` — ${valorFmt}` : ""}`
    : null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] pointer-events-none overflow-hidden"
          role="status"
          aria-live="polite"
          initial={{ backgroundColor: "rgba(0,0,0,0)" }}
          animate={{ backgroundColor: "rgba(0,0,0,0.85)" }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="sr-only">Oportunidade ganha</span>

          {/* Flash dourado radial */}
          {!prefersReducedMotion && (
            <motion.div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle, rgba(251,191,36,0.6) 0%, transparent 70%)",
              }}
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          )}

          {/* Confete */}
          <div className="absolute inset-0">
            {confetti.map((i) => (
              <ConfettiPiece key={i} index={i} />
            ))}
          </div>

          {/* Conteúdo central */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
            {/* Sino */}
            {prefersReducedMotion ? (
              <Bell
                className="text-amber-400 drop-shadow-[0_0_40px_rgba(251,191,36,0.6)]"
                size={200}
                strokeWidth={1.75}
              />
            ) : (
              <motion.div
                initial={{ scale: 0, rotate: -15, opacity: 0 }}
                animate={{
                  scale: [0, 1.2, 1, 1, 0.8],
                  rotate: [
                    -15, 0,
                    -25, 25, -22, 22, -18, 18, -10, 10, 0,
                    0,
                  ],
                  opacity: [0, 1, 1, 1, 0],
                }}
                transition={{
                  duration: 3,
                  ease: [0.16, 1, 0.3, 1],
                  times: [
                    0,
                    0.133, // 400ms entrada
                    0.18,
                    0.28,
                    0.38,
                    0.48,
                    0.55,
                    0.6,
                    0.55,
                    0.6,
                    0.6, // fim do swing ~1800ms (0.6)
                    1, // saída até 3s
                  ].slice(0, 12),
                }}
              >
                <Bell
                  className="text-amber-400 drop-shadow-[0_0_40px_rgba(251,191,36,0.6)]"
                  size={200}
                  strokeWidth={1.75}
                />
              </motion.div>
            )}

            {/* Badge GANHOU */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={
                prefersReducedMotion
                  ? { scale: 1, opacity: 1 }
                  : { scale: [0, 1.1, 1, 1, 0.8], opacity: [0, 1, 1, 1, 0] }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0.3 }
                  : {
                      duration: 3,
                      ease: [0.16, 1, 0.3, 1],
                      delay: 0,
                      times: [0, 0.2, 0.33, 0.9, 1],
                    }
              }
              className="flex flex-col items-center gap-2"
            >
              <h1
                className="font-display font-black tracking-widest text-6xl md:text-7xl bg-gradient-to-b from-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]"
                style={{ WebkitTextStroke: "0px transparent" }}
              >
                GANHOU
              </h1>
              {subtitle && (
                <p className="text-amber-200/90 text-base md:text-lg font-medium tracking-wide">
                  {subtitle}
                </p>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
