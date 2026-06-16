## Migration: Gestão de Contas — base

Tenant alvo do seed: **Jesus & Co** (`ca48961c-9ee0-470d-9d9e-cfecbd7e26c2`).

### 1. ENUM novo
```sql
CREATE TYPE public.squad_type AS ENUM ('strikers', 'fenix', 'saber');
```

### 2. ALTER TABLE public.accounts
Adiciona colunas para classificação/segmentação (não recria a tabela, não toca `produtos_contratados`). Assumindo do prompt original colunas como:
- `squad public.squad_type`
- `segmento text`
- `ticket_mensal numeric`
- `data_inicio_contrato date` (se ainda não existir)
- demais colunas listadas no prompt original truncado

*(vou confirmar a lista exata das colunas do ALTER lendo o trecho truncado no momento da implementação — se você puder colar de novo a parte cortada do item 2, garanto fidelidade 100%)*

### 3. Nova tabela `public.squad_entregaveis`
Catálogo de entregáveis por squad (alimenta o form de contas).

```sql
CREATE TABLE public.squad_entregaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  squad public.squad_type NOT NULL,
  item text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, squad, item)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_entregaveis TO authenticated;
GRANT ALL ON public.squad_entregaveis TO service_role;

ALTER TABLE public.squad_entregaveis ENABLE ROW LEVEL SECURITY;
```

### 4. RLS (mesmo padrão de `cobrancas`)
```sql
CREATE POLICY "tenant_select" ON public.squad_entregaveis
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_insert" ON public.squad_entregaveis
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_update" ON public.squad_entregaveis
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_delete" ON public.squad_entregaveis
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());
```

+ trigger `set_tenant_id_on_insert` BEFORE INSERT (igual `cobrancas`)
+ trigger `update_updated_at_column` BEFORE UPDATE

### 5. Seed (tenant Jesus & Co)

**Saber** (3):
1. Estruturação Estratégica
2. Estruturação Comercial
3. Branding

**Strikers** (7):
1. Gestão de Tráfego
2. Criativos
3. Social Media
4. CRM
5. Estruturação Estratégica
6. Estruturação Comercial
7. Branding

**Fênix** (7): mesmos itens de Strikers, mesma ordem.

```sql
INSERT INTO public.squad_entregaveis (tenant_id, squad, item, ordem) VALUES
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','saber','Estruturação Estratégica',1),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','saber','Estruturação Comercial',2),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','saber','Branding',3),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','strikers','Gestão de Tráfego',1),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','strikers','Criativos',2),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','strikers','Social Media',3),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','strikers','CRM',4),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','strikers','Estruturação Estratégica',5),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','strikers','Estruturação Comercial',6),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','strikers','Branding',7),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','fenix','Gestão de Tráfego',1),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','fenix','Criativos',2),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','fenix','Social Media',3),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','fenix','CRM',4),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','fenix','Estruturação Estratégica',5),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','fenix','Estruturação Comercial',6),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','fenix','Branding',7)
ON CONFLICT (tenant_id, squad, item) DO NOTHING;
```

### Não toca
- `accounts.produtos_contratados` (Json existente) permanece intacto.
- Nenhum CREATE TABLE accounts.

### Pendente antes de aplicar
Preciso que você reenvie o trecho truncado do **item 2 (ALTER TABLE accounts)** com a lista completa das colunas a adicionar, para incluir no SQL final. Confirma esse trecho e eu executo a migration?
