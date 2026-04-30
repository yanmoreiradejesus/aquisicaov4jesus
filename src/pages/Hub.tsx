import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowUpRight } from "lucide-react";
import { getGreeting, formatHubDate, formatHubTime } from "@/lib/greeting";
import { getHubContextLine } from "@/lib/hubContextLine";
import { AgendaWidget } from "@/components/hub/widgets/AgendaWidget";
import { PendenciasWidget } from "@/components/hub/widgets/PendenciasWidget";
import { HubOrb } from "@/components/hub/HubOrb";

interface AppEntry {
  id: string;
  title: string;
  description: string;
  href: string;
  external?: boolean;
  accessPaths: string[];
}

const APPS: AppEntry[] = [
  {
    id: "data-analytics",
    title: "Data Analytics",
    description: "Funil, dashboards, metas e insights.",
    href: "/aquisicao/funil",
    accessPaths: [
      "/aquisicao/funil",
      "/aquisicao/dashboard",
      "/aquisicao/insights",
      "/aquisicao/meta",
      "/aquisicao/financeiro",
    ],
  },
  {
    id: "comercial",
    title: "Comercial",
    description: "CRM, contas e cobranças.",
    href: "/comercial/leads",
    accessPaths: [
      "/comercial/leads",
      "/comercial/oportunidades",
      "/comercial/accounts",
      "/comercial/cobrancas",
    ],
  },
  {
    id: "app-v4",
    title: "App V4",
    description: "Sistema operacional V4 Jesus.",
    href: "https://app.v4jesus.com",
    external: true,
    accessPaths: ["/app-v4"],
  },
];

const WIDGETS = [
  { id: "agenda", Component: AgendaWidget, accessPaths: ["/comercial/leads", "/comercial/oportunidades"] },
  { id: "pendencias", Component: PendenciasWidget, accessPaths: ["/comercial/leads", "/comercial/oportunidades"] },
];

const Hub = () => {
  const { hasPageAccess, profile } = useAuth();
  const [now, setNow] = useState(new Date());
  const [meetingsToday, setMeetingsToday] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const visibleApps = APPS.filter((a) => a.accessPaths.some((p) => hasPageAccess(p)));
  const visibleWidgets = WIDGETS.filter((w) => w.accessPaths.some((p) => hasPageAccess(p)));

  const greeting = getGreeting(now);
  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const contextLine = getHubContextLine({ pendingCount, meetingsToday, date: now });

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-7xl px-4 lg:px-10 py-10 lg:py-16">
        {/* Eyebrow */}
        <div className="flex items-center justify-between mb-12 lg:mb-20">
          <p className="text-[10px] lg:text-xs font-semibold tracking-[0.25em] uppercase text-muted-foreground">
            V4 Jesus · {formatHubDate(now)} · <span className="tabular-nums">{formatHubTime(now)}</span>
          </p>
        </div>

        {/* Hero editorial + 3D orb */}
        <header className="mb-16 lg:mb-24 grid grid-cols-1 lg:grid-cols-[1fr_auto] items-center gap-8 lg:gap-12">
          <div>
            <h1
              className="font-heading uppercase leading-[0.9] tracking-tight"
              style={{ fontSize: "clamp(2.5rem, 8vw, 6rem)" }}
            >
              <span className="block text-foreground">{greeting},</span>
              <span className="block bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
                {firstName || "bem-vindo"}.
              </span>
            </h1>
            <p className="mt-6 lg:mt-8 text-base lg:text-lg text-muted-foreground max-w-2xl">
              {contextLine}
            </p>
          </div>
          <HubOrb className="hidden lg:block w-[360px] h-[360px] xl:w-[420px] xl:h-[420px]" />
        </header>

        {/* APLICAÇÕES */}
        {visibleApps.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Você ainda não tem acesso a nenhuma aplicação. Solicite acesso ao administrador.
          </div>
        ) : (
          <section className="mb-20 lg:mb-28">
            <div className="flex items-baseline justify-between mb-6 lg:mb-8 border-b border-border/60 pb-3">
              <h2 className="text-[10px] lg:text-xs font-semibold tracking-[0.25em] uppercase text-muted-foreground">
                Aplicações
              </h2>
              <span className="text-[10px] lg:text-xs font-semibold tracking-[0.25em] uppercase text-muted-foreground tabular-nums">
                {String(visibleApps.length).padStart(2, "0")} disponíveis
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {visibleApps.map((app, idx) => {
                const num = String(idx + 1).padStart(2, "0");
                const card = (
                  <article className="group relative h-full overflow-hidden rounded-2xl border border-border/60 bg-[hsl(var(--surface-1))] p-6 lg:p-8 transition-all duration-500 hover:border-primary/50 hover:bg-[hsl(var(--surface-2))] hover:shadow-[var(--shadow-glow)] cursor-pointer min-h-[260px] lg:min-h-[320px] flex flex-col justify-between">
                    {/* Number */}
                    <div className="flex items-start justify-between">
                      <span
                        className="font-heading text-foreground/15 leading-none transition-all duration-500 group-hover:text-primary/40"
                        style={{ fontSize: "clamp(3.5rem, 7vw, 5.5rem)" }}
                      >
                        {num}
                      </span>
                      <ArrowUpRight className="h-6 w-6 lg:h-7 lg:w-7 text-muted-foreground transition-all duration-500 group-hover:text-primary group-hover:-translate-y-1 group-hover:translate-x-1" />
                    </div>

                    {/* Title + desc */}
                    <div>
                      <h3
                        className="font-heading uppercase text-foreground leading-[0.95] tracking-tight mb-2"
                        style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)" }}
                      >
                        {app.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">{app.description}</p>
                    </div>
                  </article>
                );

                return app.external ? (
                  <a
                    key={app.id}
                    href={app.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Abrir ${app.title}`}
                  >
                    {card}
                  </a>
                ) : (
                  <Link key={app.id} to={app.href} aria-label={`Abrir ${app.title}`}>
                    {card}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

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
