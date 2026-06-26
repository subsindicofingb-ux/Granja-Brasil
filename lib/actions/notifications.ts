"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import {
  notifyUnitNotificationCreated,
  notifyUnitNotificationReadToSender,
  notifyUnitNotificationReply,
} from "@/lib/email/notification-notifications";
import type { UnitNotificationWithDetails } from "@/lib/notifications/types";
import {
  createUnitNotification,
  createUnitNotificationReply,
  getUnitNotificationById,
  markUnitNotificationAsRead,
  markUnitNotificationReadReceiptSent,
  markUnitNotificationSenderSeen,
} from "@/lib/services/notifications";
import { resolveUnitContext } from "@/lib/services/unit-access";
import { uploadCondoImage } from "@/lib/storage/upload-image";
import {
  getNotificationAttachmentFromForm,
  parseUnitNotificationFormData,
  parseUnitNotificationReplyFormData,
} from "@/lib/validations/notification.schema";

function revalidateNotificationPaths(condoSlug: string, notificationId?: string) {
  revalidatePath(`/app/${condoSlug}/notifications`);
  revalidatePath(`/app/${condoSlug}`);
  if (notificationId) {
    revalidatePath(`/app/${condoSlug}/notifications/${notificationId}`);
  }
}

async function uploadNotificationAttachment(
  condominiumId: string,
  formData: FormData,
): Promise<{ ok: true; url: string | null; name: string | null } | { ok: false; error: string }> {
  const file = getNotificationAttachmentFromForm(formData);

  if (!file) {
    return { ok: true, url: null, name: null };
  }

  const upload = await uploadCondoImage({
    condominiumId,
    folder: "notifications",
    file,
  });

  if (!upload.ok) {
    return { ok: false, error: upload.error };
  }

  return { ok: true, url: upload.data, name: file.name };
}

export async function createUnitNotificationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canSendUnitNotifications,
    { redirectTo: `/app/${condoSlug}/notifications` },
  );

  const parsed = parseUnitNotificationFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const isGranjaSource = isGeneralCondominium(condoSlug);
  const targetCondominiumId = isGranjaSource
    ? parsed.data.target_condominium_id
    : access.condominium.id;

  if (!targetCondominiumId) {
    return { error: "Selecione o condomínio de destino." };
  }

  const unitContext = await resolveUnitContext(parsed.data.target_unit_id, targetCondominiumId);
  if (!unitContext.ok) {
    return { error: unitContext.error ?? "Unidade inválida." };
  }

  const attachment = await uploadNotificationAttachment(
    isGranjaSource ? access.condominium.id : targetCondominiumId,
    formData,
  );

  if (!attachment.ok) {
    return { error: attachment.error };
  }

  const result = await createUnitNotification({
    sourceCondominiumId: access.condominium.id,
    targetCondominiumId,
    targetUnitId: parsed.data.target_unit_id,
    createdBy: access.profile.id,
    title: parsed.data.title,
    body: parsed.data.body,
    attachmentUrl: attachment.url,
    attachmentName: attachment.name,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  scheduleUnitNotificationCreatedEmail({
    notification: result.data,
    senderName: access.profile.fullName,
  });

  revalidateNotificationPaths(condoSlug, result.data.id);
  redirect(`/app/${condoSlug}/notifications/${result.data.id}?enviado=1`);
}

export async function replyUnitNotificationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const notificationId = String(formData.get("notification_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canSendUnitNotifications || ctx.permissions.canViewUnitNotifications,
    { redirectTo: `/app/${condoSlug}/notifications/${notificationId}` },
  );

  const parsed = parseUnitNotificationReplyFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const notificationResult = await getUnitNotificationById(notificationId, access.profile.id);
  if (!notificationResult.ok) {
    return { error: notificationResult.error };
  }

  const notification = notificationResult.data;
  const attachmentCondominiumId =
    notification.source_condominium_id === access.condominium.id
      ? notification.source_condominium_id
      : notification.target_condominium_id;

  const attachment = await uploadNotificationAttachment(attachmentCondominiumId, formData);
  if (!attachment.ok) {
    return { error: attachment.error };
  }

  const result = await createUnitNotificationReply({
    notificationId,
    createdBy: access.profile.id,
    body: parsed.data.body,
    attachmentUrl: attachment.url,
    attachmentName: attachment.name,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  const recipientProfileId =
    access.profile.id === notification.created_by
      ? notification.target_profile_id
      : notification.created_by;
  const recipientCondoSlug =
    access.profile.id === notification.created_by
      ? notification.target_condominium.slug
      : notification.source_condominium.slug;

  scheduleUnitNotificationReplyEmail({
    notification,
    replyBody: parsed.data.body,
    senderProfileId: access.profile.id,
    senderName: access.profile.fullName,
    recipientProfileId,
    recipientCondoSlug,
  });

  revalidateNotificationPaths(condoSlug, notificationId);
  return { success: "Resposta registrada no histórico da notificação." };
}

export async function processUnitNotificationDetailSideEffects(input: {
  condoSlug: string;
  notificationId: string;
  profileId: string;
  isRecipient: boolean;
  isSender: boolean;
  readerName: string;
}) {
  if (input.isSender) {
    await markUnitNotificationSenderSeen({
      notificationId: input.notificationId,
      profileId: input.profileId,
    });
  }

  if (!input.isRecipient) {
    revalidateNotificationPaths(input.condoSlug, input.notificationId);
    return;
  }

  const readResult = await markUnitNotificationAsRead({
    notificationId: input.notificationId,
    profileId: input.profileId,
  });

  if (!readResult.ok || !readResult.data.firstRead) {
    revalidateNotificationPaths(input.condoSlug, input.notificationId);
    return;
  }

  const notificationResult = await getUnitNotificationById(
    input.notificationId,
    input.profileId,
  );

  if (notificationResult.ok) {
    scheduleUnitNotificationReadEmail({
      notification: notificationResult.data,
      readerName: input.readerName,
      readAt: readResult.data.read_at,
      readerProfileId: input.profileId,
    });
  }

  revalidateNotificationPaths(input.condoSlug, input.notificationId);
}

function scheduleUnitNotificationCreatedEmail(input: {
  notification: UnitNotificationWithDetails;
  senderName: string;
}) {
  after(async () => {
    try {
      await notifyUnitNotificationCreated(input);
    } catch (error) {
      console.error("[email:notification-created]", error);
    }
  });
}

function scheduleUnitNotificationReadEmail(input: {
  notification: UnitNotificationWithDetails;
  readerName: string;
  readAt: string;
  readerProfileId: string;
}) {
  after(async () => {
    try {
      await notifyUnitNotificationReadToSender({
        notification: input.notification,
        readerName: input.readerName,
        readAt: input.readAt,
      });
      await markUnitNotificationReadReceiptSent({
        notificationId: input.notification.id,
        profileId: input.readerProfileId,
      });
    } catch (error) {
      console.error("[email:notification-read]", error);
    }
  });
}

function scheduleUnitNotificationReplyEmail(input: {
  notification: UnitNotificationWithDetails;
  replyBody: string;
  senderProfileId: string;
  senderName: string;
  recipientProfileId: string;
  recipientCondoSlug: string;
}) {
  after(async () => {
    try {
      await notifyUnitNotificationReply(input);
    } catch (error) {
      console.error("[email:notification-reply]", error);
    }
  });
}
