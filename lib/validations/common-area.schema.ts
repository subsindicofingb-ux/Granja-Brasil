import { z } from "zod";
import { ALLOWED_DAYS, BOOKING_MODES } from "@/lib/common-areas/types";
import {
  CLASS_OPEN_HOURS_DEFAULT,
  deriveClassAllowedDays,
  deriveClassMaxDurationMinutes,
  deriveClassOperatingHours,
} from "@/lib/reservations/class-booking";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const optionalRules = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine((value) => value === null || value.length <= 2000, "Regras muito longas.");

const optionalNonNegativeInt = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  })
  .refine((value) => value === null || value >= 0, "Informe um valor válido.");

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

const classSessionSchema = z
  .object({
    day: z.enum(ALLOWED_DAYS),
    start: z.string().regex(timeRegex, "Horário inicial inválido (HH:mm)."),
    end: z.string().regex(timeRegex, "Horário final inválido (HH:mm)."),
  })
  .superRefine((session, ctx) => {
    if (session.start >= session.end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O fim da aula deve ser posterior ao início.",
        path: ["end"],
      });
    }
  });

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
    description: optionalRules,
    capacity: z.coerce
      .number({ invalid_type_error: "Capacidade inválida." })
      .int("Capacidade deve ser inteira.")
      .min(1, "Capacidade mínima: 1."),
    is_active: z.boolean(),
    requires_approval: z.boolean(),
    requires_payment: z.boolean(),
    booking_mode: z.enum(BOOKING_MODES),
    class_sessions: z.array(classSessionSchema).default([]),
    min_advance_hours: z.coerce
      .number({ invalid_type_error: "Abertura das reservas inválida." })
      .int()
      .min(0, "Não pode ser negativa."),
    min_advance_days: z.coerce
      .number({ invalid_type_error: "Antecedência mínima inválida." })
      .int()
      .min(0, "Não pode ser negativa."),
    max_advance_days: optionalPositiveInt,
    max_reservations_per_unit: optionalPositiveInt,
    reservation_period_days: z.coerce
      .number({ invalid_type_error: "Período inválido." })
      .int()
      .min(1, "Período mínimo: 1 dia."),
    buffer_days: z.coerce
      .number({ invalid_type_error: "Descanso entre reservas inválido." })
      .int()
      .min(0, "Não pode ser negativo."),
    buffer_minutes: z.coerce
      .number({ invalid_type_error: "Intervalo entre turnos inválido." })
      .int()
      .min(0, "Não pode ser negativo."),
    max_duration_minutes: optionalNonNegativeInt,
    slot_interval_minutes: optionalPositiveInt,
    operating_hours_start: z.string().regex(timeRegex, "Horário inicial inválido (HH:mm)."),
    operating_hours_end: z.string().regex(timeRegex, "Horário final inválido (HH:mm)."),
    allowed_days: z.array(z.enum(ALLOWED_DAYS)),
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

    if (data.booking_mode === "class") {
      if (data.class_sessions.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Cadastre ao menos um horário de aula.",
          path: ["class_sessions"],
        });
      }
    } else if (data.allowed_days.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione ao menos um dia permitido.",
        path: ["allowed_days"],
      });
    }

    if (data.booking_mode !== "class" && data.max_duration_minutes != null && data.max_duration_minutes > 0) {
      const slot = data.slot_interval_minutes ?? 60;
      if (data.max_duration_minutes < slot) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "O tempo máximo por reserva deve ser maior ou igual à duração do turno.",
          path: ["max_duration_minutes"],
        });
      }
    }
  });

export function parseCommonAreaFormData(formData: FormData) {
  let allowedDays: string[] = [];
  let maintenanceBlocks: unknown[] = [];
  let classSessions: unknown[] = [];

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

  try {
    classSessions = JSON.parse(String(formData.get("class_sessions_json") ?? "[]"));
  } catch {
    classSessions = [];
  }

  const bookingMode = String(formData.get("booking_mode") || "exclusive");
  const parsedSessions = classSessionSchema.array().safeParse(classSessions);
  const validSessions = parsedSessions.success ? parsedSessions.data : [];
  const classHours = deriveClassOperatingHours(validSessions);

  return commonAreaFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    capacity: formData.get("capacity"),
    is_active: parseBoolean(formData.get("is_active")),
    requires_approval: parseBoolean(formData.get("requires_approval")),
    requires_payment: parseBoolean(formData.get("requires_payment")),
    booking_mode: bookingMode,
    class_sessions: classSessions,
    min_advance_hours: formData.get("min_advance_hours") || 0,
    min_advance_days: formData.get("min_advance_days") || 0,
    max_advance_days: formData.get("max_advance_days"),
    max_reservations_per_unit: formData.get("max_reservations_per_unit"),
    reservation_period_days: formData.get("reservation_period_days"),
    buffer_days: formData.get("buffer_days"),
    buffer_minutes: formData.get("buffer_minutes"),
    max_duration_minutes: formData.get("max_duration_minutes"),
    slot_interval_minutes: formData.get("slot_interval_minutes"),
    operating_hours_start:
      bookingMode === "class"
        ? classHours.start
        : formData.get("operating_hours_start"),
    operating_hours_end:
      bookingMode === "class" ? classHours.end : formData.get("operating_hours_end"),
    allowed_days:
      bookingMode === "class" && validSessions.length > 0
        ? deriveClassAllowedDays(validSessions)
        : allowedDays,
    maintenance_blocks: maintenanceBlocks,
  });
}

export function toCommonAreaPayload(
  data: z.infer<typeof commonAreaFormSchema>,
) {
  const isClass = data.booking_mode === "class";
  const classSessions = isClass ? data.class_sessions : [];
  const operatingHours = isClass
    ? deriveClassOperatingHours(classSessions)
    : {
        start: data.operating_hours_start,
        end: data.operating_hours_end,
      };
  const allowedDays = isClass ? deriveClassAllowedDays(classSessions) : data.allowed_days;
  const maxDurationMinutes = isClass
    ? deriveClassMaxDurationMinutes(classSessions)
    : data.max_duration_minutes != null && data.max_duration_minutes > 0
      ? data.max_duration_minutes
      : null;

  return {
    name: data.name,
    description: data.description,
    capacity: data.capacity,
    is_active: data.is_active,
    requires_approval: isClass ? false : data.requires_approval,
    requires_payment: isClass ? false : data.requires_payment,
    booking_mode: data.booking_mode,
    class_sessions: classSessions,
    max_duration_minutes: maxDurationMinutes,
    min_advance_days: isClass ? 0 : data.min_advance_days,
    min_advance_minutes: isClass
      ? Math.max(1, data.min_advance_hours || CLASS_OPEN_HOURS_DEFAULT) * 60
      : 0,
    max_advance_days: isClass ? null : data.max_advance_days,
    max_reservations_per_unit: isClass ? null : data.max_reservations_per_unit,
    reservation_period_days: data.reservation_period_days,
    buffer_days: isClass ? 0 : data.buffer_days,
    buffer_minutes: isClass ? 0 : data.buffer_minutes,
    slot_interval_minutes: isClass
      ? 60
      : data.max_duration_minutes != null && data.max_duration_minutes > 0
        ? data.slot_interval_minutes ?? 60
        : null,
    operating_hours: operatingHours,
    allowed_days: allowedDays.length > 0 ? allowedDays : data.allowed_days,
    maintenance_blocks: data.maintenance_blocks,
    rules: {},
  };
}
