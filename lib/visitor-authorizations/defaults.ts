import { GUEST_TYPE } from "@/lib/constants";
import type { VisitorAuthorizationFormInput } from "@/lib/visitor-authorizations/types";

export const DEFAULT_VISITOR_AUTHORIZATION_FORM: VisitorAuthorizationFormInput = {
  unit_id: "",
  guest_type: GUEST_TYPE.VISITOR,
  full_name: "",
  document_type: null,
  document_number: null,
  company_name: null,
  vehicle_plate: null,
  access_starts_at: "",
  access_ends_at: "",
  notes: null,
};
