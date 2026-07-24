import { createAdminClient } from "@/lib/supabase/admin";
import { buildEmailLayout, textToHtmlParagraphs } from "@/lib/email/format";
import { isEmailConfigured, sendEmail } from "@/lib/email/send-email";
import { getReservationStatusLabel } from "@/lib/reservations/labels";
import type { ReservationNotificationEvent } from "@/lib/reservations/types";
import { formatUnitWithTower } from "@/lib/residents/labels";
import { formatDateTime } from "@/lib/utils";
import {
  getCondominiumsInDoormanBlock,
  getDoormanBlockForCondominium,
} from "@/lib/condominiums/doorman-blocks";
import type { CondominiumRecord } from "@/lib/services/condominiums-admin";

const ADMIN_NOTIFICATION_ROLES = ["syndic", "sub_syndic", "admin", "super_admin"] as const;

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

async function getAdminNotificationEmails(condominiumIds: string[]): Promise<string[]> {
  if (condominiumIds.length === 0) {
    return [];
  }

  try {
    const admin = createAdminClient();
    const uniqueCondoIds = [...new Set(condominiumIds)];
    const expandedIds = new Set(uniqueCondoIds);

    const { data: condominiums } = await admin.from("condominiums").select("id, slug, name");

    if (condominiums?.length) {
      for (const condominiumId of uniqueCondoIds) {
        const condominium = condominiums.find((entry) => entry.id === condominiumId);
        if (!condominium) continue;

        const block = getDoormanBlockForCondominium(condominium as CondominiumRecord);
        if (!block) continue;

        for (const entry of getCondominiumsInDoormanBlock(
          block,
          condominiums as CondominiumRecord[],
        )) {
          expandedIds.add(entry.id);
        }
      }
    }

    const { data: memberships, error } = await admin
      .from("memberships")
      .select("profile_id")
      .in("condominium_id", [...expandedIds])
      .in("role", ADMIN_NOTIFICATION_ROLES);

    if (error || !memberships?.length) {
      return [];
    }

    const emails: string[] = [];

    for (const membership of memberships) {
      const email = await getProfileEmail(membership.profile_id);
      if (email) {
        emails.push(email);
      }
    }

    return [...new Set(emails)];
  } catch {
    return [];
  }
}

async function loadReservationEmailContext(reservationId: string): Promise<{
  condominiumName: string;
  condoSlug: string | null;
  areaName: string;
  unitLabel: string;
  statusLabel: string;
  startLabel: string;
  endLabel: string;
  requesterName: string;
  requesterId: string | null;
  areaCondominiumId: string;
  unitCondominiumId: string;
} | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("reservations")
      .select(
        `
        id,
        status,
        start_at,
        end_at,
        requested_by,
        common_areas!inner (
          id,
          name,
          condominium_id,
          condominiums!inner (
            id,
            name,
            slug
          )
        ),
        units!inner (
          id,
          number,
          block,
          towers!inner (
            id,
            name,
            condominium_id
          )
        ),
        profiles!reservations_requested_by_fkey (
          id,
          full_name
        )
      `,
      )
      .eq("id", reservationId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const area = Array.isArray(data.common_areas) ? data.common_areas[0] : data.common_areas;
    const condo = area
      ? Array.isArray(area.condominiums)
        ? area.condominiums[0]
        : area.condominiums
      : null;
    const unit = Array.isArray(data.units) ? data.units[0] : data.units;
    const tower = unit ? (Array.isArray(unit.towers) ? unit.towers[0] : unit.towers) : null;
    const requester = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

    if (!area || !unit || !tower) {
      return null;
    }

    return {
      condominiumName: condo?.name ?? "Condomínio",
      condoSlug: condo?.slug ?? null,
      areaName: area.name,
      unitLabel: formatUnitWithTower({
        number: unit.number,
        block: unit.block,
        tower: { name: tower.name },
      }),
      statusLabel: getReservationStatusLabel(data.status),
      startLabel: formatDateTime(data.start_at),
      endLabel: formatDateTime(data.end_at),
      requesterName: requester?.full_name ?? "Morador",
      requesterId: data.requested_by,
      areaCondominiumId: area.condominium_id,
      unitCondominiumId: tower.condominium_id,
    };
  } catch {
    return null;
  }
}

function buildEventCopy(event: ReservationNotificationEvent): {
  subjectPrefix: string;
  title: string;
  summary: string;
} {
  switch (event.type) {
    case "reservation_created":
      return {
        subjectPrefix: "Nova reserva",
        title: "Nova solicitação de reserva",
        summary: "Uma nova reserva foi registrada e aguarda andamento.",
      };
    case "reservation_receipt_submitted":
      return {
        subjectPrefix: "Comprovante enviado",
        title: "Comprovante de reserva enviado",
        summary: "O comprovante de pagamento foi enviado e a reserva aguarda autorização.",
      };
    case "reservation_approved":
      return {
        subjectPrefix: "Reserva autorizada",
        title: "Reserva autorizada",
        summary: "A administração autorizou o uso do espaço comum.",
      };
    case "reservation_rejected":
      return {
        subjectPrefix: "Reserva rejeitada",
        title: "Reserva rejeitada",
        summary: "A reserva foi rejeitada pela administração.",
      };
    case "reservation_cancelled":
      return {
        subjectPrefix: "Reserva cancelada",
        title: "Reserva cancelada",
        summary: "A reserva foi cancelada.",
      };
    case "reservation_rescheduled":
      return {
        subjectPrefix: "Reserva reagendada",
        title: "Reserva reagendada",
        summary: "A data/horário da reserva foi alterado. Houve movimentação no andamento.",
      };
  }
}

export async function sendReservationMovementNotification(
  event: ReservationNotificationEvent,
): Promise<boolean> {
  if (!isEmailConfigured()) {
    return false;
  }

  const context = await loadReservationEmailContext(event.reservationId);
  if (!context) {
    return false;
  }

  const copy = buildEventCopy(event);
  const link = context.condoSlug
    ? `${getSiteUrl()}/app/${context.condoSlug}/reservations/${event.reservationId}`
    : getSiteUrl();

  const text = [
    "Olá,",
    "",
    copy.summary,
    "",
    `Espaço: ${context.areaName}`,
    `Unidade: ${context.unitLabel}`,
    `Solicitante: ${context.requesterName}`,
    `Status: ${context.statusLabel}`,
    `Início: ${context.startLabel}`,
    `Fim: ${context.endLabel}`,
    "",
    "Acesse o sistema para acompanhar o andamento.",
  ].join("\n");

  const subject = `${copy.subjectPrefix} — ${context.areaName} (${context.condominiumName})`;

  const recipientEmails = new Set<string>();

  if (context.requesterId) {
    const requesterEmail = await getProfileEmail(context.requesterId);
    if (requesterEmail) {
      recipientEmails.add(requesterEmail);
    }
  }

  const adminEmails = await getAdminNotificationEmails([
    event.condominiumId,
    context.areaCondominiumId,
    context.unitCondominiumId,
  ]);

  for (const email of adminEmails) {
    recipientEmails.add(email);
  }

  if (recipientEmails.size === 0) {
    return false;
  }

  let sent = false;

  for (const email of recipientEmails) {
    const result = await sendEmail({
      to: [email],
      subject,
      text,
      html: buildEmailLayout({
        preview: subject,
        title: copy.title,
        bodyHtml: textToHtmlParagraphs(text),
        actionLabel: "Ver reserva",
        actionUrl: link,
      }),
      tags: [{ name: "category", value: "reservation" }],
    });

    sent = sent || result.ok;
  }

  return sent;
}
