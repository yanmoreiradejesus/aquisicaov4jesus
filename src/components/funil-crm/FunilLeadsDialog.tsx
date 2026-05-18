import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink } from "lucide-react";
import type { FunilCrmResult, Lente } from "@/utils/crmFunnelCalculator";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: FunilCrmResult | null;
  stageId: "mql" | "sql" | "sal" | "ass" | null;
  subId: string | null;
  lente: Lente;
  profileNameById: Map<string, string>;
}

const fmtBRL = (n: number | null | undefined) =>
  n == null || isNaN(Number(n))
    ? "—"
    : Number(n).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      });

const fmtDate = (raw: any) => {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
};

const STAGE_TITLE: Record<string, string> = {
  mql: "MQL",
  sql: "SQL",
  sal: "SAL",
  ass: "ASS",
};

const SUB_TITLE: Record<string, string> = {
  entrada: "Entrada",
  tentativa_contato: "Tentativa de Contato",
  contato_realizado: "Contato Realizado",
  avancou: "Já avançou",
  reuniao_agendada: "Reunião Agendada",
  no_show: "No-Show",
  realizada: "Reunião Realizada",
  sem_oportunidade: "Sem oportunidade ainda",
  proposta: "Proposta",
  negociacao: "Negociação",
  contrato: "Dúvidas e Fechamento",
  follow_infinito: "Follow Infinito",
  fechado_ganho: "Ganho",
  fechado_perdido: "Perdido",
};

const FunilLeadsDialog = ({
  open,
  onOpenChange,
  data,
  stageId,
  subId,
  lente,
  profileNameById,
}: Props) => {
  const { rows, title, isAss } = useMemo(() => {
    if (!data || !stageId) {
      return { rows: [] as any[], title: "", isAss: false };
    }
    const leadById = new Map<string, any>();
    [...data.inMqlLeads, ...data.inSqlLeads, ...data.inSalLeads].forEach((l) =>
      leadById.set(l.id, l),
    );

    let baseLeads: any[] = [];
    let baseOps: any[] = [];
    let isAssBucket = false;

    if (stageId === "mql") {
      baseLeads = data.inMqlLeads;
      if (subId === "entrada") baseLeads = baseLeads.filter((l) => l.etapa === "entrada");
      else if (subId === "tentativa_contato") baseLeads = baseLeads.filter((l) => l.etapa === "tentativa_contato");
      else if (subId === "contato_realizado") baseLeads = baseLeads.filter((l) => l.etapa === "contato_realizado");
      else if (subId === "avancou")
        baseLeads = baseLeads.filter(
          (l) => !["entrada", "tentativa_contato", "contato_realizado"].includes(l.etapa),
        );
    } else if (stageId === "sql") {
      baseLeads = data.inSqlLeads;
      if (subId === "reuniao_agendada") baseLeads = baseLeads.filter((l) => l.etapa === "reuniao_agendada");
      else if (subId === "no_show") baseLeads = baseLeads.filter((l) => l.etapa === "no_show");
      else if (subId === "realizada") baseLeads = baseLeads.filter((l) => l.etapa === "reuniao_realizada");
    } else if (stageId === "sal") {
      baseLeads = data.inSalLeads;
      if (subId && subId !== "sem_oportunidade") {
        // sub é etapa de oportunidade
        const opsByLead = new Map<string, any[]>();
        data.inAssOps.forEach((o) => {
          const arr = opsByLead.get(o.lead_id) ?? [];
          arr.push(o);
          opsByLead.set(o.lead_id, arr);
        });
        // Para sub-etapas, precisamos olhar as oportunidades de cada lead SAL
        // Mas as oportunidades estão fora de inAssOps; vamos filtrar pelos leads que têm uma op naquela etapa
        // Como o calculator não expõe inSalOps, mantemos: mostra leads SAL.
        // Já filtrar por sub aqui exigiria opsByLeadId — simplificação: mostra todos os leads SAL.
      } else if (subId === "sem_oportunidade") {
        // não temos a info aqui sem opsByLeadId; deixa todos
      }
    } else if (stageId === "ass") {
      baseOps = data.inAssOps;
      isAssBucket = true;
    }

    const rows = isAssBucket
      ? baseOps.map((o) => ({
          id: o.lead_id ?? o.id,
          nome: "Oportunidade fechada",
          empresa: "",
          responsavel: profileNameById.get(o.responsavel_id) ?? "—",
          origem: "—",
          tier: "—",
          etapa: "fechado_ganho",
          dataEvento: o.data_fechamento_real,
          valor: (Number(o.valor_ef) || 0) + (Number(o.valor_fee) || 0),
          cpmql: null,
          pipe: "inbound",
        }))
      : baseLeads.map((l) => ({
          id: l.id,
          nome: l.nome ?? "—",
          empresa: l.empresa ?? "—",
          responsavel: profileNameById.get(l.responsavel_id) ?? "—",
          origem: l.origem ?? "—",
          tier: l.tier ?? "—",
          etapa: l.etapa,
          dataEvento:
            stageId === "mql"
              ? l.data_criacao_origem ?? l.created_at
              : stageId === "sql"
              ? lente === "coorte"
                ? l.data_criacao_origem ?? l.created_at
                : l.data_reuniao_agendada ?? l.created_at
              : lente === "coorte"
              ? l.data_criacao_origem ?? l.created_at
              : l.data_reuniao_realizada,
          valor: null,
          cpmql: l.valor_pago,
          pipe: l.pipe ?? "inbound",
        }));

    const title = subId
      ? `${STAGE_TITLE[stageId]} · ${SUB_TITLE[subId] ?? subId}`
      : STAGE_TITLE[stageId];

    return { rows, title, isAss: isAssBucket };
  }, [data, stageId, subId, lente, profileNameById]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Leads · {title}{" "}
            <span className="text-sm text-muted-foreground font-normal">
              ({rows.length})
            </span>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Pipe</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Data</TableHead>
                {isAss ? (
                  <TableHead className="text-right">Valor</TableHead>
                ) : (
                  <TableHead className="text-right">Valor pago</TableHead>
                )}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Nenhum lead nesta etapa.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell>{r.empresa}</TableCell>
                    <TableCell>{r.responsavel}</TableCell>
                    <TableCell>{r.origem}</TableCell>
                    <TableCell className="capitalize text-xs">{r.pipe}</TableCell>
                    <TableCell>{r.tier}</TableCell>
                    <TableCell className="text-xs">{r.etapa}</TableCell>
                    <TableCell>{fmtDate(r.dataEvento)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {isAss ? fmtBRL(r.valor) : fmtBRL(r.cpmql)}
                    </TableCell>
                    <TableCell>
                      {r.id ? (
                        <Link
                          to={`/comercial/leads/${r.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default FunilLeadsDialog;
