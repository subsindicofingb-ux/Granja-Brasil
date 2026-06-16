import { z } from "zod";
import { ALLOWED_DAYS } from "@/lib/common-areas/types";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const optionalDescription = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine((value) => value === null || value.length <= 2000, "Descrição muito longa.");

const optionalPositiveInt = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  })
  .refine((value) => value === null || value > 0, "Informe um valor maior que zero.");

function parseBoolean(value: FormDataEntryValue | null): boolean {
  return value === "true" || value === "on" || value === "1";
}

const maintenanceBlockSchema = z.object({
  title: z.string().trim().min(1, "Informe o título do bloqueio."),
  start_at: z.string().min(1, "Informe o início do bloqueio."),
  end_at: z.string().min(1, "Informe o fim do bloqueio."),
  reason: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null) return null;
      const trimmed = String(value).trim();
      return trimmed === "" ? null : trimmed;
    }),
});

export const commonAreaFormSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome do espaço.").max(100, "Nome muito longo."),
    description: optionalDescription,
    capacity: z.coerce
      .number({ invalid_type_error: "Capacidade inválida." })
      .int("Capacidade deve ser inteira.")
      .min(1, "Capacidade mínima: 1."),
    is_active: z.boolean(),
    requires_approval: z.boolean(),
    max_duration_minutes: optionalPositiveInt,
    min_advance_minutes: z.coerce
      .number({ invalid_type_error: "Antecedência mínima inválida." })
      .int()
      .min(0, "Não pode ser negativa."),
    max_advance_days: optionalPositiveInt,
    max_reservations_per_unit: optionalPositiveInt,
    reservation_period_days: z.coerce
      .number({ invalid_type_error: "Período inválido." })
      .int()
      .min(1, "Período mínimo: 1 dia."),
    buffer_minutes: z.coerce
      .number({ invalid_type_error: "Buffer inválido." })
      .int()
      .min(0, "Buffer não pode ser negativo."),
    operating_hours_start: z.string().regex(timeRegex, "Horário inicial inválido (HH:mm)."),
    operating_hours_end: z.string().regex(timeRegex, "Horário final inválido (HH:mm)."),
    allowed_days: z
      .array(z.enum(ALLOWED_DAYS))
      .min(1, "Selecione ao menos um dia permitido."),
    maintenance_blocks: z.array(maintenanceBlockSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.operating_hours_start >= data.operating_hours_end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Horário final deve ser posterior ao inicial.",
        path: ["operating_hours_end"],
      });
    }

    for (const [index, block] of data.maintenance_blocks.entries()) {
      if (new Date(block.end_at) <= new Date(block.start_at)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Fim do bloqueio deve ser posterior ao início.",
          path: ["maintenance_blocks", index, "end_at"],
        });
      }
    }
  });

export function parseCommonAreaFormData(formData: FormData) {
  let allowedDays: string[] = [];
  let maintenanceBlocks: unknown[] = [];

  try {
    allowedDays = JSON.parse(String(formData.get("allowed_days_json") ?? "[]"));
  } catch {
    allowedDays = [];
  }

  try {
    maintenanceBlocks = JSON.parse(String(formData.get("maintenance_blocks_json") ?? "[]"));
  } catch {
    maintenanceBlocks = [];
  }

  return commonAreaFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    capacity: formData.get("capacity"),
    is_active: parseBoolean(formData.get("is_active")),
    requires_approval: parseBoolean(formData.get("requires_approval")),
    max_duration_minutes: formData.get("max_duration_minutes"),
    min_advance_minutes: formData.get("min_advance_minutes"),
    max_advance_days: formData.get("max_advance_days"),
    max_reservations_per_unit: formData.get("max_reservations_per_unit"),
    reservation_period_days: formData.get("reservation_period_days"),
    buffer_minutes: formData.get("buffer_minutes"),
    operating_hours_start: formData.get("operating_hours_start"),
    operating_hours_end: formData.get("operating_hours_end"),
    allowed_days: allowedDays,
    maintenance_blocks: maintenanceBlocks,
  });
}

export function toCommonAreaPayload(
  data: z.infer<typeof commonAreaFormSchema>,
) {
  return {
    name: data.name,
    description: data.description,
    capacity: data.capacity,
    is_active: data.is_active,
    requires_approval: data.requires_approval,
    max_duration_minutes: data.max_duration_minutes,
    min_advance_minutes: data.min_advance_minutes,
    max_advance_days: data.max_advance_days,
    max_reservations_per_unit: data.max_reservations_per_unit,
    reservation_period_days: data.reservation_period_days,
    buffer_minutes: data.buffer_minutes,
    operating_hours: {
      start: data.operating_hours_start,
      end: data.operating_hours_end,
    },
    allowed_days: data.allowed_days,
    maintenance_blocks: data.maintenance_blocks,
    rules: {},
  };
}
