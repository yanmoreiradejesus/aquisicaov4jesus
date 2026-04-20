

## Plano — Step "Ganho" no diálogo de avançar oportunidade

### Visão geral
Quando a oportunidade for movida para `fechado_ganho`, abrir um **step adicional** no `OportunidadeAvancarDialog` (depois dos passos meeting/task) com 4 campos:

1. **Contrato assinado** — upload de arquivo (PDF/DOCX/JPG/PNG)
2. **Oportunidades de monetização** — textarea (upsell, cross-sell, expansão)
3. **Grau de exigência do cliente** — seletor 4 níveis (Baixo / Médio / Alto / Crítico) com badge colorido
4. **Informações gerais do deal** — textarea (decisores, contexto, prazos)

Esses dados ficam visíveis no `OportunidadeDetailSheet` numa nova seção "Deal Fechado" — base para handoff ao Account Manager.

### Mudanças

**1. Schema (`crm_oportunidades`)** — novas colunas:
- `contrato_url` text
- `oportunidades_monetizacao` text
- `grau_exigencia` text
- `info_deal` text

**2. Storage** — novo bucket privado `contratos-assinados`:
- INSERT/SELECT: authenticated
- DELETE: admin

**3. UI — `OportunidadeAvancarDialog.tsx`**
- `REQUIRES_GANHO_FORM = new Set(["fechado_ganho"])`
- Novo step `"ganho"` (sempre o último quando aplicável)
- Total de steps recalculado dinamicamente
- **Defaults**: contrato obrigatório, demais campos obrigatórios também (deal ganho merece registro completo)
- Aceita PDF + DOCX + JPG/PNG (cobre contrato físico fotografado)
- Upload do contrato antes do `onConfirm`; payload extra com os 4 campos

**4. Hook — `useCrmOportunidades.ts`**
- Estender `updateEtapa` para aceitar e gravar os 4 campos novos junto da mudança de etapa

**5. UI — `OportunidadeDetailSheet.tsx`**
- Nova seção "Deal Fechado" (accordion, visível se `etapa === fechado_ganho` ou se já houver dados)
- Mostra: link do contrato, monetização, badge colorido de exigência, info deal

### Arquivos
- **Migração**: nova (colunas + bucket + RLS)
- **Editar**: `src/components/crm/OportunidadeAvancarDialog.tsx`
- **Editar**: `src/hooks/useCrmOportunidades.ts`
- **Editar**: `src/components/crm/OportunidadeDetailSheet.tsx`

### Decisões assumidas (me avise se quiser mudar)
- **Obrigatoriedade**: todos os 4 campos obrigatórios (deal fechado precisa de registro completo).
- **Formatos**: PDF + DOCX + JPG/PNG.
- **Rótulos exigência**: Baixo / Médio / Alto / Crítico (verde → vermelho).

