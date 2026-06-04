import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SDRStats, CloserStats } from "@/utils/atividadesCalculator";
import type { ProfileLite } from "@/hooks/useProfilesList";
import { profileLabel } from "@/hooks/useProfilesList";

const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Props<T> {
  rows: T[];
  profiles: ProfileLite[];
  onRowClick?: (userId: string) => void;
}

const nameOf = (id: string, profiles: ProfileLite[]) =>
  profileLabel(profiles.find((p) => p.id === id) ?? null) || "—";

export const SDRRankingTable = ({ rows, profiles, onRowClick }: Props<SDRStats>) => (
  <div className="rounded-xl border border-border/50 overflow-hidden">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SDR</TableHead>
          <TableHead className="text-right">
            Ligações <span className="text-[10px] font-normal text-muted-foreground/70">(VoIP)</span>
          </TableHead>
          <TableHead className="text-right">Tarefas</TableHead>
          <TableHead className="text-right">Contato Real.</TableHead>
          <TableHead className="text-right">Reun. Agend.</TableHead>
          <TableHead className="text-right">Reun. Real.</TableHead>
          <TableHead className="text-right">No-Show</TableHead>
          <TableHead className="text-right">Show Rate</TableHead>
          <TableHead className="text-right">Conv. Rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
              Sem atividades no período.
            </TableCell>
          </TableRow>
        )}
        {rows.map((r) => (
          <TableRow
            key={r.userId}
            className={onRowClick ? "cursor-pointer hover:bg-accent/30" : ""}
            onClick={() => onRowClick?.(r.userId)}
          >
            <TableCell className="font-medium">{nameOf(r.userId, profiles)}</TableCell>
            <TableCell className="text-right">{r.ligacoes}</TableCell>
            <TableCell className="text-right">{r.contatoRealizado}</TableCell>
            <TableCell className="text-right">{r.reunioesAgendadas}</TableCell>
            <TableCell className="text-right">{r.reunioesRealizadas}</TableCell>
            <TableCell className="text-right">{r.noShow}</TableCell>
            <TableCell className="text-right">{fmtPct(r.showRate)}</TableCell>
            <TableCell className="text-right">{fmtPct(r.conversionRate)}</TableCell>
          </TableRow>
        ))}
      </TableBody>

    </Table>
  </div>
);

export const CloserRankingTable = ({ rows, profiles, onRowClick }: Props<CloserStats>) => (
  <div className="rounded-xl border border-border/50 overflow-hidden">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Closer</TableHead>
          <TableHead className="text-right">Reun. Real.</TableHead>
          <TableHead className="text-right">Propostas</TableHead>
          <TableHead className="text-right">Follow-ups</TableHead>
          <TableHead className="text-right">Ganhos</TableHead>
          <TableHead className="text-right">Win Rate</TableHead>
          <TableHead className="text-right">Ticket Médio</TableHead>
          <TableHead className="text-right">Receita</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
              Sem atividades no período.
            </TableCell>
          </TableRow>
        )}
        {rows.map((r) => (
          <TableRow
            key={r.userId}
            className={onRowClick ? "cursor-pointer hover:bg-accent/30" : ""}
            onClick={() => onRowClick?.(r.userId)}
          >
            <TableCell className="font-medium">{nameOf(r.userId, profiles)}</TableCell>
            <TableCell className="text-right">{r.reunioesRealizadas}</TableCell>
            <TableCell className="text-right">{r.propostas}</TableCell>
            <TableCell className="text-right">{r.followups}</TableCell>
            <TableCell className="text-right">{r.fechamentosGanhos}</TableCell>
            <TableCell className="text-right">{fmtPct(r.winRate)}</TableCell>
            <TableCell className="text-right">{fmtMoney(r.ticketMedio)}</TableCell>
            <TableCell className="text-right">{fmtMoney(r.receitaTotal)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
