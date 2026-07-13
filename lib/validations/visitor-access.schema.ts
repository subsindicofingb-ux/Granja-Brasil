import { z } from "zod";
import { fromDatetimeLocalValue } from "@/lib/reservations/timezone";

export const visitorAccessFormSchema = z
  .object({
    access_starts_at: z
      .string()
      .min(1, "Informe o início do acesso.")
      .transform((value) => fromDatetimeLocalValue(value))
      .refine((value) => Boolean(value) && !Number.isNaN(new Date(value).getTime()), {
        message: "Início inválido.",
      }),
    access_ends_at: z
      .string()
      .min(1, "Informe o fim do acesso.")
      .transform((value) => fromDatetimeLocalValue(value))
      .refine((value) => Boolean(value) && !Number.isNaN(new Date(value).getTime()), {
        message: "Fim inválido.",
      }),
  })
  .superRefine((data, ctx) => {
    if (new Date(data.access_ends_at) <= new Date(data.access_starts_at)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O fim deve ser posterior ao início.",
        path: ["access_ends_at"],
      });
    }
  });

export function parseVisitorAccessFormData(formData: FormData) {
  return visitorAccessFormSchema.safeParse({
    access_starts_at: formData.get("access_starts_at"),
    access_ends_at: formData.get("access_ends_at"),
  });
}
