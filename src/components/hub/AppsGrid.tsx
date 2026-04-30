import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export interface AppEntry {
  id: string;
  title: string;
  description: string;
  href: string;
  external?: boolean;
  accessPaths: string[];
}

export const APPS: AppEntry[] = [
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

interface AppsGridProps {
  compact?: boolean;
}

export function AppsGrid({ compact = false }: AppsGridProps) {
  const { hasPageAccess } = useAuth();
  const visibleApps = APPS.filter((a) => a.accessPaths.some((p) => hasPageAccess(p)));

  if (visibleApps.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Você ainda não tem acesso a nenhuma aplicação. Solicite acesso ao administrador.
      </div>
    );
  }

  return (
    <section className={compact ? "" : "mb-20 lg:mb-28"}>
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
          const minH = compact ? "min-h-[200px] lg:min-h-[240px]" : "min-h-[260px] lg:min-h-[320px]";
          const card = (
            <article className={`group relative h-full overflow-hidden rounded-2xl border border-border/60 bg-[hsl(var(--surface-1))] p-6 lg:p-8 transition-all duration-500 hover:border-primary/50 hover:bg-[hsl(var(--surface-2))] hover:shadow-[var(--shadow-glow)] cursor-pointer ${minH} flex flex-col justify-between`}>
              <div className="flex items-start justify-between">
                <span
                  className="font-heading text-foreground/15 leading-none transition-all duration-500 group-hover:text-primary/40"
                  style={{ fontSize: compact ? "clamp(2.5rem, 5vw, 4rem)" : "clamp(3.5rem, 7vw, 5.5rem)" }}
                >
                  {num}
                </span>
                <ArrowUpRight className="h-6 w-6 lg:h-7 lg:w-7 text-muted-foreground transition-all duration-500 group-hover:text-primary group-hover:-translate-y-1 group-hover:translate-x-1" />
              </div>
              <div>
                <h3
                  className="font-heading uppercase text-foreground leading-[0.95] tracking-tight mb-2"
                  style={{ fontSize: compact ? "clamp(1.5rem, 2.5vw, 2rem)" : "clamp(1.75rem, 3vw, 2.5rem)" }}
                >
                  {app.title}
                </h3>
                <p className="text-sm text-muted-foreground">{app.description}</p>
              </div>
            </article>
          );

          return app.external ? (
            <a key={app.id} href={app.href} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${app.title}`}>
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
  );
}
