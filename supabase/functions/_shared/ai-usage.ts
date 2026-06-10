// Shared AI usage logger. Fire-and-forget; never throws into the caller.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const USD_BRL = Number(Deno.env.get("AI_USAGE_USD_BRL") || "5.20");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

type PriceRow = {
  model: string;
  input_price_per_1m_usd: number;
  output_price_per_1m_usd: number;
  audio_price_per_minute_usd: number;
};

let priceCache: { rows: Record<string, PriceRow>; ts: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

async function getPricing(): Promise<Record<string, PriceRow>> {
  if (priceCache && Date.now() - priceCache.ts < CACHE_MS) return priceCache.rows;
  const { data } = await admin.from("ai_model_pricing").select("model,input_price_per_1m_usd,output_price_per_1m_usd,audio_price_per_minute_usd");
  const map: Record<string, PriceRow> = {};
  (data || []).forEach((r: any) => { map[r.model] = r; });
  priceCache = { rows: map, ts: Date.now() };
  return map;
}

export type LogAiUsageInput = {
  tenantId?: string | null;
  userId?: string | null;
  functionName: string;
  provider: "lovable" | "anthropic" | string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  audioSeconds?: number;
  requestId?: string | null;
  status?: "ok" | "error";
  error?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAiUsage(input: LogAiUsageInput): Promise<void> {
  try {
    const pricing = await getPricing();
    const p = pricing[input.model];
    const inTok = input.inputTokens || 0;
    const outTok = input.outputTokens || 0;
    const audioSec = input.audioSeconds || 0;
    let costUsd = 0;
    if (p) {
      costUsd =
        (inTok / 1_000_000) * Number(p.input_price_per_1m_usd) +
        (outTok / 1_000_000) * Number(p.output_price_per_1m_usd) +
        (audioSec / 60) * Number(p.audio_price_per_minute_usd);
    }
    const costBrl = costUsd * USD_BRL;

    await admin.from("ai_usage_events").insert({
      tenant_id: input.tenantId || null,
      user_id: input.userId || null,
      function_name: input.functionName,
      provider: input.provider,
      model: input.model,
      input_tokens: inTok,
      output_tokens: outTok,
      total_tokens: inTok + outTok,
      audio_seconds: audioSec,
      cost_usd: costUsd,
      cost_brl: costBrl,
      request_id: input.requestId || null,
      status: input.status || "ok",
      error: input.error || null,
      metadata: input.metadata || null,
    });
  } catch (err) {
    console.error("[ai-usage] failed to log:", err);
  }
}

// Convenience: extract usage from common response shapes.
export function extractUsage(provider: string, body: any): { inputTokens: number; outputTokens: number } {
  if (!body) return { inputTokens: 0, outputTokens: 0 };
  if (provider === "anthropic") {
    const u = body.usage || {};
    return { inputTokens: Number(u.input_tokens || 0), outputTokens: Number(u.output_tokens || 0) };
  }
  // OpenAI-compatible (Lovable AI Gateway)
  const u = body.usage || {};
  return {
    inputTokens: Number(u.prompt_tokens || u.input_tokens || 0),
    outputTokens: Number(u.completion_tokens || u.output_tokens || 0),
  };
}

// Resolve user_id from Authorization header (best-effort).
export async function resolveUserIdFromAuth(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.replace("Bearer ", "");
    const { data } = await admin.auth.getUser(token);
    return data?.user?.id || null;
  } catch { return null; }
}

// Resolve tenant for a user (uses current_tenant logic: active_tenant_id for super admins, else tenant_id).
export async function resolveTenantForUser(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id, active_tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) return null;
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isSuper = (roles || []).some((r: any) => r.role === "super_admin_v4");
    return isSuper ? (profile.active_tenant_id || profile.tenant_id) : profile.tenant_id;
  } catch { return null; }
}
