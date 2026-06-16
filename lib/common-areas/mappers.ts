import type { CommonAreaFormInput, CommonAreaRecord } from "@/lib/common-areas/types";

export function toCommonAreaFormInput(area: CommonAreaRecord): CommonAreaFormInput {
  return {
    name: area.name,
    description: area.description,
    capacity: area.capacity,
    is_active: area.is_active,
    requires_approval: area.requires_approval,
    max_duration_minutes: area.max_duration_minutes,
    min_advance_minutes: area.min_advance_minutes,
    max_advance_days: area.max_advance_days,
    max_reservations_per_unit: area.max_reservations_per_unit,
    reservation_period_days: area.reservation_period_days,
    buffer_minutes: area.buffer_minutes,
    operating_hours: area.operating_hours,
    allowed_days: area.allowed_days,
    maintenance_blocks: area.maintenance_blocks,
  };
}
