import { createAdminClient } from "@/lib/supabase/admin";
import { buildEmailLayout, textToHtmlParagraphs } from "@/lib/email/format";
import { getResidentTypeLabel } from "@/lib/residents/labels";
import { isEmailConfigured, sendEmail } from "@/lib/email/send-email";
import {
  getCondominiumsInDoormanBlock,
  getDoormanBlockForCondominium,
} from "@/lib/condominiums/doorman-blocks";
import type { CondominiumRecord } from "@/lib/services/condominiums-admin";
import type { RegistrationRequestNotificationEvent } from "@/lib/registrations/types";
import type { ResidentType } from "@/types";

const SYNDIC_NOTIFICATION_ROLES = ["syndic", "sub_syndic", "admin"] as const;

function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

async function getCondominiumSlug(condominiumId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("condominiums")
      .select("slug")
      .eq("id", condominiumId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data.slug;
  } catch {
    return null;
  }
}

async function getSyndicNotificationEmails(condominiumId: string): Promise<string[]> {
  try {
    const admin = createAdminClient();

    const { data: condominium, error: condominiumError } = await admin
      .from("condominiums")
      .select("id, slug, name")
      .eq("id", condominiumId)
      .maybeSingle();

    if (condominiumError || !condominium) {
      return [];
    }

    let condominiumIds = [condominiumId];
    const block = getDoormanBlockForCondominium(condominium);

    if (block) {
      const { data: condominiums, error: condominiumsError } = await admin
        .from("condominiums")
        .select("id, slug, name");

      if (!condominiumsError && condominiums?.length) {
        condominiumIds = getCondominiumsInDoormanBlock(
          block,
          condominiums as CondominiumRecord[],
        ).map((entry) => entry.id);
      }
    }

    const { data: memberships, error } = await admin
      .from("memberships")
      .select("profile_id")
      .in("condominium_id", condominiumIds)
      .in("role", SYNDIC_NOTIFICATION_ROLES);

    if (error || !memberships?.length) {
      return [];
    }

    const emails: string[] = [];

    for (const membership of memberships) {
      const { data, error: userError } = await admin.auth.admin.getUserById(membership.profile_id);
      if (!userError && data.user?.email) {
        emails.push(data.user.email);
      }
    }

    return [...new Set(emails)];
  } catch {
    return [];
  }
}

function buildRegistrationEmailBody(input: {
  event: RegistrationRequestNotificationEvent;
  link: string;
}): { subject: string; text: string } {
  const { event } = input;
  const residentTypeLabel = getResidentTypeLabel(event.residentType as ResidentType);
  const accessLine =
    event.accessDeviceNames && event.accessDeviceNames.length > 0
      ? `Locais de acesso: ${event.accessDeviceNames.join(", ")}`
      : null;

  if (event.source === "doorman") {
    const text = [
      `Olá,`,
      ``,
      event.fulfilledImmediately
        ? `A portaria cadastrou um novo morador no ${event.condominiumName}.`
        : `A portaria enviou uma nova solicitação de cadastro no ${event.condominiumName}.`,
      ``,
      `Nome: ${event.fullName}`,
      `E-mail: ${event.email}`,
      `Unidade: ${event.unitLabel}`,
      `Tipo: ${residentTypeLabel}`,
      accessLine,
      event.fulfilledImmediately
        ? `O acesso facial ControlID já foi liberado nos locais selecionados.`
        : `A solicitação aguarda sua aprovação antes de liberar o ControlID.`,
      ``,
      event.fulfilledImmediately
        ? `Consulte o cadastro no sistema quando precisar.`
        : `Acesse o link abaixo para aprovar ou recusar.`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      subject: event.fulfilledImmediately
        ? `Novo cadastro pela portaria — ${event.condominiumName}`
        : `Nova solicitação pela portaria — ${event.condominiumName}`,
      text,
    };
  }

  const text = [
    `Olá,`,
    ``,
    `Há uma nova solicitação de cadastro aguardando análise no ${event.condominiumName}.`,
    ``,
    `Nome: ${event.fullName}`,
    `E-mail: ${event.email}`,
    `Unidade: ${event.unitLabel}`,
    `Tipo: ${residentTypeLabel}`,
    accessLine,
    ``,
    `Acesse o sistema para aprovar ou recusar.`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `Nova solicitação de cadastro — ${event.condominiumName}`,
    text,
  };
}

export async function sendRegistrationRequestNotification(
  event: RegistrationRequestNotificationEvent,
): Promise<boolean> {
  if (!isEmailConfigured()) {
    return false;
  }

  const emails = await getSyndicNotificationEmails(event.condominiumId);
  if (emails.length === 0) {
    return false;
  }

  const condoSlug = await getCondominiumSlug(event.condominiumId);
  const link = condoSlug
    ? `${getSiteUrl()}/app/${condoSlug}/settings/registration-requests`
    : getSiteUrl();
  const { subject, text } = buildRegistrationEmailBody({ event, link });

  let sent = false;

  for (const email of emails) {
    const result = await sendEmail({
      to: [email],
      subject,
      text,
      html: buildEmailLayout({
        preview: subject,
        title: event.source === "doorman" ? "Cadastro pela portaria" : "Nova solicitação de cadastro",
        bodyHtml: textToHtmlParagraphs(text),
        actionLabel: event.fulfilledImmediately ? "Abrir painel" : "Ver solicitações",
        actionUrl: link,
      }),
      tags: [{ name: "category", value: "registration-request" }],
    });

    sent = sent || result.ok;
  }

  return sent;
}
