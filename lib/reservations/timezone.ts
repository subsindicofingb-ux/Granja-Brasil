/** Fuso padrão para regras de horário/dia até haver config por condomínio. */
export const DEFAULT_CONDO_TIMEZONE = "America/Sao_Paulo";

export function getWeekdayInTimezone(date: Date, timeZone = DEFAULT_CONDO_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
}

const WEEKDAY_MAP: Record<string, import("@/lib/common-areas/types").AllowedDay> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

export function getAllowedDayInTimezone(
  date: Date,
  timeZone = DEFAULT_CONDO_TIMEZONE,
): import("@/lib/common-areas/types").AllowedDay | null {
  const weekday = getWeekdayInTimezone(date, timeZone);
  return WEEKDAY_MAP[weekday] ?? null;
}

export function getLocalDateKey(date: Date, timeZone = DEFAULT_CONDO_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getLocalTimeString(date: Date, timeZone = DEFAULT_CONDO_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function localDateTimeToIso(dateKey: string, time: string, timeZone = DEFAULT_CONDO_TIMEZONE): string {
  const provisional = new Date(`${dateKey}T${time}:00`);
  const utcDate = new Date(provisional.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzDate = new Date(provisional.toLocaleString("en-US", { timeZone }));
  const offset = utcDate.getTime() - tzDate.getTime();
  return new Date(provisional.getTime() + offset).toISOString();
}

export function fromDatetimeLocalValue(
  value: string,
  timeZone = DEFAULT_CONDO_TIMEZONE,
): string {
  if (!value) return "";

  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) {
    return new Date(value).toISOString();
  }

  return localDateTimeToIso(datePart, timePart.slice(0, 5), timeZone);
}

export function toDatetimeLocalValue(iso: string, timeZone = DEFAULT_CONDO_TIMEZONE): string {
  if (!iso) return "";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 16);

  return `${getLocalDateKey(date, timeZone)}T${getLocalTimeString(date, timeZone)}`;
}

export function formatInCondoTimezone(
  date: string | Date,
  options: Intl.DateTimeFormatOptions,
  timeZone = DEFAULT_CONDO_TIMEZONE,
): string {
  return new Intl.DateTimeFormat("pt-BR", {
    ...options,
    timeZone,
  }).format(typeof date === "string" ? new Date(date) : date);
}
