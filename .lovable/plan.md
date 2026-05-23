## Objetivo

Adicionar, no relatório da Growth Class (OnboardingDetailSheet), um botão **"Exportar jornada completa (PDF)"** que gera um PDF estruturado pelo framework **SPICED**, com a identidade visual do CRM (dark, Montserrat/Bebas, primary azul), reunindo toda a jornada do lead → oportunidade → account → growth class.

Disponível apenas quando a Growth Class está **concluída** (`growth_class_data_realizada IS NOT NULL` / `onboarding_status = 'concluida'`).

---

## Estrutura do PDF

**Capa**
- Logo do tenant + nome do cliente + data de geração
- Responsável comercial, AM, responsável pela GC

**1. Identificação**
- Lead: nome, empresa, cargo, email, telefone, instagram, site
- Segmento, faturamento, tier, urgência, origem, canal, pipe, cidade/estado
- Data de criação na origem vs entrada no CRM

**2. SPICED (núcleo do diagnóstico)**
- **S — Situation**: contexto (de `briefing_mercado`, `pesquisa_pre_qualificacao`, `info_deal`)
- **P — Pain**: dores (qualificação, resumo/transcrição da reunião comercial)
- **I — Impact**: impacto (faturamento, `grau_exigencia`, `nivel_consciencia`, oportunidades de monetização)
- **C — Critical Event**: gatilho/urgência (`urgencia`, `data_fechamento_previsto`)
- **D — Decision**: processo de decisão, decisores, valores (EF/Fee/Total), contrato

**3. Jornada comercial (timeline)**
- `crm_atividades`: criação, mudanças de etapa, reuniões, tarefas
- `crm_call_events`: data, duração, operador, status, gravação, **resumo IA**

**4. Reunião comercial**
- Transcrição + resumo (`crm_oportunidades.transcricao_reuniao`, `resumo_reuniao`)
- Temperatura, motivo de perda se houver

**5. Fechamento & Contrato**
- Valores EF, Fee, Total, data fechamento, link contrato, validação de divergência, produtos contratados

**6. Pré Growth Class**
- Conteúdo de `pre_growth_class_relatorio` na íntegra

**7. 🎯 GROWTH CLASS — Marco balizador de expectativa (seção em destaque)**

Tratada como **a seção central do relatório**, com peso visual diferente das outras:
- Página dedicada com **capa interna** (Bebas Neue grande, faixa primary azul, ícone/badge "MARCO ZERO DA OPERAÇÃO")
- Subtítulo explicando: *"A Growth Class é o ponto de calibração entre o que foi vendido e o que será entregue. Este é o registro oficial da expectativa acordada com o cliente."*

Conteúdo organizado em blocos visuais (cards com borda primary):

- **📅 Realização**: data agendada × data realizada, responsável V4, link do meet
- **💬 Expectativas declaradas pelo cliente** (`growth_class_expectativas`) — **destacado em quote block** com borda lateral azul, fonte maior
- **📝 Ata oficial** (`growth_class_ata`)
- **🎙️ Transcrição da reunião** (`growth_class_transcricao_reuniao`) — colapsável visualmente (texto menor, em seção secundária)
- **💰 Oportunidades de monetização identificadas** (`growth_class_oportunidades_monetizacao`)
- **➡️ Próximos passos acordados** (`growth_class_proximos_passos`) — em formato de checklist visual

**8. Síntese executiva para a operação (IA)**
- Resumo de 1 página em bullets prontos pra time de execução: quem é o cliente, **dor central**, **promessa feita na GC**, **expectativa do cliente em uma frase**, entregáveis combinados, riscos, primeiras ações nos próximos 30 dias
- Gerada via Lovable AI (`google/gemini-2.5-pro`) consolidando os dados anteriores, com **ênfase explícita no que foi prometido vs expectativa declarada na GC**

---

## Implementação técnica

**Edge function nova**: `supabase/functions/generate-account-journey-pdf/index.ts`
- Recebe `account_id`, valida JWT (respeita RLS do usuário)
- Fetch: `accounts`, `crm_oportunidades`, `crm_leads`, `crm_atividades`, `crm_call_events`, `cobrancas`, `tenants` (logo + cor)
- Chama Lovable AI pra seção 8
- Renderiza HTML estilizado e gera PDF via `@react-pdf/renderer` (Deno) com fontes Montserrat/Bebas Neue carregadas inline, paginação automática, header com nome do cliente e footer com numeração
- Upload em bucket novo `account-journeys` (privado, RLS por tenant), retorna URL assinada de 1h

**Bucket novo**: `account-journeys` (privado) com policies de leitura por tenant.

**Frontend**: em `OnboardingDetailSheet.tsx`, botão `Exportar jornada (PDF)` ao lado dos botões da GC, visível só quando concluída. Loading state + toast + download automático.

**Identidade visual do PDF**
- Background `#0a0a0f` (dark CRM)
- Texto: branco / cinza claro
- Headings: Bebas Neue, primary `#3B82F6`
- Body: Montserrat
- Seção Growth Class: faixa horizontal primary azul, badge destacado, quote block para a expectativa
- Cards com bordas em `hsl(217 91% 60% / 0.2)`
- Capa com logo do tenant

---

## Custos/limitações
- Síntese IA: 1 chamada Gemini Pro por export (~$0.01–0.03 em créditos do workspace)
- Geração: ~10–20s (IA + render)
- PDF fica no storage 30 dias