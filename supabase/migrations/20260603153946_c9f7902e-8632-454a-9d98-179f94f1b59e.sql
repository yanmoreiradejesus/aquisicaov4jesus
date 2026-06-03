
-- 1) Corrige get_sdr_activity_stats: match por agent_id OU operador_id
CREATE OR REPLACE FUNCTION public.get_sdr_activity_stats(p_start timestamp with time zone, p_end timestamp with time zone, p_pipe text DEFAULT 'all'::text)
 RETURNS TABLE(user_id uuid, tentativas bigint, conectadas bigint, contato_realizado bigint, reunioes_agendadas bigint, reunioes_realizadas bigint, no_show bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
BEGIN
  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH
  call_stats AS (
    SELECT
      COALESCE(c.user_id, va.user_id) AS uid,
      COUNT(*) AS tentativas,
      COUNT(*) FILTER (WHERE COALESCE(c.duracao_seg, 0) >= 10) AS conectadas
    FROM public.crm_call_events c
    LEFT JOIN public.voip_accounts va
      ON va.provider = '3cplus'
     AND va.tenant_id = v_tenant
     AND va.ativo = true
     AND (va.agent_id = c.operador OR va.operador_id = c.operador)
    WHERE c.tenant_id = v_tenant
      AND c.created_at >= p_start
      AND c.created_at <= p_end
    GROUP BY COALESCE(c.user_id, va.user_id)
  ),
  etapa_stats AS (
    SELECT
      a.usuario_id AS uid,
      COUNT(*) FILTER (WHERE substring(a.descricao FROM 'para\s+"([^"]+)"') = 'contato_realizado') AS contato_realizado,
      COUNT(*) FILTER (WHERE substring(a.descricao FROM 'para\s+"([^"]+)"') = 'reuniao_agendada') AS reunioes_agendadas
    FROM public.crm_atividades a
    LEFT JOIN public.crm_leads l ON l.id = a.lead_id
    WHERE a.tenant_id = v_tenant
      AND a.tipo = 'mudanca_etapa'
      AND a.usuario_id IS NOT NULL
      AND a.created_at >= p_start
      AND a.created_at <= p_end
      AND (p_pipe = 'all' OR a.lead_id IS NULL OR l.pipe::text = p_pipe)
    GROUP BY a.usuario_id
  ),
  lead_stats AS (
    SELECT
      l.responsavel_id AS uid,
      COUNT(*) FILTER (
        WHERE l.data_reuniao_realizada IS NOT NULL
          AND l.data_reuniao_realizada >= p_start
          AND l.data_reuniao_realizada <= p_end
      ) AS reunioes_realizadas,
      COUNT(*) FILTER (
        WHERE l.etapa = 'no_show'::lead_etapa
          AND l.updated_at >= p_start
          AND l.updated_at <= p_end
      ) AS no_show
    FROM public.crm_leads l
    WHERE l.tenant_id = v_tenant
      AND l.responsavel_id IS NOT NULL
      AND (p_pipe = 'all' OR l.pipe::text = p_pipe)
    GROUP BY l.responsavel_id
  ),
  all_uids AS (
    SELECT uid FROM call_stats WHERE uid IS NOT NULL
    UNION
    SELECT uid FROM etapa_stats WHERE uid IS NOT NULL
    UNION
    SELECT uid FROM lead_stats WHERE uid IS NOT NULL
  )
  SELECT
    u.uid,
    COALESCE(cs.tentativas, 0),
    COALESCE(cs.conectadas, 0),
    COALESCE(es.contato_realizado, 0),
    COALESCE(es.reunioes_agendadas, 0),
    COALESCE(ls.reunioes_realizadas, 0),
    COALESCE(ls.no_show, 0)
  FROM all_uids u
  LEFT JOIN call_stats cs ON cs.uid = u.uid
  LEFT JOIN etapa_stats es ON es.uid = u.uid
  LEFT JOIN lead_stats ls ON ls.uid = u.uid;
END;
$function$;

-- 2) Backfill: preenche user_id nos eventos 3CPlus existentes sem atribuição
UPDATE public.crm_call_events c
SET user_id = va.user_id
FROM public.voip_accounts va
WHERE c.user_id IS NULL
  AND c.provider = '3cplus'
  AND c.operador IS NOT NULL
  AND va.provider = '3cplus'
  AND va.tenant_id = c.tenant_id
  AND va.ativo = true
  AND (va.agent_id = c.operador OR va.operador_id = c.operador);
