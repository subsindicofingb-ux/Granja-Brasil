import { createClient } from "@/lib/supabase/server";
import type { ReservationStatus } from "@/lib/constants";
import {
  getBookableCommonAreaById,
  getCommonAreaById,
} from "@/lib/services/common-areas";
import {
  getGranjaCondominiumId,
  isEligibleForGranjaSharedCommonAreas,
  type CondominiumContext,
} from "@/lib/condominiums/granja-shared-areas";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";
import { notifyReservationEvent } from "@/lib/reservations/notifications";
import type {
  ReservationRecord,
  ReservationWithDetails,
} from "@/lib/reservations/types";
import {
  canApproveReservation,
  canCancelReservation,
  canRejectReservation,
  resolveInitialReservationStatus,
  validateBooking,
} from "@/lib/reservations/validate-booking";

type ReservationRow = ReservationRecord;

type ReservationDetailRow = ReservationRow & {
  common_areas: {
    id: string;
    name: string;
    requires_approval: boolean;
    condominium_id: string;
  };
  units: {
    id: string;
    number: string;
    block: string | null;
    towers: {
      id: string;
      name: string;
      condominium_id: string;
    };
  };
  profiles: {
    id: string;
    full_name: string;
  } | null;
};

const RESERVATION_SELECT = `
  id,
  common_area_id,
  unit_id,
  requested_by,
  start_at,
  end_at,
  status,
  notes,
  created_at,
  updated_at
`;

const RESERVATION_DETAIL_SELECT = `
  ${RESERVATION_SELECT},
  common_areas!inner (
    id,
    name,
    requires_approval,
    condominium_id
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
  profiles (
    id,
    full_name
  )
`;

