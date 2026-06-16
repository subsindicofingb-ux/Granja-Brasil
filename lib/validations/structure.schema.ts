import { z } from "zod";

export const towerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome da torre.")
    .max(100, "Nome muito longo."),
  floors: z.coerce
    .number({ invalid_type_error: "Informe um número válido de andares." })
    .int("Andares deve ser um número inteiro.")
    .min(1, "Mínimo de 1 andar.")
    .max(200, "Máximo de 200 andares."),
});

export type TowerFormValues = z.infer<typeof towerFormSchema>;

export const unitFormSchema = z.object({
  tower_id: z.string().uuid("Selecione uma torre válida."),
  number: z
    .string()
    .trim()
    .min(1, "Informe o número da unidade.")
    .max(20, "Número muito longo."),
  block: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null) return null;
      const trimmed = String(value).trim();
      return trimmed === "" ? null : trimmed;
    })
    .refine((value) => value === null || value.length <= 20, "Bloco muito longo."),
});

export type UnitFormValues = z.infer<typeof unitFormSchema>;

const optionalEmail = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    "E-mail inválido.",
  );

const optionalPhone = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine((value) => value === null || value.length <= 30, "Telefone muito longo.");

export const residentFormSchema = z.object({
  unit_id: z.string().uuid("Selecione uma unidade válida."),
  full_name: z
    .string()
    .trim()
    .min(1, "Informe o nome completo.")
    .max(200, "Nome muito longo."),
  email: optionalEmail,
  phone: optionalPhone,
  type: z.enum(["owner", "tenant", "dependent", "responsible"], {
    errorMap: () => ({ message: "Selecione um tipo de morador." }),
  }),
});

export type ResidentFormValues = z.infer<typeof residentFormSchema>;
