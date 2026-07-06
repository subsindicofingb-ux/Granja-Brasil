import { createAdminClient } from "@/lib/supabase/admin";
import { buildEmailLayout, textToHtmlParagraphs } from "@/lib/email/format";
import { isEmailConfigured, sendEmail } from "@/lib/email/send-email";
import { formatUnitWithTower } from "@/lib/residents/labels";
import { getGuestTypeLabel } from "@/lib/visitor-authorizations/labels";
import type { VisitorAuthorizationWithDetails } from "@/lib/visitor-authorizations/types";
import {
  getCondominiumsInDoormanBlock,
  getDoormanBlockForCondominium,
} from "@/lib/condominiums/doorman-blocks";
import type { CondominiumRecord } from "@/lib/services/condominiums-admin";

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

async function getCondominiumName(condominiumId: string): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("condominiums")
      .select("name")
      .eq("id", condominiumId)
      .maybeSingle();

    return data?.name ?? "Condomínio";
  } catch {
    return "Condomínio";
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

export async function sendVisitorAuthorizationRequestNotification(input: {
  authorization: VisitorAuthorizationWithDetails;
  condominiumId: string;
  requesterName: string;
}): Promise<boolean> {
  if (!isEmailConfigured()) {
    return false;
  }

  const emails = await getSyndicNotificationEmails(input.condominiumId);
  if (emails.length === 0) {
    return false;
  }

  const [condoSlug, condominiumName] = await Promise.all([
    getCondominiumSlug(input.condominiumId),
    getCondominiumName(input.condominiumId),
  ]);

  const link = condoSlug
    ? `${getSiteUrl()}/app/${condoSlug}/visitors/${input.authorization.id}`
    : getSiteUrl();

  const unitLabel = formatUnitWithTower(input.authorization.unit);
  const guestTypeLabel = getGuestTypeLabel(input.authorization.guest_type);

  const text = [
    "Olá,",
    "",
    `Há uma nova solicitação de visitante aguardando aprovação no ${condominiumName}.`,
    "",
    `Visitante: ${input.authorization.full_name}`,
    `Tipo: ${guestTypeLabel}`,
    `Unidade: ${unitLabel}`,
    `Solicitante: ${input.requesterName}`,
    "",
    "Acesse o sistema para aprovar ou recusar.",
  ].join("\n");

  const subject = `Nova solicitação de visitante — ${condominiumName}`;
  let sent = false;

  for (const email of emails) {
    const result = await sendEmail({
      to: [email],
      subject,
      text,
      html: buildEmailLayout({
        preview: subject,
        title: "Nova solicitação de visitante",
        bodyHtml: textToHtmlParagraphs(text),
        actionLabel: "Revisar solicitação",
        actionUrl: link,
      }),
      tags: [{ name: "category", value: "visitor-authorization" }],
    });

    sent = sent || result.ok;
  }

  return sent;
}
