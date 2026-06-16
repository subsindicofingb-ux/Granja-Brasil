import { z } from "zod";
import { RESIDENT_TYPES } from "@/lib/constants";

export const registrationPreQualificationSchema = z.object({
  condominium_id: z.string().uuid("Selecione um condomínio."),
  resident_type: z.enum([RESIDENT_TYPES.OWNER, RESIDENT_TYPES.TENANT], {
    message: "Informe se você é proprietário ou inquilino.",
  }),
  unit_id: z.string().uuid("Selecione sua unidade ou casa."),
});

export const reviewRegistrationRequestSchema = z.object({
  request_id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  review_notes: z.string().trim().optional(),
  unit_id: z.string().uuid().optional(),
});
