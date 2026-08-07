import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_NAME } from "@/lib/brand";
import { buildEmailLayout, textToHtmlParagraphs } from "@/lib/email/format";
import { isEmailConfigured, sendEmail } from "@/lib/email/send-email";
import { getOccurrenceCategoryLabel, getOccurrenceStatusLabel } from "@/lib/occurrences/labels";
import type { OccurrenceWithDetails } from "@/lib/occurrences/types";
import type { MembershipRole } from "@/types/database.types";

function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function logEmailFailure(context: string, error: string): void {
  console.error(`[email:occurrence:${context}] ${error}`);
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

async function getCondominiumMeta(
  condominiumId: string,
): Promise<{ slug: string; name: string } | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("condominiums")
      .select("slug, name")
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

async function emailsForProfileIds(profileIds: string[]): Promise<string[]> {
  const emails: string[] = [];
  for (const profileId of [...new Set(profileIds.filter(Boolean))]) {
    const email = await getProfileEmail(profileId);
    if (email) {
      emails.push(email);
    }
  }
  return [...new Set(emails)];
}

async function getManagerEmails(input: {
  condominiumId: string;
  roles: readonly MembershipRole[];
}): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data: memberships, error } = await admin
      .from("memberships")
      .select("profile_id")
      .eq("condominium_id", input.condominiumId)
      .in("role", [...input.roles]);

    if (error || !memberships?.length) {
      return [];
    }

    return emailsForProfileIds(memberships.map((row) => row.profile_id));
  } catch {
    return [];
  }
}

/** Super admin em qualquer condomínio + admin/super_admin da Granja. */
async function getGranjaOccurrenceNotifyEmails(
  granjaCondominiumId: string,
): Promise<string[]> {
  try {
    const admin = createAdminClient();

    const [{ data: granjaMemberships }, { data: superMemberships }] = await Promise.all([
      admin
        .from("memberships")
        .select("profile_id")
        .eq("condominium_id", granjaCondominiumId)
        .in("role", ["admin", "super_admin"]),
      admin.from("memberships").select("profile_id").eq("role", "super_admin"),
    ]);

    const profileIds = [
      ...(granjaMemberships ?? []).map((row) => row.profile_id),
      ...(superMemberships ?? []).map((row) => row.profile_id),
    ];

    return emailsForProfileIds(profileIds);
  } catch (error) {
    logEmailFailure(
      "granja-recipients",
      error instanceof Error ? error.message : "Falha ao buscar destinatários da Granja.",
    );
    return [];
  }
}

export async function notifyOccurrenceCreated(input: {
  occurrence: OccurrenceWithDetails;
  condoSlugForLink: string;
  isGranjaDestination: boolean;
  condominiumName: string;
}): Promise<boolean> {
  if (!isEmailConfigured()) {
    logEmailFailure("created", "E-mail não configurado (RESEND_API_KEY).");
    return false;
  }

  const emails = input.isGranjaDestination
    ? await getGranjaOccurrenceNotifyEmails(input.occurrence.condominium_id)
    : await getManagerEmails({
        condominiumId: input.occurrence.condominium_id,
        roles: ["syndic", "sub_syndic", "admin"],
      });

  if (emails.length === 0) {
    logEmailFailure(
      "created",
      input.isGranjaDestination
        ? "Nenhum e-mail de Super Admin/Admin da Granja encontrado."
        : "Nenhum e-mail de síndico/admin do condomínio encontrado.",
    );
    return false;
  }

  const link = `${getSiteUrl()}/app/${input.condoSlugForLink}/occurrences/${input.occurrence.id}`;
  const authorName = input.occurrence.author?.full_name ?? "Morador";
  const destinationLabel = input.isGranjaDestination
    ? BRAND_NAME
    : input.condominiumName;

  const bodyText = [
    `Olá,`,
    ``,
    `Foi registrada uma nova ocorrência em ${destinationLabel}.`,
    ``,
    `Título: ${input.occurrence.title}`,
    `Tipo: ${getOccurrenceCategoryLabel(input.occurrence.category)}`,
    `Registrado por: ${authorName}`,
    input.occurrence.location_text ? `Local: ${input.occurrence.location_text}` : null,
    input.occurrence.attachment_url
      ? `Anexo: ${input.occurrence.attachment_name ?? "arquivo"} (${input.occurrence.attachment_url})`
      : null,
    ``,
    `Descrição:`,
    input.occurrence.description,
    ``,
    `Acesse o sistema para analisar e responder.`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const result = await sendEmail({
    to: emails,
    subject: `Nova ocorrência — ${input.occurrence.title}`,
    text: bodyText,
    html: buildEmailLayout({
      preview: `Nova ocorrência: ${input.occurrence.title}`,
      title: "Nova ocorrência registrada",
      bodyHtml: textToHtmlParagraphs(bodyText),
      actionLabel: "Abrir ocorrência",
      actionUrl: link,
    }),
    tags: [{ name: "category", value: "occurrence" }],
  });

  if (!result.ok) {
    logEmailFailure("created", result.error);
  }

  return result.ok;
}

export async function notifyOccurrenceUpdatedToAuthor(input: {
  occurrence: OccurrenceWithDetails;
  condoSlugForLink: string;
  responderName: string;
}): Promise<boolean> {
  if (!isEmailConfigured()) {
    logEmailFailure("updated", "E-mail não configurado (RESEND_API_KEY).");
    return false;
  }

  const email = await getProfileEmail(input.occurrence.created_by);
  if (!email) {
    logEmailFailure("updated", "E-mail do reclamante não encontrado.");
    return false;
  }

  const link = `${getSiteUrl()}/app/${input.condoSlugForLink}/occurrences/${input.occurrence.id}`;
  const bodyText = [
    `Olá,`,
    ``,
    `Houve uma atualização na ocorrência "${input.occurrence.title}".`,
    ``,
    `Novo status: ${getOccurrenceStatusLabel(input.occurrence.status)}`,
    `Respondido por: ${input.responderName}`,
    input.occurrence.response_text
      ? `\nResposta:\n${input.occurrence.response_text}`
      : null,
    ``,
    `Acesse o sistema para ver os detalhes.`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const result = await sendEmail({
    to: [email],
    subject: `Atualização da ocorrência — ${input.occurrence.title}`,
    text: bodyText,
    html: buildEmailLayout({
      preview: `Sua ocorrência foi atualizada: ${getOccurrenceStatusLabel(input.occurrence.status)}`,
      title: "Atualização da ocorrência",
      bodyHtml: textToHtmlParagraphs(bodyText),
      actionLabel: "Ver ocorrência",
      actionUrl: link,
    }),
    tags: [{ name: "category", value: "occurrence" }],
  });

  if (!result.ok) {
    logEmailFailure("updated", result.error);
  }

  return result.ok;
}

export async function resolveOccurrenceCondominiumName(
  condominiumId: string,
): Promise<string> {
  const meta = await getCondominiumMeta(condominiumId);
  return meta?.name ?? "Condomínio";
}

export async function resolveOccurrenceCondoSlug(
  condominiumId: string,
): Promise<string | null> {
  const meta = await getCondominiumMeta(condominiumId);
  return meta?.slug ?? null;
}
