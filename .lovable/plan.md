# Padrão de Relatório Pré Growth Class — SPICED

## Resposta às suas perguntas

**1. Qual IA está processando hoje?**
A função `meeting-ai` usa a **Anthropic Claude** com 3 modelos disponíveis:
- `sonnet` → `claude-sonnet-4-5` *(padrão atual — bom equilíbrio)*
- `opus45` → `claude-opus-4-5` *(o mais potente da Anthropic — melhor raciocínio, síntese e nuance)*
- `haiku45` → `claude-haiku-4-5` *(rápido e barato)*

A chamada do Pré GC hoje vai sem `provider`, então cai no padrão `sonnet`. Para o relatório executivo, **Opus 4.5 é o melhor que temos** — vale o custo extra porque o relatório é gerado uma única vez por cliente e precisa de máxima qualidade de síntese.

**2. Campos a remover** ✅
- Arrematador
- Data de criação do lead
- Data de aquisição

**3. Framework SPICED como espinha dorsal** ✅

---

## O que vou alterar

### A) Forçar o uso de Claude Opus 4.5 no Pré GC
No `OnboardingDetailSheet.tsx`, ao invocar `meeting-ai` com `action: "pre_growth_class"`, passar `provider: "opus45"`.

### B) Reescrever o prompt do relatório no `meeting-ai/index.ts`

Novo formato **objetivo, enxuto e SPICED-first**:

```text
## 🏢 Identificação
- Empresa | Segmento | Faturamento | Localização
- Contato principal (nome, cargo, contato)
- Categoria contratada (Saber/Ter/Executar/Potencializar)
- Deal: Fee mensal + EF | Data de assinatura

## 🎯 SPICED — Diagnóstico Consolidado

### S — Situation (Situação atual)
Onde o cliente está hoje: contexto de negócio, estrutura, momento.

### P — Pain (Dor)
Dores concretas levantadas na qualificação e nas reuniões. Impacto no negócio.

### I — Impact (Impacto)
Custo de manter a dor (financeiro, operacional, estratégico). Quantificar quando possível.

### C — Critical Event (Evento crítico)
Prazo, marco ou gatilho que torna a solução urgente AGORA.

### D — Decision (Decisão)
Quem decide, quem influencia, critérios de decisão, processo de aprovação.

## 💼 O Que Foi Contratado
Escopo, expectativas alinhadas no fechamento, prazos.

## 💰 Oportunidades de Monetização
Upsells/cross-sells já mapeados pelo closer.

## ⚠️ Riscos & Pontos de Atenção
Gaps, expectativas potencialmente desalinhadas, sinais de alerta.

## 🎯 Agenda Sugerida da Growth Class
3-5 bullets objetivos.

## 🚀 Próximas Ações
Checkbox markdown.
```

**Diretrizes do prompt:**
- Tom: objetivo, executivo, sem encheção de linguiça.
- Quando o dado não existir: `_Não informado_` (nunca inventar).
- SPICED é o coração — se faltar dado em alguma letra, registrar explicitamente como gap a investigar na GC.
- Remover do prompt: arrematador, data de criação, data de aquisição.

### C) Limpar o contexto enviado (opcional, recomendado)
No `OnboardingDetailSheet.tsx`, antes de mandar `contexto`, remover os campos `arrematador`, `data_criacao_origem`, `data_aquisicao` do objeto `lead` para não poluir o input da IA.

---

## Arquivos a editar

- `supabase/functions/meeting-ai/index.ts` — novo prompt SPICED, remover campos irrelevantes
- `src/components/crm/OnboardingDetailSheet.tsx` — passar `provider: "opus45"` e sanitizar contexto

Sem mudanças de banco, sem migrations.
