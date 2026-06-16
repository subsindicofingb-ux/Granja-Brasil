import type { GuestType, VisitorAuthorizationStatus } from "@/lib/constants";

export type VisitorAuthorizationRecord = {
  id: string;
  condominium_id: string;
  unit_id: string;
  guest_type: GuestType;
  full_name: string;
  document_type: string | null;
  document_number: string | null;
  company_name: string | null;
  vehicle_plate: string | null;
  access_starts_at: string;
  access_ends_at: string;
  status: VisitorAuthorizationStatus;
  notes: string | null;
  doorman_notes: string | null;
  requested_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VisitorAuthorizationDisplayStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "scheduled"
  | "active"
  | "expired";

export type VisitorAuthorizationWithDetails = VisitorAuthorizationRecord & {
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
  reviewer: {
    id: string;
    full_name: string;
  } | null;
};

export type VisitorAuthorizationFormInput = {
  unit_id: string;
  guest_type: GuestType;
  full_name: string;
  document_type: string | null;
  document_number: string | null;
  company_name: string | null;
  vehicle_plate: string | null;
  access_starts_at: string;
  access_ends_at: string;
  notes: string | null;
};
