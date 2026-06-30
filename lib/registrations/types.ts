import type { RegistrationRequestStatus, RegistrationUnitKind, ResidentType } from "@/types";
import type { RegistrationProfileType } from "@/lib/constants";

export type RegistrationRequestNotificationEvent = {
  type: "registration_request_created";
  requestId: string;
  condominiumId: string;
  condominiumName: string;
  fullName: string;
  email: string;
  unitLabel: string;
  profileType: RegistrationProfileType;
  residentType: ResidentType;
  source?: "doorman" | "signup";
  fulfilledImmediately?: boolean;
  accessDeviceNames?: string[];
};

export type RegistrationRequestRecord = {
  id: string;
  profile_id: string;
  condominium_id: string;
  resident_type: ResidentType;
  profile_type: RegistrationProfileType;
  unit_kind: RegistrationUnitKind | null;
  unit_number: string | null;
  requested_unit_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
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
