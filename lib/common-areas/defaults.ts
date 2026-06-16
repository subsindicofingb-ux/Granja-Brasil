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
  max_duration_minutes: 360,
  min_advance_minutes: 60,
  max_advance_days: 90,
  max_reservations_per_unit: 2,
  reservation_period_days: 30,
  buffer_minutes: 30,
  operating_hours: DEFAULT_OPERATING_HOURS,
  allowed_days: DEFAULT_ALLOWED_DAYS,
  maintenance_blocks: [],
};

export function emptyToNull(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
