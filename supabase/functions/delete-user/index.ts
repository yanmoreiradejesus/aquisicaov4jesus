// supabase/functions/delete-user/index.ts
// Exclui um usuário do tenant atual, reatribuindo (opcionalmente) leads,
// oportunidades, atividades e accounts para um substituto.
// Apenas admin (no mesmo tenant) ou super_admin_v4 podem chamar.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  user_id: string;
  /** Para onde reatribuir leads/oport/atividades/accounts; null = deixa sem responsável */
  reassign_to?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente do caller — só pra descobrir quem chamou
    const callerClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const body = (await req.json()) as Body;
    if (!body?.user_id) {
      return new Response(JSON.stringify({ error: "user_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.user_id === callerId) {
      return new Response(
        JSON.stringify({ error: "Você não pode excluir a si mesmo" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Service role — daqui pra frente, bypass de RLS
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Carrega perfis: caller (pra tenant + roles) e alvo (pra tenant)
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("tenant_id, active_tenant_id")
      .eq("id", callerId)
      .maybeSingle();

    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", callerId);

    const isSuper = (callerRoles ?? []).some(
      (r: any) => r.role === "super_admin_v4",
    );
    const callerTenant =
      callerProfile?.active_tenant_id ?? callerProfile?.tenant_id ?? null;

    const { data: targetProfile } = await admin
      .from("profiles")
      .select("tenant_id, full_name, email")
      .eq("id", body.user_id)
      .maybeSingle();

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetTenant = targetProfile.tenant_id;
    const isAdminSameTenant =
      callerTenant === targetTenant &&
      (callerRoles ?? []).some(
        (r: any) =>
          r.role === "admin" &&
          (r.tenant_id === targetTenant || r.tenant_id === null),
      );

    if (!isSuper && !isAdminSameTenant) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reassignTo = body.reassign_to ?? null;

    // 1. Reatribuir referências (apenas dentro do tenant alvo)
    const reassignments = [
      admin
        .from("crm_leads")
        .update({ responsavel_id: reassignTo })
        .eq("responsavel_id", body.user_id)
        .eq("tenant_id", targetTenant),
      admin
        .from("crm_oportunidades")
        .update({ responsavel_id: reassignTo })
        .eq("responsavel_id", body.user_id)
        .eq("tenant_id", targetTenant),
      admin
        .from("crm_atividades")
        .update({ usuario_id: reassignTo })
        .eq("usuario_id", body.user_id)
        .eq("tenant_id", targetTenant),
      admin
        .from("accounts")
        .update({ account_manager_id: reassignTo })
        .eq("account_manager_id", body.user_id)
        .eq("tenant_id", targetTenant),
    ];
    for (const op of reassignments) {
      const { error } = await op;
      if (error) {
        return new Response(
          JSON.stringify({
            error: `Falha ao reatribuir: ${error.message}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // 2. Apaga dependências do usuário
    await admin.from("user_roles").delete().eq("user_id", body.user_id);
    await admin.from("user_page_access").delete().eq("user_id", body.user_id);
    await admin.from("voip_accounts").delete().eq("user_id", body.user_id);
    await admin.from("user_google_tokens").delete().eq("user_id", body.user_id);
    await admin.from("profiles").delete().eq("id", body.user_id);

    // 3. Apaga do auth
    const { error: authErr } = await admin.auth.admin.deleteUser(body.user_id);
    if (authErr) {
      console.warn("auth.admin.deleteUser failed:", authErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        deleted: targetProfile.email,
        reassigned_to: reassignTo,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
