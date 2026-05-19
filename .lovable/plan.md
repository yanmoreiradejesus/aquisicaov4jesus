## Objetivo

Permitir trocar/remover a logo de cada tenant direto no diálogo **Editar cliente** em `/admin/clientes`. A logo padrão segue sendo a da V4 Jesus (fallback do `useTenantConfig`) — só sobrescreve quando o cliente tem `client_logo_url` próprio (caso Kloh).

## Arquivo único alterado

`src/pages/AdminClientes.tsx`

## Mudanças

1. **Interface `Tenant`**: adicionar `client_logo_url: string | null`.
2. **Estado `form`**: adicionar `client_logo_url: ""`. Adicionar `logoUploading` (boolean).
3. **`openEdit`**: hidratar `client_logo_url` a partir do tenant.
4. **`resetForm`**: limpar `client_logo_url`.
5. **`upsertMut.payload`**: incluir `client_logo_url: form.client_logo_url || null` (passar `null` aciona o fallback da V4 Jesus automaticamente).
6. **`onLogoSelected(file)`**: upload pro bucket público `avatars` no path `tenant-logos/{slug}-{timestamp}.{ext}`, com `upsert: true`. Pega `publicUrl` e seta no form. Mesmo fluxo já usado em `AdminClienteNovo.tsx`.
7. **`removeLogo()`**: zera `client_logo_url` no form (efetiva ao salvar). Toast informativo.
8. **UI no dialog** (entre o campo "Nome" e "Slug"): bloco "Logo do cliente" com:
   - Preview 64x64 da logo atual (ou placeholder com ícone Upload se vazio).
   - Botão **Escolher arquivo** (input file oculto, `accept="image/*"`), desabilitado durante upload ou sem slug.
   - Botão **Remover** (ícone Trash2) visível só quando há logo, ao lado do "Escolher arquivo".
   - Texto de ajuda: "Padrão = logo V4 Jesus. Envie uma imagem só se este cliente tem branding próprio."
9. **Imports**: adicionar `Upload` e `Loader2` de `lucide-react`.

## Storage

Bucket `avatars` já existe e é público — sem nova migration.

## Sem mudanças de schema

A coluna `tenants.client_logo_url` já existe. RLS de `tenants` já permite `super_admin_v4` dar `UPDATE`.

## Validação

- Editar Kloh → enviar PNG → preview atualiza → Salvar → `kloh.v4jesus.com` passa a mostrar a nova logo (via `useTenantConfig`).
- Editar Kloh → Remover → Salvar → volta a mostrar logo padrão V4 Jesus (fallback).
- V4 Jesus continua sem `client_logo_url` setado e segue usando o fallback.
