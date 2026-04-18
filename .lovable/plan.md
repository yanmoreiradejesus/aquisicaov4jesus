

## O que você quer

1. Renomear a aplicação atual de **"Aquisição"** para **"Data Analytics"** (label visível no Hub, header, admin). Rotas internas podem continuar `/aquisicao/*` (sem risco de quebrar permissões salvas no banco).
2. Adicionar no Hub um card pra nova app que vai morar em `app.v4jesus.com` (subdomínio separado, projeto Lovable separado).
3. Manter **autenticação unificada** entre os dois projetos.

## Parte 1 — Rename "Aquisição" → "Data Analytics"

Mudanças apenas de label (string), sem mexer em rotas ou banco:

- **`src/pages/Hub.tsx`**: card `title: "Data Analytics"` + descrição atualizada
- **`src/components/V4Header.tsx`**: trocar texto "AQUISIÇÃO" do dropdown e menu mobile pra "DATA ANALYTICS"
- **`src/pages/Admin.tsx`**: no `AVAILABLE_PAGES`, atualizar os `label` (ex: "Funil Aquisição" → "Funil") ou adicionar prefixo "Data Analytics —" se quiser. A escolha exata vou confirmar abaixo.

**Não** vou renomear pastas/rotas (`/aquisicao/*` continua), porque:
- Permissões em `user_page_access` já estão salvas com esses paths
- Redirects das rotas antigas já apontam pra cá
- Renomear pasta = migration grande + risco de quebrar acesso de usuários de novo

## Parte 2 — Card no Hub apontando pra `app.v4jesus.com`

Adicionar segundo card em `Hub.tsx` que é um link externo (`<a href="https://app.v4jesus.com">` em vez de `<Link>`):

```text
Hub (v4jesus.com/)
├── Card: Data Analytics  → /aquisicao/funil  (interno)
└── Card: [Nova App]      → https://app.v4jesus.com  (externo, novo projeto)
```

Pra controle de acesso do card externo, posso usar uma flag no `AVAILABLE_PAGES` tipo `external: true` com path simbólico `/app-externa` — assim você libera/bloqueia pelo Admin igual aos outros, e o Hub só mostra o card pra quem tiver acesso. (Detalhe: a permissão fica registrada nesse projeto, mas a verificação real de acesso quem faz é o outro projeto. Mais sobre isso na Parte 3.)

## Parte 3 — Autenticação unificada entre os 2 projetos Lovable

**Sim, é possível e é a abordagem certa pro seu caso.** Como os dois projetos vão estar no mesmo domínio raiz (`v4jesus.com` e `app.v4jesus.com`), dá pra compartilhar usuários de duas formas:

### Opção A — Mesmo backend Lovable Cloud nos dois projetos (recomendada)

Conectar o **novo projeto** ao **mesmo Supabase/Lovable Cloud** desse projeto atual. Resultado:
- Mesma tabela `auth.users`, `profiles`, `user_roles`, `user_page_access`
- Usuário criado num lado existe no outro automaticamente
- Admin único: você libera acesso à nova app pelo Admin daqui mesmo
- Cada projeto tem seu próprio frontend, mas backend/DB é o mesmo

**Como fazer**: ao criar o novo projeto no Lovable, em vez de habilitar Lovable Cloud novo, conectar manualmente o Supabase desse projeto (precisa do project ref + anon key). Os tokens de sessão são por-projeto-supabase, então funciona transparente.

**Limitação honesta**: o usuário ainda precisa **logar uma vez em cada subdomínio** (`v4jesus.com` e `app.v4jesus.com`) porque o `localStorage` da sessão Supabase é por origem. As credenciais são as mesmas, só o ato de "clicar entrar" repete uma vez. Pra evitar isso teria que migrar storage pra cookies em domínio `.v4jesus.com` — dá, mas é trabalho extra e não vem por padrão no template Lovable.

### Opção B — SSO via cookie compartilhado em `.v4jesus.com`

Mais sofisticado: configurar Supabase pra usar cookies no domínio `.v4jesus.com` em vez de localStorage. Aí login num subdomínio vale pro outro automaticamente. Recomendo deixar pra depois, só se o "logar 2x" virar dor real.

## Minha recomendação de execução agora

1. **Agora**: renomear pra "Data Analytics" + adicionar card externo no Hub (placeholder apontando pra `app.v4jesus.com`, mesmo que ainda não esteja no ar)
2. **Depois (no novo projeto)**: criar lá conectando ao mesmo backend → instruções específicas vão aparecer quando você estiver lá

## Perguntas pra fechar antes de implementar

<lov-actions>
<lov-suggestion message="Aprovado. Renomeia pra Data Analytics e adiciona o card externo apontando pra https://app.v4jesus.com no Hub. O nome da nova app no card vai ser 'App V4' com descrição 'Sistema operacional V4 Jesus'. Controle de acesso pelo Admin igual os outros.">Aprovado, app se chama "App V4"</lov-suggestion>
<lov-suggestion message="Aprovado, mas a nova app vai ter outro nome. Deixa o card como 'Em breve' por enquanto, sem link ativo, só visível pra admin. Renomeia pra Data Analytics normalmente.">Card "Em breve" por ora</lov-suggestion>
<lov-suggestion message="Antes de implementar, me explica melhor o passo a passo de criar o novo projeto Lovable conectando ao MESMO backend Lovable Cloud desse projeto. Quero entender o fluxo exato.">Explicar conexão do backend</lov-suggestion>
<lov-suggestion message="Quero a Opção B desde já — configurar cookies em .v4jesus.com pra login funcionar nos dois subdomínios sem repetir. Me mostra o que muda.">Fazer SSO real (Opção B)</lov-suggestion>
</lov-actions>
