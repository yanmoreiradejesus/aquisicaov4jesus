import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPREADSHEET_ID = '1RskyPQdkqUIS4y2n6TXtBPK_MdNKQNwmqRXlAwq0qlg';
const SHEET_NAME = 'Contas a Receber';

function parseNumber(val: string): number {
  if (!val || val.trim() === '') return 0;
  // Handle Brazilian number format: 1.234,56 → 1234.56
  const cleaned = val.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_SHEETS_API_KEY not configured');
    }

    console.log('Fetching financial data from Google Sheets...');

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}?key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Sheets API error:', response.status, errorText);
      throw new Error(`Failed to fetch data: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No data found in spreadsheet' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers: string[] = rows[0];
    console.log('Financial headers:', headers);

    // Find column indices
    const colIndex = (name: string) => {
      const idx = headers.findIndex(h => h && h.trim().toUpperCase() === name.toUpperCase());
      return idx;
    };

    const iVencimento = colIndex('VENCIMENTO');
    const iMes = colIndex('MÊS');
    const iAno = colIndex('ANO');
    const iCliente = colIndex('CLIENTE');
    const iValor = colIndex('VALOR');
    const iRoyalties = colIndex('ROYALTIES');
    const iLiquido = headers.findIndex(h => h && (h.trim().toUpperCase() === 'LIQUÍDO' || h.trim().toUpperCase() === 'LÍQUIDO' || h.trim().toUpperCase() === 'LIQUIDO'));
    const iMeioPag = headers.findIndex(h => h && h.trim().toUpperCase().includes('MEIO'));
    const iDataPag = headers.findIndex(h => h && h.trim().toUpperCase().includes('DATA PAG'));
    const iDiasAtraso = headers.findIndex(h => h && h.trim().toUpperCase().includes('DIAS'));
    const iStatus = colIndex('STATUS');
    const iFormato = colIndex('FORMATO');

    console.log('Column indices:', { iVencimento, iMes, iAno, iCliente, iValor, iRoyalties, iLiquido, iMeioPag, iDataPag, iDiasAtraso, iStatus, iFormato });

    const records = rows.slice(1)
      .filter((row: string[]) => row[iCliente] && row[iCliente].trim() !== '')
      .map((row: string[]) => {
        const get = (i: number) => (i >= 0 && i < row.length) ? (row[i] || '') : '';
        return {
          vencimento: get(iVencimento),
          mes: get(iMes).toLowerCase(),
          ano: parseInt(get(iAno)) || 0,
          cliente: get(iCliente),
          valor: parseNumber(get(iValor)),
          royalties: parseNumber(get(iRoyalties)),
          liquido: parseNumber(get(iLiquido)),
          meioPag: get(iMeioPag),
          dataPag: get(iDataPag) || null,
          diasAtraso: parseInt(get(iDiasAtraso)) || 0,
          status: get(iStatus),
          formato: get(iFormato),
        };
      });

    console.log('Processed financial records:', records.length);
    if (records.length > 0) {
      console.log('Sample record:', records[0]);
    }

    return new Response(
      JSON.stringify({
        records,
        totalRows: records.length,
        lastUpdated: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-financial-data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
