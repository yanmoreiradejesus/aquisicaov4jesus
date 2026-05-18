
CREATE TABLE IF NOT EXISTS public.tenant_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  version_number int NOT NULL,
  build_hash text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, build_hash),
  UNIQUE (tenant_id, version_number)
);

ALTER TABLE public.tenant_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read versions tenant"
ON public.tenant_versions FOR SELECT TO authenticated
USING (tenant_id = current_tenant_id() OR has_role(auth.uid(), 'super_admin_v4'::app_role));

CREATE POLICY "Manage versions tenant"
ON public.tenant_versions FOR ALL TO authenticated
USING (
  ((tenant_id = current_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role))
  OR has_role(auth.uid(), 'super_admin_v4'::app_role)
)
WITH CHECK (
  ((tenant_id = current_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role))
  OR has_role(auth.uid(), 'super_admin_v4'::app_role)
);

-- Função: registra nova versão se for V4 Jesus e o build mudou
CREATE OR REPLACE FUNCTION public.register_version_if_new(p_build_hash text)
RETURNS public.tenant_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_slug text;
  v_next int;
  v_row public.tenant_versions;
BEGIN
  v_tenant := current_tenant_id();
  IF v_tenant IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT client_slug INTO v_slug FROM public.tenants WHERE id = v_tenant;
  -- Só auto-bump para V4 Jesus (cliente piloto/canário)
  IF v_slug IS DISTINCT FROM 'jesus' THEN
    SELECT * INTO v_row FROM public.tenant_versions
      WHERE tenant_id = v_tenant ORDER BY version_number DESC LIMIT 1;
    RETURN v_row;
  END IF;

  -- Já existe esta build pra esse tenant?
  SELECT * INTO v_row FROM public.tenant_versions
    WHERE tenant_id = v_tenant AND build_hash = p_build_hash;
  IF FOUND THEN RETURN v_row; END IF;

  SELECT COALESCE(MAX(version_number),0)+1 INTO v_next
    FROM public.tenant_versions WHERE tenant_id = v_tenant;

  INSERT INTO public.tenant_versions (tenant_id, version_number, build_hash)
  VALUES (v_tenant, v_next, p_build_hash)
  ON CONFLICT (tenant_id, build_hash) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM public.tenant_versions
      WHERE tenant_id = v_tenant AND build_hash = p_build_hash;
  END IF;

  RETURN v_row;
END;
$$;

-- Função: promove a versão atual do V4 Jesus para outro tenant
CREATE OR REPLACE FUNCTION public.promote_jesus_version_to_tenant(p_target_tenant uuid)
RETURNS public.tenant_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jesus uuid;
  v_src public.tenant_versions;
  v_next int;
  v_row public.tenant_versions;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin_v4'::app_role) THEN
    RAISE EXCEPTION 'Apenas super_admin_v4 pode promover versões';
  END IF;

  SELECT id INTO v_jesus FROM public.tenants WHERE client_slug = 'jesus';
  IF v_jesus IS NULL OR p_target_tenant = v_jesus THEN
    RAISE EXCEPTION 'Tenant alvo inválido';
  END IF;

  SELECT * INTO v_src FROM public.tenant_versions
    WHERE tenant_id = v_jesus ORDER BY version_number DESC LIMIT 1;
  IF v_src.id IS NULL THEN
    RAISE EXCEPTION 'Sem versão registrada para V4 Jesus';
  END IF;

  -- Já está nesta versão?
  SELECT * INTO v_row FROM public.tenant_versions
    WHERE tenant_id = p_target_tenant AND build_hash = v_src.build_hash;
  IF FOUND THEN RETURN v_row; END IF;

  SELECT COALESCE(MAX(version_number),0)+1 INTO v_next
    FROM public.tenant_versions WHERE tenant_id = p_target_tenant;

  INSERT INTO public.tenant_versions (tenant_id, version_number, build_hash, notes)
  VALUES (p_target_tenant, v_next, v_src.build_hash, v_src.notes)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
