## O problema (resumo)

**1) Áudio não toca nas chamadas Kloh (api4com).**
A API4COM manda a URL `https://listener.api4com.com/files/listen/<id>.mp3`, mas esse endereço **não é o MP3 de verdade** — responde com texto `"Found. Redirecting to https://fs5.api4com.com/..."`. O player tenta tocar texto e quebra. A URL real (`fs5.api4com.com/...`) funciona.

**2) Transcrição não roda quando a duração chega depois.**
O gatilho só dispara quando a URL da gravação é gravada. Se a duração vem num evento separado mais tarde, o gatilho não roda de novo.

**3) Player aparece em tentativas sem áudio real.**
Hoje qualquer evento com `gravacao_url` mostra o player — mesmo quando foi só uma tentativa (sem atendimento). Precisa diferenciar **tentativa** de **chamada efetiva**, como já fizemos no 3CPlus.

---

## O plano

### 1. Resolver a URL real no webhook (api4com)
No `voip-webhook-api4com`: se a `recordUrl` vier como `listener.api4com.com/files/listen/...`, ler o texto `"Found. Redirecting to <URL>"` e salvar já a URL final (`fs5.api4com.com/...`) em `gravacao_url`. Fallback: manter a original se algo falhar.

### 2. Mesma proteção no transcritor
No `transcribe-call-recording`, antes de baixar, resolver o "redirect de texto" para qualquer URL `listener.api4com.com/...`. Protege gravações antigas já salvas com a URL quebrada.

### 3. Diferenciar tentativa vs. chamada real no front (api4com **e** 3CPlus)
No `LeadCallEventsList.tsx`, só renderizar o player quando a chamada tiver áudio real:
- `duracao_seg >= 10` (não foi só toque/tentativa)
- E `status` indicar atendimento (não mostrar player em `noanswer`, `busy`, `failed`, `abandoned`).

Tentativas (<10s ou não atendidas) mostram só a linha do evento com badge **"Tentativa de contato"**, sem player, sem botão de transcrever, sem botão de "Buscar gravação".

### 4. Subir o piso de transcrição automática para 10s
- Atualizar o gatilho `trigger_transcribe_call_recording`: transcrever a partir de `>= 10s` (em vez de `>= 3s`).
- Atualizar o `transcribe-call-recording`: marcar `sem_audio` quando `duracao_seg < 10`.

### 5. Gatilho reage também à atualização da duração
Ajustar o trigger para disparar quando `duracao_seg` mudar (não só `gravacao_url`). Assim chamadas onde a duração chega depois passam a ser transcritas automaticamente.

### 6. Backfill (api4com + 3CPlus)
Dois passos:

**a) Reabilitar transcrição para chamadas com áudio real (≥ 10s) que ficaram paradas/erradas.**
Para `provider IN ('api4com','3cplus')` AND `duracao_seg >= 10` AND `gravacao_url IS NOT NULL` AND (`transcricao_status IS NULL` OR `transcricao_status IN ('erro','sem_audio','pendente')`):
- Limpar `transcricao_status`, `transcricao`, `transcricao_error`.
- Tocar a `gravacao_url` (UPDATE no próprio valor) para o gatilho refazer o processamento. Com o webhook corrigido (passo 1), o transcritor (passo 2) vai baixar a URL real.

**b) Marcar tentativas (< 10s) como `sem_audio`.**
Para `provider IN ('api4com','3cplus')` AND `duracao_seg < 10`: setar `transcricao_status = 'sem_audio'` e limpar `transcricao_error`. Assim somem da fila de transcrição e ficam claramente identificadas como tentativa.

### O que NÃO vou mexer
- Tela de oportunidades, IA de reuniões, resumo de reunião.
- Lógica do `play-3cplus-recording` (continua sendo o proxy autenticado).

### Como saber que funcionou
- Chamada Kloh recente atendida → áudio toca direto no player.
- Tentativas (não atendidas ou <10s) → só badge "Tentativa de contato", sem player.
- Em alguns minutos: chamadas antigas (api4com e 3CPlus) com ≥10s passam de `null`/`erro` para `concluida`.
