import { createAdminClient } from "@/lib/supabase/admin";
import { getGranjaCondoSlug } from "@/lib/constants";
import { getGranjaCondominiumId } from "@/lib/condominiums/granja-shared-areas";
import {
  buildEmailLayout,
  textToHtmlParagraphs,
} from "@/lib/email/format";
import { isEmailConfigured, sendEmail } from "@/lib/email/send-email";
import type { AnnouncementWithDetails } from "@/lib/announcements/types";

const STAFF_ROLES = ["super_admin", "admin", "syndic", "sub_syndic"] as const;

function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function logEmailFailure(context: string, error: string): void {
  console.error(`[email:${context}] ${error}`);
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

async function getStaffProfileIdsForCondominium(condominiumId: string): Promise<string[]> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("memberships")
      .select("profile_id")
      .eq("condominium_id", condominiumId)
      .in("role", STAFF_ROLES);

    if (error || !data) {
      return [];
    }

    return data.map((row) => row.profile_id);
  } catch (error) {
    logEmailFailure(
      "staff",
      error instanceof Error ? error.message : "Falha ao buscar equipe do condomínio.",
    );
    return [];
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

async function getPreferredCondoSlugForProfile(profileId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const granjaCondominiumId = await getGranjaCondominiumId();

    const { data, error } = await admin
      .from("memberships")
      .select("condominium_id, role, condominiums!inner(slug)")
      .eq("profile_id", profileId);

    if (error || !data || data.length === 0) {
      return null;
    }

    const granjaMembership = data.find(
      (row) => granjaCondominiumId && row.condominium_id === granjaCondominiumId,
    );
    if (granjaMembership?.condominiums?.slug) {
      return granjaMembership.condominiums.slug;
    }

    const staffMembership = data.find((row) =>
      STAFF_ROLES.includes(row.role as (typeof STAFF_ROLES)[number]),
    );
    if (staffMembership?.condominiums?.slug) {
      return staffMembership.condominiums.slug;
    }

    return data[0]?.condominiums?.slug ?? null;
  } catch {
    return null;
  }
}

function buildAnnouncementLink(condoSlug: string, announcementId: string): string {
  return `${getSiteUrl()}/app/${condoSlug}/announcements/${announcementId}`;
}

async function resolveFallbackSlug(announcement: AnnouncementWithDetails): Promise<string> {
  const granjaCondominiumId = await getGranjaCondominiumId();
  const isGranjaMessage =
    granjaCondominiumId !== null && announcement.condominium_id === granjaCondominiumId;

  if (isGranjaMessage && announcement.target_condominium_id) {
    return (
      (await getCondominiumSlug(announcement.target_condominium_id)) ??
      getGranjaCondoSlug()
    );
  }

  return (await getCondominiumSlug(announcement.condominium_id)) ?? getGranjaCondoSlug();
}

async function resolveStaffRecipients(
  announcement: AnnouncementWithDetails,
): Promise<string[]> {
  const granjaCondominiumId = await getGranjaCondominiumId();
  const isGranjaMessage =
    granjaCondominiumId !== null && announcement.condominium_id === granjaCondominiumId;

  if (isGranjaMessage && announcement.target_condominium_id) {
    const [granjaStaff, localStaff] = await Promise.all([
      getStaffProfileIdsForCondominium(granjaCondominiumId),
      getStaffProfileIdsForCondominium(announcement.target_condominium_id),
    ]);

    return [...new Set([...granjaStaff, ...localStaff])];
  }

  return getStaffProfileIdsForCondominium(announcement.condominium_id);
}

async function sendAnnouncementEmailToProfiles(input: {
  profileIds: string[];
  excludeProfileId: string;
  fallbackCondoSlug: string;
  subject: string;
  preview: string;
  title: string;
  bodyText: string;
  actionLabel: string;
  announcementId: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    logEmailFailure("config", "RESEND_API_KEY não configurada.");
    return;
  }

  const recipients = [...new Set(input.profileIds)].filter(
    (profileId) => profileId !== input.excludeProfileId,
  );

  if (recipients.length === 0) {
    logEmailFailure("recipients", "Nenhum destinatário para notificar.");
    return;
  }

  let sentCount = 0;

  for (const profileId of recipients) {
    const email = await getProfileEmail(profileId);
    if (!email) {
      continue;
    }

    const condoSlug =
      (await getPreferredCondoSlugForProfile(profileId)) ?? input.fallbackCondoSlug;
    const link = buildAnnouncementLink(condoSlug, input.announcementId);
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
      tags: [{ name: "category", value: "announcement" }],
    });

    if (!result.ok) {
      logEmailFailure("send", result.error);
    } else {
      sentCount += 1;
    }
  }

  if (sentCount === 0) {
    logEmailFailure("send", "Nenhum e-mail foi enviado para os destinatários encontrados.");
  }
}