function mapReservation(row: ReservationRow): ReservationRecord {
  return {
    id: row.id,
    common_area_id: row.common_area_id,
    unit_id: row.unit_id,
    requested_by: row.requested_by,
    start_at: row.start_at,
    end_at: row.end_at,
    status: row.status,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapReservationDetail(row: ReservationDetailRow): ReservationWithDetails {
  return {
    ...mapReservation(row),
    common_area: {
      id: row.common_areas.id,
      name: row.common_areas.name,
      requires_approval: row.common_areas.requires_approval,
    },
    unit: {
      id: row.units.id,
      number: row.units.number,
      block: row.units.block,
      tower: row.units.towers,
    },
    requester: row.profiles
      ? { id: row.profiles.id, full_name: row.profiles.full_name }
      : null,
  };
}

export type ReservationListOptions = {
  commonAreaId?: string;
  unitId?: string;
  unitIds?: string[];
  unitCondominiumId?: string;
  status?: ReservationStatus | "all";
  from?: string;
  to?: string;
};

export async function listReservationsByCondominium(
  condominiumId: string,
  options?: ReservationListOptions,
): Promise<ServiceResult<ReservationWithDetails[]>> {
  const supabase = await createClient();

  let query = supabase
    .from("reservations")
    .select(RESERVATION_DETAIL_SELECT)
    .eq("common_areas.condominium_id", condominiumId)
    .order("start_at", { ascending: true });

  if (options?.commonAreaId) {
    query = query.eq("common_area_id", options.commonAreaId);
  }

  if (options?.unitId) {
    query = query.eq("unit_id", options.unitId);
  } else if (options?.unitIds) {
    query = query.in("unit_id", options.unitIds);
  }

  if (options?.unitCondominiumId) {
    query = query.eq("units.towers.condominium_id", options.unitCondominiumId);
  }

  if (options?.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  if (options?.from) {
    query = query.gte("start_at", options.from);
  }

  if (options?.to) {
    query = query.lte("start_at", options.to);
  }

  const { data, error } = await query;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(((data as ReservationDetailRow[] | null) ?? []).map(mapReservationDetail));
}

function mergeReservations(
  primary: ReservationWithDetails[],
  secondary: ReservationWithDetails[],
): ReservationWithDetails[] {
  const byId = new Map<string, ReservationWithDetails>();

  for (const reservation of primary) {
    byId.set(reservation.id, reservation);
  }

  for (const reservation of secondary) {
    byId.set(reservation.id, reservation);
  }

  return Array.from(byId.values()).sort((left, right) =>
    left.start_at.localeCompare(right.start_at),
  );
}

export async function listReservationsForContext(
  context: CondominiumContext,
  options?: ReservationListOptions,
): Promise<ServiceResult<ReservationWithDetails[]>> {
  const ownResult = await listReservationsByCondominium(context.condominiumId, options);

  if (!ownResult.ok) {
    return ownResult;
  }

  if (!(await isEligibleForGranjaSharedCommonAreas(context))) {
    return ownResult;
  }

  const granjaCondominiumId = await getGranjaCondominiumId();

  if (!granjaCondominiumId || granjaCondominiumId === context.condominiumId) {
    return ownResult;
  }

  const granjaResult = await listReservationsByCondominium(granjaCondominiumId, {
    ...options,
    unitCondominiumId: context.condominiumId,
  });

  if (!granjaResult.ok) {
    return ownResult;
  }

  return serviceOk(mergeReservations(ownResult.data, granjaResult.data));
}

export async function listUpcomingReservationsByCondominium(
  condominiumId: string,
  limit = 5,
  options?: Pick<ReservationListOptions, "unitId" | "unitIds">,
): Promise<ServiceResult<ReservationWithDetails[]>> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("reservations")
    .select(RESERVATION_DETAIL_SELECT)
    .eq("common_areas.condominium_id", condominiumId)
    .gte("start_at", now)
    .in("status", ["pending", "approved"])
    .order("start_at", { ascending: true })
    .limit(limit);

  if (options?.unitId) {
    query = query.eq("unit_id", options.unitId);
  } else if (options?.unitIds) {
    query = query.in("unit_id", options.unitIds);
  }

  const { data, error } = await query;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(((data as ReservationDetailRow[] | null) ?? []).map(mapReservationDetail));
}

export async function listRecentReservationsByCondominium(
  condominiumId: string,
  limit = 5,
  options?: Pick<ReservationListOptions, "unitId" | "unitIds">,
): Promise<ServiceResult<ReservationWithDetails[]>> {
  const supabase = await createClient();

  let query = supabase
    .from("reservations")
    .select(RESERVATION_DETAIL_SELECT)
    .eq("common_areas.condominium_id", condominiumId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.unitId) {
    query = query.eq("unit_id", options.unitId);
  } else if (options?.unitIds) {
    query = query.in("unit_id", options.unitIds);
  }

  const { data, error } = await query;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(((data as ReservationDetailRow[] | null) ?? []).map(mapReservationDetail));
}

export async function countReservationsByStatusForCondominium(
  condominiumId: string,
  options?: Pick<ReservationListOptions, "unitId" | "unitIds">,
): Promise<ServiceResult<Record<ReservationStatus, number>>> {
  const supabase = await createClient();
  const statuses: ReservationStatus[] = ["pending", "approved", "rejected", "cancelled"];
  const counts = Object.fromEntries(
    statuses.map((status) => [status, 0]),
  ) as Record<ReservationStatus, number>;

  const results = await Promise.all(
    statuses.map(async (status) => {
      let query = supabase
        .from("reservations")
        .select("id, common_areas!inner(condominium_id)", { count: "exact", head: true })
        .eq("common_areas.condominium_id", condominiumId)
        .eq("status", status);

      if (options?.unitId) {
        query = query.eq("unit_id", options.unitId);
      } else if (options?.unitIds) {
        query = query.in("unit_id", options.unitIds);
      }

      const { count, error } = await query;

      return { status, count, error };
    }),
  );

  for (const result of results) {
    if (result.error) {
      return serviceError(mapSupabaseError(result.error));
    }
    counts[result.status] = result.count ?? 0;
  }

  return serviceOk(counts);
}

export async function listReservationsForArea(
  commonAreaId: string,
  condominiumId: string,
  range: { from: string; to: string },
): Promise<ServiceResult<ReservationWithDetails[]>> {
  return listReservationsByCondominium(condominiumId, {
    commonAreaId,
    from: range.from,
    to: range.to,
    status: "all",
  });
}

export async function listBlockingReservationsForArea(
  commonAreaId: string,
): Promise<ServiceResult<ReservationRecord[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("common_area_id", commonAreaId)
    .in("status", ["pending", "approved"]);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(((data as ReservationRow[] | null) ?? []).map(mapReservation));
}

export async function getReservationById(
  reservationId: string,
  condominiumId: string,
): Promise<ServiceResult<ReservationWithDetails>> {
  return getReservationByIdForContext(reservationId, {
    condominiumId,
    condominiumSlug: "",
  });
}

export async function getReservationByIdForContext(
  reservationId: string,
  context: CondominiumContext,
): Promise<ServiceResult<ReservationWithDetails>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_DETAIL_SELECT)
    .eq("id", reservationId)
    .eq("common_areas.condominium_id", context.condominiumId)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (data) {
    return serviceOk(mapReservationDetail(data as ReservationDetailRow));
  }

  if (!(await isEligibleForGranjaSharedCommonAreas(context))) {
    return serviceError("Reserva não encontrada neste condomínio.");
  }

  const granjaCondominiumId = await getGranjaCondominiumId();

  if (!granjaCondominiumId || granjaCondominiumId === context.condominiumId) {
    return serviceError("Reserva não encontrada neste condomínio.");
  }

  const { data: granjaReservation, error: granjaError } = await supabase
    .from("reservations")
    .select(RESERVATION_DETAIL_SELECT)
    .eq("id", reservationId)
    .eq("common_areas.condominium_id", granjaCondominiumId)
    .eq("units.towers.condominium_id", context.condominiumId)
    .maybeSingle();

  if (granjaError) {
    return serviceError(mapSupabaseError(granjaError));
  }

  if (!granjaReservation) {
    return serviceError("Reserva não encontrada neste condomínio.");
  }

  return serviceOk(mapReservationDetail(granjaReservation as ReservationDetailRow));
}

