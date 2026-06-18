"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoAccess, requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import type { CondominiumContext } from "@/lib/condominiums/granja-shared-areas";
import {
  approveReservation,
  cancelReservation,
  createReservation,
  getReservationByIdForContext,
  listUnitIdsForProfile,
  rejectReservation,
  submitReservationReceipt,
} from "@/lib/services/reservations";
import { uploadCondoImage } from "@/lib/storage/upload-image";
import { parseReservationFormData } from "@/lib/validations/reservation.schema";

function toBookingContext(input: { id: string; slug: string }): CondominiumContext {
  return {
    condominiumId: input.id,
    condominiumSlug: input.slug,
  };
}

function revalidateReservationPaths(condoSlug: string, reservationId?: string) {
  revalidatePath(`/app/${condoSlug}/reservations`);
  if (reservationId) {
    revalidatePath(`/app/${condoSlug}/reservations/${reservationId}`);
  }
}

async function assertCanBookForUnit(
  condoSlug: string,
  unitId: string,
  isStaff: boolean,
  profileId: string,
  condominiumId: string,
): Promise<AuthActionState | null> {
  if (isStaff) {
    return null;
  }

  const unitsResult = await listUnitIdsForProfile(profileId, condominiumId);

  if (!unitsResult.ok) {
    return { error: unitsResult.error };
  }

  if (!unitsResult.data.includes(unitId)) {
    return { error: "Você só pode reservar para suas unidades." };
  }

  return null;
}

export async function createReservationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canManageReservations) {
    return { error: "Sem permissão para criar reservas." };
  }

  const parsed = parseReservationFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const isStaff = access.permissions.canApproveReservations;
  const isResidentForm = String(formData.get("form_mode") ?? "staff") === "resident";

  const unitCheck = await assertCanBookForUnit(
    condoSlug,
    parsed.data.unit_id,
    isStaff,
    access.profile.id,
    access.condominium.id,
  );

  if (unitCheck?.error) {
    return unitCheck;
  }

  const result = await createReservation({
    condominiumId: access.condominium.id,
    commonAreaId: parsed.data.common_area_id,
    unitId: parsed.data.unit_id,
    startAt: parsed.data.start_at,
    endAt: parsed.data.end_at,
    notes: parsed.data.notes,
    guestCount: parsed.data.guest_count,
    enforceGuestCount: isResidentForm,
    requestedBy: access.profile.id,
    bookingContext: toBookingContext(access.condominium),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateReservationPaths(condoSlug, result.data.id);
  redirect(`/app/${condoSlug}/reservations/${result.data.id}`);
}

export async function approveReservationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const reservationId = String(formData.get("reservation_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canApproveReservations,
    { redirectTo: `/app/${condoSlug}/reservations/${reservationId}` },
  );

  const bookingContext = toBookingContext(access.condominium);
  const result = await approveReservation(
    reservationId,
    access.condominium.id,
    bookingContext,
  );

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateReservationPaths(condoSlug, reservationId);
  return { success: "Reserva aprovada com sucesso." };
}

export async function rejectReservationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const reservationId = String(formData.get("reservation_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canApproveReservations,
    { redirectTo: `/app/${condoSlug}/reservations/${reservationId}` },
  );

  const bookingContext = toBookingContext(access.condominium);
  const result = await rejectReservation(
    reservationId,
    access.condominium.id,
    bookingContext,
  );

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateReservationPaths(condoSlug, reservationId);
  return { success: "Reserva rejeitada." };
}

export async function cancelReservationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const reservationId = String(formData.get("reservation_id") ?? "");

  const access = await requireCondoAccess(condoSlug);
  const isStaff = access.permissions.canApproveReservations;

  if (!isStaff && !access.permissions.canManageReservations) {
    redirect(`/app/${condoSlug}/reservations/${reservationId}`);
  }

  if (!isStaff) {
    const current = await getReservationByIdForContext(
      reservationId,
      toBookingContext(access.condominium),
    );

    if (!current.ok) {
      return { error: current.error };
    }

    const unitsResult = await listUnitIdsForProfile(
      access.profile.id,
      access.condominium.id,
    );

    if (!unitsResult.ok) {
      return { error: unitsResult.error };
    }

    if (!unitsResult.data.includes(current.data.unit_id)) {
      return { error: "Você só pode cancelar reservas das suas unidades." };
    }
  }

  const result = await cancelReservation(
    reservationId,
    access.condominium.id,
    toBookingContext(access.condominium),
  );

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateReservationPaths(condoSlug, reservationId);
  return { success: "Reserva cancelada." };
}

export async function submitReservationReceiptAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const reservationId = String(formData.get("reservation_id") ?? "");
  const receipt = formData.get("receipt");

  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canManageReservations) {
    return { error: "Sem permissão para enviar recibo." };
  }

  const current = await getReservationByIdForContext(
    reservationId,
    toBookingContext(access.condominium),
  );

  if (!current.ok) {
    return { error: current.error };
  }

  if (current.data.status !== "awaiting_receipt") {
    return { error: "Esta reserva não está aguardando recibo." };
  }

  const isStaff = access.permissions.canApproveReservations;

  if (!isStaff) {
    const unitsResult = await listUnitIdsForProfile(
      access.profile.id,
      access.condominium.id,
    );

    if (!unitsResult.ok) {
      return { error: unitsResult.error };
    }

    if (!unitsResult.data.includes(current.data.unit_id)) {
      return { error: "Você só pode enviar recibo das suas reservas." };
    }
  }

  const uploadResult = await uploadCondoImage({
    condominiumId: current.data.common_area.condominium_id,
    folder: "reservations",
    file: receipt instanceof File ? receipt : null,
  });

  if (!uploadResult.ok) {
    return { error: uploadResult.error };
  }

  if (!uploadResult.data) {
    return { error: "Selecione o arquivo do recibo." };
  }

  const result = await submitReservationReceipt({
    reservationId,
    bookingContext: toBookingContext(access.condominium),
    receiptUrl: uploadResult.data,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateReservationPaths(condoSlug, reservationId);
  return {
    success:
      "Recibo enviado com sucesso. Aguarde a autorização do administrador da Granja.",
  };
}
