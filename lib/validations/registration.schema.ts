import { z } from "zod";
import { DEMO_CONDO_SLUG, REGISTRATION_PROFILE_TYPES, RESIDENT_TYPES, ROLES } from "@/lib/constants";
import { requiresRegistrationUnit } from "@/lib/registrations/profile-type";

const membershipRoleValues = [
  ROLES.RESIDENT,
  ROLES.DOORMAN,
  ROLES.STAFF,
  ROLES.SUB_SYNDIC,
  ROLES.SYNDIC,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
] as const;

const profileTypeValues = [
  REGISTRATION_PROFILE_TYPES.RESIDENT,
  REGISTRATION_PROFILE_TYPES.SYNDIC,
  REGISTRATION_PROFILE_TYPES.STAFF,
  REGISTRATION_PROFILE_TYPES.VISITOR,
  REGISTRATION_PROFILE_TYPES.SERVICE_PROVIDER,
  REGISTRATION_PROFILE_TYPES.OTHER,
] as const;

const residentTypeValues = [
  RESIDENT_TYPES.OWNER,
  RESIDENT_TYPES.TENANT,
  RESIDENT_TYPES.DEPENDENT,
  RESIDENT_TYPES.RESPONSIBLE,
] as const;

export const registrationPreQualificationSchema = z
  .object({
    condominium_id: z.string().uuid("Selecione um condomínio."),
    condominium_slug: z.string().min(1, "Selecione um condomínio."),
    profile_type: z.enum(profileTypeValues, {
      message: "Informe quem você é no condomínio.",
    }),
    unit_id: z.string().uuid().optional().or(z.literal("")),
    unit_number: z.string().trim().optional(),
    phone: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (!requiresRegistrationUnit(data.profile_type)) {
      return;
    }

    const isGeneralCondo = data.condominium_slug === DEMO_CONDO_SLUG;

    if (isGeneralCondo) {
      if (!data.unit_number || data.unit_number.length < 1) {
        ctx.addIssue({
          code: "custom",
          message: "Informe sua unidade.",
          path: ["unit_number"],
        });
      }

      return;
    }

    if (!data.unit_id) {
      ctx.addIssue({
        code: "custom",
        message: "Selecione sua unidade ou casa.",
        path: ["unit_id"],
      });
    }
  });

export const reviewRegistrationRequestSchema = z.object({
  request_id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  review_notes: z.string().trim().optional(),
  unit_id: z.string().uuid().optional(),
  resident_type: z.enum(residentTypeValues).optional(),
  mark_as_unit_responsible: z.coerce.boolean().optional(),
  membership_role: z.enum(membershipRoleValues).optional(),
});
