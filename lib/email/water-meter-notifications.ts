import { createAdminClient } from "@/lib/supabase/admin";
import { buildEmailLayout, textToHtmlParagraphs } from "@/lib/email/format";
import { formatWaterMeterReadingValue } from "@/lib/water-meters/format";
import { isEmailConfigured, sendEmail } from "@/lib/email/send-email";
import type { WaterMeterAlert } from "@/lib/water-meters/types";

const ALERT_RECIPIENT_ROLES = ["syndic", "sub_syndic", "admin", "doorman"] as const;

function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

async function getCondominiumInfo(condominiumId: string): Promise<{ name: string; slug: string } | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("condominiums")
      .select("name, slug")
      .eq("id", condominiumId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

async function getAlertRecipientEmails(condominiumId: string): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data: memberships, error } = await admin
      .from("memberships")
      .select("profile_id")
      .eq("condominium_id", condominiumId)
      .in("role", ALERT_RECIPIENT_ROLES);

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

export async function notifyWaterMeterAbnormalConsumption(input: {
  alert: WaterMeterAlert;
  readingDate: string;
}): Promise<boolean> {
  if (!isEmailConfigured()) {
    return false;
  }

  const condo = await getCondominiumInfo(input.alert.condominium_id);
  if (!condo) {
    return false;
  }

  const emails = await getAlertRecipientEmails(input.alert.condominium_id);
  if (emails.length === 0) {
    return false;
  }

  const link = `${getSiteUrl()}/app/${condo.slug}/water-meters`;
  const bodyText = [
    `Alerta de consumo de água no condomínio ${condo.name}.`,
    ``,
    `Data da leitura: ${input.readingDate}`,
    `Consumo do dia: ${formatWaterMeterReadingValue(input.alert.daily_consumption)} m³`,
    `Média recente: ${formatWaterMeterReadingValue(input.alert.average_consumption)} m³`,
    `Excesso: ${input.alert.excess_percent.toFixed(1)}% acima da média`,
    ``,
    `Verifique possíveis vazamentos ou uso anormal.`,
  ].join("\n");

  let sent = false;

  for (const email of emails) {
    const result = await sendEmail({
      to: [email],
      subject: `Alerta de consumo de água — ${condo.name}`,
      text: bodyText,
      html: buildEmailLayout({
        preview: `Consumo ${input.alert.excess_percent.toFixed(1)}% acima da média.`,
        title: "Consumo de água acima da média",
        bodyHtml: textToHtmlParagraphs(bodyText),
        actionLabel: "Ver hidrômetros",
        actionUrl: link,
      }),
      tags: [{ name: "category", value: "water-meter-alert" }],
    });

    sent = sent || result.ok;
  }

  return sent;
}
