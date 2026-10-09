import type { AllowedDay, ClassSession, CommonAreaRecord } from "@/lib/common-areas/types";
import type { ReservationRecord, ReservationWithDetails } from "@/lib/reservations/types";
import { BLOCKING_RESERVATION_STATUSES } from "@/lib/reservations/types";
import {
  DEFAULT_CONDO_TIMEZONE,
  getAllowedDayInTimezone,
  getLocalTimeString,
  localDateTimeToIso,
  parseTimeToMinutes,
} from "@/lib/reservations/timezone";

export const CLASS_SPOTS_DEFAULT = 13;
export const CLASS_OPEN_HOURS_DEFAULT = 12;
export const CLASS_MIN_ADVANCE_HOURS_DEFAULT = CLASS_OPEN_HOURS_DEFAULT;

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

export function getClassOpenWindowMs(
  area: Pick<CommonAreaRecord, "min_advance_days" | "min_advance_minutes">,
): number {
  const stored = getMinAdvanceMs(area);
  if (stored > 0) return stored;
  return CLASS_OPEN_HOURS_DEFAULT * 60 * 60_000;
}

export function formatAdvanceHours(ms: number): string {
  const hours = ms / (60 * 60_000);
  if (Number.isInteger(hours)) {
    return hours === 1 ? "1 hora" : `${hours} horas`;
  }
  return `${Math.round(ms / 60_000)} min`;
}

export function formatAdvanceRule(area: Pick<CommonAreaRecord, "min_advance_days" | "min_advance_minutes">): string {
  if (area.min_advance_minutes > 0 && area.min_advance_days === 0) {
    return formatAdvanceHours(area.min_advance_minutes * 60_000);
  }

  if (area.min_advance_days <= 0 && area.min_advance_minutes <= 0) {
    return "Sem antecedência mínima";
  }

  if (area.min_advance_days === 1) {
    return "1 dia";
  }

  return `${area.min_advance_days} dias`;
}

export function formatClassBookingWindow(
  area: Pick<CommonAreaRecord, "min_advance_days" | "min_advance_minutes">,
): string {
  return `Abre ${formatAdvanceHours(getClassOpenWindowMs(area))} antes; confirmação até o início da aula`;
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

export function normalizeAttendeeName(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed === "" ? null : trimmed;
}

export function attendeeAlreadyBookedSlot(input: {
  reservations: ReservationRecord[];
  unitId: string;
  startAt: Date;
  attendeeName: string;
  excludeReservationId?: string;
}): boolean {
  const startMs = input.startAt.getTime();
  const name = input.attendeeName.trim().toLowerCase();

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
    if (new Date(reservation.start_at).getTime() !== startMs) {
      return false;
    }
    return (reservation.attendee_name ?? "").trim().toLowerCase() === name;
  });
}

export function isClassSlotStillBookable(input: {
  startAt: Date;
  now?: Date;
  minAdvanceMs?: number;
}): boolean {
  const now = input.now ?? new Date();
  return input.startAt.getTime() > now.getTime();
}

export function isClassSlotInBookingWindow(input: {
  startAt: Date;
  now?: Date;
  openWindowMs: number;
}): boolean {
  const now = input.now ?? new Date();
  const msUntilStart = input.startAt.getTime() - now.getTime();
  return msUntilStart > 0 && msUntilStart <= input.openWindowMs;
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

export type ClassAttendanceRoll = {
  areaId: string;
  areaName: string;
  capacity: number;
  dateKey: string;
  startTime: string;
  endTime: string;
  startAt: string;
  endAt: string;
  attendees: ReservationWithDetails[];
};

export function buildClassAttendanceRolls(input: {
  areas: CommonAreaRecord[];
  reservations: ReservationWithDetails[];
  dateKey: string;
}): ClassAttendanceRoll[] {
  const rolls: ClassAttendanceRoll[] = [];
  const blocking = input.reservations.filter((reservation) =>
    BLOCKING_RESERVATION_STATUSES.includes(reservation.status),
  );

  for (const area of input.areas.filter(isClassArea)) {
    const day = getAllowedDayInTimezone(
      new Date(`${input.dateKey}T12:00:00`),
      DEFAULT_CONDO_TIMEZONE,
    );
    const sessions = getSessionsForDay(getClassSessions(area), day);

    for (const session of sessions) {
      const startAt = localDateTimeToIso(input.dateKey, session.start);
      const endAt = localDateTimeToIso(input.dateKey, session.end);
      const startMs = new Date(startAt).getTime();
      const attendees = blocking
        .filter(
          (reservation) =>
            reservation.common_area_id === area.id &&
            new Date(reservation.start_at).getTime() === startMs,
        )
        .sort((left, right) =>
          (left.attendee_name ?? "").localeCompare(right.attendee_name ?? "", "pt-BR"),
        );

      rolls.push({
        areaId: area.id,
        areaName: area.name,
        capacity: area.capacity,
        dateKey: input.dateKey,
        startTime: session.start,
        endTime: session.end,
        startAt,
        endAt,
        attendees,
      });
    }
  }

  return rolls.sort((left, right) => {
    const byTime = left.startTime.localeCompare(right.startTime);
    if (byTime !== 0) return byTime;
    return left.areaName.localeCompare(right.areaName, "pt-BR");
  });
}
