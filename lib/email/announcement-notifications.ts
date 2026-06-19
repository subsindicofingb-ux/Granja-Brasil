import { createAdminClient } from "@/lib/supabase/admin";
import { getGranjaCondominiumId } from "@/lib/condominiums/granja-shared-areas";
import { sendEmail } from "@/lib/email/send-email";
import type { AnnouncementWithDetails } from "@/lib/announcements/types";

const STAFF_ROLES = ["super_admin", "admin", "syndic"] as const;

function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

async function getProfileEmails(profileIds: string[]): Promise<string[]> {
  if (profileIds.length === 0) {
    return [];
  }

  const admin = createAdminClient();
  const emails: string[] = [];

  for (const profileId of [...new Set(profileIds)]) {
    const { data, error } = await admin.auth.admin.getUserById(profileId);

    if (!error && data.user?.email) {
      emails.push(data.user.email);
    }
  }

  return emails;
}

async function getStaffProfileIdsForCondominium(condominiumId: string): Promise<string[]> {
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
}

async function getCondominiumSlug(condominiumId: string): Promise<string | null> {
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
}

async function resolveNotificationContext(announcement: AnnouncementWithDetails): Promise<{
  condoSlug: string;
  recipientProfileIds: string[];
}> {
  const granjaCondominiumId = await getGranjaCondominiumId();
  const isGranjaMessage =
    granjaCondominiumId !== null && announcement.condominium_id === granjaCondominiumId;

  if (isGranjaMessage && announcement.target_condominium_id) {
    const [granjaStaff, localStaff, slug] = await Promise.all([
      getStaffProfileIdsForCondominium(granjaCondominiumId),
      getStaffProfileIdsForCondominium(announcement.target_condominium_id),
      getCondominiumSlug(announcement.target_condominium_id),
    ]);

    return {
      condoSlug: slug ?? "residencial-exemplo",
      recipientProfileIds: [...granjaStaff, ...localStaff],
    };
  }

  const slug = await getCondominiumSlug(announcement.condominium_id);
  const staff = await getStaffProfileIdsForCondominium(announcement.condominium_id);

  return {
    condoSlug: slug ?? "residencial-exemplo",
    recipientProfileIds: staff,
  };
}

function buildAnnouncementLink(condoSlug: string, announcementId: string): string {
  return `${getSiteUrl()}/app/${condoSlug}/announcements/${announcementId}`;
}

export async function notifyAnnouncementCreated(input: {
  announcement: AnnouncementWithDetails;
  senderProfileId: string;
}): Promise<void> {
  const { announcement, senderProfileId } = input;

  if (announcement.staff_only) {
    const { condoSlug, recipientProfileIds } = await resolveNotificationContext(announcement);
    const recipients = recipientProfileIds.filter((profileId) => profileId !== senderProfileId);
    const emails = await getProfileEmails(recipients);

    if (emails.length === 0) {
      return;
    }

    const link = buildAnnouncementLink(condoSlug, announcement.id);

    await sendEmail({
      to: emails,
      subject: `Nova mensagem: ${announcement.title}`,
      text: `Você recebeu uma nova mensagem no condomínio.\n\nAssunto: ${announcement.title}\n\n${announcement.body}\n\nAbrir: ${link}`,
      html: `
        <p>Você recebeu uma nova mensagem no condomínio.</p>
        <p><strong>Assunto:</strong> ${announcement.title}</p>
        <p>${announcement.body.replace(/\n/g, "<br />")}</p>
        <p><a href="${link}">Abrir mensagem</a></p>
      `,
    });

    return;
  }

  const condoSlug = (await getCondominiumSlug(announcement.condominium_id)) ?? "residencial-exemplo";
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
    const admin = createAdminClient();
    const residentCondoId = announcement.target_condominium_id ?? announcement.condominium_id;
    const { data } = await admin
      .from("memberships")
      .select("profile_id")
      .eq("condominium_id", residentCondoId)
      .eq("role", "resident");

    recipientProfileIds.push(...(data?.map((row) => row.profile_id) ?? []));
  }

  const emails = await getProfileEmails(
    recipientProfileIds.filter((profileId) => profileId !== senderProfileId),
  );

  if (emails.length === 0) {
    return;
  }

  const link = buildAnnouncementLink(condoSlug, announcement.id);

  await sendEmail({
    to: emails,
    subject: `Novo aviso: ${announcement.title}`,
    text: `Novo aviso publicado no condomínio.\n\n${announcement.title}\n\n${announcement.body}\n\nAbrir: ${link}`,
    html: `
      <p>Novo aviso publicado no condomínio.</p>
      <p><strong>${announcement.title}</strong></p>
      <p>${announcement.body.replace(/\n/g, "<br />")}</p>
      <p><a href="${link}">Abrir aviso</a></p>
    `,
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
    const { recipientProfileIds: staffIds } = await resolveNotificationContext(rootAnnouncement);
    recipientProfileIds.push(...staffIds);
  }

  const emails = await getProfileEmails(
    [...new Set(recipientProfileIds)].filter((profileId) => profileId !== senderProfileId),
  );

  if (emails.length === 0) {
    return;
  }

  const condoSlug =
    (await getCondominiumSlug(
      rootAnnouncement.target_condominium_id ?? rootAnnouncement.condominium_id,
    )) ?? "residencial-exemplo";
  const link = buildAnnouncementLink(condoSlug, rootAnnouncement.id);

  await sendEmail({
    to: emails,
    subject: `Nova resposta: ${rootAnnouncement.title}`,
    text: `${senderName} respondeu a "${rootAnnouncement.title}".\n\n${replyBody}\n\nAbrir: ${link}`,
    html: `
      <p><strong>${senderName}</strong> respondeu a "${rootAnnouncement.title}".</p>
      <p>${replyBody.replace(/\n/g, "<br />")}</p>
      <p><a href="${link}">Abrir conversa</a></p>
    `,
  });
}
