import {
  REGISTRATION_PROFILE_TYPES,
  RESIDENT_TYPES,
  type RegistrationProfileType,
} from "@/lib/constants";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import type { RegistrationUnitKind, ResidentType } from "@/types";

const PROFILE_NOTE_PATTERN = /\[registration_profile:([a-z_]+)\]/;

export function encodeProfileTypeInReviewNotes(
  profileType: RegistrationProfileType,
): string {
  return `[registration_profile:${profileType}]`;
}

export function parseProfileTypeFromReviewNotes(
  notes: string | null | undefined,
): RegistrationProfileType | null {
  if (!notes) {
    return null;
  }

  const match = notes.match(PROFILE_NOTE_PATTERN);
  if (!match) {
    return null;
  }

  const value = match[1];
  if (
    Object.values(REGISTRATION_PROFILE_TYPES).includes(value as RegistrationProfileType)
  ) {
    return value as RegistrationProfileType;
  }

  return null;
}

export function inferProfileTypeFromResidentType(
  residentType: ResidentType,
): RegistrationProfileType {
  switch (residentType) {
    case RESIDENT_TYPES.RESPONSIBLE:
      return REGISTRATION_PROFILE_TYPES.SYNDIC;
    case RESIDENT_TYPES.DEPENDENT:
      return REGISTRATION_PROFILE_TYPES.VISITOR;
    case RESIDENT_TYPES.TENANT:
      return REGISTRATION_PROFILE_TYPES.SERVICE_PROVIDER;
    default:
      return REGISTRATION_PROFILE_TYPES.RESIDENT;
  }
}

export function resolveRegistrationProfileType(input: {
  profile_type?: RegistrationProfileType | null;
  review_notes?: string | null;
  resident_type: ResidentType;
}): RegistrationProfileType {
  return (
    input.profile_type ??
    parseProfileTypeFromReviewNotes(input.review_notes) ??
    inferProfileTypeFromResidentType(input.resident_type)
  );
}

export function isMissingProfileTypeColumnError(message: string | undefined): boolean {
  return Boolean(message?.includes("profile_type"));
}

export const REGISTRATION_UNIT_NOT_APPLICABLE = "—";

export function requiresRegistrationUnit(profileType: RegistrationProfileType): boolean {
  return (
    profileType === REGISTRATION_PROFILE_TYPES.RESIDENT ||
    profileType === REGISTRATION_PROFILE_TYPES.VISITOR
  );
}

export function formatRegistrationUnitLabel(input: {
  profileType: RegistrationProfileType;
  unitNumber: string | null;
  unitKind: RegistrationUnitKind | null;
  condominiumSlug?: string;
}): string {
  if (!requiresRegistrationUnit(input.profileType)) {
    return "Não se aplica";
  }

  if (!input.unitNumber || input.unitNumber === REGISTRATION_UNIT_NOT_APPLICABLE) {
    return input.unitNumber === REGISTRATION_UNIT_NOT_APPLICABLE
      ? "Não se aplica"
      : "Unidade informada";
  }

  if (input.condominiumSlug && isGeneralCondominium(input.condominiumSlug)) {
    return input.unitNumber;
  }

  if (input.unitKind === "house") {
    return `Casa ${input.unitNumber}`;
  }

  return `Apto ${input.unitNumber}`;
}
