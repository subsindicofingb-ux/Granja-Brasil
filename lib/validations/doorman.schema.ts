import { parseWaterMeterReadingValue } from "@/lib/water-meters/format";
import { getPasswordPolicyError } from "@/lib/auth/password-policy";
import { z } from "zod";

export const CORRESPONDENCE_RECIPIENT_OTHER = "__other__";

export const correspondenceFormSchema = z
  .object({
    target_condominium_id: z.string().uuid("Selecione o condomínio.").optional(),
    unit_id: z.string().uuid("Selecione a unidade."),
    recipient_resident_id: z.string().min(1, "Selecione o destinatário."),
    recipient_name: z.string().trim().max(120).optional(),
    description: z.string().trim().min(1, "Informe a descrição da correspondência.").max(500),
    carrier: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.recipient_resident_id === CORRESPONDENCE_RECIPIENT_OTHER && !data.recipient_name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o nome do destinatário.",
        path: ["recipient_name"],
      });
    }
  });

export function parseCorrespondenceFormData(formData: FormData) {
  return correspondenceFormSchema.safeParse({
    target_condominium_id: formData.get("target_condominium_id") || undefined,
    unit_id: formData.get("unit_id"),
    recipient_resident_id: formData.get("recipient_resident_id"),
    recipient_name: formData.get("recipient_name") || undefined,
    description: formData.get("description"),
    carrier: formData.get("carrier") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

export const correspondencePickupSchema = z
  .object({
    notice_id: z.string().uuid("Correspondência inválida."),
    picked_up_resident_id: z.string().min(1, "Informe quem retirou."),
    picked_up_by_name: z.string().trim().max(120).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.picked_up_resident_id === CORRESPONDENCE_RECIPIENT_OTHER && !data.picked_up_by_name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o nome de quem retirou.",
        path: ["picked_up_by_name"],
      });
    }
  });

export function parseCorrespondencePickupFormData(formData: FormData) {
  return correspondencePickupSchema.safeParse({
    notice_id: formData.get("notice_id"),
    picked_up_resident_id: formData.get("picked_up_resident_id"),
    picked_up_by_name: formData.get("picked_up_by_name") || undefined,
  });
}

export const doormanResidentMessageSchema = z.object({
  target_profile_id: z.string().uuid("Selecione o morador."),
  title: z.string().trim().min(1, "Informe o assunto.").max(200),
  body: z.string().trim().min(1, "Informe a mensagem.").max(10000),
});

export function parseDoormanResidentMessageFormData(formData: FormData) {
  return doormanResidentMessageSchema.safeParse({
    target_profile_id: formData.get("target_profile_id"),
    title: formData.get("title"),
    body: formData.get("body"),
  });
}

const waterMeterReadingValueSchema = z
  .string()
  .trim()
  .min(1, "Informe a leitura acumulada.")
  .transform((value, ctx) => {
    const parsed = parseWaterMeterReadingValue(value);
    if (parsed === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use vírgula para decimais (ex.: 1234,567).",
      });
      return z.NEVER;
    }
    return parsed;
  });

export const waterMeterReadingSchema = z.object({
  target_condominium_id: z.string().uuid("Selecione o condomínio.").optional(),
  reading_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da leitura."),
  reading_value: waterMeterReadingValueSchema,
});

export function parseWaterMeterReadingFormData(formData: FormData) {
  return waterMeterReadingSchema.safeParse({
    target_condominium_id: formData.get("target_condominium_id") || undefined,
    reading_date: formData.get("reading_date"),
    reading_value: formData.get("reading_value"),
  });
}

export const doormanRegistrationRequestSchema = z
  .object({
    target_condominium_id: z.string().uuid("Selecione o condomínio.").optional(),
    unit_id: z.string().uuid("Selecione a unidade."),
    full_name: z.string().trim().min(1, "Informe o nome completo.").max(200),
    email: z.string().trim().email("Informe um e-mail válido."),
    phone: z.string().trim().max(40).optional(),
    resident_type: z.enum(["owner", "tenant", "dependent", "responsible"]),
    password: z.string().min(1, "Informe a senha de acesso do morador."),
    password_confirm: z.string().min(1, "Confirme a senha."),
  })
  .superRefine((data, ctx) => {
    const passwordError = getPasswordPolicyError(data.password);
    if (passwordError) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: passwordError,
        path: ["password"],
      });
    }

    if (data.password !== data.password_confirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "As senhas não conferem.",
        path: ["password_confirm"],
      });
    }
  });

export function parseDoormanRegistrationRequestFormData(formData: FormData) {
  return doormanRegistrationRequestSchema.safeParse({
    target_condominium_id: formData.get("target_condominium_id") || undefined,
    unit_id: formData.get("unit_id"),
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    resident_type: formData.get("resident_type"),
    password: formData.get("password"),
    password_confirm: formData.get("password_confirm"),
  });
}

export const waterMeterReadingUpdateSchema = z.object({
  reading_id: z.string().uuid("Leitura inválida."),
  reading_value: waterMeterReadingValueSchema,
});

export function parseWaterMeterReadingUpdateFormData(formData: FormData) {
  return waterMeterReadingUpdateSchema.safeParse({
    reading_id: formData.get("reading_id"),
    reading_value: formData.get("reading_value"),
  });
}
