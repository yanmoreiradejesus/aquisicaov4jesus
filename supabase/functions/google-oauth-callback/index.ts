import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fromBase64Url(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
  return atob(padded);
}

async function signState(payload: string) {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("Missing signing secret");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function resolveUserId(req: Request, state?: string | null) {
  if (state) {
    const [payloadEncoded, signature] = state.split(".");
    if (!payloadEncoded || !signature) throw new Error("Invalid state");

    const payload = fromBase64Url(payloadEncoded);
    const expectedSignature = await signState(payload);
    if (signature !== expectedSignature) throw new Error("Invalid state signature");

    const parsed = JSON.parse(payload) as {
      uid: string;
      return_origin?: string | null;
      exp: number;
    };

    if (!parsed.uid || !parsed.exp || parsed.exp < Date.now()) {
      throw new Error("Expired or invalid state");
    }

    return {
      userId: parsed.uid,
      returnOrigin: parsed.return_origin ?? null,
    };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing auth or state");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Invalid user");

  return {
    userId: userData.user.id,
    returnOrigin: null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { code, redirect_uri, state } = body ?? {};
    if (!code || !redirect_uri) {
      return new Response(JSON.stringify({ error: "Missing code or redirect_uri" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, returnOrigin } = await resolveUserId(req, state);

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri,
        grant_type: "authorization_code",
      }),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("Google token error", tokenJson);
      return new Response(JSON.stringify({ error: "Google token exchange failed", details: tokenJson }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { access_token, refresh_token, expires_in, scope } = tokenJson;

    if (!refresh_token) {
      return new Response(
        JSON.stringify({
          error: "No refresh_token returned. Revoke previous access at https://myaccount.google.com/permissions and try again.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let emailGoogle: string | null = null;
    try {
      const uRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const uJson = await uRes.json();
      emailGoogle = uJson.email ?? null;
    } catch (_) {}

    const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: upErr } = await admin.from("user_google_tokens").upsert({
      user_id: userId,
      refresh_token,
      access_token,
      expires_at: expiresAt,
      email_google: emailGoogle,
      scope,
      updated_at: new Date().toISOString(),
    });

    if (upErr) {
      console.error("Upsert error", upErr);
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, email_google: emailGoogle, return_origin: returnOrigin }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
