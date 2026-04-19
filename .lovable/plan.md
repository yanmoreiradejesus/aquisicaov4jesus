
## Plano — Copilot estilo iMessage com anexos

### 1. Estética iMessage
Refazer `CloserCopilot.tsx` com visual Apple Messages:
- **Bolhas**: usuário à direita em azul iOS (`#007AFF`), assistente à esquerda em cinza claro (`#E9E9EB` light / `#3A3A3C` dark), bordas arredondadas grandes (`rounded-[18px]`), "tail" sutil (cantos diferentes).
- **Layout**: fundo gradiente sutil tipo Messages, espaçamento generoso, timestamps discretos agrupados.
- **Typography**: SF-style (system font stack), 14px base.
- **Indicador de digitação**: 3 pontinhos animados na bolha do assistente (não texto "pensando").
- **Input bar**: pill arredondada (`rounded-full`), botão `+` à esquerda (anexos), botão de envio circular azul à direita aparece só quando há texto.
- **Quick actions**: pílulas estilo "suggestions" acima do input quando vazio.

### 2. Upload de arquivos (PDFs, imagens, prints)
- **Storage bucket** novo: `copilot-attachments` (privado, RLS por usuário).
- Botão `+` no input abre file picker aceitando: `image/*, application/pdf`.
- Upload direto via `supabase.storage` para `copilot-attachments/{user_id}/{oportunidade_id}/{timestamp}-{filename}`.
- Preview do anexo aparece como "card" acima do input antes de enviar (chip removível).
- Ao enviar mensagem com anexo: a bolha mostra thumbnail (imagem) ou ícone+nome (pdf).

### 3. Processamento dos anexos pela IA
- **Imagens** → enviar diretamente como `image_url` (base64 ou URL signed) no formato OpenAI multimodal.
- **PDFs** → extrair texto via `pdf-parse` (npm) na edge function, anexar como contexto textual com label `[Conteúdo do PDF: nome.pdf]`.
- Edge function `closer-copilot` aceita novo campo `attachments: [{ url, type, name, extracted_text? }]` e injeta no payload de mensagens.

### 4. Registro automático em "Notas internas" da oportunidade
Toda interação relevante vira atividade + entrada em `notas`:
- **Ao fazer upload**: atividade tipo `nota` com texto `📎 Anexo enviado ao Copilot: nome-do-arquivo` + URL signed (válida por 7 dias).
- **Botão "Salvar conversa nas notas"** (no header do Copilot): pega histórico atual, formata em markdown e:
  - Concatena ao campo `notas` da oportunidade (com separador `--- Conversa Copilot [data] ---`).
  - Cria atividade tipo `nota` no histórico com o conteúdo.
- Toast de confirmação.

### 5. Tabela `crm_copilot_attachments` (opcional, leve)
Para listar anexos da oportunidade:
- Colunas: `id, oportunidade_id, user_id, file_name, file_path, file_type, file_size, extracted_text, created_at`.
- RLS: usuário autenticado vê/cria do que lhe pertence; admin vê tudo.
- Edge function lista anexos passados ao montar contexto (recall entre sessões).

### Arquivos
- **Migration**: criar bucket `copilot-attachments` + tabela `crm_copilot_attachments` + RLS.
- **Reescrever**: `src/components/crm/CloserCopilot.tsx` (UI iMessage + upload + save-to-notes).
- **Editar**: `supabase/functions/closer-copilot/index.ts` (multimodal + PDF parse + carregar anexos).
- **Sem mudanças**: `OportunidadeDetailSheet.tsx` (a aba já existe).

### Confirmações técnicas
- Lovable AI Gateway suporta multimodal (image_url) via `openai/gpt-5` ✓.
- `pdf-parse` roda em Deno via `npm:pdf-parse` ✓.
- Storage com signed URLs para a IA acessar imagens.

### Ordem de execução
1. Migration (bucket + tabela + RLS).
2. Reescrever componente com UI iMessage + upload + save-to-notes.
3. Atualizar edge function (multimodal + PDF + carregar anexos do banco).
