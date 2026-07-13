import { z } from "zod";
import {
  ANNOUNCEMENT_PRIORITY,
  ANNOUNCEMENT_PUBLICATION_STATUS,
} from "@/lib/constants";
import {
  applyGranjaAudienceToPayload,
  type GranjaAnnouncementAudience,
} from "@/lib/announcements/granja-audience";
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
const optionalTargetProfileIds = z
  .array(z.string().uuid("Morador inválido."))
  .default([]);

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

const granjaAudienceSchema = z.enum([
  "all_blocks",
  "block_residents",
  "block_syndic",
  "specific_residents",
]);

const announcementFormBaseSchema = z.object({
  title: z.string().trim().min(1, "Informe o título.").max(200, "Título muito longo."),
  body: z.string().trim().min(1, "Informe o conteúdo.").max(10000, "Conteúdo muito longo."),
  priority: z.enum([
    ANNOUNCEMENT_PRIORITY.NORMAL,
    ANNOUNCEMENT_PRIORITY.IMPORTANT,
    ANNOUNCEMENT_PRIORITY.URGENT,
  ]),
  tower_id: optionalTowerId,
  target_condominium_id: optionalTargetCondominiumId,
  target_profile_ids: optionalTargetProfileIds,
  granja_audience: granjaAudienceSchema.nullable().optional(),
  granja_block_condominium_id: optionalTargetCondominiumId,
  is_granja_source: z.boolean().default(false),
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
});

export const announcementFormSchema = announcementFormBaseSchema.superRefine((data, ctx) => {
  if (data.expires_at && new Date(data.expires_at) <= new Date(data.published_at)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Expiração deve ser posterior à publicação.",
      path: ["expires_at"],
    });
  }

  if (!data.is_granja_source && data.target_profile_ids.length > 0 && data.target_condominium_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Escolha destino por condomínio ou por moradores, não ambos.",
      path: ["target_profile_ids"],
    });
  }

  if (data.is_granja_source) {
    if (!data.granja_audience) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione quem deve receber o aviso.",
        path: ["granja_audience"],
      });
      return;
    }

    if (
      (data.granja_audience === "block_residents" || data.granja_audience === "block_syndic") &&
      !data.granja_block_condominium_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione o bloco de destino.",
        path: ["granja_block_condominium_id"],
      });
    }

    if (data.granja_audience === "specific_residents" && data.target_profile_ids.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione ao menos um morador.",
        path: ["target_profile_ids"],
      });
    }
  }
});

function parseTargetProfileIds(formData: FormData): string[] {
  return [
    ...new Set(
      formData
        .getAll("target_profile_ids")
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0),
    ),
  ];
}

function parseGranjaAudience(formData: FormData): GranjaAnnouncementAudience | null {
  const value = String(formData.get("granja_audience") ?? "").trim();
  if (!value) {
    return null;
  }

  const parsed = granjaAudienceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseAnnouncementFormData(formData: FormData) {
  const isGranjaSource = String(formData.get("is_granja_source") ?? "") === "1";

  return announcementFormSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    priority: formData.get("priority"),
    tower_id: formData.get("tower_id"),
    target_condominium_id: formData.get("target_condominium_id"),
    target_profile_ids: parseTargetProfileIds(formData),
    granja_audience: isGranjaSource ? parseGranjaAudience(formData) : null,
    granja_block_condominium_id: formData.get("granja_block_condominium_id"),
    is_granja_source: isGranjaSource,
    publication_status: formData.get("publication_status"),
    published_at: formData.get("published_at"),
    expires_at: formData.get("expires_at") ?? "",
  });
}

export function toAnnouncementPayload(data: z.infer<typeof announcementFormSchema>) {
  if (data.is_granja_source && data.granja_audience) {
    const granjaTargeting = applyGranjaAudienceToPayload({
      granja_audience: data.granja_audience,
      granja_block_condominium_id: data.granja_block_condominium_id,
      target_profile_ids: data.target_profile_ids,
    });

    return {
      title: data.title,
      body: data.body,
      priority: data.priority,
      tower_id: null,
      target_condominium_id: granjaTargeting.target_condominium_id,
      target_condominium_staff_only: granjaTargeting.target_condominium_staff_only,
      target_profile_ids: granjaTargeting.target_profile_ids,
      target_profile_id: granjaTargeting.target_profile_id,
      publication_status: data.publication_status,
      published_at: data.published_at,
      expires_at: data.expires_at,
    };
  }

  const hasTargetProfiles = data.target_profile_ids.length > 0;

  return {
    title: data.title,
    body: data.body,
    priority: data.priority,
    tower_id: hasTargetProfiles ? null : data.tower_id,
    target_condominium_id: hasTargetProfiles ? null : data.target_condominium_id,
    target_condominium_staff_only: false,
    target_profile_ids: data.target_profile_ids,
    target_profile_id: data.target_profile_ids.length === 1 ? data.target_profile_ids[0] : null,
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
