-- tenant_config: single-row, identidade do cliente desta instância
CREATE TABLE IF NOT EXISTS public.tenant_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL DEFAULT 'V4 Jesus',
  client_slug TEXT NOT NULL DEFAULT 'jesus',
  client_logo_url TEXT,
  primary_color_hsl TEXT DEFAULT '217 91% 60%',
  app_base_url TEXT DEFAULT 'https://v4jesus.com',
  sheet_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
  voip_provider TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  is_singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read tenant_config"
  ON public.tenant_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin update tenant_config"
  ON public.tenant_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin insert tenant_config"
  ON public.tenant_config FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_tenant_config_updated_at
  BEFORE UPDATE ON public.tenant_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.tenant_config (client_name, client_slug, app_base_url)
VALUES ('V4 Jesus', 'jesus', 'https://v4jesus.com')
ON CONFLICT (is_singleton) DO NOTHING;

-- v4_hub_clients: catálogo central (só vive neste projeto)
CREATE TABLE IF NOT EXISTS public.v4_hub_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_slug TEXT NOT NULL UNIQUE,
  app_url TEXT,
  lovable_project_id TEXT,
  status TEXT NOT NULL DEFAULT 'setup',
  v4_contact TEXT,
  internal_notes TEXT,
  provisioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.v4_hub_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin V4 read clients"
  ON public.v4_hub_clients FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin_v4'::app_role));

CREATE POLICY "Super admin V4 insert clients"
  ON public.v4_hub_clients FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin_v4'::app_role));

CREATE POLICY "Super admin V4 update clients"
  ON public.v4_hub_clients FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin_v4'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin_v4'::app_role));

CREATE POLICY "Super admin V4 delete clients"
  ON public.v4_hub_clients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin_v4'::app_role));

CREATE TRIGGER update_v4_hub_clients_updated_at
  BEFORE UPDATE ON public.v4_hub_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();