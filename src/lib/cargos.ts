// Fonte única de cargos / departamentos / páginas — usada por Admin, LeadDialog, filtros, etc.
// Manter sincronizado com `profiles.cargo` no banco.

export const CARGOS_BY_AREA: Record<string, string[]> = {
  Receitas: ["SDR", "Closer", "BDR", "Coordenador de Receitas", "Líder de Expansão"],
  "PE&G": [
    "Coordenador de PE&G",
    "Account Manager",
    "Gestor de Tráfego",
    "Designer",
    "Copywriter",
    "Social Media",
    "Consultor",
    "Analista de Tech",
  ],
  ADM: ["Coordenadora ADM", "HRBP", "Analista Financeira"],
};

export const CARGO_OPTIONS = [
  ...CARGOS_BY_AREA.Receitas,
  ...CARGOS_BY_AREA["PE&G"],
  ...CARGOS_BY_AREA.ADM,
  "Outro",
];

export const DEPARTAMENTO_OPTIONS = ["Receitas", "PE&G", "ADM", "Outro"];

export const isCargoReceitas = (cargo: string | null | undefined) =>
  !!cargo && CARGOS_BY_AREA.Receitas.includes(cargo);

export interface AppPage {
  path: string;
  label: string;
  group: string;
}

export const AVAILABLE_PAGES: AppPage[] = [
  { path: "/aquisicao/funil", label: "Funil", group: "Data Analytics" },
  { path: "/aquisicao/dashboard", label: "Dashboard", group: "Data Analytics" },
  { path: "/aquisicao/insights", label: "Insights", group: "Data Analytics" },
  { path: "/aquisicao/meta", label: "Meta", group: "Data Analytics" },
  { path: "/aquisicao/financeiro", label: "Financeiro", group: "Data Analytics" },
  { path: "/comercial/leads", label: "CRM Leads", group: "Comercial" },
  { path: "/comercial/oportunidades", label: "CRM Oportunidades", group: "Comercial" },
  { path: "/comercial/onboarding", label: "Onboarding", group: "Comercial" },
  { path: "/comercial/accounts", label: "Accounts", group: "Comercial" },
  { path: "/comercial/cobrancas", label: "Cobranças", group: "Comercial" },
  { path: "/app-v4", label: "App V4", group: "Outros" },
];

export const PAGE_GROUPS = ["Data Analytics", "Comercial", "Outros"];
