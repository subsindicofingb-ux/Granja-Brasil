import type { CommonAreaFormInput, CommonAreaRecord } from "@/lib/common-areas/types";

export function toCommonAreaFormInput(area: CommonAreaRecord): CommonAreaFormInput {
  return {
    name: area.name,
    description: area.description,
    capacity: area.capacity,
    is_active: area.is_active,
    requires_approval: area.requires_approval,
    requires_payment: area.requires_payment,
    min_advance_days: area.min_advance_days,
    max_advance_days: area.max_advance_days,
    max_reservations_per_unit: area.max_reservations_per_unit,
    reservation_period_days: area.reservation_period_days,
    buffer_days: area.buffer_days,
    buffer_minutes: area.buffer_minutes,
    max_duration_minutes: area.max_duration_minutes,
    slot_interval_minutes: area.slot_interval_minutes,
    operating_hours: area.operating_hours,
    allowed_days: area.allowed_days,
    maintenance_blocks: area.maintenance_blocks,
  };
}
