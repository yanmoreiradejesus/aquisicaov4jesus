## Problema identificado

O PDF atual é montado como um HTML longo com várias seções forçando `page-break-before: always`, capa com `page-break-after`, cards longos, grids e blocos com estilos que o motor de conversão pode quebrar mal. Isso explica os sintomas: páginas vazias, texto solto/desorganizado e apêndice/transcrições ficando visualmente ruins nos dois formatos.

## Solução proposta

### 1. Trocar a estrutura do PDF para um layout de relatório, não de “slides”
- Remover o modelo atual de seções full-page com quebras obrigatórias.
- Usar páginas A4 com margens reais, fundo claro, texto escuro e hierarquia editorial.
- Cada bloco terá título, subtítulo, conteúdo e espaçamento previsível.
- Só inserir quebra de página quando necessário, não antes de toda seção.

### 2. Gerar um único PDF completo
- Remover os dois botões atuais.
- Deixar um botão único: `Exportar jornada (PDF)`.
- O PDF sempre inclui a parte executiva e, no final, o apêndice quando houver transcrições/call logs.
- Manter compatibilidade no backend: se `include_appendix` não vier, o padrão será gerar completo.

### 3. Reorganizar o conteúdo em ordem útil para operação
Nova estrutura:
1. Capa compacta com cliente, responsáveis, data e principais valores.
2. Sumário executivo por IA.
3. Dados do cliente e contrato.
4. Diagnóstico comercial/SPICED em blocos curtos.
5. Jornada comercial: atividades e chamadas em timeline limpa.
6. Reunião comercial.
7. Pré Growth Class, somente se houver conteúdo útil.
8. Growth Class: expectativa, ata, oportunidades e próximos passos.
9. Apêndice técnico: transcrições completas e call logs, em fonte menor e bem delimitado.

### 4. Corrigir paginação e páginas vazias
- Eliminar `page-break-before` obrigatório nas seções.
- Remover elementos com altura fixa de página fora da capa.
- Evitar `page-break-inside: avoid` em blocos longos.
- Aplicar `break-inside: avoid` apenas em blocos pequenos, como KPIs e linhas de metadados.
- Quebrar textos grandes em parágrafos/listas antes de mandar ao HTML, evitando blocos gigantes indivisíveis.
- Remover layout em duas colunas nas transcrições, que costuma bagunçar paginação em PDF.

### 5. Limpar e normalizar textos antes de renderizar
- Transformar JSON bruto em texto legível.
- Cortar espaços excessivos, quebras duplicadas e campos vazios.
- Evitar repetir a mesma qualificação/resumo em múltiplas seções.
- Limitar trechos executivos muito longos no corpo principal e deixar o conteúdo completo no apêndice.

### 6. Melhorar robustez técnica da conversão
- Ajustar CSS para impressão com `@page` com margens, sem full-bleed em todo o documento.
- Usar tipografia padrão segura para PDF.
- Manter PDFShift, mas com HTML mais simples e previsível.
- Retornar também metadados básicos no response, como quantidade de seções/apêndices incluídos, para facilitar debug futuro.

## Arquivos que serão alterados

- `supabase/functions/generate-account-journey-pdf/index.ts`
  - Refatorar o template HTML/CSS do PDF.
  - Ajustar padrão de `include_appendix` para completo.
  - Reorganizar conteúdo e paginação.

- `src/components/crm/OnboardingDetailSheet.tsx`
  - Substituir os dois botões por um botão único.
  - Chamar a função sempre no modo completo.
  - Atualizar texto de ajuda do botão.

## Validação

Após implementar, vou:
- Verificar que a função continua compilável em termos de TypeScript/estrutura.
- Conferir que o frontend chama apenas um modo de exportação.
- Revisar o HTML gerado para garantir que não há quebras obrigatórias causando páginas vazias.
- Se possível pelo ambiente, usar logs/teste da função para confirmar que a geração não retorna erro.

## Fora do escopo deste ajuste

- Alterar dados do CRM ou banco.
- Criar novo armazenamento.
- Trocar PDFShift por outro provedor agora.
- Redesenhar a tela de onboarding além do botão de exportação.