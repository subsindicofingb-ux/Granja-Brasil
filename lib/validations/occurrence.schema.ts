import { z } from "zod";
import { OCCURRENCE_CATEGORY, OCCURRENCE_STATUS } from "@/lib/constants";

const categoryValues = Object.values(OCCURRENCE_CATEGORY) as [string, ...string[]];
const statusValues = Object.values(OCCURRENCE_STATUS) as [string, ...string[]];

export const occurrenceFormSchema = z.object({
  category: z.enum(categoryValues, { message: "Selecione o tipo da ocorrência." }),
  title: z.string().trim().min(3, "Informe um título com pelo menos 3 caracteres.").max(160),
  description: z
    .string()
    .trim()
    .min(5, "Descreva a ocorrência com pelo menos 5 caracteres.")
    .max(5000),
  location_text: z.string().trim().max(200).optional(),
  destination: z.enum(["building", "granja"], {
    message: "Selecione o destino da ocorrência.",
  }),
  unit_id: z.string().uuid("Unidade inválida.").optional().or(z.literal("")),
  occurred_at: z.string().min(1, "Informe a data/hora da ocorrência."),
});

export function parseOccurrenceFormData(formData: FormData) {
  return occurrenceFormSchema.safeParse({
    category: formData.get("category"),
    title: formData.get("title"),
    description: formData.get("description"),
    location_text: formData.get("location_text") || undefined,
    destination: formData.get("destination") || "building",
    unit_id: formData.get("unit_id") || undefined,
    occurred_at: formData.get("occurred_at"),
  });
}

export const occurrenceStatusSchema = z.object({
  occurrence_id: z.string().uuid("Ocorrência inválida."),
  status: z.enum(statusValues, { message: "Status inválido." }),
  response_text: z.string().trim().max(2000).optional(),
  internal_notes: z.string().trim().max(2000).optional(),
});

export function parseOccurrenceStatusFormData(formData: FormData) {
  return occurrenceStatusSchema.safeParse({
    occurrence_id: formData.get("occurrence_id"),
    status: formData.get("status"),
    response_text: formData.get("response_text") || undefined,
    internal_notes: formData.get("internal_notes") || undefined,
  });
}

export function getOccurrenceAttachmentFromForm(formData: FormData): File | null {
  const file = formData.get("attachment");
  return file instanceof File && file.size > 0 ? file : null;
}
