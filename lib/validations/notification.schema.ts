import { z } from "zod";

export const unitNotificationFormSchema = z.object({
  title: z.string().trim().min(1, "Informe o assunto.").max(200, "Assunto muito longo."),
  body: z.string().trim().min(1, "Informe a mensagem.").max(10000, "Mensagem muito longa."),
  target_condominium_id: z.string().uuid().optional(),
  target_unit_id: z.string().uuid("Selecione a unidade."),
});

export function parseUnitNotificationFormData(formData: FormData) {
  return unitNotificationFormSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    target_condominium_id: formData.get("target_condominium_id") || undefined,
    target_unit_id: formData.get("target_unit_id"),
  });
}

export function getNotificationAttachmentFromForm(formData: FormData): File | null {
  const value = formData.get("attachment");
  return value instanceof File && value.size > 0 ? value : null;
}
