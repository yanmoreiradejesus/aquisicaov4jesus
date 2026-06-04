
DROP FUNCTION IF EXISTS public.get_sdr_activity_stats(timestamp with time zone, timestamp with time zone, text);
DROP FUNCTION IF EXISTS public.get_sdr_activity_totals(timestamp with time zone, timestamp with time zone, text);

CREATE OR REPLACE FUNCTION public.get_sdr_activity_stats(p_start timestamp with time zone, p_end timestamp with time zone, p_pipe text DEFAULT 'all'::text)
 RETURNS TABLE(user_id uuid, ligacoes bigint, contato_realizado bigint, reunioes_agendadas bigint, reunioes_realizadas bigint, no_show bigint, conversoes bigint, tarefas bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
BEGIN
  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH
  call_stats AS (
    SELECT COALESCE(c.user_id, va.user_id) AS uid, COUNT(*) AS ligacoes
    FROM public.crm_call_events c
    LEFT JOIN public.voip_accounts va
      ON va.tenant_id = v_tenant
     AND va.ativo = true
     AND va.provider = c.provider
     AND (va.agent_id = c.operador OR va.operador_id = c.operador)
    LEFT JOIN public.crm_leads l ON l.id = c.lead_id
    WHERE c.tenant_id = v_tenant
      AND c.created_at >= p_start AND c.created_at <= p_end
      AND (p_pipe = 'all' OR c.lead_id IS NULL OR l.pipe::text = p_pipe)
    GROUP BY COALESCE(c.user_id, va.user_id)
  ),
  etapa_stats AS (
    SELECT
      a.usuario_id AS uid,
      COUNT(DISTINCT a.lead_id) FILTER (WHERE substring(a.descricao FROM 'para\s+"([^"]+)"') = 'contato_realizado') AS contato_realizado,
      COUNT(DISTINCT a.lead_id) FILTER (WHERE substring(a.descricao FROM 'para\s+"([^"]+)"') = 'reuniao_agendada') AS reunioes_agendadas
    FROM public.crm_atividades a
    LEFT JOIN public.crm_leads l ON l.id = a.lead_id
    WHERE a.tenant_id = v_tenant
      AND a.tipo = 'mudanca_etapa'
      AND a.usuario_id IS NOT NULL
      AND a.created_at >= p_start AND a.created_at <= p_end
      AND (p_pipe = 'all' OR a.lead_id IS NULL OR l.pipe::text = p_pipe)
    GROUP BY a.usuario_id
  ),
  task_stats AS (
    SELECT a.usuario_id AS uid, COUNT(*) AS tarefas
    FROM public.crm_atividades a
    LEFT JOIN public.crm_leads l ON l.id = a.lead_id
    WHERE a.tenant_id = v_tenant
      AND a.tipo = 'tarefa'
      AND a.usuario_id IS NOT NULL
      AND a.created_at >= p_start AND a.created_at <= p_end
      AND (p_pipe = 'all' OR a.lead_id IS NULL OR l.pipe::text = p_pipe)
    GROUP BY a.usuario_id
  ),
  lead_stats AS (
    SELECT
      l.responsavel_id AS uid,
      COUNT(*) FILTER (
        WHERE l.data_reuniao_realizada IS NOT NULL
          AND l.data_reuniao_realizada >= p_start AND l.data_reuniao_realizada <= p_end
      ) AS reunioes_realizadas,
      COUNT(*) FILTER (
        WHERE l.etapa = 'no_show'::lead_etapa
          AND l.updated_at >= p_start AND l.updated_at <= p_end
      ) AS no_show
    FROM public.crm_leads l
    WHERE l.tenant_id = v_tenant
      AND l.responsavel_id IS NOT NULL
      AND (p_pipe = 'all' OR l.pipe::text = p_pipe)
    GROUP BY l.responsavel_id
  ),
  conv_stats AS (
    SELECT l.responsavel_id AS uid, COUNT(*) AS conversoes
    FROM public.crm_oportunidades o
    JOIN public.crm_leads l ON l.id = o.lead_id
    WHERE o.tenant_id = v_tenant
      AND o.etapa = 'fechado_ganho'::oportunidade_etapa
      AND o.data_fechamento_real IS NOT NULL
      AND o.data_fechamento_real >= p_start AND o.data_fechamento_real <= p_end
      AND l.responsavel_id IS NOT NULL
      AND (p_pipe = 'all' OR l.pipe::text = p_pipe)
    GROUP BY l.responsavel_id
  ),
  all_uids AS (
    SELECT uid FROM call_stats WHERE uid IS NOT NULL
    UNION SELECT uid FROM etapa_stats WHERE uid IS NOT NULL
    UNION SELECT uid FROM task_stats WHERE uid IS NOT NULL
    UNION SELECT uid FROM lead_stats WHERE uid IS NOT NULL
    UNION SELECT uid FROM conv_stats WHERE uid IS NOT NULL
  )
  SELECT
    u.uid,
    COALESCE(cs.ligacoes, 0),
    COALESCE(es.contato_realizado, 0),
    COALESCE(es.reunioes_agendadas, 0),
    COALESCE(ls.reunioes_realizadas, 0),
    COALESCE(ls.no_show, 0),
    COALESCE(cv.conversoes, 0),
    COALESCE(ts.tarefas, 0)
  FROM all_uids u
  LEFT JOIN call_stats cs ON cs.uid = u.uid
  LEFT JOIN etapa_stats es ON es.uid = u.uid
  LEFT JOIN task_stats ts ON ts.uid = u.uid
  LEFT JOIN lead_stats ls ON ls.uid = u.uid
  LEFT JOIN conv_stats cv ON cv.uid = u.uid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_sdr_activity_totals(p_start timestamp with time zone, p_end timestamp with time zone, p_pipe text DEFAULT 'all'::text)
 RETURNS TABLE(ligacoes bigint, contato_realizado bigint, reunioes_agendadas bigint, reunioes_realizadas bigint, no_show bigint, conversoes bigint, tarefas bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
BEGIN
  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN
    RETURN QUERY SELECT 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  RETURN QUERY
  WITH
  call_totals AS (
    SELECT COUNT(*) AS ligacoes
    FROM public.crm_call_events c
    LEFT JOIN public.crm_leads l ON l.id = c.lead_id
    WHERE c.tenant_id = v_tenant
      AND c.created_at >= p_start AND c.created_at <= p_end
      AND (p_pipe = 'all' OR c.lead_id IS NULL OR l.pipe::text = p_pipe)
  ),
  etapa_totals AS (
    SELECT
      COUNT(DISTINCT a.lead_id) FILTER (WHERE substring(a.descricao FROM 'para\s+"([^"]+)"') = 'contato_realizado') AS contato_realizado,
      COUNT(DISTINCT a.lead_id) FILTER (WHERE substring(a.descricao FROM 'para\s+"([^"]+)"') = 'reuniao_agendada') AS reunioes_agendadas
    FROM public.crm_atividades a
    LEFT JOIN public.crm_leads l ON l.id = a.lead_id
    WHERE a.tenant_id = v_tenant
      AND a.tipo = 'mudanca_etapa'
      AND a.created_at >= p_start AND a.created_at <= p_end
      AND (p_pipe = 'all' OR a.lead_id IS NULL OR l.pipe::text = p_pipe)
  ),
  task_totals AS (
    SELECT COUNT(*) AS tarefas
    FROM public.crm_atividades a
    LEFT JOIN public.crm_leads l ON l.id = a.lead_id
    WHERE a.tenant_id = v_tenant
      AND a.tipo = 'tarefa'
      AND a.created_at >= p_start AND a.created_at <= p_end
      AND (p_pipe = 'all' OR a.lead_id IS NULL OR l.pipe::text = p_pipe)
  ),
  lead_totals AS (
    SELECT
      COUNT(*) FILTER (
        WHERE l.data_reuniao_realizada IS NOT NULL
          AND l.data_reuniao_realizada >= p_start AND l.data_reuniao_realizada <= p_end
      ) AS reunioes_realizadas,
      COUNT(*) FILTER (
        WHERE l.etapa = 'no_show'::lead_etapa
          AND l.updated_at >= p_start AND l.updated_at <= p_end
      ) AS no_show
    FROM public.crm_leads l
    WHERE l.tenant_id = v_tenant
      AND (p_pipe = 'all' OR l.pipe::text = p_pipe)
  ),
  conv_totals AS (
    SELECT COUNT(*) AS conversoes
    FROM public.crm_oportunidades o
    LEFT JOIN public.crm_leads l ON l.id = o.lead_id
    WHERE o.tenant_id = v_tenant
      AND o.etapa = 'fechado_ganho'::oportunidade_etapa
      AND o.data_fechamento_real IS NOT NULL
      AND o.data_fechamento_real >= p_start AND o.data_fechamento_real <= p_end
      AND (p_pipe = 'all' OR o.lead_id IS NULL OR l.pipe::text = p_pipe)
  )
  SELECT
    COALESCE(ct.ligacoes, 0),
    COALESCE(et.contato_realizado, 0),
    COALESCE(et.reunioes_agendadas, 0),
    COALESCE(lt.reunioes_realizadas, 0),
    COALESCE(lt.no_show, 0),
    COALESCE(cv.conversoes, 0),
    COALESCE(tt.tarefas, 0)
  FROM call_totals ct
  CROSS JOIN etapa_totals et
  CROSS JOIN task_totals tt
  CROSS JOIN lead_totals lt
  CROSS JOIN conv_totals cv;
END;
$function$;
