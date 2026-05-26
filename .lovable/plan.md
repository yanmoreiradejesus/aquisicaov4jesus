## Problema

O botão "+ Nova reunião" hoje só fica habilitado quando há uma transcrição ativa colada (≥20 caracteres). Quando a zona está vazia (ex.: depois de arquivar a anterior), o botão fica cinza e não permite "começar uma nova reunião" — o que confunde o uso.

## Solução

Tornar o botão sempre clicável (exceto durante a operação) e fazer com que ele:

1. **Se houver transcrição ativa (≥20 chars):** arquiva a reunião atual (comportamento atual de `arquivarReuniaoAtual`) e limpa a zona para colar a próxima.
2. **Se NÃO houver transcrição ativa:** apenas garante que a zona de colar esteja limpa e visível (faz scroll/foco até a área de colar), sem chamar o backend. Mostra um toast leve "Pronto para colar nova transcrição" e foca o textarea de paste.

## Mudanças (arquivo único)

**`src/components/crm/OportunidadeDetailSheet.tsx`**

1. Remover a condição `disabled={!((form.transcricao_reuniao ?? "").trim().length >= 20) ...}` do botão. Manter apenas `disabled={addReuniao.isPending}` para evitar duplo clique durante o arquivamento.
2. Atualizar `arquivarReuniaoAtual` (ou criar wrapper `iniciarNovaReuniao`) para:
   - Se `txt.length < 20`: pular o `addReuniao.mutateAsync`, apenas resetar estados de IA (`setAiResumo("")`, `setAiTarefa(null)`, refs) e dar foco na paste zone.
   - Se `txt.length ≥ 20`: comportamento atual (arquiva + limpa).
3. Adicionar `ref` no textarea/área de paste e chamar `.focus()` após a ação para sinalizar visualmente onde colar.
4. Ajustar o `title` do botão para "Iniciar nova reunião (arquiva a atual se houver transcrição)".

## Fora de escopo

- Não alterar parser, geração de resumo IA, ou layout de "Última reunião / Reuniões anteriores".
- Não criar modal — manter o fluxo inline de colar.
