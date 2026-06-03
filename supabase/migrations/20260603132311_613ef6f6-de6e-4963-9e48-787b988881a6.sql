
CREATE OR REPLACE FUNCTION public.get_sdr_activity_stats(
  p_start timestamptz,
  p_end timestamptz,
  p_pipe text DEFAULT 'all'
)
RETURNS TABLE (
  user_id uuid,
  tentativas bigint,
  conectadas bigint,
  contato_realizado bigint,
  reunioes_agendadas bigint,
  reunioes_realizadas bigint,
  no_show bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
     AND va.operador_id = c.operador
     AND va.tenant_id = v_tenant
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
      AND (
        p_pipe = 'all'
        OR a.lead_id IS NULL
        OR l.pipe::text = p_pipe
      )
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
$$;

CREATE OR REPLACE FUNCTION public.get_closer_activity_stats(
  p_start timestamptz,
  p_end timestamptz,
  p_pipe text DEFAULT 'all'
)
RETURNS TABLE (
  user_id uuid,
  reunioes_realizadas bigint,
  propostas bigint,
  followups bigint,
  fechamentos_ganhos bigint,
  fechamentos_perdidos bigint,
  receita_total numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH op_filtered AS (
    SELECT o.*, COALESCE(o.closer_id, o.responsavel_id) AS uid
    FROM public.crm_oportunidades o
    LEFT JOIN public.crm_leads l ON l.id = o.lead_id
    WHERE o.tenant_id = v_tenant
      AND COALESCE(o.closer_id, o.responsavel_id) IS NOT NULL
      AND (
        p_pipe = 'all'
        OR o.lead_id IS NULL
        OR l.pipe::text = p_pipe
      )
  ),
  op_stats AS (
    SELECT
      uid,
      COUNT(*) FILTER (WHERE created_at >= p_start AND created_at <= p_end) AS reunioes_realizadas,
      COUNT(*) FILTER (
        WHERE etapa = 'proposta'::oportunidade_etapa
          AND data_proposta IS NOT NULL
          AND data_proposta >= p_start
          AND data_proposta <= p_end
      ) AS propostas,
      COUNT(*) FILTER (
        WHERE etapa = 'fechado_ganho'::oportunidade_etapa
          AND data_fechamento_real IS NOT NULL
          AND data_fechamento_real >= p_start
          AND data_fechamento_real <= p_end
      ) AS fechamentos_ganhos,
      COUNT(*) FILTER (
        WHERE etapa = 'fechado_perdido'::oportunidade_etapa
          AND updated_at >= p_start
          AND updated_at <= p_end
      ) AS fechamentos_perdidos,
      COALESCE(SUM(
        CASE
          WHEN etapa = 'fechado_ganho'::oportunidade_etapa
           AND data_fechamento_real IS NOT NULL
           AND data_fechamento_real >= p_start
           AND data_fechamento_real <= p_end
          THEN COALESCE(valor_ef, 0) + COALESCE(valor_fee, 0)
          ELSE 0
        END
      ), 0) AS receita_total
    FROM op_filtered
    GROUP BY uid
  ),
  followup_stats AS (
    SELECT
      COALESCE(o.closer_id, o.responsavel_id) AS uid,
      COUNT(*) AS followups
    FROM public.crm_atividades a
    JOIN op_filtered o ON o.id = a.oportunidade_id
    WHERE a.tenant_id = v_tenant
      AND a.tipo IN ('tarefa', 'nota')
      AND a.created_at >= p_start
      AND a.created_at <= p_end
    GROUP BY COALESCE(o.closer_id, o.responsavel_id)
  ),
  all_uids AS (
    SELECT uid FROM op_stats WHERE uid IS NOT NULL
    UNION
    SELECT uid FROM followup_stats WHERE uid IS NOT NULL
  )
  SELECT
    u.uid,
    COALESCE(os.reunioes_realizadas, 0),
    COALESCE(os.propostas, 0),
    COALESCE(fs.followups, 0),
    COALESCE(os.fechamentos_ganhos, 0),
    COALESCE(os.fechamentos_perdidos, 0),
    COALESCE(os.receita_total, 0)
  FROM all_uids u
  LEFT JOIN op_stats os ON os.uid = u.uid
  LEFT JOIN followup_stats fs ON fs.uid = u.uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sdr_activity_stats(timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_closer_activity_stats(timestamptz, timestamptz, text) TO authenticated;
