import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_IP = '185.158.133.1';

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { hostname } = await req.json();

    if (!hostname || typeof hostname !== 'string') {
      return new Response(
        JSON.stringify({ error: 'hostname required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Sanitiza: apenas letras/numeros/pontos/hifens
    const clean = hostname.trim().toLowerCase();
    if (!/^[a-z0-9.-]+$/.test(clean) || clean.length > 253) {
      return new Response(
        JSON.stringify({ error: 'invalid hostname' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(clean)}&type=A`;
    const res = await fetch(url, {
      headers: { Accept: 'application/dns-json' },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          resolved_ips: [],
          matches_lovable: false,
          error: `DoH lookup failed (${res.status})`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data: DohResponse = await res.json();
    const ips = (data.Answer ?? [])
      .filter((a) => a.type === 1) // A records
      .map((a) => a.data);

    const matches = ips.includes(LOVABLE_IP);

    return new Response(
      JSON.stringify({
        resolved_ips: ips,
        matches_lovable: matches,
        expected_ip: LOVABLE_IP,
        status: data.Status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        resolved_ips: [],
        matches_lovable: false,
        error: e instanceof Error ? e.message : 'unknown error',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
