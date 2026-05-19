## Problema
Ao abrir `kloh.v4jesus.com`, a logo da V4/Jesus aparece por ~2s antes da logo do Kloh. Causa: `useTenantConfig` devolve um fallback síncrono (com `client_logo_url: null` → cai no `defaultLogo` V4) enquanto a RPC `resolve_tenant_by_hostname` ainda está rodando. Os componentes não observam `isLoading`.

## Mudanças

### 1. `src/hooks/useTenantConfig.ts`
- Expor flag adicional `isResolved` (`!isLoading && data !== undefined`) para a UI sensível à identidade saber quando a config oficial chegou.
- Manter `config` como está (fallback durante loading) para não quebrar hooks que leem `client_name`, `app_base_url`, etc.

### 2. `src/components/V4Header.tsx`
- Enquanto `!isResolved`, renderizar placeholder invisível com as mesmas dimensões da logo (`w-14 h-4`) no lugar da `<img>` — sem flash, sem layout shift.
- Aplicar mesma lógica ao `<img>` dentro do menu mobile.

### 3. `src/pages/Login.tsx`
- Estender o early-return do spinner: aguardar `authLoading || tenantLoading` antes de pintar o Card. Garante que a tela de login do Kloh nunca apareça com a logo V4 default.

## Fora de escopo
- RLS / auth / schema / edge functions — nada muda.
- Fallback continua para resto da UI que não depende da logo.

## Validação
1. Aba anônima em `kloh.v4jesus.com/login` → spinner curto → login direto com logo Kloh.
2. Login em Kloh → header já carrega com logo Kloh.
3. `v4jesus.com` → segue mostrando logo V4 default (sem regressão).
4. Preview `*.lovable.app` → fallback resolve imediatamente, mesma UX.
