import type { AllowedDay, CommonAreaFormInput, OperatingHours } from "@/lib/common-areas/types";

export const DEFAULT_OPERATING_HOURS: OperatingHours = {
  start: "08:00",
  end: "22:00",
};

export const DEFAULT_ALLOWED_DAYS: AllowedDay[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export const DEFAULT_COMMON_AREA_FORM: CommonAreaFormInput = {
  name: "",
  description: null,
  capacity: 10,
  is_active: true,
  requires_approval: false,
  requires_payment: false,
  max_advance_days: 90,
  max_reservations_per_unit: 2,
  reservation_period_days: 30,
  min_advance_days: 1,
  buffer_days: 0,
  buffer_minutes: 0,
  max_duration_minutes: null,
  slot_interval_minutes: 60,
  operating_hours: DEFAULT_OPERATING_HOURS,
  allowed_days: DEFAULT_ALLOWED_DAYS,
  maintenance_blocks: [],
};

export function emptyToNull(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function minutesToDays(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes >= 1440) return Math.ceil(minutes / 1440);
  return 1;
}

export function resolveBufferDays(
  bufferDays: number | null | undefined,
  legacyBufferMinutes: number | null | undefined,
): number {
  if (bufferDays != null) return bufferDays;
  return minutesToDays(legacyBufferMinutes ?? 0);
}

export function resolveMinAdvanceDays(
  minAdvanceDays: number | null | undefined,
  legacyMinAdvanceMinutes: number | null | undefined,
): number {
  if (minAdvanceDays != null) return minAdvanceDays;
  return minutesToDays(legacyMinAdvanceMinutes ?? 0);
}
