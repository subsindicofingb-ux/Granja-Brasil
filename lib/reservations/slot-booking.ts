import type { CommonAreaRecord } from "@/lib/common-areas/types";
import type { ReservationRecord } from "@/lib/reservations/types";
import { BLOCKING_RESERVATION_STATUSES } from "@/lib/reservations/types";
import {
  countSlotOccupancy,
  getClassOpenWindowMs,
  getClassSessions,
  getSessionsForDay,
  isClassArea,
  isClassSlotInBookingWindow,
  sessionDurationMinutes,
} from "@/lib/reservations/class-booking";
import {
  DEFAULT_CONDO_TIMEZONE,
  getAllowedDayInTimezone,
  getLocalDateKey,
  localDateTimeToIso,
  parseTimeToMinutes,
} from "@/lib/reservations/timezone";

export function isSlotBasedArea(area: {
  max_duration_minutes: number | null;
  booking_mode?: string | null;
}): boolean {
  if (isClassArea(area)) return true;
  return area.max_duration_minutes != null && area.max_duration_minutes > 0;
}

export function getSlotIntervalMinutes(area: CommonAreaRecord): number {
  if (typeof area.slot_interval_minutes === "number" && area.slot_interval_minutes > 0) {
    return area.slot_interval_minutes;
  }

  return 60;
}

export function getDurationOptions(area: CommonAreaRecord): number[] {
  const slot = getSlotIntervalMinutes(area);
  const max = area.max_duration_minutes ?? slot;
  const options: number[] = [];

  for (let duration = slot; duration <= max; duration += slot) {
    options.push(duration);
  }

  return options.length > 0 ? options : [slot];
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && startB < endA;
}

function hasMinuteGapConflict(
  startAt: Date,
  endAt: Date,
  existingStart: Date,
  existingEnd: Date,
  bufferMinutes: number,
): boolean {
  if (bufferMinutes <= 0) {
    return false;
  }

  if (startAt >= existingEnd) {
    const gapMs = startAt.getTime() - existingEnd.getTime();
    return gapMs < bufferMinutes * 60_000;
  }

  if (endAt <= existingStart) {
    const gapMs = existingStart.getTime() - endAt.getTime();
    return gapMs < bufferMinutes * 60_000;
  }

  return true;
}

export type AvailableTimeSlot = {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  label: string;
  spotsRemaining?: number;
  spotsTotal?: number;
};

function formatSlotLabel(startTime: string, durationMinutes: number): string {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = startMinutes + durationMinutes;
  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;
  const endTime = `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`;

  if (durationMinutes < 60) {
    return `${startTime} – ${endTime} (${durationMinutes} min)`;
  }

  const hours = durationMinutes / 60;
  const hoursLabel = Number.isInteger(hours) ? `${hours}h` : `${durationMinutes} min`;
  return `${startTime} – ${endTime} (${hoursLabel})`;
}

function buildClassTimeSlots(input: {
  area: CommonAreaRecord;
  dateKey: string;
  reservations: ReservationRecord[];
  durationMinutes: number;
  now: Date;
  excludeReservationId?: string;
}): AvailableTimeSlot[] {
  const { area, dateKey, reservations, durationMinutes, now } = input;
  const timeZone = DEFAULT_CONDO_TIMEZONE;
  const day = getAllowedDayInTimezone(new Date(`${dateKey}T12:00:00`), timeZone);
  const openWindowMs = getClassOpenWindowMs(area);
  const slots: AvailableTimeSlot[] = [];

  for (const session of getSessionsForDay(getClassSessions(area), day)) {
    const duration = sessionDurationMinutes(session);
    if (duration !== durationMinutes) {
      continue;
    }

    const startAt = new Date(localDateTimeToIso(dateKey, session.start, timeZone));

    if (
      !isClassSlotInBookingWindow({
        startAt,
        now,
        openWindowMs,
      })
    ) {
      continue;
    }

    const occupied = countSlotOccupancy({
      reservations,
      startAt,
      excludeReservationId: input.excludeReservationId,
    });
    const remaining = Math.max(0, area.capacity - occupied);

    if (remaining <= 0) {
      continue;
    }

    slots.push({
      startTime: session.start,
      endTime: session.end,
      durationMinutes: duration,
      label: `${session.start} – ${session.end} (${remaining}/${area.capacity} vagas)`,
      spotsRemaining: remaining,
      spotsTotal: area.capacity,
    });
  }

  return slots;
}

export function getClassDurationOptions(area: CommonAreaRecord, dateKey: string): number[] {
  const day = getAllowedDayInTimezone(new Date(`${dateKey}T12:00:00`), DEFAULT_CONDO_TIMEZONE);
  const durations = [
    ...new Set(getSessionsForDay(getClassSessions(area), day).map(sessionDurationMinutes)),
  ].filter((duration) => duration > 0);

  return durations.sort((left, right) => left - right);
}

export function buildAvailableTimeSlots(input: {
  area: CommonAreaRecord;
  dateKey: string;
  reservations: ReservationRecord[];
  durationMinutes: number;
  now?: Date;
  excludeReservationId?: string;
}): AvailableTimeSlot[] {
  const { area, dateKey, reservations, durationMinutes } = input;
  const now = input.now ?? new Date();

  if (isClassArea(area)) {
    return buildClassTimeSlots({
      area,
      dateKey,
      reservations,
      durationMinutes,
      now,
      excludeReservationId: input.excludeReservationId,
    });
  }
  const timeZone = DEFAULT_CONDO_TIMEZONE;
  const slot = getSlotIntervalMinutes(area);
  const openMinutes = parseTimeToMinutes(area.operating_hours.start);
  const closeMinutes = parseTimeToMinutes(area.operating_hours.end);
  const blocking = reservations.filter((reservation) =>
    BLOCKING_RESERVATION_STATUSES.includes(reservation.status),
  );
  const slots: AvailableTimeSlot[] = [];

  for (
    let startMinutes = openMinutes;
    startMinutes + durationMinutes <= closeMinutes;
    startMinutes += slot
  ) {
    const hours = Math.floor(startMinutes / 60);
    const mins = startMinutes % 60;
    const startTime = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    const endMinutes = startMinutes + durationMinutes;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTime = `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`;

    const startAt = new Date(localDateTimeToIso(dateKey, startTime, timeZone));
    const endAt = new Date(localDateTimeToIso(dateKey, endTime, timeZone));

    if (startAt < now) {
      continue;
    }

    let blocked = false;

    for (const block of area.maintenance_blocks) {
      const blockStart = new Date(block.start_at);
      const blockEnd = new Date(block.end_at);
      if (rangesOverlap(startAt, endAt, blockStart, blockEnd)) {
        blocked = true;
        break;
      }
    }

    if (blocked) {
      continue;
    }

    for (const reservation of blocking) {
      const existingStart = new Date(reservation.start_at);
      const existingEnd = new Date(reservation.end_at);

      if (getLocalDateKey(existingStart, timeZone) !== dateKey) {
        continue;
      }

      if (rangesOverlap(startAt, endAt, existingStart, existingEnd)) {
        blocked = true;
        break;
      }

      if (
        hasMinuteGapConflict(
          startAt,
          endAt,
          existingStart,
          existingEnd,
          area.buffer_minutes,
        )
      ) {
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      slots.push({
        startTime,
        endTime,
        durationMinutes,
        label: formatSlotLabel(startTime, durationMinutes),
      });
    }
  }

  return slots;
}
