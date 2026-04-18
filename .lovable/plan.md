

## Contexto

- Mesmos usuários (auth + permissões compartilhadas)
- Dados diferentes (outras planilhas, outras tabelas)
- Tudo sob o domínio `v4jesus.com`

Isso muda bastante a recomendação. Como você quer **usuários compartilhados**, criar projeto novo no Lovable significaria duplicar o sistema de auth, gerenciar dois bancos, e o usuário teria que logar duas vezes. Não vale a pena.

## Recomendação: Mesmo projeto, organizado como "hub"

Transformar esse projeto em um hub com múltiplas aplicações internas, cada uma em sua própria área de rota. Estrutura proposta:

```text
v4jesus.com/
├── /                          → Hub (escolhe app)
├── /aquisicao/*               → app atual (dashboard, insights, financeiro, meta)
└── /nova-app/*                → nova aplicação
```

### Por que funciona bem aqui

1. **Auth única**: o `useAuth` + `user_page_access` que você já tem cobre tudo nativamente — basta cadastrar as novas rotas no `AVAILABLE_PAGES` do Admin
2. **Domínio único**: `v4jesus.com` já está conectado, nada muda
3. **Bundle**: Vite faz code-split por rota — usuário que entra em `/nova-app` não baixa o código de `/aquisicao`, então não fica "pesado" no runtime
4. **Banco isolado por contexto**: novas tabelas com prefixo (ex: `nova_*`) ficam separadas das atuais

### Sobre o "peso" pra IA

Esse é o risco real. Mitigação:

- Pasta `src/apps/aquisicao/` e `src/apps/nova-app/` — IA consegue trabalhar focada em uma área
- Componentes compartilhados (Header, Auth, UI) ficam em `src/shared/`
- Quando pedir mudanças, mencionar a área (ex: "na nova-app, faça X")

## Plano de execução (quando você aprovar)

### Fase 1 — Reorganização (preparação)
1. Criar `src/apps/aquisicao/` e mover páginas atuais (DashboardComercial, Insights, Financeiro, MixCompra) para lá
2. Atualizar rotas em `App.tsx` com prefixo `/aquisicao/*` (manter redirects das rotas antigas pra não quebrar links salvos)
3. Atualizar `AVAILABLE_PAGES` no Admin e migrar registros existentes em `user_page_access` (`/insights` → `/aquisicao/insights`, etc.)
4. Criar página Hub em `/` que mostra cards das aplicações disponíveis (filtrados por permissão)

### Fase 2 — Nova aplicação (depois você me conta o que é)
5. Criar `src/apps/nova-app/` com estrutura inicial
6. Adicionar rotas em `/nova-app/*`
7. Criar tabelas no banco com prefixo apropriado
8. Adicionar páginas no Admin pra liberar acesso

## Trade-offs honestos

**Risco**: a Fase 1 mexe em rotas que já existem. Vou cuidar de:
- Manter redirects das URLs antigas → novas (ninguém perde link salvo)
- Migrar `user_page_access` no mesmo deploy pra ninguém ficar sem acesso
- Testar fluxo de login + permissão antes de considerar pronto

**Alternativa mais leve**: se você preferir, dá pra **pular a Fase 1** e simplesmente adicionar a nova app em `/nova-app/*` sem reorganizar nada. Mais rápido, mas o projeto fica menos organizado conforme cresce.

## O que preciso de você antes de começar

<lov-actions>
<lov-suggestion message="Aprovado. Faça a Fase 1 completa (reorganização + hub) e depois me chama pra falar da nova app">Fazer Fase 1 completa</lov-suggestion>
<lov-suggestion message="Pula a Fase 1. Só adiciona a nova aplicação em /nova-app sem reorganizar o resto. Vou te contar agora o que ela faz: [descreva aqui]">Pular reorganização</lov-suggestion>
<lov-suggestion message="Antes de decidir, me explica em mais detalhe como ficaria a página Hub e o fluxo de navegação entre as apps">Detalhar o Hub</lov-suggestion>
<lov-suggestion message="Prefiro criar projeto novo mesmo assim e conectar no mesmo Lovable Cloud pra compartilhar usuários. Me explica como fazer isso">Projeto separado, mesmo backend</lov-suggestion>
</lov-actions>
