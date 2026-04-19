CREATE OR REPLACE FUNCTION public.auto_create_oportunidade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.etapa = 'reuniao_realizada' AND (OLD.etapa IS DISTINCT FROM 'reuniao_realizada') THEN
    IF NOT EXISTS (SELECT 1 FROM public.crm_oportunidades WHERE lead_id = NEW.id) THEN
      INSERT INTO public.crm_oportunidades (lead_id, nome_oportunidade, etapa, responsavel_id, data_proposta)
      VALUES (
        NEW.id,
        COALESCE(NEW.empresa, NEW.nome),
        'proposta',
        NEW.responsavel_id,
        now()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;