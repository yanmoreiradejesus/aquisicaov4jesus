## Problema

O parser em `src/lib/leadCsvImport.ts` está fixado em `delimiter: ";"` (linha 82 do `Papa.parse`). A planilha enviada (`Cópia_de_Lista_Contatos_-_Contatos.csv`) usa **vírgula** como separador:

```
Empresa,Nome,Telefone
Varejão do alho,Thiago,+55 (79) 99924-8013
```

Como resultado:
- Papaparse lê o cabeçalho como uma única coluna `"Empresa,Nome,Telefone"`.
- Nenhum dos `pick(...)` encontra `Nome`, `Empresa`, `Telefone`.
- Todas as linhas viram `nome = "(Sem nome)"` sem email/telefone/empresa preenchidos.
- O `.filter(...)` na linha 149 descarta tudo → 0 leads importados.

## Solução

1. **`src/lib/leadCsvImport.ts`** — em `parseLeadsCsv`, trocar `delimiter: ";"` por **auto-detecção**: deixar o Papa Parse detectar via `delimitersToGuess: [",", ";", "\t", "|"]` (sem passar `delimiter`). Isso mantém compatibilidade com os CSVs antigos `;` e passa a aceitar `,`.

2. Sem mudanças necessárias no resto: os headers `Empresa`, `Nome`, `Telefone` já são reconhecidos pelo `pick(...)` (que normaliza case/acento).

## Validação esperada

Após a mudança, ao reenviar a mesma planilha em **Outbound**, devem aparecer 9 leads no preview com nome, empresa e telefone preenchidos.
