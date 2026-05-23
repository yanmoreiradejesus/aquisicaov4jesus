## Correções no PDF Account Journey

Vou refatorar `supabase/functions/generate-account-journey-pdf/index.ts` para resolver todos os problemas identificados na análise.

### 1. Sanitização de texto (emojis e caracteres especiais)
- Criar função `sanitize(text)` que substitui emojis comuns por equivalentes ASCII seguros do Helvetica:
  - `🎯 ✅ 🔴 🟡 🟢 📅 💬 📝 💰 ➡️ 🎙️ 📞 👥 🚀 ⚠️ 📊 🏢` → `•`, `[x]`, `[ALTA]`, `[MED]`, `[OK]`, `Data:`, `"`, `-`, `R$`, `→`, etc.
  - Strip de qualquer caractere fora do range Latin-1 (`\u0000-\u00FF`) com fallback `?`
- Aplicar `sanitize()` em **todo** texto antes de `doc.text()`, incluindo conteúdo gerado pela IA
- Ajustar prompt do Gemini para **não usar emojis** na saída

### 2. Pré-processar JSON cru
- Detectar campos `briefing_mercado`, `pesquisa_pre_qualificacao`, `pre_growth_class_relatorio` que são JSON
- Renderizar apenas campos legíveis (`resumo`, `highlights[].resumo`, `pontos_principais`) em formato narrativo
- Nunca despejar `JSON.stringify` no PDF

### 3. Deduplicação de conteúdo
- Se `lead.qualificacao` e `oportunidade.resumo_reuniao` têm overlap > 70% (comparação por substring/jaccard simples), renderizar apenas uma vez sob "Síntese da Qualificação"
- Marcar seções já renderizadas para não repetir "Participantes / Dores / Próximos passos"

### 4. Quebras de página corretas
- Helper `ensureSpace(mm)` antes de cada `sectionTitle()` — se restar < 40mm, força `doc.addPage()`
- Aplicar em todos os títulos de seção

### 5. Campos vazios com fallback `—`
- Helper `val(v)` → retorna `'—'` se `v` for null/undefined/`''`/`'null'`
- Aplicar em todos os campos (Cidade, Estado, datas, valores)

### 6. Growth Class vazia
- Se GC marcada como `concluida` mas todos os campos estão vazios → renderizar bloco único: *"Growth Class registrada mas conteúdo ainda não preenchido."*
- Não renderizar os 5 cards vazios

### 7. Logo do tenant na capa
- `fetch(tenant.client_logo_url)` → converter para base64 → `doc.addImage()` na capa
- Fallback para texto "V4 COMPANY" se logo não carregar ou der erro

### 8. Síntese executiva completa
- Aumentar `slice(0, 60000)` → `slice(0, 120000)` no input do Gemini
- Aumentar `max_tokens` da síntese para garantir resposta completa
- Ajustar prompt para retornar **markdown puro sem emojis**

### 9. Atividades agrupadas por dia
- Agrupar `crm_atividades` por data (YYYY-MM-DD) e renderizar como timeline com cabeçalho de dia
- Transcrições com timestamps `[00:05:43]` formatadas em itálico/cinza claro

### Arquivos alterados
- `supabase/functions/generate-account-journey-pdf/index.ts` (refatoração completa)

### Validação
- Gerar novo PDF para a mesma conta (PhD Sports Vila Prudente)
- Baixar via Storage e converter páginas com `pdftoppm -jpeg -r 150` 
- Inspecionar cada página: sem boxes pretos, sem JSON cru, sem duplicação, sem quebras feias, logo presente
