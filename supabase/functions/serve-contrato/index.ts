import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path');
    const token = url.searchParams.get('token') || req.headers.get('Authorization')?.replace('Bearer ', '');

    if (!path) return new Response('missing path', { status: 400, headers: corsHeaders });
    if (!token) return new Response('unauthorized', { status: 401, headers: corsHeaders });

    const authed = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: claims, error: authErr } = await authed.auth.getClaims(token);
    if (authErr || !claims?.claims) {
      return new Response('unauthorized', { status: 401, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data, error } = await admin.storage.from('contratos-assinados').download(path);
    if (error || !data) {
      return new Response('not found: ' + (error?.message || ''), { status: 404, headers: corsHeaders });
    }

    const buf = await data.arrayBuffer();
    const filename = path.split('/').pop() || 'contrato.pdf';
    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (e) {
    return new Response('error: ' + (e as Error).message, { status: 500, headers: corsHeaders });
  }
});
