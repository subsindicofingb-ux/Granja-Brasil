import { z } from "zod";

export const correspondenceFormSchema = z.object({
  unit_id: z.string().uuid("Selecione a unidade."),
  description: z.string().trim().min(1, "Informe a descrição da correspondência.").max(500),
  carrier: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export function parseCorrespondenceFormData(formData: FormData) {
  return correspondenceFormSchema.safeParse({
    unit_id: formData.get("unit_id"),
    description: formData.get("description"),
    carrier: formData.get("carrier") || undefined,
    notes: formData.get("notes") || undefined,
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

export const waterMeterReadingSchema = z.object({
  reading_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da leitura."),
  reading_value: z.coerce.number().min(0, "A leitura não pode ser negativa."),
});

export function parseWaterMeterReadingFormData(formData: FormData) {
  return waterMeterReadingSchema.safeParse({
    reading_date: formData.get("reading_date"),
    reading_value: formData.get("reading_value"),
  });
}
