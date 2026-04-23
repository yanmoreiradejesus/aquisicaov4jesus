import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TASK_DURATION_MIN = 15;
const APP_BASE_URL = "https://v4jesus.com";
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const TASKS_BASE = "https://www.googleapis.com/tasks/v1/lists/@default/tasks";
const RECONNECT_MSG = "Reconecte sua conta Google em /perfil para autorizar Google Tasks";

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

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

// Formata HH:mm em America/Sao_Paulo a partir de uma data ISO
function formatHHmmSP(iso: string): string {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(d);
}

// Formata YYYY-MM-DD em America/Sao_Paulo (data local do usuário)
function formatDateSP(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
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
    const explicit_resource_type: string | undefined = body.google_resource_type;

    if (!atividade_id || !action) return jsonResponse({ error: "Missing atividade_id or action" }, 400);
    if (action !== "upsert" && action !== "delete") return jsonResponse({ error: "Invalid action" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Token Google
    const { data: tokenRow } = await admin
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!tokenRow) {
      if (action === "upsert") {
        await admin
          .from("crm_atividades")
          .update({ google_sync_status: "skipped", google_sync_error: "Google não conectado" })
          .eq("id", atividade_id);
      }
      return jsonResponse({ synced: false, reason: "NOT_CONNECTED" });
    }

    let accessToken = tokenRow.access_token as string | null;
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

    // Lê atividade pra rotear (ou pra delete se precisar do tipo)
    const { data: atividade } = await admin
      .from("crm_atividades")
      .select("*")
      .eq("id", atividade_id)
      .maybeSingle();

    // ===== DELETE =====
    if (action === "delete") {
      const eventId = explicit_event_id;
      if (!eventId) return jsonResponse({ synced: true, reason: "no_event_id" });

      // Determina endpoint de deleção
      const resourceType =
        explicit_resource_type ||
        atividade?.google_resource_type ||
        // Se não temos info, tenta inferir pela origem da atividade
        (atividade?.oportunidade_id ? "task" : "event");

      const url = resourceType === "task"
        ? `${TASKS_BASE}/${encodeURIComponent(eventId)}`
        : `${CALENDAR_BASE}/${encodeURIComponent(eventId)}`;

      const delRes = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (delRes.ok || delRes.status === 404 || delRes.status === 410) {
        return jsonResponse({ synced: true, deleted: true, resource: resourceType });
      }

      const errText = await delRes.text();
      console.error("Delete error", resourceType, delRes.status, errText);
      return jsonResponse({ synced: false, reason: "DELETE_FAILED", status: delRes.status, details: errText }, 200);
    }

    // ===== UPSERT =====
    if (!atividade) return jsonResponse({ synced: false, reason: "ATIVIDADE_NOT_FOUND" }, 200);
    if (atividade.tipo !== "tarefa") return jsonResponse({ synced: false, reason: "NOT_A_TASK" }, 200);
    if (!atividade.data_agendada) {
      await admin
        .from("crm_atividades")
        .update({ google_sync_status: "skipped", google_sync_error: "Sem data_agendada" })
        .eq("id", atividade_id);
      return jsonResponse({ synced: false, reason: "NO_DATE" }, 200);
    }

    // Roteamento: Lead → Calendar Event | Oportunidade → Google Tasks
    const isOportunidade = !!atividade.oportunidade_id && !atividade.lead_id;
    const targetResource: "event" | "task" = isOportunidade ? "task" : "event";

    // Migração órfã: tarefa de oportunidade que tem id de Calendar Event
    // (resource_type ainda não setado OU está marcado como event)
    if (
      targetResource === "task" &&
      atividade.google_event_id &&
      atividade.google_resource_type !== "task"
    ) {
      // Tenta deletar o evento órfão no Calendar (best-effort)
      try {
        await fetch(
          `${CALENDAR_BASE}/${encodeURIComponent(atividade.google_event_id)}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
        );
      } catch (e) {
        console.warn("Orphan calendar event cleanup failed", e);
      }
      // Zera id pra forçar criação como Task abaixo
      atividade.google_event_id = null;
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

    // ===== Fluxo Calendar Event (LEADS) =====
    if (targetResource === "event") {
      const summary = contextLabel ? `${prefix} ${tituloBase} — ${contextLabel}` : `${prefix} ${tituloBase}`;
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
        colorId: "5",
        reminders: { useDefault: true },
      };

      let eventId = atividade.google_event_id as string | null;
      let calRes: Response;

      if (eventId) {
        calRes = await fetch(`${CALENDAR_BASE}/${encodeURIComponent(eventId)}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(eventBody),
        });
        if (calRes.status === 404 || calRes.status === 410) {
          eventId = null;
          calRes = await fetch(CALENDAR_BASE, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(eventBody),
          });
        }
      } else {
        calRes = await fetch(CALENDAR_BASE, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(eventBody),
        });
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
          google_resource_type: "event",
          google_sync_status: "synced",
          google_sync_error: null,
        })
        .eq("id", atividade_id);

      return jsonResponse({ synced: true, resource: "event", event_id: calJson.id, event_link: calJson.htmlLink });
    }

    // ===== Fluxo Google Tasks (OPORTUNIDADES) =====
    const hora = formatHHmmSP(atividade.data_agendada);
    const due = `${formatDateSP(atividade.data_agendada)}T00:00:00.000Z`;
    const title = `${prefix} ${tituloBase} (${hora})${contextLabel ? ` — ${contextLabel}` : ""}`;
    const notes = [
      atividade.descricao && atividade.descricao !== tituloBase ? atividade.descricao : null,
      contextLabel ? `Contexto: ${contextLabel}` : null,
      `Horário agendado no CRM: ${hora}`,
      `Abrir no CRM: ${appLink}`,
    ].filter(Boolean).join("\n\n");

    const taskBody: Record<string, unknown> = {
      title,
      notes,
      due,
      status: atividade.concluida ? "completed" : "needsAction",
    };
    if (atividade.concluida) {
      taskBody.completed = new Date().toISOString();
    }

    let taskId = atividade.google_event_id as string | null;
    let tRes: Response;

    if (taskId) {
      tRes = await fetch(`${TASKS_BASE}/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(taskBody),
      });
      if (tRes.status === 404 || tRes.status === 410) {
        taskId = null;
        tRes = await fetch(TASKS_BASE, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(taskBody),
        });
      }
    } else {
      tRes = await fetch(TASKS_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(taskBody),
      });
    }

    const tJson = await tRes.json().catch(() => ({}));
    if (!tRes.ok) {
      console.error("Tasks upsert error", tRes.status, tJson);
      // Detecta scope insuficiente
      const errStr = JSON.stringify(tJson).toLowerCase();
      const isScopeError =
        tRes.status === 403 &&
        (errStr.includes("insufficient") || errStr.includes("scope") || errStr.includes("permission"));
      const errMsg = isScopeError
        ? RECONNECT_MSG
        : `${tRes.status}: ${JSON.stringify(tJson).slice(0, 500)}`;

      await admin
        .from("crm_atividades")
        .update({ google_sync_status: "error", google_sync_error: errMsg })
        .eq("id", atividade_id);
      return jsonResponse({ synced: false, reason: isScopeError ? "SCOPE_MISSING" : "TASKS_ERROR", details: tJson }, 200);
    }

    await admin
      .from("crm_atividades")
      .update({
        google_event_id: tJson.id,
        google_resource_type: "task",
        google_sync_status: "synced",
        google_sync_error: null,
      })
      .eq("id", atividade_id);

    return jsonResponse({ synced: true, resource: "task", task_id: tJson.id });
  } catch (e) {
    console.error("sync-task-to-google fatal", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
