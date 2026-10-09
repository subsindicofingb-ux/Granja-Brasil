import type { AllowedDay, ClassSession, CommonAreaRecord } from "@/lib/common-areas/types";
import type { ReservationRecord } from "@/lib/reservations/types";
import { BLOCKING_RESERVATION_STATUSES } from "@/lib/reservations/types";
import {
  DEFAULT_CONDO_TIMEZONE,
  getAllowedDayInTimezone,
  getLocalTimeString,
  localDateTimeToIso,
  parseTimeToMinutes,
} from "@/lib/reservations/timezone";

export const CLASS_SPOTS_DEFAULT = 13;
export const CLASS_MIN_ADVANCE_HOURS_DEFAULT = 12;

export function isClassArea(area: {
  booking_mode?: string | null;
}): boolean {
  return area.booking_mode === "class";
}

export function getMinAdvanceMs(area: Pick<CommonAreaRecord, "min_advance_days" | "min_advance_minutes">): number {
  return (
    area.min_advance_days * 24 * 60 * 60_000 + area.min_advance_minutes * 60_000
  );
}

export function formatAdvanceRule(area: Pick<CommonAreaRecord, "min_advance_days" | "min_advance_minutes">): string {
  if (area.min_advance_minutes > 0 && area.min_advance_days === 0) {
    const hours = area.min_advance_minutes / 60;
    if (Number.isInteger(hours)) {
      return hours === 1 ? "1 hora" : `${hours} horas`;
    }
    return `${area.min_advance_minutes} min`;
  }

  if (area.min_advance_days <= 0 && area.min_advance_minutes <= 0) {
    return "Sem antecedência mínima";
  }

  if (area.min_advance_days === 1) {
    return "1 dia";
  }

  return `${area.min_advance_days} dias`;
}

export function getClassSessions(area: Pick<CommonAreaRecord, "class_sessions">): ClassSession[] {
  return area.class_sessions ?? [];
}

export function getSessionsForDay(
  sessions: ClassSession[],
  day: AllowedDay | null,
): ClassSession[] {
  if (!day) return [];
  return sessions.filter((session) => session.day === day);
}

export function sessionDurationMinutes(session: ClassSession): number {
  return parseTimeToMinutes(session.end) - parseTimeToMinutes(session.start);
}

export function findMatchingClassSession(input: {
  area: Pick<CommonAreaRecord, "class_sessions">;
  startAt: Date;
  endAt: Date;
  timeZone?: string;
}): ClassSession | null {
  const timeZone = input.timeZone ?? DEFAULT_CONDO_TIMEZONE;
  const day = getAllowedDayInTimezone(input.startAt, timeZone);
  const startTime = getLocalTimeString(input.startAt, timeZone);
  const endTime = getLocalTimeString(input.endAt, timeZone);

  return (
    getSessionsForDay(getClassSessions(input.area), day).find(
      (session) => session.start === startTime && session.end === endTime,
    ) ?? null
  );
}

export function countSlotOccupancy(input: {
  reservations: ReservationRecord[];
  startAt: Date;
  excludeReservationId?: string;
}): number {
  const startMs = input.startAt.getTime();

  return input.reservations.filter((reservation) => {
    if (input.excludeReservationId && reservation.id === input.excludeReservationId) {
      return false;
    }
    if (!BLOCKING_RESERVATION_STATUSES.includes(reservation.status)) {
      return false;
    }
    return new Date(reservation.start_at).getTime() === startMs;
  }).length;
}

export function unitAlreadyBookedSlot(input: {
  reservations: ReservationRecord[];
  unitId: string;
  startAt: Date;
  excludeReservationId?: string;
}): boolean {
  const startMs = input.startAt.getTime();

  return input.reservations.some((reservation) => {
    if (input.excludeReservationId && reservation.id === input.excludeReservationId) {
      return false;
    }
    if (!BLOCKING_RESERVATION_STATUSES.includes(reservation.status)) {
      return false;
    }
    if (reservation.unit_id !== input.unitId) {
      return false;
    }
    return new Date(reservation.start_at).getTime() === startMs;
  });
}

export function isClassSlotStillBookable(input: {
  startAt: Date;
  now?: Date;
  minAdvanceMs: number;
}): boolean {
  const now = input.now ?? new Date();
  return input.startAt.getTime() - now.getTime() >= input.minAdvanceMs;
}

export function deriveClassOperatingHours(sessions: ClassSession[]): { start: string; end: string } {
  if (sessions.length === 0) {
    return { start: "08:00", end: "22:00" };
  }

  const starts = sessions.map((session) => session.start).sort();
  const ends = sessions.map((session) => session.end).sort();
  return { start: starts[0] ?? "08:00", end: ends[ends.length - 1] ?? "22:00" };
}

export function deriveClassAllowedDays(sessions: ClassSession[]): AllowedDay[] {
  return [...new Set(sessions.map((session) => session.day))];
}

export function deriveClassMaxDurationMinutes(sessions: ClassSession[]): number | null {
  if (sessions.length === 0) return 60;
  return Math.max(...sessions.map(sessionDurationMinutes));
}

export function classSessionStartIso(dateKey: string, session: ClassSession): string {
  return localDateTimeToIso(dateKey, session.start);
}
