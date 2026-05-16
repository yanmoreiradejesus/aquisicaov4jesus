Diagnóstico:
- O botão fica dentro da aba `Histórico`, no bloco `Histórico de ligações`, em cada card de ligação sem áudio.
- Na tela enviada, você está na aba `Qualificação`, então esse bloco não aparece ali.
- Para o lead `Casa Rosada Carnes` (`+55 (65) 99981-4223`), não há nenhum evento da 3CPlus vinculado a esse lead nem nenhum evento bruto com esse telefone na base.
- Os eventos encontrados anteriormente com número parecido eram de outro lead: `RIBEIRÃO SOLAR / ANTÓNIO MARCOS`, telefone `+5599981271529`. Isso indica que a 3CPlus pode estar enviando outro número, ou que a chamada do Casa Rosada não chegou no webhook.

Plano de ajuste:
1. Tornar o botão mais fácil de encontrar
   - Manter a lista na aba `Histórico`, mas adicionar um atalho/aviso quando não houver ligações registradas.
   - Exibir uma ação clara do tipo `Forçar busca na 3CPlus` quando o lead não tiver eventos vinculados, em vez de mostrar apenas `Nenhuma ligação registrada ainda`.

2. Permitir busca por telefone do lead
   - Criar/ajustar a função de busca manual para aceitar `lead_id`, não apenas `event_id`.
   - Ao clicar em `Forçar busca na 3CPlus`, buscar chamadas recentes na 3CPlus usando o telefone normalizado do lead.
   - Se encontrar chamadas, criar/vincular os eventos ao lead e tentar preencher a gravação.

3. Melhorar o card de ligações já existentes
   - Em cards de 3CPlus sem gravação, manter o botão `Buscar gravação` mesmo quando a duração estiver `0` ou ausente.
   - Isso cobre chamadas em que só chegou o evento inicial e a gravação precisa ser reconsultada depois.

4. Validar no caso Casa Rosada Carnes
   - Depois de implementar, testar o botão no lead `Casa Rosada Carnes`.
   - Resultado esperado: se a 3CPlus tiver chamada para `+55 (65) 99981-4223`, ela aparece no Histórico e o botão tenta preencher a gravação; se a 3CPlus não retornar nada para esse número, o app mostra uma mensagem clara de que nenhuma chamada foi encontrada para o telefone do lead.