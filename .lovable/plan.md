

## Plano — Corrigir visibilidade da "Pesquisa Pré-Qualificação"

### Problema
No `LeadDetailSheet.tsx` (linha 499), o painel `PreQualificationPanel` foi colocado **dentro do mesmo bloco condicional** do `MarketBriefingPanel`, que só renderiza quando a etapa está em `reuniao_agendada`, `reuniao_realizada` ou `no_show`. Por isso, ao mover um lead para `tentativa_contato` (que é quando a IA dispara), a seção não aparece em lugar nenhum.

### Correção
Separar os dois painéis em blocos condicionais distintos, dentro da aba **Informações** (logo após o campo "Detalhes da qualificação"):

- **PreQualificationPanel**: visível quando `etapa !== 'entrada'` (ou seja, a partir de `tentativa_contato` em diante, incluindo desqualificados que já passaram da entrada).
- **MarketBriefingPanel**: mantém a regra atual (`reuniao_agendada` / `reuniao_realizada` / `no_show`).

Assim, assim que o lead sai de Entrada, a seção "Pesquisa Pré-Qualificação (IA)" aparece na aba Informações com loading → resultado, e o Briefing de Mercado continua aparecendo só perto da reunião.

### Arquivo
- **Editar**: `src/components/crm/LeadDetailSheet.tsx` (linhas 498-504) — desmembrar o bloco condicional.

### Onde encontrar depois
Abra o lead → aba **"Informações"** → role até o final → seção **"Pesquisa Pré-Qualificação (IA)"** logo abaixo de "Detalhes da qualificação".