export async function listUnitIdsForProfile(
  profileId: string,
  condominiumId: string,
): Promise<ServiceResult<string[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("residents")
    .select(
      `
      unit_id,
      units!inner (
        towers!inner (
          condominium_id
        )
      )
    `,
    )
    .eq("profile_id", profileId)
    .eq("units.towers.condominium_id", condominiumId);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const unitIds = [...new Set((data ?? []).map((row) => row.unit_id as string))];
  return serviceOk(unitIds);
}

export async function createReservation(input: {
  condominiumId: string;
  commonAreaId: string;
  unitId: string;
  startAt: string;
  endAt: string;
  notes: string | null;
  requestedBy: string | null;
  bookingContext?: CondominiumContext;
}): Promise<ServiceResult<ReservationWithDetails>> {
  const areaResult = input.bookingContext
    ? await getBookableCommonAreaById(input.commonAreaId, input.bookingContext)
    : await getCommonAreaById(input.commonAreaId, input.condominiumId);

  if (!areaResult.ok) {
    return serviceError(areaResult.error);
  }

  const area = areaResult.data;
  const notificationCondominiumId = area.condominium_id;
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  const blockingResult = await listBlockingReservationsForArea(input.commonAreaId);

  if (!blockingResult.ok) {
    return serviceError(blockingResult.error);
  }

  const validation = validateBooking({
    area,
    unitId: input.unitId,
    startAt,
    endAt,
    existingReservations: blockingResult.data,
  });

  if (!validation.valid) {
    return serviceError(validation.error);
  }

  const status = resolveInitialReservationStatus(area);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      common_area_id: input.commonAreaId,
      unit_id: input.unitId,
      requested_by: input.requestedBy,
      start_at: input.startAt,
      end_at: input.endAt,
      notes: input.notes,
      status,
    })
    .select(RESERVATION_DETAIL_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const reservation = mapReservationDetail(data as ReservationDetailRow);

  await notifyReservationEvent({
    type: "reservation_created",
    reservationId: reservation.id,
    condominiumId: notificationCondominiumId,
  });

  return serviceOk(reservation);
}

