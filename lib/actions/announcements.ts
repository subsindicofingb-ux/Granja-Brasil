"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireCondoAccess, requireCondoPermission } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import type { AuthActionState } from "@/lib/auth/types";
import { uploadCondoImage } from "@/lib/storage/upload-image";
import {
  notifyAnnouncementCreated,
  notifyAnnouncementRead,
  notifyAnnouncementReply,
} from "@/lib/email/announcement-notifications";
import type { AnnouncementWithDetails } from "@/lib/announcements/types";
import {
  createAnnouncement,
  createAnnouncementReply,
  createDoormanToResidentAnnouncement,
  createResidentAnnouncement,
  createStaffToGranjaAnnouncement,
  getAnnouncementById,
  listAnnouncementReplies,
  markAnnouncementAsRead,
  updateAnnouncement,
} from "@/lib/services/announcements";
import {
  getAnnouncementAttachmentFromForm,
  parseAnnouncementFormData,
  parseAnnouncementReplyFormData,
  parseResidentAnnouncementFormData,
  parseSyndicContactFormData,
  toAnnouncementPayload,
} from "@/lib/validations/announcement.schema";
import { parseDoormanResidentMessageFormData } from "@/lib/validations/doorman.schema";

function revalidateAnnouncementPaths(condoSlug: string, announcementId?: string) {
  revalidatePath(`/app/${condoSlug}/announcements`);
  revalidatePath(`/app/${condoSlug}`);
  if (announcementId) {
    revalidatePath(`/app/${condoSlug}/announcements/${announcementId}`);
  }
}

async function uploadAnnouncementAttachment(
  condominiumId: string,
  formData: FormData,
): Promise<{ ok: true; url: string | null; name: string | null } | { ok: false; error: string }> {
  const file = getAnnouncementAttachmentFromForm(formData);

  if (!file) {
    return { ok: true, url: null, name: null };
  }

  const upload = await uploadCondoImage({
    condominiumId,
    folder: "announcements",
    file,
  });

  if (!upload.ok) {
    return { ok: false, error: upload.error };
  }

  return { ok: true, url: upload.data, name: file.name };
}

function scheduleAnnouncementReadNotification(input: {
  announcement: AnnouncementWithDetails;
  readerProfileId: string;
  readerName: string;
}) {
  after(async () => {
    try {
      await notifyAnnouncementRead(input);
    } catch (error) {
      console.error("[email:announcement-read]", error);
    }
  });
}

function scheduleAnnouncementCreatedNotification(input: {
  announcement: AnnouncementWithDetails;
  senderProfileId: string;
}) {
  after(async () => {
    try {
      await notifyAnnouncementCreated(input);
    } catch (error) {
      console.error("[email:announcement-created]", error);
    }
  });
}

function scheduleAnnouncementReplyNotification(input: {
  rootAnnouncement: AnnouncementWithDetails;
  replyBody: string;
  senderProfileId: string;
  senderName: string;
}) {
  after(async () => {
    try {
      await notifyAnnouncementReply(input);
    } catch (error) {
      console.error("[email:announcement-reply]", error);
    }
  });
}

export async function createAnnouncementAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageAnnouncements,
    { redirectTo: `/app/${condoSlug}/announcements` },
  );

  const parsed = parseAnnouncementFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const attachment = await uploadAnnouncementAttachment(access.condominium.id, formData);

  if (!attachment.ok) {
    return { error: attachment.error };
  }

  const result = await createAnnouncement({
    condominiumId: access.condominium.id,
    createdBy: access.profile.id,
    data: {
      ...toAnnouncementPayload(parsed.data),
      attachment_url: attachment.url,
      attachment_name: attachment.name,
    },
  });

  if (!result.ok) {
    return { error: result.error };
  }

  scheduleAnnouncementCreatedNotification({
    announcement: result.data,
    senderProfileId: access.profile.id,
  });

  revalidateAnnouncementPaths(condoSlug, result.data.id);
  redirect(`/app/${condoSlug}/announcements/${result.data.id}`);
}

