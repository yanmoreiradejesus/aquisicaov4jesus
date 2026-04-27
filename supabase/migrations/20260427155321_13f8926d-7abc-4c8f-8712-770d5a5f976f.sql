CREATE OR REPLACE FUNCTION public.normalize_phone_br(phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d TEXT;
BEGIN
  IF phone IS NULL THEN RETURN ''; END IF;
  d := regexp_replace(phone, '\D', '', 'g');
  IF d = '' THEN RETURN ''; END IF;
  IF length(d) >= 12 AND left(d, 2) = '55' THEN d := substring(d FROM 3); END IF;
  IF left(d, 1) = '0' THEN d := substring(d FROM 2); END IF;
  IF length(d) > 11 THEN d := right(d, 11); END IF;
  RETURN d;
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_3cplus_call_events()
RETURNS TABLE(processed INT, updated INT, linked INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_top_key TEXT;
  v_data JSONB;
  v_event_type TEXT;
  v_call_id TEXT;
  v_phone TEXT;
  v_phone_norm TEXT;
  v_phone_last10 TEXT;
  v_operador TEXT;
  v_agent_id TEXT;
  v_agent_name TEXT;
  v_duration INT;
  v_status TEXT;
  v_recording_url TEXT;
  v_recorded BOOLEAN;
  v_lead_id UUID;
  v_user_id UUID;
  v_processed INT := 0;
  v_updated INT := 0;
  v_linked INT := 0;
BEGIN
  FOR r IN
    SELECT id, raw_payload, lead_id, user_id, gravacao_url
    FROM crm_call_events
    WHERE provider = '3cplus'
  LOOP
    v_processed := v_processed + 1;
    BEGIN
      -- Encontra a chave de evento no top-level
      SELECT key INTO v_top_key
      FROM jsonb_object_keys(r.raw_payload) AS key
      WHERE key IN (
        'call-history-was-created','call-was-connected','call-was-not-answered',
        'call-was-qualified','call-was-finished','call-was-abandoned',
        'manual-call-acw-started','manual-call-acw-ended'
      )
      LIMIT 1;

      IF v_top_key IS NULL THEN
        v_event_type := COALESCE(r.raw_payload->>'event', 'unknown');
        v_data := COALESCE(r.raw_payload->'callHistory', r.raw_payload->'call', r.raw_payload);
      ELSE
        v_event_type := v_top_key;
        v_data := COALESCE(
          r.raw_payload->v_top_key->'callHistory',
          r.raw_payload->v_top_key->'call',
          r.raw_payload->v_top_key->'data',
          r.raw_payload->v_top_key
        );
      END IF;

      v_call_id := COALESCE(
        v_data->>'_id', v_data->>'telephony_id', v_data->>'id',
        v_data->>'call_id', v_data->>'uuid'
      );

      v_phone := COALESCE(
        v_data->>'number', v_data->>'phone',
        v_data->'mailing_data'->>'phone',
        v_data->>'telephone', v_data->>'to', v_data->>'destination'
      );
      v_phone_norm := normalize_phone_br(v_phone);

      v_agent_id := v_data->'agent'->>'id';
      v_agent_name := v_data->'agent'->>'name';
      IF v_agent_id IS NOT NULL AND v_agent_id <> '0' THEN
        v_operador := v_agent_id;
      ELSIF v_agent_name IS NOT NULL THEN
        v_operador := v_agent_name;
      ELSE
        v_operador := COALESCE(v_data->>'operator', v_data->>'user', v_data->>'extension');
      END IF;

      v_duration := COALESCE(
        NULLIF(v_data->>'speaking_with_agent_time','')::INT,
        NULLIF(v_data->>'speaking_time','')::INT,
        NULLIF(v_data->>'billed_time','')::INT,
        NULLIF(v_data->>'duration','')::INT,
        NULLIF(v_data->>'billsec','')::INT
      );

      v_status := COALESCE(
        v_data->'hangupCause'->>'text',
        v_data->'qualification'->>'name',
        v_data->>'status'
      );

      v_recording_url := COALESCE(
        r.gravacao_url,
        v_data->>'recording_url', v_data->>'record_url',
        v_data->>'recording', v_data->>'audio_url'
      );

      v_recorded := COALESCE((v_data->>'recorded')::BOOLEAN, false);

      -- Lead lookup
      v_lead_id := r.lead_id;
      IF v_lead_id IS NULL AND v_phone_norm <> '' THEN
        v_phone_last10 := right(v_phone_norm, 10);
        SELECT id INTO v_lead_id
        FROM crm_leads
        WHERE telefone IS NOT NULL
          AND regexp_replace(telefone, '\D', '', 'g') LIKE '%' || v_phone_last10
        LIMIT 1;
        IF v_lead_id IS NOT NULL THEN
          v_linked := v_linked + 1;
        END IF;
      END IF;

      -- user_id via voip_accounts
      v_user_id := r.user_id;
      IF v_user_id IS NULL AND v_operador IS NOT NULL THEN
        SELECT user_id INTO v_user_id
        FROM voip_accounts
        WHERE provider = '3cplus' AND operador_id = v_operador AND ativo = true
        LIMIT 1;
      END IF;

      UPDATE crm_call_events
      SET event_type = v_event_type,
          call_id = v_call_id,
          telefone = v_phone,
          telefone_normalizado = NULLIF(v_phone_norm, ''),
          operador = v_operador,
          duracao_seg = v_duration,
          status = v_status,
          gravacao_url = v_recording_url,
          lead_id = v_lead_id,
          user_id = v_user_id
      WHERE id = r.id;

      v_updated := v_updated + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_updated, v_linked;
END;
$$;