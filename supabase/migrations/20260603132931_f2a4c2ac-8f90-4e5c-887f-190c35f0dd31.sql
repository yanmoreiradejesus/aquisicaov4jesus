CREATE OR REPLACE FUNCTION public.get_sdr_activity_totals(
  p_start timestamptz,
  p_end timestamptz,
  p_pipe text DEFAULT 'all'
)
RETURNS TABLE (
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
    RETURN QUERY SELECT 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  RETURN QUERY
  WITH
  call_totals AS (
    SELECT
      COUNT(*) AS tentativas,
      COUNT(*) FILTER (WHERE COALESCE(c.duracao_seg, 0) >= 10) AS conectadas
    FROM public.crm_call_events c
    LEFT JOIN public.crm_leads l ON l.id = c.lead_id
    WHERE c.tenant_id = v_tenant
      AND c.created_at >= p_start
      AND c.created_at <= p_end
      AND (
        p_pipe = 'all'
        OR c.lead_id IS NULL
        OR l.pipe::text = p_pipe
      )
  ),
  etapa_totals AS (
    SELECT
      COUNT(*) FILTER (WHERE substring(a.descricao FROM 'para\s+"([^"]+)"') = 'contato_realizado') AS contato_realizado,
      COUNT(*) FILTER (WHERE substring(a.descricao FROM 'para\s+"([^"]+)"') = 'reuniao_agendada') AS reunioes_agendadas
    FROM public.crm_atividades a
    LEFT JOIN public.crm_leads l ON l.id = a.lead_id
    WHERE a.tenant_id = v_tenant
      AND a.tipo = 'mudanca_etapa'
      AND a.created_at >= p_start
      AND a.created_at <= p_end
      AND (
        p_pipe = 'all'
        OR a.lead_id IS NULL
        OR l.pipe::text = p_pipe
      )
  ),
  lead_totals AS (
    SELECT
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
      AND (p_pipe = 'all' OR l.pipe::text = p_pipe)
  )
  SELECT
    COALESCE(ct.tentativas, 0),
    COALESCE(ct.conectadas, 0),
    COALESCE(et.contato_realizado, 0),
    COALESCE(et.reunioes_agendadas, 0),
    COALESCE(lt.reunioes_realizadas, 0),
    COALESCE(lt.no_show, 0)
  FROM call_totals ct
  CROSS JOIN etapa_totals et
  CROSS JOIN lead_totals lt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sdr_activity_totals(timestamptz, timestamptz, text) TO authenticated;