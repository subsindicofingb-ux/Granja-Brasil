import { z } from "zod";
import {
  ANNOUNCEMENT_PRIORITY,
  ANNOUNCEMENT_PUBLICATION_STATUS,
} from "@/lib/constants";
import { fromDatetimeLocalValue } from "@/lib/reservations/timezone";

const optionalUuid = (message: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null || value === "") return null;
      return String(value);
    })
    .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
      message,
    });

const optionalTowerId = optionalUuid("Torre inválida.");
const optionalTargetCondominiumId = optionalUuid("Condomínio inválido.");
const optionalTargetProfileId = optionalUuid("Morador inválido.");

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
    target_condominium_id: optionalTargetCondominiumId,
    target_profile_id: optionalTargetProfileId,
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

    if (data.target_profile_id && data.target_condominium_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Escolha destino por condomínio ou por morador, não ambos.",
        path: ["target_profile_id"],
      });
    }
  });

export function parseAnnouncementFormData(formData: FormData) {
  return announcementFormSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    priority: formData.get("priority"),
    tower_id: formData.get("tower_id"),
    target_condominium_id: formData.get("target_condominium_id"),
    target_profile_id: formData.get("target_profile_id"),
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
    tower_id: data.target_profile_id ? null : data.tower_id,
    target_condominium_id: data.target_profile_id ? null : data.target_condominium_id,
    target_profile_id: data.target_profile_id,
    publication_status: data.publication_status,
    published_at: data.published_at,
    expires_at: data.expires_at,
  };
}

export const residentAnnouncementFormSchema = z.object({
  title: z.string().trim().min(1, "Informe o assunto.").max(200, "Assunto muito longo."),
  body: z.string().trim().min(1, "Informe a mensagem.").max(10000, "Mensagem muito longa."),
  destination: z.enum(["condominium", "granja"]),
});

export const syndicContactFormSchema = z.object({
  title: z.string().trim().min(1, "Informe o assunto.").max(200, "Assunto muito longo."),
  body: z.string().trim().min(1, "Informe a mensagem.").max(10000, "Mensagem muito longa."),
});

export const announcementReplySchema = z.object({
  body: z.string().trim().min(1, "Informe a resposta.").max(10000, "Resposta muito longa."),
  parent_announcement_id: z.string().uuid("Aviso inválido."),
});

export function parseResidentAnnouncementFormData(formData: FormData) {
  return residentAnnouncementFormSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    destination: formData.get("destination"),
  });
}

export function parseSyndicContactFormData(formData: FormData) {
  return syndicContactFormSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
}

export function parseAnnouncementReplyFormData(formData: FormData) {
  return announcementReplySchema.safeParse({
    body: formData.get("body"),
    parent_announcement_id: formData.get("parent_announcement_id"),
  });
}

export function getAnnouncementAttachmentFromForm(formData: FormData): File | null {
  const file = formData.get("attachment");
  return file instanceof File && file.size > 0 ? file : null;
}
