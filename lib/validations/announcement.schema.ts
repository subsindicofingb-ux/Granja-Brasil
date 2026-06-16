import { z } from "zod";
import {
  ANNOUNCEMENT_PRIORITY,
  ANNOUNCEMENT_PUBLICATION_STATUS,
} from "@/lib/constants";
import { fromDatetimeLocalValue } from "@/lib/reservations/timezone";

const optionalTowerId = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null || value === "") return null;
    return String(value);
  })
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
    message: "Torre inválida.",
  });

const optionalExpiresAt = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null || value === "") return null;
    const iso = fromDatetimeLocalValue(String(value));
    return iso || null;
  })
  .refine((value) => value === null || !Number.isNaN(new Date(value).getTime()), {
    message: "Data de expiração inválida.",
  });

export const announcementFormSchema = z
  .object({
    title: z.string().trim().min(1, "Informe o título.").max(200, "Título muito longo."),
    body: z.string().trim().min(1, "Informe o conteúdo.").max(10000, "Conteúdo muito longo."),
    priority: z.enum([
      ANNOUNCEMENT_PRIORITY.NORMAL,
      ANNOUNCEMENT_PRIORITY.IMPORTANT,
      ANNOUNCEMENT_PRIORITY.URGENT,
    ]),
    tower_id: optionalTowerId,
    publication_status: z.enum([
      ANNOUNCEMENT_PUBLICATION_STATUS.DRAFT,
      ANNOUNCEMENT_PUBLICATION_STATUS.PUBLISHED,
    ]),
    published_at: z
      .string()
      .min(1, "Informe a data de publicação.")
      .transform((value) => fromDatetimeLocalValue(value))
      .refine((value) => Boolean(value) && !Number.isNaN(new Date(value).getTime()), {
        message: "Data de publicação inválida.",
      }),
    expires_at: optionalExpiresAt,
  })
  .superRefine((data, ctx) => {
    if (data.expires_at && new Date(data.expires_at) <= new Date(data.published_at)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expiração deve ser posterior à publicação.",
        path: ["expires_at"],
      });
    }
  });

export function parseAnnouncementFormData(formData: FormData) {
  return announcementFormSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    priority: formData.get("priority"),
    tower_id: formData.get("tower_id"),
    publication_status: formData.get("publication_status"),
    published_at: formData.get("published_at"),
    expires_at: formData.get("expires_at") ?? "",
  });
}

export function toAnnouncementPayload(data: z.infer<typeof announcementFormSchema>) {
  return {
    title: data.title,
    body: data.body,
    priority: data.priority,
    tower_id: data.tower_id,
    publication_status: data.publication_status,
    published_at: data.published_at,
    expires_at: data.expires_at,
  };
}
