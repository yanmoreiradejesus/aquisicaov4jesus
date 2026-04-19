

## 3 ajustes rápidos

### 1. Novos motivos de desqualificação
Em `src/components/crm/DesqualificacaoDialog.tsx`, substituir o array `MOTIVOS` pela nova lista (17 itens, ordem alfabética conforme enviado):
Adolescente/Criança, Blocklist, Cliente, Cliente oculto, Contatos inválidos, Deixou de responder, Duplicado, Engano/Não Lembra, Ex-cliente (detrator), Nunca respondeu, Pessoa Física, Sem autoridade, Sem budget, Sem interesse, Sem timing, Serviço fora de escopo, SPAM.

### 2. Header todo vermelho (teste de cor)
Em `src/components/V4Header.tsx`, trocar o glassmorphism vermelho atual (gradiente `from-red-600/25` translúcido) por um **fundo vermelho sólido** no tom da barra antiga — `bg-red-600` (com hover/scroll mantendo `bg-red-700` para profundidade). Manter:
- Pill flutuante, bordas arredondadas, sombra
- Tipografia branca (já está)
- Indicadores ativos: trocar `bg-white/10` por `bg-white/20` para contrastar melhor sobre vermelho sólido
- Dropdowns continuam com glass escuro (não muda)
- Mobile sidebar idem: fundo `bg-red-600` sólido

Sem backdrop-blur no header (vira sólido). Mantém o efeito macOS pela forma (pill + sombra), trocando só o material.

### 3. Renomear "CRM Leads" → "Leads"
Procurar todas as ocorrências de "CRM Leads" e trocar por "Leads":
- `src/components/V4Header.tsx` (item de navegação)
- `src/pages/CrmLeads.tsx` (título da página, se houver)
- Qualquer breadcrumb/título

Mantém a rota `/comercial/leads` igual — só muda o label visível.

### Arquivos a editar
- `src/components/crm/DesqualificacaoDialog.tsx`
- `src/components/V4Header.tsx`
- `src/pages/CrmLeads.tsx`

