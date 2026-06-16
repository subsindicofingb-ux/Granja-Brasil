import { z } from "zod";

const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null) return null;
      const trimmed = String(value).trim();
      return trimmed === "" ? null : trimmed;
    })
    .refine((value) => value === null || value.length <= max, `Máximo de ${max} caracteres.`);

export const vehicleFormSchema = z.object({
  unit_id: z.string().uuid("Selecione uma unidade válida."),
  resident_id: optionalText(36).refine(
    (value) => value === null || z.string().uuid().safeParse(value).success,
    "Morador inválido.",
  ),
  brand: z
    .string()
    .trim()
    .min(1, "Informe a marca.")
    .max(80, "Marca muito longa."),
  model: z
    .string()
    .trim()
    .min(1, "Informe o modelo.")
    .max(80, "Modelo muito longo."),
  color: optionalText(40),
  license_plate: z
    .string()
    .trim()
    .min(1, "Informe a placa.")
    .max(15, "Placa muito longa."),
  tag_number: optionalText(50),
});

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;
