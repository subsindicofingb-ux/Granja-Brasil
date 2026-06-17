import { z } from "zod";
import { isHouseTower } from "@/lib/residents/labels";

export const towerFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Informe o nome.")
      .max(100, "Nome muito longo."),
    floors: z
      .union([z.coerce.number(), z.literal(""), z.null(), z.undefined()])
      .transform((value) => {
        if (value === "" || value == null || value === undefined) {
          return undefined;
        }
        return Number(value);
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const isHouse = isHouseTower(data.name);

    if (isHouse) {
      return;
    }

    if (data.floors == null || Number.isNaN(data.floors)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe um número válido de andares.",
        path: ["floors"],
      });
      return;
    }

    if (!Number.isInteger(data.floors) || data.floors < 1 || data.floors > 200) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Andares deve ser um número inteiro entre 1 e 200.",
        path: ["floors"],
      });
    }
  })
  .transform((data) => ({
    name: data.name,
    floors: isHouseTower(data.name) ? 1 : (data.floors ?? 1),
  }));

export type TowerFormValues = z.infer<typeof towerFormSchema>;

const unitNumberField = z
  .string()
  .trim()
  .min(1, "Informe o número da unidade.")
  .max(20, "Número muito longo.");

const unitBlockField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine((value) => value === null || value.length <= 20, "Bloco muito longo.");

export const unitFormSchema = z.object({
  tower_id: z.string().uuid("Selecione uma torre válida."),
  number: unitNumberField,
  block: unitBlockField,
});

export const unitFormWithoutTowerSchema = z.object({
  number: unitNumberField,
  block: unitBlockField,
});

export const unitFormWithCondominiumSchema = z.object({
  condominium_id: z.string().uuid("Selecione um condomínio válido."),
  number: unitNumberField,
  block: unitBlockField,
});

export type UnitFormValues = z.infer<typeof unitFormSchema>;
export type UnitFormWithoutTowerValues = z.infer<typeof unitFormWithoutTowerSchema>;
export type UnitFormWithCondominiumValues = z.infer<typeof unitFormWithCondominiumSchema>;

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
