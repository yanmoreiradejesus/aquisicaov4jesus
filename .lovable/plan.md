## Problema

Em `src/components/crm/LeadCard.tsx` (linha 108) a tag de dias usa `lead.updated_at`:

```ts
const stageDays = showStageDays ? daysSince(lead.updated_at) : 0;
```

`updated_at` é atualizado a cada edição (nota, telefone, temperatura, responsável, mudança de etapa, etc.). Por isso o número diverge da data de cadastro e parece "voltar no tempo" quando alguém mexe no lead.

## Correção

Trocar a base do cálculo para a data de cadastro, priorizando a data de origem quando existir (leads importados costumam ter `data_criacao_origem` diferente do `created_at`).

**Arquivo:** `src/components/crm/LeadCard.tsx`

1. Substituir a linha 108:
   ```ts
   const stageDays = showStageDays
     ? daysSince(lead.data_criacao_origem || lead.created_at)
     : 0;
   ```
2. Renomear a variável para `ageDays` (e ajustar onde é renderizada) para deixar claro no código que é "idade do lead", não "dias na etapa". Mantém a prop `showStageDays` para não quebrar quem já passa essa flag — só muda o significado interno.

Nenhuma outra alteração: backend, queries e demais componentes ficam intactos. É uma correção puramente de apresentação.

## Validação

- Abrir a coluna "Tentativa de Conexão" e conferir que a tag de dias bate com `created_at` / `data_criacao_origem` do lead.
- Editar uma nota de um lead e confirmar que o número **não muda mais** após salvar.
