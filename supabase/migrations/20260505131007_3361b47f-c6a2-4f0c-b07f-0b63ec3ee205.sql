ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS outbound_tag TEXT,
  ADD COLUMN IF NOT EXISTS outbound_tag_color TEXT;

ALTER TABLE public.crm_leads
  DROP CONSTRAINT IF EXISTS crm_leads_outbound_tag_len;
ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_outbound_tag_len CHECK (outbound_tag IS NULL OR char_length(outbound_tag) <= 6);