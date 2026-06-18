import type { CommonAreaRecord } from "@/lib/common-areas/types";
import type {
  BookingValidationInput,
  BookingValidationResult,
  ReservationRecord,
} from "@/lib/reservations/types";
import { BLOCKING_RESERVATION_STATUSES } from "@/lib/reservations/types";
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

function expandWithBuffer(start: Date, end: Date, bufferMinutes: number): [Date, Date] {
  return [
    new Date(start.getTime() - bufferMinutes * 60_000),
    new Date(end.getTime() + bufferMinutes * 60_000),
  ];
}

function isBlockingReservation(reservation: ReservationRecord, excludeId?: string): boolean {
  if (excludeId && reservation.id === excludeId) return false;
  return BLOCKING_RESERVATION_STATUSES.includes(reservation.status);
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

  const durationMinutes = Math.round((endAt.getTime() - startAt.getTime()) / 60_000);
  if (area.max_duration_minutes != null && durationMinutes > area.max_duration_minutes) {
    return {
      valid: false,
      error: `Duração máxima permitida: ${area.max_duration_minutes} minutos.`,
    };
  }

  const minutesUntilStart = (startAt.getTime() - now.getTime()) / 60_000;
  if (minutesUntilStart < area.min_advance_minutes) {
    return {
      valid: false,
      error: `Antecedência mínima: ${area.min_advance_minutes} minutos.`,
    };
  }

  if (area.max_advance_days != null) {
    const maxAdvanceMs = area.max_advance_days * 24 * 60 * 60_000;
    if (startAt.getTime() - now.getTime() > maxAdvanceMs) {
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

    const [bufferStart, bufferEnd] = expandWithBuffer(
      existingStart,
      existingEnd,
      area.buffer_minutes,
    );

    if (rangesOverlap(startAt, endAt, bufferStart, bufferEnd)) {
      return {
        valid: false,
        error: `Intervalo mínimo entre reservas: ${area.buffer_minutes} minutos.`,
      };
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
