import { z } from "zod";
import { RESERVATION_STATUS } from "@/lib/constants";
import { fromDatetimeLocalValue } from "@/lib/reservations/timezone";

const optionalNotes = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine((value) => value === null || value.length <= 2000, "Observação muito longa.");

export const reservationFormSchema = z.object({
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
  notes: optionalNotes,
});

export function parseReservationFormData(formData: FormData) {
  return reservationFormSchema.safeParse({
    common_area_id: formData.get("common_area_id"),
    unit_id: formData.get("unit_id"),
    start_at: formData.get("start_at"),
    end_at: formData.get("end_at"),
    notes: formData.get("notes") ?? "",
  });
}

export const reservationListFiltersSchema = z.object({
  area: z.string().uuid().optional(),
  unit: z.string().uuid().optional(),
  status: z.enum([
    RESERVATION_STATUS.PENDING,
    RESERVATION_STATUS.APPROVED,
    RESERVATION_STATUS.REJECTED,
    RESERVATION_STATUS.CANCELLED,
    "all",
  ]).optional(),
  view: z.enum(["list", "agenda"]).optional(),
});
