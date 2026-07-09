## Problema
Na tela `Cadastro de projetos`, o link "Contrato atual" usa `row.contrato_url` diretamente no `<a href>`. Mas esse campo guarda apenas o **path interno** do bucket privado `contratos-assinados` (ex.: `jesus/abc.pdf`), não uma URL pública. Por isso o navegador cai em `/jesus/abc.pdf` → 404.

Outras telas (ex.: `OnboardingDetailSheet`) resolvem isso gerando **signed URL** do bucket antes de exibir.

## Correção
Em `src/pages/ProjetosCadastro.tsx`, no editor de célula "Contrato":

1. Quando o editor abrir com `row.contrato_url` preenchido, chamar `supabase.storage.from("contratos-assinados").createSignedUrl(row.contrato_url, 3600)` e guardar o resultado em estado local.
2. Trocar o `<a href={row.contrato_url}>` por `<a href={signedUrl}>`, mantendo o ícone/label "Contrato atual". Enquanto o signed URL não estiver pronto, desabilitar o link (ou mostrar "Gerando link…").
3. Não alterar o fluxo de upload nem o valor persistido — continua salvando o path no `crm_oportunidades.contrato_url`.

Nenhuma outra tela é afetada.