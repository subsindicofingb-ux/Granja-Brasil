import { createAdminClient } from "@/lib/supabase/admin";
import { formatUnitWithTower } from "@/lib/residents/labels";
import { buildEmailLayout, textToHtmlParagraphs } from "@/lib/email/format";
import { isEmailConfigured, sendEmail } from "@/lib/email/send-email";
import type { CorrespondenceNotice } from "@/lib/correspondence/types";

function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

async function getProfileEmail(profileId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(profileId);

    if (error || !data.user?.email) {
      return null;
    }

    return data.user.email;
  } catch {
    return null;
  }
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

export async function notifyCorrespondenceCreated(input: {
  notice: CorrespondenceNotice;
  condominiumName: string;
}): Promise<boolean> {
  if (!isEmailConfigured()) {
    return false;
  }

  const email = await getProfileEmail(input.notice.target_profile_id);
  if (!email) {
    return false;
  }

  const condoSlug = await getCondominiumSlug(input.notice.condominium_id);
  const link = condoSlug ? `${getSiteUrl()}/app/${condoSlug}` : getSiteUrl();
  const unitLabel = input.notice.unit ? formatUnitWithTower(input.notice.unit) : "sua unidade";

  const bodyText = [
    `Olá,`,
    ``,
    `Há uma correspondência aguardando retirada na portaria do ${input.condominiumName}.`,
    ``,
    `Unidade: ${unitLabel}`,
    `Descrição: ${input.notice.description}`,
    input.notice.carrier ? `Transportadora/remetente: ${input.notice.carrier}` : null,
    input.notice.notes ? `Observações: ${input.notice.notes}` : null,
    ``,
    `Acesse o sistema para mais detalhes.`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await sendEmail({
    to: [email],
    subject: `Correspondência aguardando retirada — ${input.condominiumName}`,
    text: bodyText,
    html: buildEmailLayout({
      preview: `Correspondência na portaria para ${unitLabel}.`,
      title: "Correspondência na portaria",
      bodyHtml: textToHtmlParagraphs(bodyText),
      actionLabel: "Acessar o condomínio",
      actionUrl: link,
    }),
    tags: [{ name: "category", value: "correspondence" }],
  });

  return result.ok;
}
