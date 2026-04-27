ALTER TABLE public.crm_call_events
ADD CONSTRAINT crm_call_events_3cplus_requires_lead
CHECK (provider <> '3cplus' OR lead_id IS NOT NULL);