export async function notifyAnnouncementCreated(input: {
  announcement: AnnouncementWithDetails;
  senderProfileId: string;
}): Promise<void> {
  const { announcement, senderProfileId } = input;
  const fallbackCondoSlug = await resolveFallbackSlug(announcement);

  if (announcement.staff_only) {
    const recipientProfileIds = await resolveStaffRecipients(announcement);

    await sendAnnouncementEmailToProfiles({
      profileIds: recipientProfileIds,
      excludeProfileId: senderProfileId,
      fallbackCondoSlug,
      announcementId: announcement.id,
      subject: `Nova mensagem: ${announcement.title}`,
      preview: "Nova mensagem recebida no condomínio.",
      title: "Nova mensagem",
      bodyText: `Assunto: ${announcement.title}\n\n${announcement.body}`,
      actionLabel: "Abrir mensagem",
    });

    return;
  }

  const granjaCondominiumId = await getGranjaCondominiumId();
  const isGranjaBroadcast =
    granjaCondominiumId !== null &&
    announcement.condominium_id === granjaCondominiumId &&
    !announcement.target_condominium_id &&
    !announcement.target_profile_id;

  if (isGranjaBroadcast) {
    return;
  }

  const recipientProfileIds: string[] = [];

  if (announcement.target_profile_id) {
    recipientProfileIds.push(announcement.target_profile_id);
  } else {
    try {
      const admin = createAdminClient();
      const residentCondoId = announcement.target_condominium_id ?? announcement.condominium_id;
      const { data } = await admin
        .from("memberships")
        .select("profile_id")
        .eq("condominium_id", residentCondoId)
        .eq("role", "resident");

      recipientProfileIds.push(...(data?.map((row) => row.profile_id) ?? []));
    } catch (error) {
      logEmailFailure(
        "residents",
        error instanceof Error ? error.message : "Falha ao buscar moradores.",
      );
    }
  }

  await sendAnnouncementEmailToProfiles({
    profileIds: recipientProfileIds,
    excludeProfileId: senderProfileId,
    fallbackCondoSlug,
    announcementId: announcement.id,
    subject: `Novo aviso: ${announcement.title}`,
    preview: "Novo aviso publicado no condomínio.",
    title: announcement.title,
    bodyText: announcement.body,
    actionLabel: "Abrir aviso",
  });
}

export async function notifyAnnouncementReply(input: {
  rootAnnouncement: AnnouncementWithDetails;
  replyBody: string;
  senderProfileId: string;
  senderName: string;
}): Promise<void> {
  const { rootAnnouncement, replyBody, senderProfileId, senderName } = input;
  const recipientProfileIds: string[] = [];

  if (rootAnnouncement.created_by && rootAnnouncement.created_by !== senderProfileId) {
    recipientProfileIds.push(rootAnnouncement.created_by);
  }

  if (rootAnnouncement.staff_only) {
    recipientProfileIds.push(...(await resolveStaffRecipients(rootAnnouncement)));
  }

  const fallbackCondoSlug = await resolveFallbackSlug(rootAnnouncement);

  await sendAnnouncementEmailToProfiles({
    profileIds: [...new Set(recipientProfileIds)],
    excludeProfileId: senderProfileId,
    fallbackCondoSlug,
    announcementId: rootAnnouncement.id,
    subject: `Nova resposta: ${rootAnnouncement.title}`,
    preview: `${senderName} respondeu uma conversa.`,
    title: "Nova resposta",
    bodyText: `${senderName} respondeu "${rootAnnouncement.title}":\n\n${replyBody}`,
    actionLabel: "Abrir conversa",
  });
}
