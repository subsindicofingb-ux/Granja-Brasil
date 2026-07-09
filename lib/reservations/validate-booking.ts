import type { CommonAreaRecord } from "@/lib/common-areas/types";
import type {
  BookingValidationInput,
  BookingValidationResult,
  ReservationRecord,
} from "@/lib/reservations/types";
import { BLOCKING_RESERVATION_STATUSES } from "@/lib/reservations/types";
import {
  addDaysToDateKey,
  dateKeyTouchesRange,
} from "@/lib/reservations/calendar-availability";
import { getSlotIntervalMinutes, isSlotBasedArea } from "@/lib/reservations/slot-booking";
import { formatMinutes } from "@/lib/common-areas/labels";
import {
  DEFAULT_CONDO_TIMEZONE,
  getAllowedDayInTimezone,
  getLocalDateKey,
  getLocalTimeString,
  parseTimeToMinutes,
} from "@/lib/reservations/timezone";

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && startB < endA;
}

function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

function daysBetweenDateKeys(fromKey: string, toKey: string): number {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60_000));
}

function isBlockingReservation(reservation: ReservationRecord, excludeId?: string): boolean {
  if (excludeId && reservation.id === excludeId) return false;
  return BLOCKING_RESERVATION_STATUSES.includes(reservation.status);
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

export function validateBooking(input: BookingValidationInput): BookingValidationResult {
  const {
    area,
    startAt,
    endAt,
    existingReservations,
    now = new Date(),
    excludeReservationId,
  } = input;
  const timeZone = DEFAULT_CONDO_TIMEZONE;
  const todayKey = getLocalDateKey(now, timeZone);
  const startDateKey = getLocalDateKey(startAt, timeZone);

  if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) {
    return { valid: false, error: "Data/hora de início inválida." };
  }

  if (!(endAt instanceof Date) || Number.isNaN(endAt.getTime())) {
    return { valid: false, error: "Data/hora de fim inválida." };
  }

  if (endAt <= startAt) {
    return { valid: false, error: "O fim deve ser posterior ao início." };
  }

  if (startAt < now) {
    return { valid: false, error: "Não é possível reservar no passado." };
  }

  if (!area.is_active) {
    return { valid: false, error: "Este espaço está inativo e não aceita reservas." };
  }

  const startDay = getAllowedDayInTimezone(startAt, timeZone);
  if (!startDay || !area.allowed_days.includes(startDay)) {
    return { valid: false, error: "Reserva não permitida neste dia da semana." };
  }

  const endDay = getAllowedDayInTimezone(endAt, timeZone);
  if (startDay !== endDay) {
    return { valid: false, error: "A reserva deve iniciar e terminar no mesmo dia." };
  }

  const startTime = getLocalTimeString(startAt, timeZone);
  const endTime = getLocalTimeString(endAt, timeZone);
  const openMinutes = parseTimeToMinutes(area.operating_hours.start);
  const closeMinutes = parseTimeToMinutes(area.operating_hours.end);
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (startMinutes < openMinutes || endMinutes > closeMinutes) {
    return {
      valid: false,
      error: `Horário fora do funcionamento (${area.operating_hours.start}–${area.operating_hours.end}).`,
    };
  }

  const durationMinutes = endMinutes - startMinutes;

  if (area.max_duration_minutes != null && durationMinutes > area.max_duration_minutes) {
    return {
      valid: false,
      error: `Tempo máximo por reserva: ${formatMinutes(area.max_duration_minutes)}.`,
    };
  }

  if (isSlotBasedArea(area)) {
    const slotInterval = getSlotIntervalMinutes(area);
    if (durationMinutes % slotInterval !== 0) {
      return {
        valid: false,
        error: `A duração deve ser múltiplo de ${formatMinutes(slotInterval)}.`,
      };
    }
  }

  const daysUntilStart = daysBetweenDateKeys(todayKey, startDateKey);
  if (daysUntilStart < area.min_advance_days) {
    return {
      valid: false,
      error: `Antecedência mínima: ${area.min_advance_days} dia(s).`,
    };
  }

  if (area.max_advance_days != null) {
    if (daysUntilStart > area.max_advance_days) {
      return {
        valid: false,
        error: `Antecedência máxima: ${area.max_advance_days} dias.`,
      };
    }
  }

  for (const block of area.maintenance_blocks) {
    const blockStart = new Date(block.start_at);
    const blockEnd = new Date(block.end_at);
    if (rangesOverlap(startAt, endAt, blockStart, blockEnd)) {
      return {
        valid: false,
        error: `Período bloqueado: ${block.title}.`,
      };
    }
  }

  const blocking = existingReservations.filter((reservation) =>
    isBlockingReservation(reservation, excludeReservationId),
  );

  for (const reservation of blocking) {
    const existingStart = new Date(reservation.start_at);
    const existingEnd = new Date(reservation.end_at);

    if (rangesOverlap(startAt, endAt, existingStart, existingEnd)) {
      return { valid: false, error: "Conflito de horário com outra reserva." };
    }

    if (
      area.buffer_minutes > 0 &&
      getLocalDateKey(existingStart, timeZone) === startDateKey &&
      hasMinuteGapConflict(startAt, endAt, existingStart, existingEnd, area.buffer_minutes)
    ) {
      return {
        valid: false,
        error: `Intervalo mínimo entre turnos: ${area.buffer_minutes} min.`,
      };
    }

    if (area.buffer_days > 0) {
      const existingStartKey = getLocalDateKey(existingStart, timeZone);
      const existingEndKey = getLocalDateKey(existingEnd, timeZone);
      const bufferStartKey = addDaysToDateKey(existingStartKey, -area.buffer_days);
      const bufferEndKey = addDaysToDateKey(existingEndKey, area.buffer_days);

      if (dateKeyTouchesRange(startDateKey, bufferStartKey, bufferEndKey)) {
        return {
          valid: false,
          error: `Descanso mínimo entre reservas: ${area.buffer_days} dia(s).`,
        };
      }
    }
  }

  if (area.max_reservations_per_unit != null) {
    const windowStart = new Date(
      startAt.getTime() - area.reservation_period_days * 24 * 60 * 60_000,
    );

    const count = blocking.filter((reservation) => {
      if (reservation.unit_id !== input.unitId) return false;
      const reservationStart = new Date(reservation.start_at);
      return reservationStart >= windowStart && reservationStart <= startAt;
    }).length;

    if (count >= area.max_reservations_per_unit) {
      return {
        valid: false,
        error: `Limite de ${area.max_reservations_per_unit} reserva(s) por unidade a cada ${area.reservation_period_days} dias.`,
      };
    }
  }

  return { valid: true };
}

export function resolveInitialReservationStatus(
  area: CommonAreaRecord,
  options?: { requiresPaymentReceipt?: boolean },
): import("@/lib/constants").ReservationStatus {
  if (options?.requiresPaymentReceipt) {
    return "awaiting_receipt";
  }

  return area.requires_approval ? "pending" : "approved";
}

export function canCancelReservation(
  status: ReservationRecord["status"],
): boolean {
  return (
    status === "awaiting_receipt" || status === "pending" || status === "approved"
  );
}

export function canApproveReservation(status: ReservationRecord["status"]): boolean {
  return status === "pending";
}

export function canRejectReservation(status: ReservationRecord["status"]): boolean {
  return status === "pending" || status === "awaiting_receipt";
}

export function groupReservationsByLocalDate<T extends { start_at: string }>(
  reservations: T[],
  timeZone = DEFAULT_CONDO_TIMEZONE,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const reservation of reservations) {
    const key = getLocalDateKey(new Date(reservation.start_at), timeZone);
    const list = grouped.get(key) ?? [];
    list.push(reservation);
    grouped.set(key, list);
  }

  for (const [, list] of grouped) {
    list.sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
  }

  return grouped;
}
