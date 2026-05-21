## O que será feito

1. **Gerar agora o CSV das oportunidades desqualificadas** (`fechado_perdido`) e entregar como artifact aqui no chat.
   - Mesmo modelo do export de leads: colunas **Empresa, Nome, Telefone, Etapa do CRM**.
   - Adiciono também a coluna **Motivo da Perda** (informação chave que só existe em oportunidades).
   - Arquivo: `oportunidades-desqualificadas.csv`.

2. **Criar o feature de export de oportunidades em CSV** (espelhando o de leads):
   - Novo componente `src/components/crm/OportunidadeExportDialog.tsx` com mesma UX do `LeadExportDialog`.
   - Checkboxes por etapa de oportunidade (`proposta`, `negociacao`, `contrato`, `follow_infinito`, `fechado_ganho`, `fechado_perdido`).
   - Filtro adicional: "Excluir oportunidades com tarefa pendente" (consulta `crm_atividades` por `oportunidade_id`).
   - Colunas exportadas: Empresa, Nome, Telefone (puxados via join do `lead_id`), Etapa do CRM, Motivo da Perda.
   - Botão "Exportar CSV" na página `src/pages/Oportunidades.tsx`, ao lado do botão de importar.

## Observação

No banco a etapa "desqualificada" das oportunidades é `fechado_perdido` (confirmado por query). É essa que será considerada como "desqualificadas".

Para eu poder gravar o CSV e os arquivos do feature, **mude para o modo Build** e eu sigo com a implementação + entrega do arquivo.