import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DEFAULT_CONDO_TIMEZONE, formatInCondoTimezone } from "@/lib/reservations/timezone";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return formatInCondoTimezone(
    date,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
    DEFAULT_CONDO_TIMEZONE,
  );
}

export function formatDateTime(date: string | Date): string {
  return formatInCondoTimezone(
    date,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
    DEFAULT_CONDO_TIMEZONE,
  );
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | undefined | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}
