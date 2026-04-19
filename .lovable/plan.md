

## Botão "Enviar confirmação WhatsApp" após agendamento

### Onde aparece
Em `LeadDetailSheet.tsx`, na seção "Informações da reunião" (que mostra data/hora e link do Google Calendar). Quando `data_reuniao_agendada` E `google_event_link` estiverem preenchidos, mostrar um botão verde **"Enviar confirmação no WhatsApp"** abaixo das infos.

### O que faz
Abre `https://wa.me/<telefone>?text=<mensagem URL-encoded>` em nova aba, com a mensagem já pronta:

```
Oi [Nome]! Agendamento confirmado — nossa conversa é [Data] às [Hora] (45min a 1h). Segue o link: [Link].

Qualquer coisa é só me chamar aqui.
```

### Preenchimento dos placeholders
- **[Nome]** → primeiro nome de `lead.nome` (split no espaço, primeira parte)
- **[Data]** → `data_reuniao_agendada` formatada `dd/MM/yyyy` (date-fns + locale pt-BR, já usado no projeto)
- **[Hora]** → mesma data formatada `HH'h'mm` (ex: "14h30")
- **[Link]** → `lead.google_event_link`
- **Telefone** → `lead.telefone` normalizado (só dígitos, com 55 prefix se faltar) — usar utilitário `ddd.ts` se aplicável, senão regex simples

### Validações / fallbacks
- Se faltar telefone → botão desabilitado com tooltip "Lead sem telefone".
- Se faltar `google_event_link` → não mostra botão (aguardando agendamento).
- Toast de sucesso "Abrindo WhatsApp..." ao clicar.

### Arquivo a editar
- `src/components/crm/LeadDetailSheet.tsx` (apenas — adiciona o botão e a função `enviarConfirmacaoWhats`)

Sem mudanças de schema, sem edge function, sem novas libs.

