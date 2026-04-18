// Mapeia DDD brasileiro -> { cidade, estado }
const DDD_MAP: Record<string, { cidade: string; estado: string }> = {
  "11": { cidade: "São Paulo", estado: "SP" },
  "12": { cidade: "São José dos Campos", estado: "SP" },
  "13": { cidade: "Santos", estado: "SP" },
  "14": { cidade: "Bauru", estado: "SP" },
  "15": { cidade: "Sorocaba", estado: "SP" },
  "16": { cidade: "Ribeirão Preto", estado: "SP" },
  "17": { cidade: "São José do Rio Preto", estado: "SP" },
  "18": { cidade: "Presidente Prudente", estado: "SP" },
  "19": { cidade: "Campinas", estado: "SP" },
  "21": { cidade: "Rio de Janeiro", estado: "RJ" },
  "22": { cidade: "Campos dos Goytacazes", estado: "RJ" },
  "24": { cidade: "Volta Redonda", estado: "RJ" },
  "27": { cidade: "Vitória", estado: "ES" },
  "28": { cidade: "Cachoeiro de Itapemirim", estado: "ES" },
  "31": { cidade: "Belo Horizonte", estado: "MG" },
  "32": { cidade: "Juiz de Fora", estado: "MG" },
  "33": { cidade: "Governador Valadares", estado: "MG" },
  "34": { cidade: "Uberlândia", estado: "MG" },
  "35": { cidade: "Poços de Caldas", estado: "MG" },
  "37": { cidade: "Divinópolis", estado: "MG" },
  "38": { cidade: "Montes Claros", estado: "MG" },
  "41": { cidade: "Curitiba", estado: "PR" },
  "42": { cidade: "Ponta Grossa", estado: "PR" },
  "43": { cidade: "Londrina", estado: "PR" },
  "44": { cidade: "Maringá", estado: "PR" },
  "45": { cidade: "Cascavel", estado: "PR" },
  "46": { cidade: "Francisco Beltrão", estado: "PR" },
  "47": { cidade: "Joinville", estado: "SC" },
  "48": { cidade: "Florianópolis", estado: "SC" },
  "49": { cidade: "Chapecó", estado: "SC" },
  "51": { cidade: "Porto Alegre", estado: "RS" },
  "53": { cidade: "Pelotas", estado: "RS" },
  "54": { cidade: "Caxias do Sul", estado: "RS" },
  "55": { cidade: "Santa Maria", estado: "RS" },
  "61": { cidade: "Brasília", estado: "DF" },
  "62": { cidade: "Goiânia", estado: "GO" },
  "63": { cidade: "Palmas", estado: "TO" },
  "64": { cidade: "Rio Verde", estado: "GO" },
  "65": { cidade: "Cuiabá", estado: "MT" },
  "66": { cidade: "Rondonópolis", estado: "MT" },
  "67": { cidade: "Campo Grande", estado: "MS" },
  "68": { cidade: "Rio Branco", estado: "AC" },
  "69": { cidade: "Porto Velho", estado: "RO" },
  "71": { cidade: "Salvador", estado: "BA" },
  "73": { cidade: "Ilhéus", estado: "BA" },
  "74": { cidade: "Juazeiro", estado: "BA" },
  "75": { cidade: "Feira de Santana", estado: "BA" },
  "77": { cidade: "Vitória da Conquista", estado: "BA" },
  "79": { cidade: "Aracaju", estado: "SE" },
  "81": { cidade: "Recife", estado: "PE" },
  "82": { cidade: "Maceió", estado: "AL" },
  "83": { cidade: "João Pessoa", estado: "PB" },
  "84": { cidade: "Natal", estado: "RN" },
  "85": { cidade: "Fortaleza", estado: "CE" },
  "86": { cidade: "Teresina", estado: "PI" },
  "87": { cidade: "Petrolina", estado: "PE" },
  "88": { cidade: "Juazeiro do Norte", estado: "CE" },
  "89": { cidade: "Picos", estado: "PI" },
  "91": { cidade: "Belém", estado: "PA" },
  "92": { cidade: "Manaus", estado: "AM" },
  "93": { cidade: "Santarém", estado: "PA" },
  "94": { cidade: "Marabá", estado: "PA" },
  "95": { cidade: "Boa Vista", estado: "RR" },
  "96": { cidade: "Macapá", estado: "AP" },
  "97": { cidade: "Coari", estado: "AM" },
  "98": { cidade: "São Luís", estado: "MA" },
  "99": { cidade: "Imperatriz", estado: "MA" },
};

/** Extrai apenas dígitos */
const digits = (s?: string | null) => (s ?? "").replace(/\D/g, "");

/** Pega DDD do telefone (suporta +55, 0, parênteses…) */
export function extractDDD(phone?: string | null): string | null {
  let d = digits(phone);
  if (!d) return null;
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  const ddd = d.slice(0, 2);
  return DDD_MAP[ddd] ? ddd : null;
}

export function locationFromPhone(phone?: string | null): { cidade: string; estado: string } | null {
  const ddd = extractDDD(phone);
  return ddd ? DDD_MAP[ddd] : null;
}

/** Formata "11999998888" -> "(11) 99999-8888" */
export function formatPhone(phone?: string | null): string {
  let d = digits(phone);
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone ?? "";
}

/** E.164 sem '+' para link wa.me */
export function whatsappNumber(phone?: string | null): string {
  let d = digits(phone);
  if (!d) return "";
  if (!d.startsWith("55")) d = "55" + d;
  return d;
}

/** "há X" desde uma data */
export function timeAgo(date?: string | Date | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  if (diff < 0) return "agora";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `há ${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months}mes`;
  return `há ${Math.floor(months / 12)}a`;
}
