-- Deduplicate keeping best row per (provider, call_id)
WITH ranked AS (
  SELECT id,
         provider,
         call_id,
         ROW_NUMBER() OVER (
           PARTITION BY provider, call_id
           ORDER BY
             (gravacao_url IS NOT NULL) DESC,
             COALESCE(duracao_seg, 0) DESC,
             created_at ASC
         ) AS rn
  FROM public.crm_call_events
  WHERE call_id IS NOT NULL
)
DELETE FROM public.crm_call_events ce
USING ranked r
WHERE ce.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS crm_call_events_provider_call_id_uniq
  ON public.crm_call_events (provider, call_id)
  WHERE call_id IS NOT NULL;