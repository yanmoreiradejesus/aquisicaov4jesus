import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AFaturarForm, { type AFaturarRow } from "@/components/admin/AFaturarForm";

const AdminFaturarContrato = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["accounts", "a-faturar", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("accounts")
        .select(
          "id, cliente_nome, oportunidade_id, origem, modelo_contrato, forma_pagamento_ef, qtd_parcelas_ef, valor_ef_override, dia_vencimento_primeiro_ef, dia_vencimento_demais_ef, forma_pagamento_recorrente, qtd_parcelas_recorrente, valor_fee_override, dia_vencimento_primeiro_recorrente, dia_vencimento_demais_recorrente, oportunidade:crm_oportunidades(id, contrato_url, valor_ef, valor_fee), expansao:crm_expansoes(id, contrato_path, valor_aumento_fee, valor_escopo_fechado, novo_fee_mensal, tipo_ganho)"
        )
        .eq("id", accountId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const row: AFaturarRow | null = useMemo(() => {
    if (!data) return null;
    const isExpansao = data.origem === "expansao";
    const tipoG = data.expansao?.tipo_ganho as string | undefined;
    const temFeeExp = tipoG === "aumento_fee" || tipoG === "ambos";
    const temEfExp = tipoG === "escopo_fechado" || tipoG === "ambos";
    const efDisplay = isExpansao ? (temEfExp ? data.expansao?.valor_escopo_fechado : null) : data.oportunidade?.valor_ef;
    const feeDisplay = isExpansao ? (temFeeExp ? data.expansao?.novo_fee_mensal : null) : data.oportunidade?.valor_fee;
    const contratoUrl = isExpansao ? data.expansao?.contrato_path ?? null : data.oportunidade?.contrato_url ?? null;
    return {
      id: data.id,
      cliente_nome: data.cliente_nome,
      oportunidade_id: data.oportunidade?.id ?? null,
      contrato_url: contratoUrl,
      valor_ef: efDisplay ?? null,
      valor_fee: feeDisplay ?? null,
      modelo_contrato: data.modelo_contrato ?? null,
      forma_pagamento_ef: data.forma_pagamento_ef ?? null,
      qtd_parcelas_ef: data.qtd_parcelas_ef ?? null,
      valor_ef_override: data.valor_ef_override ?? null,
      dia_vencimento_primeiro_ef: data.dia_vencimento_primeiro_ef ?? null,
      dia_vencimento_demais_ef: data.dia_vencimento_demais_ef ?? null,
      forma_pagamento_recorrente: data.forma_pagamento_recorrente ?? null,
      qtd_parcelas_recorrente: data.qtd_parcelas_recorrente ?? null,
      valor_fee_override: data.valor_fee_override ?? null,
      dia_vencimento_primeiro_recorrente: data.dia_vencimento_primeiro_recorrente ?? null,
      dia_vencimento_demais_recorrente: data.dia_vencimento_demais_recorrente ?? null,
    };
  }, [data]);

  const back = () => navigate("/admin/financeiro");

  return (
    <div className="min-h-screen bg-background">
      <main className="w-full px-4 lg:px-8 py-6 lg:py-10 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Button size="sm" variant="ghost" onClick={back}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {row?.cliente_nome || "Contrato"}
            </h1>
            <p className="text-sm text-muted-foreground">Validar faturamento do contrato</p>
          </div>
        </div>

        {isLoading || !row ? (
          <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando contrato...
          </div>
        ) : (
          <AFaturarForm
            row={row}
            onCancel={back}
            onValidated={() => {
              qc.invalidateQueries({ queryKey: ["accounts", "a-faturar"] });
              qc.invalidateQueries({ queryKey: ["cobrancas"] });
              back();
            }}
          />
        )}
      </main>
    </div>
  );
};

export default AdminFaturarContrato;
