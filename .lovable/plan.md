

## Cadastrar operador API4com de outro usuário (admin) — via card no /admin

Adicionar um card em `/admin` onde você (admin) escolhe um vendedor da lista, cola o `operador_id` da API4com dele e salva. Pronto — sem precisar logar como ele.

### Mudanças

**1. `src/components/admin/AdminVoipAccountsCard.tsx`** (novo)
- Tabela com todas as `voip_accounts` (admin já tem RLS para ver tudo): **Usuário**, **Provider**, **Operador ID**, **Apelido**, **Ativo**, **Ações** (toggle ativo / excluir).
- Botão **"+ Adicionar conta"** abre dialog com:
  - Select **Usuário** — lista `profiles` aprovados (nome + email).
  - Select **Provider** — `api4com` (default) / `3cplus`.
  - Input **Operador ID** — o identificador que vem no payload do webhook (login/ramal do operador na API4com).
  - Input **Apelido** (opcional).
  - Switch **Ativo** (default ligado).
- Salvar → `insert` em `voip_accounts` com o `user_id` escolhido (RLS já permite admin).
- Toast de sucesso/erro; lista atualiza.

**2. `src/pages/Admin.tsx`**
- Renderizar `<AdminVoipAccountsCard />` abaixo da seção atual de usuários.

### Como usar (depois de implementado)
1. `/admin` → role até **"Contas VoIP da equipe"** → **+ Adicionar conta**.
2. Escolha o vendedor, selecione `api4com`, cole o `operador_id`, salve.
3. Próxima ligação daquele operador entra com `user_id` correto e aparece no filtro "Minhas chamadas" do vendedor.

### Detalhes técnicos
- Sem mudança de schema — `voip_accounts` e RLS já suportam admin gerenciar contas de terceiros.
- Webhook continua único do sistema (mesma URL para todos); o que muda é só o mapeamento `operador_id → user_id`.
- Lookup de nome via `useQuery` em `profiles` (`id, full_name, email`).

