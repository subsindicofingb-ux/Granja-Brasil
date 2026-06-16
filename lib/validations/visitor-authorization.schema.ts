import { z } from "zod";
import { GUEST_TYPE } from "@/lib/constants";
import { fromDatetimeLocalValue } from "@/lib/reservations/timezone";

const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null) return null;
      const trimmed = String(value).trim();
      return trimmed === "" ? null : trimmed;
    })
    .refine((value) => value === null || value.length <= max, `Máximo ${max} caracteres.`);

export const visitorAuthorizationFormSchema = z
  .object({
    unit_id: z.string().uuid("Selecione uma unidade válida."),
    guest_type: z.enum([GUEST_TYPE.VISITOR, GUEST_TYPE.SERVICE_PROVIDER]),
    full_name: z.string().trim().min(1, "Informe o nome.").max(200, "Nome muito longo."),
    document_type: optionalText(30),
    document_number: optionalText(50),
    company_name: optionalText(200),
    vehicle_plate: optionalText(20),
    access_starts_at: z
      .string()
      .min(1, "Informe o início do acesso.")
      .transform((value) => fromDatetimeLocalValue(value))
      .refine((value) => Boolean(value) && !Number.isNaN(new Date(value).getTime()), {
        message: "Início inválido.",
      }),
    access_ends_at: z
      .string()
      .min(1, "Informe o fim do acesso.")
      .transform((value) => fromDatetimeLocalValue(value))
      .refine((value) => Boolean(value) && !Number.isNaN(new Date(value).getTime()), {
        message: "Fim inválido.",
      }),
    notes: optionalText(2000),
  })
  .superRefine((data, ctx) => {
    if (new Date(data.access_ends_at) <= new Date(data.access_starts_at)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O fim deve ser posterior ao início.",
        path: ["access_ends_at"],
      });
    }

    if (data.guest_type === GUEST_TYPE.VISITOR && data.company_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Empresa só se aplica a prestadores.",
        path: ["company_name"],
      });
    }
  });

export function parseVisitorAuthorizationFormData(formData: FormData) {
  return visitorAuthorizationFormSchema.safeParse({
    unit_id: formData.get("unit_id"),
    guest_type: formData.get("guest_type"),
    full_name: formData.get("full_name"),
    document_type: formData.get("document_type") ?? "",
    document_number: formData.get("document_number") ?? "",
    company_name: formData.get("company_name") ?? "",
    vehicle_plate: formData.get("vehicle_plate") ?? "",
    access_starts_at: formData.get("access_starts_at"),
    access_ends_at: formData.get("access_ends_at"),
    notes: formData.get("notes") ?? "",
  });
}

export const doormanNotesSchema = z.object({
  doorman_notes: optionalText(2000),
});

export function parseDoormanNotesFormData(formData: FormData) {
  return doormanNotesSchema.safeParse({
    doorman_notes: formData.get("doorman_notes") ?? "",
  });
}

export function toVisitorAuthorizationPayload(
  data: z.infer<typeof visitorAuthorizationFormSchema>,
) {
  return {
    unit_id: data.unit_id,
    guest_type: data.guest_type,
    full_name: data.full_name,
    document_type: data.document_type,
    document_number: data.document_number,
    company_name: data.company_name,
    vehicle_plate: data.vehicle_plate,
    access_starts_at: data.access_starts_at,
    access_ends_at: data.access_ends_at,
    notes: data.notes,
  };
}
