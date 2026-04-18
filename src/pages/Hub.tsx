import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import V4Header from "@/components/V4Header";
import { Card } from "@/components/ui/card";
import { TrendingUp, ArrowRight, LayoutGrid, Briefcase } from "lucide-react";

interface AppCard {
  id: string;
  title: string;
  description: string;
  href: string;
  external?: boolean;
  // The app is visible if the user has access to ANY of these paths (or is admin)
  accessPaths: string[];
  icon: React.ComponentType<{ className?: string }>;
}

const APPS: AppCard[] = [
  {
    id: "data-analytics",
    title: "Data Analytics",
    description: "Funil de vendas, dashboard comercial, metas e insights de aquisição.",
    href: "/aquisicao/funil",
    accessPaths: [
      "/aquisicao/funil",
      "/aquisicao/dashboard",
      "/aquisicao/insights",
      "/aquisicao/meta",
      "/aquisicao/financeiro",
    ],
    icon: TrendingUp,
  },
  {
    id: "comercial",
    title: "Comercial",
    description: "CRM de leads e oportunidades, gestão de contas e cobranças.",
    href: "/comercial/leads",
    accessPaths: [
      "/comercial/leads",
      "/comercial/oportunidades",
      "/comercial/accounts",
      "/comercial/cobrancas",
    ],
    icon: Briefcase,
  },
  {
    id: "app-v4",
    title: "App V4",
    description: "Sistema operacional V4 Jesus.",
    href: "https://app.v4jesus.com",
    external: true,
    accessPaths: ["/app-v4"],
    icon: LayoutGrid,
  },
];

const Hub = () => {
  const { hasPageAccess, profile } = useAuth();

  const visibleApps = APPS.filter((app) =>
    app.accessPaths.some((p) => hasPageAccess(p))
  );

  return (
    <div className="min-h-screen bg-background">
      <V4Header />
      <main className="container mx-auto max-w-5xl px-4 lg:px-8 py-12 lg:py-20">
        <header className="mb-10 lg:mb-16 space-y-3">
          <p className="text-xs lg:text-sm font-medium text-muted-foreground tracking-widest uppercase">
            V4 Jesus
          </p>
          <h1 className="font-heading text-3xl lg:text-5xl font-bold text-foreground">
            Olá{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.
          </h1>
          <p className="text-muted-foreground text-base lg:text-lg max-w-2xl">
            Selecione uma aplicação para começar.
          </p>
        </header>

        {visibleApps.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            Você ainda não tem acesso a nenhuma aplicação. Solicite acesso ao
            administrador.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            {visibleApps.map((app) => {
              const Icon = app.icon;
              const cardInner = (
                <Card className="p-6 lg:p-8 h-full transition-all duration-300 hover:border-primary/50 hover:shadow-lg cursor-pointer">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                  </div>
                  <h2 className="font-heading text-xl lg:text-2xl font-bold text-foreground mb-2">
                    {app.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {app.description}
                  </p>
                </Card>
              );
              return app.external ? (
                <a
                  key={app.id}
                  href={app.href}
                  className="group"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {cardInner}
                </a>
              ) : (
                <Link key={app.id} to={app.href} className="group">
                  {cardInner}
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Hub;
