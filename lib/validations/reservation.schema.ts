import { z } from "zod";
import { RESERVATION_STATUS } from "@/lib/constants";
import { fromDatetimeLocalValue } from "@/lib/reservations/timezone";

const optionalPartyDescription = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine((value) => value === null || value.length <= 2000, "Relato muito longo.");

const optionalGuestCount = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  });

export const staffReservationFormSchema = z.object({
  common_area_id: z.string().uuid("Selecione um espaço válido."),
  unit_id: z.string().uuid("Selecione uma unidade válida."),
  start_at: z
    .string()
    .min(1, "Informe o início.")
    .transform((value) => fromDatetimeLocalValue(value))
    .refine((value) => Boolean(value) && !Number.isNaN(new Date(value).getTime()), {
      message: "Data/hora de início inválida.",
    }),
  end_at: z
    .string()
    .min(1, "Informe o fim.")
    .transform((value) => fromDatetimeLocalValue(value))
    .refine((value) => Boolean(value) && !Number.isNaN(new Date(value).getTime()), {
      message: "Data/hora de fim inválida.",
    }),
  notes: optionalPartyDescription,
  guest_count: optionalGuestCount,
});

export const residentReservationFormSchema = z.object({
  common_area_id: z.string().uuid("Selecione um espaço válido."),
  unit_id: z.string().uuid("Selecione uma unidade válida."),
  reservation_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da reserva."),
  reservation_start_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe o horário de início.")
    .optional(),
  reservation_duration_minutes: z.coerce.number().int().positive().optional(),
  notes: optionalPartyDescription,
  guest_count: optionalGuestCount,
});

export function parseReservationFormData(formData: FormData) {
  const mode = String(formData.get("form_mode") ?? "staff");

  if (mode === "resident") {
    const parsed = residentReservationFormSchema.safeParse({
      common_area_id: formData.get("common_area_id"),
      unit_id: formData.get("unit_id"),
      reservation_date: formData.get("reservation_date"),
      reservation_start_time: formData.get("reservation_start_time") ?? undefined,
      reservation_duration_minutes: formData.get("reservation_duration_minutes") ?? undefined,
      notes: formData.get("notes") ?? "",
      guest_count: formData.get("guest_count"),
    });

    if (!parsed.success) {
      return parsed;
    }

    return {
      success: true as const,
      data: {
        common_area_id: parsed.data.common_area_id,
        unit_id: parsed.data.unit_id,
        reservation_date: parsed.data.reservation_date,
        reservation_start_time: parsed.data.reservation_start_time,
        reservation_duration_minutes: parsed.data.reservation_duration_minutes,
        notes: parsed.data.notes,
        guest_count: parsed.data.guest_count,
      },
    };
  }

  return staffReservationFormSchema.safeParse({
    common_area_id: formData.get("common_area_id"),
    unit_id: formData.get("unit_id"),
    start_at: formData.get("start_at"),
    end_at: formData.get("end_at"),
    notes: formData.get("notes") ?? "",
    guest_count: formData.get("guest_count"),
  });
}

export const reservationHandoverSchema = z.object({
  reservation_id: z.string().uuid("Reserva inválida."),
  resident_profile_id: z.string().uuid("Selecione o morador que assina."),
  signature_data: z
    .string()
    .min(32, "Colete a assinatura do morador.")
    .refine((value) => value.startsWith("data:image/png;base64,"), "Assinatura inválida.")
    .refine((value) => value.length <= 500_000, "Assinatura muito grande."),
});

export const reservationListFiltersSchema = z.object({
  area: z.string().uuid().optional(),
  unit: z.string().uuid().optional(),
  status: z.enum([
    RESERVATION_STATUS.AWAITING_RECEIPT,
    RESERVATION_STATUS.PENDING,
    RESERVATION_STATUS.APPROVED,
    RESERVATION_STATUS.REJECTED,
    RESERVATION_STATUS.CANCELLED,
    "all",
  ]).optional(),
  view: z.enum(["list", "agenda"]).optional(),
});
