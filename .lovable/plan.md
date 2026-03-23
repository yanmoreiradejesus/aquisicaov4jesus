

# Plano: Sistema de Login com Controle de Acesso por Telas

## Visão Geral

Criar um sistema de autenticação com auto-cadastro + aprovação do admin. O admin define manualmente quais telas cada usuário aprovado pode acessar.

---

## Estrutura do Banco de Dados

### Tabela `profiles`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid (FK auth.users) | ID do usuário |
| email | text | Email do usuário |
| full_name | text | Nome completo |
| approved | boolean (default false) | Se foi aprovado pelo admin |
| created_at | timestamp | Data de criação |

### Tabela `user_roles`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid (FK auth.users) | ID do usuário |
| role | app_role (enum) | admin ou user |

### Tabela `user_page_access`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid (FK auth.users) | ID do usuário |
| page_path | text | Caminho da tela (/, /insights, /metas, /financeiro) |

### Enum `app_role`
Valores: `admin`, `user`

### Função `has_role` (security definer)
Para evitar recursão infinita nas policies RLS.

---

## Fluxo do Sistema

```text
Usuário novo → Cadastro (email/senha) → Aguarda aprovação
                                              ↓
Admin acessa /admin → Vê lista de pendentes → Aprova + seleciona telas
                                              ↓
Usuário faz login → Vê apenas telas liberadas no menu
```

---

## Páginas e Componentes

### 1. `/login` - Página de Login/Cadastro
- Formulário de email + senha
- Abas para Login e Cadastro
- Mensagem "Aguarde aprovação" após cadastro

### 2. `/admin` - Painel Administrativo (só admin)
- Lista de usuários pendentes com botão aprovar
- Lista de usuários aprovados
- Para cada usuário: checkboxes das telas disponíveis (Dashboard, Insights, Metas)
- Capacidade de revogar acesso

### 3. Componente `ProtectedRoute`
- Verifica se está logado
- Verifica se está aprovado
- Verifica se tem acesso àquela tela específica
- Redireciona para `/login` ou mostra "Acesso negado"

### 4. Header atualizado
- Mostra apenas links das telas que o usuário tem acesso
- Botão de logout
- Link para /admin se for admin

---

## Políticas RLS

- **profiles**: usuário lê o próprio perfil; admin lê todos e atualiza (approved)
- **user_roles**: admin gerencia; usuário lê o próprio
- **user_page_access**: admin gerencia; usuário lê o próprio

---

## Trigger automático
- Ao criar conta no auth, trigger cria automaticamente o registro em `profiles`

---

## Setup inicial
- O primeiro usuário cadastrado será definido como admin automaticamente (via trigger que checa se é o primeiro registro)

---

## Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar tabelas, enum, função has_role, trigger, policies |
| `src/pages/Login.tsx` | Página de login/cadastro |
| `src/pages/Admin.tsx` | Painel de gestão de usuários |
| `src/components/ProtectedRoute.tsx` | Wrapper de proteção de rotas |
| `src/hooks/useAuth.ts` | Hook de autenticação e permissões |
| `src/components/V4Header.tsx` | Adicionar menu dinâmico + logout |
| `src/App.tsx` | Adicionar rotas protegidas |

