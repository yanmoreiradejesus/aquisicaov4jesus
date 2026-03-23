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

interface Lead {
  LEAD: string;
  DATA: string;
  CANAL?: string;
  TIER?: string;
  URGÊNCIA?: string;
  CARGO?: string;
  "E-MAIL"?: string;
  CPMQL?: string;
  FEE?: string;
  "E.F"?: string;
  BOOKING?: string;
  "DATA DA ASSINATURA"?: string;
}

interface LeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  stageTitle: string;
}

const LeadsDialog = ({ open, onOpenChange, leads, stageTitle }: LeadsDialogProps) => {
  const formatCurrency = (value: string | undefined) => {
    if (!value) return "-";
    const num = parseFloat(value);
    if (isNaN(num)) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(num);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("pt-BR");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading">
            {stageTitle} - {leads.length} leads
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] w-full">
          {/* Mobile: card layout */}
          <div className="block md:hidden space-y-3 p-1">
            {leads.map((lead, index) => (
              <div key={index} className="rounded-lg border border-border/50 bg-card p-4 space-y-2">
                <p className="font-medium text-sm text-foreground">{(lead as any).LEADS || lead.LEAD || "-"}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Data: <span className="text-foreground">{formatDate(lead.DATA)}</span></span>
                  <span>Canal: <span className="text-foreground">{lead.CANAL || "-"}</span></span>
                  <span>Tier: <span className="text-foreground">{lead.TIER || "-"}</span></span>
                  <span>Urgência: <span className="text-foreground">{lead.URGÊNCIA || "-"}</span></span>
                  <span>Cargo: <span className="text-foreground">{lead.CARGO || "-"}</span></span>
                  <span>CPMQL: <span className="text-foreground">{formatCurrency(lead.CPMQL)}</span></span>
                </div>
                <p className="text-xs text-muted-foreground truncate">E-mail: <span className="text-foreground">{lead["E-MAIL"] || "-"}</span></p>
              </div>
            ))}
          </div>
          {/* Desktop: table layout */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Lead</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Urgência</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>CPMQL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium min-w-[150px]">{(lead as any).LEADS || lead.LEAD || "-"}</TableCell>
                    <TableCell>{formatDate(lead.DATA)}</TableCell>
                    <TableCell>{lead.CANAL || "-"}</TableCell>
                    <TableCell>{lead.TIER || "-"}</TableCell>
                    <TableCell>{lead.URGÊNCIA || "-"}</TableCell>
                    <TableCell>{lead.CARGO || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{lead["E-MAIL"] || "-"}</TableCell>
                    <TableCell>{formatCurrency(lead.CPMQL)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default LeadsDialog;
