import type { AllowedDay } from "@/lib/common-areas/types";

export const ALLOWED_DAY_LABELS: Record<AllowedDay, string> = {
  mon: "Segunda",
  tue: "Terça",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sábado",
  sun: "Domingo",
};

export const ALLOWED_DAY_OPTIONS = (Object.entries(ALLOWED_DAY_LABELS) as [AllowedDay, string][]).map(
  ([value, label]) => ({ value, label }),
);

export function formatAllowedDays(days: AllowedDay[]): string {
  if (days.length === 7) return "Todos os dias";
  if (days.length === 0) return "Nenhum dia";
  return days.map((day) => ALLOWED_DAY_LABELS[day]).join(", ");
}

export function formatMinutes(minutes: number | null, fallback = "Sem limite"): string {
  if (minutes == null) return fallback;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}min` : `${hours}h`;
}

export function formatDays(days: number | null, fallback = "Sem limite"): string {
  if (days == null) return fallback;
  return days === 1 ? "1 dia" : `${days} dias`;
}
