import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTenantEnabledPages } from "@/hooks/useTenantEnabledPages";

export interface AppSubItem {
  label: string;
  path: string;
}

export interface AppEntry {
  id: string;
  title: string;
  description: string;
  href: string;
  external?: boolean;
  accessPaths: string[];
  bypassTenantCheck?: boolean;
  items?: AppSubItem[];
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
      "/aquisicao/financeiro",
      "/aquisicao/legado/funil",
      "/aquisicao/legado/meta",
    ],
    items: [
      { label: "Funil", path: "/aquisicao/funil" },
      { label: "Meta", path: "/aquisicao/meta" },
      { label: "Atividades", path: "/aquisicao/atividades" },
      { label: "Insights Broker", path: "/aquisicao/insights" },
      { label: "Financeiro", path: "/aquisicao/financeiro" },
    ],
  },
  {
    id: "comercial",
    title: "Revenue",
    description: "Leads, oportunidades e gestão de receitas.",
    href: "/comercial/leads",
    accessPaths: [
      "/comercial/leads",
      "/comercial/oportunidades",
      "/comercial/onboarding",
      "/comercial/cobrancas",
    ],
    items: [
      { label: "Leads", path: "/comercial/leads" },
      { label: "Oportunidades", path: "/comercial/oportunidades" },
      { label: "Onboarding", path: "/comercial/onboarding" },
      { label: "Expansão", path: "/comercial/expansao" },
    ],
  },
  {
    id: "peg",
    title: "PE&G",
    description: "Performance, expansão e gestão de contas.",
    href: "/comercial/accounts",
    accessPaths: ["/comercial/accounts"],
    items: [
      { label: "Accounts", path: "/comercial/accounts" },
      { label: "Database", path: "/comercial/projetos" },
      { label: "Cadastro", path: "/comercial/projetos/cadastro" },
      { label: "Tarefas", path: "/peg/tarefas" },
      { label: "Squad view", path: "/peg/tarefas/squad" },
    ],
  },
  {
    id: "admin",
    title: "Admin",
    description: "People, financeiro e gestão interna.",
    href: "/admin/people",
    accessPaths: ["/admin/people", "/admin/financeiro"],
    bypassTenantCheck: true,
    items: [
      { label: "People", path: "/admin/people" },
      { label: "Financeiro", path: "/admin/financeiro" },
    ],
  },
];

interface AppsGridProps {
  compact?: boolean;
}

export function AppsGrid({ compact = false }: AppsGridProps) {
  const { hasPageAccess, authResolved } = useAuth();
  const { isPageEnabled, isLoading: tenantPagesLoading } = useTenantEnabledPages();

  const canReach = (app: AppEntry, path: string) =>
    hasPageAccess(path) && (app.bypassTenantCheck || isPageEnabled(path));

  const visibleApps = APPS
    .map((a) => ({
      ...a,
      visibleItems: (a.items ?? []).filter((i) => canReach(a, i.path)),
    }))
    .filter((a) => a.accessPaths.some((p) => canReach(a, p)));

  const stillResolving = !authResolved || tenantPagesLoading;

  if (visibleApps.length === 0) {
    if (stillResolving) {
      return (
        <section className={compact ? "" : "mb-20 lg:mb-28"}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`rounded-2xl border border-border/40 bg-[hsl(var(--surface-1))]/40 ${compact ? "min-h-[200px] lg:min-h-[240px]" : "min-h-[260px] lg:min-h-[320px]"} animate-pulse`}
              />
            ))}
          </div>
        </section>
      );
    }
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
          const hasItems = app.visibleItems.length > 0;

          return (
            <article
              key={app.id}
              className={`group relative h-full overflow-hidden rounded-2xl border border-border/60 bg-[hsl(var(--surface-1))] p-6 lg:p-8 transition-all duration-500 hover:border-primary/50 hover:bg-[hsl(var(--surface-2))] hover:shadow-[var(--shadow-glow)] ${minH} flex flex-col justify-between`}
            >
              {/* Big number + arrow → link to primary href */}
              <Link
                to={app.href}
                aria-label={`Abrir ${app.title}`}
                className="flex items-start justify-between"
              >
                <span
                  className="font-heading text-foreground/15 leading-none transition-all duration-500 group-hover:text-primary/40"
                  style={{ fontSize: compact ? "clamp(2.5rem, 5vw, 4rem)" : "clamp(3.5rem, 7vw, 5.5rem)" }}
                >
                  {num}
                </span>
                <ArrowUpRight className="h-6 w-6 lg:h-7 lg:w-7 text-muted-foreground transition-all duration-500 group-hover:text-primary group-hover:-translate-y-1 group-hover:translate-x-1" />
              </Link>

              {/* Bottom stack: title + description ↔ submenu */}
              <div className="relative">
                <Link to={app.href} aria-label={`Abrir ${app.title}`} className="block">
                  <h3
                    className="font-heading uppercase text-foreground leading-[0.95] tracking-tight mb-2"
                    style={{ fontSize: compact ? "clamp(1.5rem, 2.5vw, 2rem)" : "clamp(1.75rem, 3vw, 2.5rem)" }}
                  >
                    {app.title}
                  </h3>
                </Link>

                {/* Description — fades out on hover */}
                <p
                  className={`text-sm text-muted-foreground transition-all duration-300 ${
                    hasItems ? "group-hover:opacity-0 group-hover:-translate-y-1" : ""
                  }`}
                >
                  {app.description}
                </p>

                {/* Submenu — slides up on hover */}
                {hasItems && (
                  <ul
                    className="absolute inset-x-0 top-full mt-[-1.25rem] pointer-events-none opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto"
                    aria-hidden="true"
                  >
                    {app.visibleItems.map((it, i) => (
                      <li
                        key={it.path}
                        style={{ transitionDelay: `${80 + i * 40}ms` }}
                        className="opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0"
                      >
                        <Link
                          to={it.path}
                          className="group/item flex items-center justify-between border-b border-border/40 py-1.5 text-sm text-foreground/85 hover:text-primary hover:border-primary/60 hover:pl-1 transition-all duration-200"
                        >
                          <span className="font-medium tracking-tight">{it.label}</span>
                          <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all duration-200 group-hover/item:opacity-100 group-hover/item:translate-x-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
