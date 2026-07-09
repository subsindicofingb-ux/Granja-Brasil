import type { CommonAreaRecord } from "@/lib/common-areas/types";
import type { ReservationRecord } from "@/lib/reservations/types";
import { BLOCKING_RESERVATION_STATUSES } from "@/lib/reservations/types";
import {
  DEFAULT_CONDO_TIMEZONE,
  getLocalDateKey,
  localDateTimeToIso,
  parseTimeToMinutes,
} from "@/lib/reservations/timezone";

export function isSlotBasedArea(area: { max_duration_minutes: number | null }): boolean {
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

export function buildAvailableTimeSlots(input: {
  area: CommonAreaRecord;
  dateKey: string;
  reservations: ReservationRecord[];
  durationMinutes: number;
  now?: Date;
}): AvailableTimeSlot[] {
  const { area, dateKey, reservations, durationMinutes } = input;
  const now = input.now ?? new Date();
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
