import { z } from "zod";

export const condominiumFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome do condomínio.")
    .max(120, "Nome muito longo."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Informe o slug do condomínio.")
    .max(80, "Slug muito longo.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens."),
  is_commercial: z.boolean(),
});
