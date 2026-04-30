/**
 * Returns a neutral, domain-agnostic context line for the Hub hero.
 * Avoids sales jargon — works for any future module (financial, ops, HR, etc.).
 */
export function getHubContextLine(opts: {
  pendingCount?: number;
  meetingsToday?: number;
  date?: Date;
}): string {
  const { pendingCount = 0, meetingsToday = 0, date = new Date() } = opts;
  const h = date.getHours();

  if (pendingCount > 0 && meetingsToday > 0) {
    return `${meetingsToday} ${meetingsToday === 1 ? "compromisso" : "compromissos"} hoje · ${pendingCount} ${pendingCount === 1 ? "pendência" : "pendências"} em aberto.`;
  }
  if (pendingCount > 0) {
    return `${pendingCount} ${pendingCount === 1 ? "item pede" : "itens pedem"} sua atenção hoje.`;
  }
  if (meetingsToday > 0) {
    return `${meetingsToday} ${meetingsToday === 1 ? "compromisso" : "compromissos"} no radar de hoje.`;
  }
  if (h < 12) return "Bom momento pra começar.";
  if (h < 18) return "Tudo no lugar por aqui.";
  return "Hora de fechar bem o dia.";
}
