import type { RegistrationRequestStatus, RegistrationUnitKind, ResidentType } from "@/types";

export type RegistrationRequestNotificationEvent = {
  type: "registration_request_created";
  requestId: string;
  condominiumId: string;
  condominiumName: string;
  fullName: string;
  email: string;
  unitLabel: string;
  residentType: ResidentType;
};

export type RegistrationRequestRecord = {
  id: string;
  profile_id: string;
  condominium_id: string;
  resident_type: ResidentType;
  unit_kind: RegistrationUnitKind | null;
  unit_number: string | null;
  requested_unit_id: string | null;
  full_name: string;
  email: string;
  status: RegistrationRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  unit_id: string | null;
  created_at: string;
  updated_at: string;
  condominium?: {
    id: string;
    name: string;
    slug: string;
  };
  profile?: {
    id: string;
    full_name: string;
  };
};
