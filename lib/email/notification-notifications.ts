import { createAdminClient } from "@/lib/supabase/admin";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import { formatUnitWithTower } from "@/lib/residents/labels";
import {
  buildEmailLayout,
  textToHtmlParagraphs,
} from "@/lib/email/format";
import { isEmailConfigured, sendEmail } from "@/lib/email/send-email";
import type { UnitNotificationWithDetails } from "@/lib/notifications/types";

function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function logEmailFailure(context: string, error: string): void {
  console.error(`[email:notification-${context}] ${error}`);
}

async function getProfileEmail(profileId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(profileId);

    if (error || !data.user?.email) {
      return null;
    }

    return data.user.email;
  } catch (error) {
    logEmailFailure(
      "profile",
      error instanceof Error ? error.message : "Falha ao buscar e-mail do usuário.",
    );
    return null;
  }
}

function buildNotificationLink(condoSlug: string, notificationId: string): string {
  return `${getSiteUrl()}/app/${condoSlug}/notifications/${notificationId}`;
}

async function sendNotificationEmail(input: {
  profileId: string;
  condoSlug: string;
  notificationId: string;
  subject: string;
  preview: string;
  title: string;
  bodyText: string;
  actionLabel: string;
}): Promise<boolean> {
  if (!isEmailConfigured()) {
    logEmailFailure("config", "RESEND_API_KEY não configurada.");
    return false;
  }

  const email = await getProfileEmail(input.profileId);
  if (!email) {
    return false;
  }

  const link = buildNotificationLink(input.condoSlug, input.notificationId);
  const bodyHtml = `<p>${textToHtmlParagraphs(input.bodyText)}</p>`;

  const result = await sendEmail({
    to: [email],
    subject: input.subject,
    text: `${input.title}\n\n${input.bodyText}\n\n${input.actionLabel}: ${link}`,
    html: buildEmailLayout({
      preview: input.preview,
      title: input.title,
      bodyHtml,
      actionLabel: input.actionLabel,
      actionUrl: link,
    }),
    tags: [{ name: "category", value: "unit-notification" }],
  });

  if (!result.ok) {
    logEmailFailure("send", result.error);
    return false;
  }

  return true;
}

function formatNotificationContext(notification: UnitNotificationWithDetails): string {
  const condoName = notification.target_condominium
    ? formatCondominiumDisplayName(
        notification.target_condominium.name,
        notification.target_condominium.slug,
      )
    : "Condomínio";
  const unitLabel = notification.target_unit
    ? formatUnitWithTower(notification.target_unit)
    : "Unidade";
  return `${condoName} · ${unitLabel}`;
}

export async function notifyUnitNotificationCreated(input: {
  notification: UnitNotificationWithDetails;
  senderName: string;
}): Promise<void> {
  const { notification, senderName } = input;
  const context = formatNotificationContext(notification);

  await sendNotificationEmail({
    profileId: notification.target_profile_id,
    condoSlug: notification.target_condominium?.slug ?? "",
    notificationId: notification.id,
    subject: `Notificação formal: ${notification.title}`,
    preview: "Você recebeu uma notificação formal do condomínio.",
    title: "Notificação formal recebida",
    bodyText: [
      "Você recebeu uma notificação formal registrada no sistema Granja Brasil.",
      "",
      `Assunto: ${notification.title}`,
      `Destino: ${context}`,
      `Remetente: ${senderName}`,
      "",
      notification.body,
      "",
      "Acesse o sistema para ler, responder e consultar o histórico da notificação.",
    ].join("\n"),
    actionLabel: "Abrir notificação",
  });
}

export async function notifyUnitNotificationReadToSender(input: {
  notification: UnitNotificationWithDetails;
  readerName: string;
  readAt: string;
}): Promise<void> {
  const { notification, readerName, readAt } = input;
  const context = formatNotificationContext(notification);

  await sendNotificationEmail({
    profileId: notification.created_by,
    condoSlug: notification.source_condominium?.slug ?? "",
    notificationId: notification.id,
    subject: `Leitura confirmada: ${notification.title}`,
    preview: "O destinatário leu sua notificação formal.",
    title: "Confirmação de leitura",
    bodyText: [
      "A notificação formal que você enviou foi lida pelo destinatário.",
      "",
      `Assunto: ${notification.title}`,
      `Unidade: ${context}`,
      `Lida por: ${readerName}`,
      `Data da leitura: ${new Date(readAt).toLocaleString("pt-BR")}`,
      "",
      "Consulte o histórico completo e eventuais respostas no sistema.",
    ].join("\n"),
    actionLabel: "Ver notificação",
  });
}

export async function notifyUnitNotificationReply(input: {
  notification: UnitNotificationWithDetails;
  replyBody: string;
  senderProfileId: string;
  senderName: string;
  recipientProfileId: string;
  recipientCondoSlug: string;
}): Promise<void> {
  const { notification, replyBody, senderProfileId, senderName, recipientProfileId, recipientCondoSlug } =
    input;

  await sendNotificationEmail({
    profileId: recipientProfileId,
    condoSlug: recipientCondoSlug,
    notificationId: notification.id,
    subject: `Resposta na notificação: ${notification.title}`,
    preview: `${senderName} respondeu uma notificação formal.`,
    title: "Nova resposta na notificação",
    bodyText: [
      `${senderName} respondeu a notificação formal "${notification.title}".`,
      "",
      replyBody,
      "",
      "Acesse o sistema para continuar o histórico registrado desta notificação.",
    ].join("\n"),
    actionLabel: "Abrir histórico",
  });
}
