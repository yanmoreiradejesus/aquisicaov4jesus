/**
 * Returns a Brazilian Portuguese greeting based on the hour of the given date.
 */
export function getGreeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Formats date as "QUI 30 ABR" in pt-BR (uppercase, no year).
 */
export function formatHubDate(date: Date = new Date()): string {
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "short" });
  const day = date.toLocaleDateString("pt-BR", { day: "2-digit" });
  const month = date.toLocaleDateString("pt-BR", { month: "short" });
  return `${weekday.replace(".", "")} ${day} ${month.replace(".", "")}`.toUpperCase();
}

/**
 * Formats time as "14:32".
 */
export function formatHubTime(date: Date = new Date()): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
