

## Plan

### 1. Nova aba "Qualificação" no OportunidadeDetailSheet
Hoje o sheet tem accordion "Informações da Oportunidade" e "Informações do Lead". Vou adicionar um terceiro accordion **"Qualificação"** (também fechado por padrão) puxando do lead vinculado:
- `qualificacao`, `tier`, `urgencia`, `temperatura` (do lead)
- `faturamento`, `segmento`, `cargo`, `nome_produto`, `tipo_produto`
- `descricao`, `motivo_desqualificacao`, `notas` do lead
- `data_reuniao_agendada`, `data_reuniao_realizada`
- `arrematador`, `canal`, `origem`, `data_aquisicao`

Tudo read-only (mesmo padrão do `ReadOnlyRow` já usado).

### 2. Corrigir nome da oportunidade ao criar via lead
Dois pontos:

**a) Trigger Postgres `auto_create_oportunidade`** (gatilha quando lead vai para `reuniao_realizada`):
```sql
nome_oportunidade = COALESCE(empresa, nome) || ' - Oportunidade'
```
Vou alterar para:
```sql
nome_oportunidade = COALESCE(NEW.empresa, NEW.nome)
```
(sem o sufixo " - Oportunidade")

**b) Criação manual** via `OportunidadeDialog`/`useCrmOportunidades.upsert`: verificar se há algum default que injeta " - Oportunidade". Se sim, remover.

### 3. Investigar lead Sattis sem dados
O usuário diz que o lead da Sattis foi criado mas "as informações do lead não vieram". Provavelmente:
- A oportunidade foi criada manualmente sem `lead_id` vinculado, OU
- O `lead_id` aponta para um registro com campos vazios.

Vou checar via SQL antes de implementar para confirmar o cenário e, se necessário, adicionar um fallback no sheet quando `lead_id` for null (mostrar "Sem lead vinculado" + botão para vincular).

### Arquivos
- `supabase/migrations/` — atualizar função `auto_create_oportunidade` (remover sufixo)
- `src/components/crm/OportunidadeDetailSheet.tsx` — novo accordion "Qualificação"
- `src/components/crm/OportunidadeDialog.tsx` / `useCrmOportunidades.ts` — remover sufixo se houver
- (verificação read-only na DB para o caso Sattis antes de codar)

