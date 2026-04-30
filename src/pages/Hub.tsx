import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getGreeting, formatHubDate, formatHubTime } from "@/lib/greeting";
import { getHubContextLine } from "@/lib/hubContextLine";
import { AgendaWidget } from "@/components/hub/widgets/AgendaWidget";
import { PendenciasWidget } from "@/components/hub/widgets/PendenciasWidget";
import { HubOrb } from "@/components/hub/HubOrb";
import { Typewriter } from "@/components/hub/Typewriter";
import { AppsGrid } from "@/components/hub/AppsGrid";

const WIDGETS = [
  { id: "agenda", Component: AgendaWidget, accessPaths: ["/comercial/leads", "/comercial/oportunidades"] },
  { id: "pendencias", Component: PendenciasWidget, accessPaths: ["/comercial/leads", "/comercial/oportunidades"] },
];

interface HubProps {
  variant?: "full" | "compact";
}

const Hub = ({ variant = "full" }: HubProps) => {
  const { hasPageAccess, profile } = useAuth();
  const [now, setNow] = useState(new Date());
  const [meetingsToday, setMeetingsToday] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // Typewriter sequencing
  const [step, setStep] = useState(0); // 0 idle -> 1 greeting done -> 2 name done -> 3 context done

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const visibleWidgets = WIDGETS.filter((w) => w.accessPaths.some((p) => hasPageAccess(p)));

  const greeting = getGreeting(now);
  const firstName = profile?.full_name?.split(" ")[0] ?? "Bem-vindo";
  const contextLine = getHubContextLine({ pendingCount, meetingsToday, date: now });

  // ---------- COMPACT (route /apps, accessed via header logo) ----------
  if (variant === "compact") {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto max-w-7xl px-4 lg:px-10 py-8 lg:py-12">
          <div className="flex items-center justify-between mb-8 lg:mb-10">
            <p className="text-[10px] lg:text-xs font-semibold tracking-[0.25em] uppercase text-muted-foreground">
              V4 Jesus · {formatHubDate(now)} · <span className="tabular-nums">{formatHubTime(now)}</span>
            </p>
          </div>
          <AppsGrid compact />
        </main>
      </div>
    );
  }

  // ---------- FULL (route /, landing on v4jesus.com) ----------
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-7xl px-4 lg:px-10 py-10 lg:py-16">
        {/* Eyebrow — clickable shortcut to /apps since header is hidden on / */}
        <div className="flex items-center justify-between mb-12 lg:mb-20">
          <Link
            to="/apps"
            className="group text-[10px] lg:text-xs font-semibold tracking-[0.25em] uppercase text-muted-foreground hover:text-foreground transition-colors"
            title="Ir para aplicações"
          >
            <span className="border-b border-transparent group-hover:border-foreground/40 transition-colors">V4 Jesus</span>
            <span> · {formatHubDate(now)} · <span className="tabular-nums">{formatHubTime(now)}</span></span>
          </Link>
        </div>

        {/* Hero editorial + 3D orb */}
        <header className="mb-16 lg:mb-24 grid grid-cols-1 lg:grid-cols-[1fr_auto] items-center gap-8 lg:gap-12">
          <div>
            <h1
              className="font-heading uppercase leading-[0.95] tracking-tight"
              style={{ fontSize: "clamp(2.5rem, 8vw, 6rem)" }}
              aria-label={`${greeting}, ${firstName}.`}
            >
              {/* Line 1: greeting */}
              <span className="block text-foreground">
                <Typewriter
                  text={`${greeting},`}
                  delay={300}
                  speed={50}
                  onDone={() => setStep((s) => (s < 1 ? 1 : s))}
                />
              </span>

              {/* Line 2: name in red block */}
              <span className="block mt-1">
                <span
                  className="inline-block bg-[#E30613] text-white px-4 py-1 align-baseline overflow-hidden"
                  style={{
                    clipPath: step >= 1 ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
                    transition: "clip-path 500ms cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                >
                  {step >= 1 ? (
                    <Typewriter
                      text={`${firstName}.`}
                      delay={500}
                      speed={60}
                      onDone={() => setStep((s) => (s < 2 ? 2 : s))}
                    />
                  ) : (
                    <span aria-hidden="true" className="invisible">
                      {firstName}.
                    </span>
                  )}
                </span>
              </span>
            </h1>

            <p
              className="mt-6 lg:mt-8 text-base lg:text-lg text-muted-foreground max-w-2xl min-h-[1.75em]"
              aria-label={contextLine}
            >
              {step >= 2 ? (
                <Typewriter
                  text={contextLine}
                  speed={25}
                  onDone={() => setStep((s) => (s < 3 ? 3 : s))}
                />
              ) : null}
            </p>
          </div>
          <HubOrb className="hidden lg:block w-[360px] h-[360px] xl:w-[420px] xl:h-[420px]" />
        </header>

        {/* APLICAÇÕES */}
        <AppsGrid />

        {/* HOJE — bento */}
        {visibleWidgets.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-6 lg:mb-8 border-b border-border/60 pb-3">
              <h2 className="text-[10px] lg:text-xs font-semibold tracking-[0.25em] uppercase text-muted-foreground">
                Hoje
              </h2>
              <span className="text-[10px] lg:text-xs font-semibold tracking-[0.25em] uppercase text-muted-foreground tabular-nums">
                {formatHubDate(now)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              {visibleWidgets.map(({ id, Component }) => {
                if (id === "agenda") return <Component key={id} onCount={setMeetingsToday} />;
                if (id === "pendencias") return <Component key={id} onCount={setPendingCount} />;
                return <Component key={id} />;
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Hub;
