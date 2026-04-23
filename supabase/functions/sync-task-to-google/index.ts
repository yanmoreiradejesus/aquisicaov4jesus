import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TASK_DURATION_MIN = 15;
const APP_BASE_URL = "https://v4jesus.com";

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing auth" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return jsonResponse({ error: "Invalid user" }, 401);

    const body = await req.json().catch(() => ({}));
    const atividade_id: string | undefined = body.atividade_id;
    const action: "upsert" | "delete" = body.action;
    const explicit_event_id: string | undefined = body.google_event_id;

    if (!atividade_id || !action) {
      return jsonResponse({ error: "Missing atividade_id or action" }, 400);
    }
    if (action !== "upsert" && action !== "delete") {
      return jsonResponse({ error: "Invalid action" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pega token Google do usuário
    const { data: tokenRow } = await admin
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!tokenRow) {
      // Marca skip silencioso (só pra upsert; delete sem token e sem event_id é no-op)
      if (action === "upsert") {
        await admin
          .from("crm_atividades")
          .update({ google_sync_status: "skipped", google_sync_error: "Google não conectado" })
          .eq("id", atividade_id);
      }
      return jsonResponse({ synced: false, reason: "NOT_CONNECTED" });
    }

    let accessToken = tokenRow.access_token;
    const isExpired =
      !tokenRow.expires_at || new Date(tokenRow.expires_at).getTime() < Date.now() + 60_000;
    if (isExpired) {
      try {
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
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (action === "upsert") {
          await admin
            .from("crm_atividades")
            .update({ google_sync_status: "error", google_sync_error: `Token refresh: ${msg}` })
            .eq("id", atividade_id);
        }
        return jsonResponse({ synced: false, reason: "TOKEN_REFRESH_FAILED", details: msg }, 200);
      }
    }

    // ===== DELETE =====
    if (action === "delete") {
      const eventId = explicit_event_id;
      if (!eventId) return jsonResponse({ synced: true, reason: "no_event_id" });

      const delRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
      );

      // 200/204 = ok; 404/410 = já deletado, idempotente
      if (delRes.ok || delRes.status === 404 || delRes.status === 410) {
        return jsonResponse({ synced: true, deleted: true });
      }

      const errText = await delRes.text();
      console.error("Calendar delete error", delRes.status, errText);
      return jsonResponse({ synced: false, reason: "DELETE_FAILED", status: delRes.status, details: errText }, 200);
    }

    // ===== UPSERT =====
    const { data: atividade, error: atvErr } = await admin
      .from("crm_atividades")
      .select("*")
      .eq("id", atividade_id)
      .maybeSingle();

    if (atvErr || !atividade) {
      return jsonResponse({ synced: false, reason: "ATIVIDADE_NOT_FOUND" }, 200);
    }
    if (atividade.tipo !== "tarefa") {
      return jsonResponse({ synced: false, reason: "NOT_A_TASK" }, 200);
    }
    if (!atividade.data_agendada) {
      await admin
        .from("crm_atividades")
        .update({ google_sync_status: "skipped", google_sync_error: "Sem data_agendada" })
        .eq("id", atividade_id);
      return jsonResponse({ synced: false, reason: "NO_DATE" }, 200);
    }

    // Contexto: lead/oportunidade
    let contextLabel = "";
    let appLink = `${APP_BASE_URL}/comercial`;
    if (atividade.lead_id) {
      const { data: lead } = await admin
        .from("crm_leads")
        .select("nome, empresa")
        .eq("id", atividade.lead_id)
        .maybeSingle();
      if (lead) contextLabel = lead.empresa || lead.nome || "";
      appLink = `${APP_BASE_URL}/comercial/leads`;
    } else if (atividade.oportunidade_id) {
      const { data: op } = await admin
        .from("crm_oportunidades")
        .select("nome_oportunidade, lead_id")
        .eq("id", atividade.oportunidade_id)
        .maybeSingle();
      if (op) {
        contextLabel = op.nome_oportunidade || "";
        if (op.lead_id) {
          const { data: lead } = await admin
            .from("crm_leads")
            .select("nome, empresa")
            .eq("id", op.lead_id)
            .maybeSingle();
          if (lead) contextLabel = lead.empresa || lead.nome || contextLabel;
        }
      }
      appLink = `${APP_BASE_URL}/comercial/oportunidades`;
    }

    const tituloBase = atividade.titulo || atividade.descricao || "Tarefa";
    const prefix = atividade.concluida ? "✓" : "📋";
    const summary = contextLabel
      ? `${prefix} ${tituloBase} — ${contextLabel}`
      : `${prefix} ${tituloBase}`;

    const description = [
      atividade.descricao && atividade.descricao !== tituloBase ? atividade.descricao : null,
      contextLabel ? `Contexto: ${contextLabel}` : null,
      `Abrir no CRM: ${appLink}`,
      atividade.concluida ? "Status: concluída ✓" : "Status: pendente",
    ].filter(Boolean).join("\n\n");

    const start = new Date(atividade.data_agendada);
    const end = new Date(start.getTime() + TASK_DURATION_MIN * 60_000);

    const eventBody = {
      summary,
      description,
      start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
      end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
      colorId: "5", // Banana (amarelo)
      reminders: { useDefault: true },
    };

    let eventId = atividade.google_event_id as string | null;
    let calRes: Response;

    if (eventId) {
      calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(eventBody),
        },
      );

      // Se evento sumiu no Google, recria
      if (calRes.status === 404 || calRes.status === 410) {
        eventId = null;
        calRes = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(eventBody),
          },
        );
      }
    } else {
      calRes = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(eventBody),
        },
      );
    }

    const calJson = await calRes.json();
    if (!calRes.ok) {
      console.error("Calendar upsert error", calRes.status, calJson);
      await admin
        .from("crm_atividades")
        .update({
          google_sync_status: "error",
          google_sync_error: `${calRes.status}: ${JSON.stringify(calJson).slice(0, 500)}`,
        })
        .eq("id", atividade_id);
      return jsonResponse({ synced: false, reason: "CALENDAR_ERROR", details: calJson }, 200);
    }

    await admin
      .from("crm_atividades")
      .update({
        google_event_id: calJson.id,
        google_sync_status: "synced",
        google_sync_error: null,
      })
      .eq("id", atividade_id);

    return jsonResponse({ synced: true, event_id: calJson.id, event_link: calJson.htmlLink });
  } catch (e) {
    console.error("sync-task-to-google fatal", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
