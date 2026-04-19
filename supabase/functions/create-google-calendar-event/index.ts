import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Refresh failed: ${JSON.stringify(json)}`);
  return json as { access_token: string; expires_in: number };
}

interface ExtraAttendee {
  email: string;
  nome?: string;
  funcao?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const lead_id: string | undefined = body.lead_id;
    const closer_id: string | null = body.closer_id ?? null;
    const extra_attendees: ExtraAttendee[] = Array.isArray(body.extra_attendees)
      ? body.extra_attendees.filter((a: any) => a && typeof a.email === "string" && a.email.trim())
      : [];

    if (!lead_id) {
      return new Response(JSON.stringify({ error: "Missing lead_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Lead
    const { data: lead, error: leadErr } = await admin
      .from("crm_leads")
      .select("*")
      .eq("id", lead_id)
      .single();
    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lead.email) {
      return new Response(JSON.stringify({ error: "Lead sem email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!lead.data_reuniao_agendada) {
      return new Response(JSON.stringify({ error: "Lead sem data_reuniao_agendada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Token Google
    const { data: tokenRow, error: tokenErr } = await admin
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", userData.user.id)
      .single();

    if (tokenErr || !tokenRow) {
      return new Response(JSON.stringify({ error: "NOT_CONNECTED" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = tokenRow.access_token;
    const isExpired =
      !tokenRow.expires_at || new Date(tokenRow.expires_at).getTime() < Date.now() + 60_000;
    if (isExpired) {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token);
      accessToken = refreshed.access_token;
      await admin
        .from("user_google_tokens")
        .update({
          access_token: accessToken,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userData.user.id);
    }

    // Closer (profile)
    let closerEmail: string | null = null;
    let closerName: string | null = null;
    if (closer_id) {
      const { data: closerProfile } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", closer_id)
        .maybeSingle();
      if (closerProfile) {
        closerEmail = closerProfile.email;
        closerName = closerProfile.full_name ?? closerProfile.email;
      }
    }

    // 1h fixo
    const start = new Date(lead.data_reuniao_agendada);
    const end = new Date(start.getTime() + 60 * 60_000);

    const empresaCliente = lead.empresa || lead.nome;
    const summary = `V4 Company + ${empresaCliente}`;

    const description = `Para acessar a reunião basta clicar no link abaixo e depois no botão azul de "Entrar com Google Meet" ou se estiver em inglês "Login with Google Meet". Algumas informações sobre a nossa reunião:

💻  1) É fundamental acessar de um computador ou notebook com câmera, para visualizar melhor as informações;


🎥 2) Não é obrigatório, mas é melhor usar uma webcam;


🎧 3) Fundamental você ter microfone e de preferência um fone de ouvido, também;


📶4) É importante ter uma boa conexão de 'internet'. Se possível, com cabo.`;

    // Attendees: lead + conta Google conectada + closer + extras
    const attendeesMap = new Map<string, { email: string; displayName?: string }>();
    const addAttendee = (email?: string | null, displayName?: string | null) => {
      if (!email) return;
      const key = email.toLowerCase().trim();
      if (!key) return;
      if (!attendeesMap.has(key)) {
        attendeesMap.set(key, { email: key, displayName: displayName ?? undefined });
      }
    };
    addAttendee(lead.email, lead.nome);
    addAttendee(tokenRow.email_google, "V4 Company");
    addAttendee(closerEmail, closerName ?? "Closer V4");
    for (const a of extra_attendees) {
      addAttendee(a.email, a.nome || a.funcao || undefined);
    }
    const attendees = Array.from(attendeesMap.values());

    const existingEventId: string | null = lead.google_event_id ?? null;
    let calJson: any;

    if (existingEventId) {
      // Buscar evento existente para mesclar attendees (preservar quem já está)
      const getRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingEventId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const existing = await getRes.json();
      if (getRes.ok && Array.isArray(existing.attendees)) {
        for (const a of existing.attendees) {
          addAttendee(a.email, a.displayName);
        }
      }
      const mergedAttendees = Array.from(attendeesMap.values());

      const patchBody = {
        summary,
        description,
        start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
        end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
        attendees: mergedAttendees,
      };

      const patchRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingEventId)}?sendUpdates=all`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(patchBody),
        }
      );
      calJson = await patchRes.json();
      if (!patchRes.ok) {
        console.error("Calendar patch error", calJson);
        return new Response(JSON.stringify({ error: "Calendar error", details: calJson }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const event = {
        summary,
        description,
        start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
        end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: `lead-${lead.id}-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: { useDefault: true },
      };

      const calRes = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      calJson = await calRes.json();
      if (!calRes.ok) {
        console.error("Calendar create error", calJson);
        return new Response(JSON.stringify({ error: "Calendar error", details: calJson }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Notas: anexar convidados extras às notas existentes
    let notasUpdate: string | null = null;
    if (extra_attendees.length > 0) {
      const linhas = extra_attendees.map((a) => {
        const nome = a.nome?.trim() || "(sem nome)";
        const funcao = a.funcao?.trim() ? ` — ${a.funcao.trim()}` : "";
        return `• ${nome}${funcao} <${a.email}>`;
      });
      const bloco = `\n\n[Convidados adicionais da reunião — ${new Date().toLocaleString("pt-BR")}]\n${linhas.join("\n")}`;
      notasUpdate = ((lead.notas ?? "").trim() + bloco).trim();
    }

    const updatePayload: Record<string, unknown> = {
      google_event_id: calJson.id,
      google_event_link: calJson.htmlLink,
    };
    if (notasUpdate !== null) updatePayload.notas = notasUpdate;

    await admin.from("crm_leads").update(updatePayload).eq("id", lead_id);

    return new Response(
      JSON.stringify({
        ok: true,
        event_id: calJson.id,
        event_link: calJson.htmlLink,
        meet_link: calJson.hangoutLink ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
