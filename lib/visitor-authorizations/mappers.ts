import type {
  VisitorAuthorizationFormInput,
  VisitorAuthorizationWithDetails,
} from "@/lib/visitor-authorizations/types";
import { toDatetimeLocalValue } from "@/lib/reservations/timezone";

export function toVisitorAuthorizationFormInput(
  record: VisitorAuthorizationWithDetails,
): VisitorAuthorizationFormInput {
  return {
    unit_id: record.unit_id,
    guest_type: record.guest_type,
    full_name: record.full_name,
    document_type: record.document_type,
    document_number: record.document_number,
    company_name: record.company_name,
    vehicle_plate: record.vehicle_plate,
    access_starts_at: toDatetimeLocalValue(record.access_starts_at),
    access_ends_at: toDatetimeLocalValue(record.access_ends_at),
    notes: record.notes,
  };
}