async function updateReservationStatus(input: {
  reservationId: string;
  condominiumId: string;
  status: ReservationStatus;
  notificationType: "reservation_approved" | "reservation_rejected" | "reservation_cancelled";
  validate?: (reservation: ReservationWithDetails) => string | null;
  bookingContext?: CondominiumContext;
}): Promise<ServiceResult<ReservationWithDetails>> {
  const context = input.bookingContext ?? {
    condominiumId: input.condominiumId,
    condominiumSlug: "",
  };
  const current = await getReservationByIdForContext(input.reservationId, context);

  if (!current.ok) {
    return serviceError(current.error);
  }

  const areaResult = await getBookableCommonAreaById(current.data.common_area_id, context);
  const notificationCondominiumId = areaResult.ok
    ? areaResult.data.condominium_id
    : input.condominiumId;

  if (input.validate) {
    const validationError = input.validate(current.data);
    if (validationError) {
      return serviceError(validationError);
    }
  }

  if (input.status === "approved") {
    if (!areaResult.ok) {
      return serviceError(areaResult.error);
    }

    const blockingResult = await listBlockingReservationsForArea(current.data.common_area_id);

    if (!blockingResult.ok) {
      return serviceError(blockingResult.error);
    }

    const validation = validateBooking({
      area: areaResult.data,
      unitId: current.data.unit_id,
      startAt: new Date(current.data.start_at),
      endAt: new Date(current.data.end_at),
      existingReservations: blockingResult.data,
      excludeReservationId: input.reservationId,
    });

    if (!validation.valid) {
      return serviceError(validation.error);
    }
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .update({ status: input.status })
    .eq("id", input.reservationId)
    .select(RESERVATION_DETAIL_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const reservation = mapReservationDetail(data as ReservationDetailRow);

  await notifyReservationEvent({
    type: input.notificationType,
    reservationId: reservation.id,
    condominiumId: notificationCondominiumId,
  });

  return serviceOk(reservation);
}

export async function approveReservation(
  reservationId: string,
  condominiumId: string,
  bookingContext?: CondominiumContext,
): Promise<ServiceResult<ReservationWithDetails>> {
  return updateReservationStatus({
    reservationId,
    condominiumId,
    bookingContext,
    status: "approved",
    notificationType: "reservation_approved",
    validate: (reservation) =>
      canApproveReservation(reservation.status)
        ? null
        : "Somente reservas pendentes podem ser aprovadas.",
  });
}

export async function rejectReservation(
  reservationId: string,
  condominiumId: string,
  bookingContext?: CondominiumContext,
): Promise<ServiceResult<ReservationWithDetails>> {
  return updateReservationStatus({
    reservationId,
    condominiumId,
    bookingContext,
    status: "rejected",
    notificationType: "reservation_rejected",
    validate: (reservation) =>
      canRejectReservation(reservation.status)
        ? null
        : "Somente reservas pendentes podem ser rejeitadas.",
  });
}

export async function cancelReservation(
  reservationId: string,
  condominiumId: string,
  bookingContext?: CondominiumContext,
): Promise<ServiceResult<ReservationWithDetails>> {
  return updateReservationStatus({
    reservationId,
    condominiumId,
    bookingContext,
    status: "cancelled",
    notificationType: "reservation_cancelled",
    validate: (reservation) =>
      canCancelReservation(reservation.status)
        ? null
        : "Esta reserva não pode ser cancelada.",
  });
}
