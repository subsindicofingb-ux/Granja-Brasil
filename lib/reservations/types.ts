import type { ReservationStatus } from "@/lib/constants";

export type ReservationRecord = {
  id: string;
  common_area_id: string;
  unit_id: string;
  requested_by: string | null;
  start_at: string;
  end_at: string;
  status: ReservationStatus;
  notes: string | null;
  guest_count: number | null;
  payment_receipt_url: string | null;
  payment_receipt_submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReservationWithDetails = ReservationRecord & {
  common_area: {
    id: string;
    name: string;
    requires_approval: boolean;
    condominium_id: string;
  };
  unit: {
    id: string;
    number: string;
    block: string | null;
    tower: {
      id: string;
      name: string;
    };
  };
  requester: {
    id: string;
    full_name: string;
  } | null;
};

export const BLOCKING_RESERVATION_STATUSES: ReservationStatus[] = [
  "awaiting_receipt",
  "pending",
  "approved",
];

export type BookingValidationInput = {
  area: import("@/lib/common-areas/types").CommonAreaRecord;
  unitId: string;
  startAt: Date;
  endAt: Date;
  existingReservations: ReservationRecord[];
  now?: Date;
  excludeReservationId?: string;
};

export type BookingValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export type ReservationNotificationEvent =
  | { type: "reservation_created"; reservationId: string; condominiumId: string }
  | { type: "reservation_approved"; reservationId: string; condominiumId: string }
  | { type: "reservation_rejected"; reservationId: string; condominiumId: string }
  | { type: "reservation_cancelled"; reservationId: string; condominiumId: string };
