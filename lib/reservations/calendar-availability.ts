import type { AllowedDay, CommonAreaRecord } from "@/lib/common-areas/types";
import type { ReservationRecord } from "@/lib/reservations/types";
import {
  DEFAULT_CONDO_TIMEZONE,
  getAllowedDayInTimezone,
  getLocalDateKey,
} from "@/lib/reservations/timezone";

export type CalendarDayStatus =
  | "available"
  | "unavailable"
  | "confirmed"
  | "prereserva"
  | "maintenance";

export type ReservationCalendarDay = {
  date: string;
  status: CalendarDayStatus;
  label?: string;
  selectable: boolean;
};

function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date, DEFAULT_CONDO_TIMEZONE);
}

function daysBetweenDateKeys(fromKey: string, toKey: string): number {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60_000));
}

function getDaysInMonth(monthKey: string): string[] {
  const [year, month] = monthKey.split("-").map(Number);
  const totalDays = new Date(year, month, 0).getDate();

  return Array.from({ length: totalDays }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${year}-${String(month).padStart(2, "0")}-${day}`;
  });
}

function dateKeyTouchesRange(
  dateKey: string,
  rangeStartKey: string,
  rangeEndKey: string,
): boolean {
  return dateKey >= rangeStartKey && dateKey <= rangeEndKey;
}

function reservationTouchesDay(reservation: ReservationRecord, dateKey: string): boolean {
  const startKey = getLocalDateKey(new Date(reservation.start_at), DEFAULT_CONDO_TIMEZONE);
  const endKey = getLocalDateKey(new Date(reservation.end_at), DEFAULT_CONDO_TIMEZONE);
  return dateKeyTouchesRange(dateKey, startKey, endKey);
}

function maintenanceTouchesDay(
  area: CommonAreaRecord,
  dateKey: string,
): boolean {
  return area.maintenance_blocks.some((block) => {
    const startKey = getLocalDateKey(new Date(block.start_at), DEFAULT_CONDO_TIMEZONE);
    const endKey = getLocalDateKey(new Date(block.end_at), DEFAULT_CONDO_TIMEZONE);
    return dateKeyTouchesRange(dateKey, startKey, endKey);
  });
}

function isAllowedBookingDay(area: CommonAreaRecord, dateKey: string, allowedDay: AllowedDay | null): boolean {
  if (!allowedDay) return false;
  return area.allowed_days.includes(allowedDay);
}

function isWithinAdvanceWindow(
  area: CommonAreaRecord,
  dateKey: string,
  todayKey: string,
): boolean {
  const daysAhead = daysBetweenDateKeys(todayKey, dateKey);

  if (daysAhead < area.min_advance_days) {
    return false;
  }

  if (area.max_advance_days != null && daysAhead > area.max_advance_days) {
    return false;
  }

  return true;
}

export function buildReservationCalendarDays(input: {
  area: CommonAreaRecord;
  reservations: ReservationRecord[];
  month: string;
  now?: Date;
}): ReservationCalendarDay[] {
  const now = input.now ?? new Date();
  const todayKey = getLocalDateKey(now, DEFAULT_CONDO_TIMEZONE);
  const approvedReservations = input.reservations.filter(
    (reservation) => reservation.status === "approved",
  );
  const prereservationStatuses = new Set<ReservationRecord["status"]>([
    "pending",
    "awaiting_receipt",
  ]);
  const prereservations = input.reservations.filter((reservation) =>
    prereservationStatuses.has(reservation.status),
  );

  return getDaysInMonth(input.month).map((dateKey) => {
    const allowedDay = getAllowedDayInTimezone(parseDateKey(dateKey), DEFAULT_CONDO_TIMEZONE);

    if (dateKey < todayKey) {
      return { date: dateKey, status: "unavailable", selectable: false };
    }

    if (!isAllowedBookingDay(input.area, dateKey, allowedDay)) {
      return { date: dateKey, status: "unavailable", selectable: false };
    }

    if (!isWithinAdvanceWindow(input.area, dateKey, todayKey)) {
      return { date: dateKey, status: "unavailable", selectable: false };
    }

    if (maintenanceTouchesDay(input.area, dateKey)) {
      return {
        date: dateKey,
        status: "maintenance",
        label: "Manutenção",
        selectable: false,
      };
    }

    const hasConfirmedReservation = approvedReservations.some((reservation) =>
      reservationTouchesDay(reservation, dateKey),
    );

    if (hasConfirmedReservation) {
      return {
        date: dateKey,
        status: "confirmed",
        label: "Confirmado",
        selectable: true,
      };
    }

    const hasPrereservation = prereservations.some((reservation) =>
      reservationTouchesDay(reservation, dateKey),
    );

    if (hasPrereservation) {
      return {
        date: dateKey,
        status: "prereserva",
        label: "Pré-reserva",
        selectable: false,
      };
    }

    return {
      date: dateKey,
      status: "available",
      selectable: true,
    };
  });
}

export function getCurrentMonthKey(now = new Date()): string {
  return getLocalDateKey(now, DEFAULT_CONDO_TIMEZONE).slice(0, 7);
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  const monthValue = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${monthValue}`;
}

export { addDaysToDateKey, dateKeyTouchesRange, getLocalDateKey as getDateKeyInCondoTimezone };
