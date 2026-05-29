## Ajustes no bloco SPICED (`src/components/crm/LeadCallEventsList.tsx`)

### 1. Legibilidade

O bloco usa `prose ... dark:prose-invert` dentro de `bg-accent/5`. Como o app não está em modo `dark` global, o `dark:prose-invert` não aplica e os headings/bold ficam com cor padrão escura sobre fundo escuro do tema.

**Fix:** forçar cores semânticas do design system independente do modo, trocando os modifiers do prose para usar tokens `foreground`/`muted-foreground`:

```
prose prose-sm max-w-none
prose-headings:text-foreground prose-headings:font-semibold
prose-p:text-foreground/90
prose-strong:text-foreground prose-strong:font-semibold
prose-li:text-foreground/90
prose-ul:text-foreground/90
prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0
```

(Remover `dark:prose-invert`.)

### 2. Copiar preservando formatação (negrito, headings)

Hoje copiamos `event.spiced` cru (markdown), então a colagem mostra `##` e `**`.

**Fix:** converter o markdown para HTML e gravar no clipboard com dois formatos via `ClipboardItem` (`text/html` + `text/plain` sem marcadores), para que apps ricos (Docs, Notion, Word, Gmail) colem com negrito/títulos e apps de texto puro colem limpo.

- Adicionar dependência leve `marked` para converter markdown → HTML (já que `react-markdown` não expõe HTML string facilmente).
- Nova função `copy()`:
  1. `const html = await marked.parse(event.spiced)`
  2. Gerar versão `text/plain` removendo `#`, `*`, `-` de marcação (manter o conteúdo legível).
  3. `navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], {type:"text/html"}), "text/plain": new Blob([plain], {type:"text/plain"}) })])`
  4. Fallback: se `ClipboardItem` indisponível, usar `writeText(plain)`.

### Arquivos

- `src/components/crm/LeadCallEventsList.tsx` — ajustar classes do container do `ReactMarkdown` (linha 622) e reescrever `copy()` do `SpicedBlock` (linhas 574-582), importar `marked`.
- `package.json` — adicionar `marked`.

Sem mudanças no backend nem no prompt.