import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPREADSHEET_ID = '1L1W3r135G4lxnqf5aUbDWnz90MEN5yUARB8u1rswyGg';
const SHEET_NAME = 'Controle de Leads';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    
    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_SHEETS_API_KEY not configured');
    }

    console.log('Fetching data from Google Sheets...');

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}?key=${GOOGLE_API_KEY}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Sheets API error:', response.status, errorText);
      throw new Error(`Failed to fetch data: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Data fetched successfully, rows:', data.values?.length || 0);

    // Process the data
    const rows = data.values || [];
    
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No data found in spreadsheet' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // First row is headers
    const headers = rows[0];
    
    // Map rows to objects
    const leads = rows.slice(1).map((row: string[]) => {
      const lead: Record<string, string> = {};
      headers.forEach((header: string, index: number) => {
        lead[header] = row[index] || '';
      });
      return lead;
    });

    console.log('Processed leads:', leads.length);

    return new Response(
      JSON.stringify({ 
        leads,
        totalRows: leads.length,
        lastUpdated: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in fetch-sheets-data:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
