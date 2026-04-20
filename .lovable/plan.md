

## Plano — Reestruturar tela de Admin (`/admin`)

A tela atual mistura tudo numa página só (lista de usuários expandida + edição inline + templates de cargo + permissões em massa), ficando poluída em 1088px. Vou reorganizar em **lista compacta + drawer de edição**.

### Nova estrutura visual

```text
┌─ /admin ──────────────────────────────────────────────────┐
│  [Tab: Usuários]  [Tab: Templates de Cargo]               │
│                                                            │
│  Usuários:                                                 │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ [Buscar...]   [Filtro Cargo ▾] [Filtro Depto ▾]      │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Avatar │ Nome / email      │ Cargo │ Status │  ⚙   │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │  JS    │ João Silva        │ SDR   │ ✓ ativo│ Editar│ │
│  │        │ joao@v4.com       │       │        │       │ │
│  │  MA    │ Maria Alves       │ -     │ ⏳ pend │ Editar│ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

Ao clicar **Editar**, abre um **Sheet (drawer lateral)** à direita com:

```text
┌─ Editar usuário: João Silva ─────────────────────┐
│  Avatar + nome + email                            │
│                                                   │
│  ▸ Status                                         │
│     [✓ Aprovado]   [Tornar admin]                 │
│                                                   │
│  ▸ Cargo & Departamento                           │
│     Cargo:        [SDR ▾]                         │
│     Departamento: [Receitas ▾] (auto pelo cargo)  │
│     [↻ Aplicar template do cargo]                 │
│                                                   │
│  ▸ Acessos individuais                            │
│     Aquisição:                                    │
│       ☑ Dashboard                                 │
│       ☐ Funil                                     │
│       ☑ Insights                                  │
│       ...                                         │
│     Comercial:                                    │
│       ☑ Leads                                     │
│       ...                                         │
│                                                   │
│            [Cancelar]   [Salvar alterações]       │
└───────────────────────────────────────────────────┘
```

A aba **Templates de Cargo** vira um espaço dedicado, separado da lista, agrupado por área (Receitas / PE&G / ADM), com checkboxes pra cada página.

### Mudanças no código

Arquivo único: `src/pages/Admin.tsx` reescrito.

- Header: título + tabs (`Usuários` / `Templates de Cargo`).
- **Tab Usuários**:
  - Filtros em cima (busca por nome/email, filtro por cargo, por departamento).
  - Tabela enxuta: avatar, nome+email, cargo (badge), departamento (badge), status (aprovado/pendente/admin), botão **Editar**.
  - Estado `editingUser` controla abertura de `<Sheet>`.
- **Sheet de edição** (componente interno `UserEditSheet`):
  - Seções colapsáveis ou separadas por `<Separator />`: Status, Cargo/Departamento, Acessos.
  - Ao mudar cargo, sugere aplicar template (botão).
  - Acessos agrupados por área (Aquisição / Comercial / Admin), checkboxes.
  - Salva tudo num único clique (batch: profile update + roles diff + page_access diff).
- **Tab Templates**:
  - Lista de cargos agrupada por área com card por cargo, mostrando páginas como checkboxes editáveis.
  - Botão "Salvar template" por cargo.

### Componentes shadcn usados
`Tabs`, `Sheet`, `Table`, `Avatar`, `Badge`, `Input`, `Select`, `Checkbox`, `Separator`, `Button`, `Card`. Todos já no projeto.

### Fora de escopo (não vou mexer)
- Schema do banco — está OK.
- RLS policies — sem alteração.
- Outras páginas.