export async function createResidentAnnouncementAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canSendAnnouncements,
    { redirectTo: `/app/${condoSlug}/announcements` },
  );

  if (isGeneralCondominium(condoSlug)) {
    return { error: "Moradores devem enviar mensagens a partir do condomínio de residência." };
  }

  const parsed = parseResidentAnnouncementFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const attachment = await uploadAnnouncementAttachment(access.condominium.id, formData);

  if (!attachment.ok) {
    return { error: attachment.error };
  }

  const result = await createResidentAnnouncement({
    contextCondominiumId: access.condominium.id,
    createdBy: access.profile.id,
    destination: parsed.data.destination,
    title: parsed.data.title,
    body: parsed.data.body,
    attachmentUrl: attachment.url,
    attachmentName: attachment.name,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  scheduleAnnouncementCreatedNotification({
    announcement: result.data,
    senderProfileId: access.profile.id,
  });

  revalidateAnnouncementPaths(condoSlug, result.data.id);
  redirect(`/app/${condoSlug}/announcements/${result.data.id}`);
}

export async function createStaffToGranjaAnnouncementAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageAnnouncements,
    { redirectTo: `/app/${condoSlug}/announcements` },
  );

  if (isGeneralCondominium(condoSlug)) {
    return { error: "A administração geral recebe mensagens dos condomínios em Avisos." };
  }

  const parsed = parseSyndicContactFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const attachment = await uploadAnnouncementAttachment(access.condominium.id, formData);

  if (!attachment.ok) {
    return { error: attachment.error };
  }

  const result = await createStaffToGranjaAnnouncement({
    sourceCondominiumId: access.condominium.id,
    createdBy: access.profile.id,
    title: parsed.data.title,
    body: parsed.data.body,
    attachmentUrl: attachment.url,
    attachmentName: attachment.name,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  scheduleAnnouncementCreatedNotification({
    announcement: result.data,
    senderProfileId: access.profile.id,
  });

  revalidateAnnouncementPaths(condoSlug, result.data.id);
  redirect(`/app/${condoSlug}/announcements/${result.data.id}?enviado=1`);
}

export async function createDoormanToResidentAnnouncementAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canSendAnnouncements,
    { redirectTo: `/app/${condoSlug}/announcements/doorman-contact` },
  );

  if (isGeneralCondominium(condoSlug)) {
    return { error: "Use esta opção a partir do condomínio filho." };
  }

  const parsed = parseDoormanResidentMessageFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const attachment = await uploadAnnouncementAttachment(access.condominium.id, formData);
  if (!attachment.ok) {
    return { error: attachment.error };
  }

  const result = await createDoormanToResidentAnnouncement({
    condominiumId: access.condominium.id,
    createdBy: access.profile.id,
    targetProfileId: parsed.data.target_profile_id,
    title: parsed.data.title,
    body: parsed.data.body,
    attachmentUrl: attachment.url,
    attachmentName: attachment.name,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  scheduleAnnouncementCreatedNotification({
    announcement: result.data,
    senderProfileId: access.profile.id,
  });

  revalidateAnnouncementPaths(condoSlug, result.data.id);
  redirect(`/app/${condoSlug}/announcements/${result.data.id}?enviado=1`);
}

export async function replyAnnouncementAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoAccess(condoSlug);
  const parsed = parseAnnouncementReplyFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const attachment = await uploadAnnouncementAttachment(access.condominium.id, formData);

  if (!attachment.ok) {
    return { error: attachment.error };
  }

  const result = await createAnnouncementReply({
    parentAnnouncementId: parsed.data.parent_announcement_id,
    createdBy: access.profile.id,
    body: parsed.data.body,
    attachmentUrl: attachment.url,
    attachmentName: attachment.name,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  const rootResult = await getAnnouncementById(
    parsed.data.parent_announcement_id,
    access.condominium.id,
  );

  if (rootResult.ok) {
    scheduleAnnouncementReplyNotification({
      rootAnnouncement: rootResult.data,
      replyBody: parsed.data.body,
      senderProfileId: access.profile.id,
      senderName: access.profile.fullName,
    });
  }

  revalidateAnnouncementPaths(condoSlug, parsed.data.parent_announcement_id);
  return { success: "Resposta enviada." };
}

export async function updateAnnouncementAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const announcementId = String(formData.get("announcement_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageAnnouncements,
    { redirectTo: `/app/${condoSlug}/announcements/${announcementId}` },
  );

  const parsed = parseAnnouncementFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const attachment = await uploadAnnouncementAttachment(access.condominium.id, formData);

  if (!attachment.ok) {
    return { error: attachment.error };
  }

  const result = await updateAnnouncement({
    announcementId,
    condominiumId: access.condominium.id,
    data: {
      ...toAnnouncementPayload(parsed.data),
      ...(attachment.url
        ? { attachment_url: attachment.url, attachment_name: attachment.name }
        : {}),
    },
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateAnnouncementPaths(condoSlug, announcementId);
  return { success: "Aviso atualizado com sucesso." };
}

export async function markAnnouncementViewedAction(
  condoSlug: string,
  announcementId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireCondoAccess(condoSlug);
  const announcementResult = await getAnnouncementById(announcementId, access.condominium.id);

  if (!announcementResult.ok) {
    return { ok: false, error: announcementResult.error ?? "Aviso não encontrado." };
  }

  const announcement = announcementResult.data;
  const isAuthor = announcement.created_by === access.profile.id;
  const repliesResult = await listAnnouncementReplies(announcementId);
  const hasReplyFromOthers =
    repliesResult.ok &&
    repliesResult.data.some((reply) => reply.created_by !== access.profile.id);
  const shouldMarkAsRead = !isAuthor || hasReplyFromOthers;

  if (shouldMarkAsRead) {
    const readResult = await markAnnouncementAsRead({
      announcementId,
      profileId: access.profile.id,
    });

    if (!readResult.ok) {
      return { ok: false, error: readResult.error ?? "Não foi possível registrar a leitura." };
    }

    if (
      readResult.data.is_new_read &&
      announcement.created_by &&
      announcement.created_by !== access.profile.id
    ) {
      scheduleAnnouncementReadNotification({
        announcement,
        readerProfileId: access.profile.id,
        readerName: access.profile.fullName,
      });
    }
  }

  revalidateAnnouncementPaths(condoSlug, announcementId);
  return { ok: true };
}
