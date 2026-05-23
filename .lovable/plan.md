## Diagnóstico

O backend está saudável e os PDFs foram gerados no bucket `account-journeys`:

- `ca48961c-.../ffa7abd5-.../2026-05-23T01-35-06-101Z_PhD_Sports_Vila_Prudente.pdf`
- `ca48961c-.../ffa7abd5-.../2026-05-23T01-34-18-933Z_PhD_Sports_Vila_Prudente.pdf`

Ou seja: o arquivo existe no Storage. O problema é de acesso/download.

Há dois pontos prováveis:

1. **Arquivos criados pela função aparecem com `owner = null`** porque foram enviados pelo backend com chave administrativa. Dependendo do painel de Storage, isso pode impedir download direto pela UI mesmo com o objeto existente.
2. No app, o botão tenta abrir o link assinado depois de uma geração de ~25s usando clique programático em `<a target="_blank">`. Navegadores podem bloquear esse download porque a ação acontece muito depois do clique original do usuário.

## Plano de correção

### 1. Corrigir o download dentro do CRM

No `OnboardingDetailSheet.tsx`, ajustar o botão “Exportar jornada completa (PDF)” para:

- chamar a função `generate-account-journey-pdf` normalmente;
- receber `{ url, filename }`;
- baixar o arquivo com `fetch(url)` como `blob`;
- criar um `blob:` URL local;
- disparar o download sem `target="_blank"`;
- exibir um link de fallback “Clique aqui para baixar o PDF” caso o navegador ainda bloqueie.

Isso garante que o usuário consiga baixar pelo próprio CRM, sem depender da UI do Storage.

### 2. Corrigir metadados de arquivos futuros no bucket

Na função `generate-account-journey-pdf`, antes do upload, passar o usuário autenticado como `owner`/metadado quando possível, para que arquivos futuros fiquem associados ao usuário que gerou o PDF.

### 3. Ajustar arquivos já criados

Adicionar uma migration para preencher o `owner` dos PDFs existentes no bucket `account-journeys` onde `owner is null`, usando o usuário que está associado ao tenant atual/admin quando aplicável.

### 4. Validar

- Confirmar que os objetos continuam em `account-journeys`.
- Confirmar que o botão do CRM passa a oferecer download/fallback.
- Confirmar que a política de leitura continua restrita ao mesmo tenant.

## Resultado esperado

O PDF continuará privado e isolado por tenant, mas poderá ser baixado com segurança pelo CRM e terá acesso mais consistente na área de Storage.