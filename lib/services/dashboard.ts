import { createClient } from "@/lib/supabase/server";
import type { ReservationStatus } from "@/lib/constants";
import type { UnitListFilter } from "@/lib/auth/unit-scope";
import type { AnnouncementWithDetails } from "@/lib/announcements/types";
import {
  getAnnouncementUnreadState,
  listAnnouncementsByCondominium,
  listRecentAnnouncementsByCondominium,
  type AnnouncementViewContext,
} from "@/lib/services/announcements";
import {
  countReservationsByStatusForCondominium,
  listRecentReservationsByCondominium,
  listUpcomingReservationsByCondominium,
} from "@/lib/services/reservations";
import type { ReservationWithDetails } from "@/lib/reservations/types";
import { applyUnitListFilter } from "@/lib/services/unit-filter";
import { formatCondominiumDisplayName, isGeneralCondominium } from "@/lib/condominiums/display";
import { VEHICLE_STATUS } from "@/lib/constants";
import { isHouseTower } from "@/lib/residents/labels";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";

export type PendingVehicleByCondominium = {
  condominiumId: string;
  condominiumName: string;
  count: number;
};

export type GeneralCondominiumOverviewMetrics = {
  residentialCondominiums: number;
  commercialCondominiums: number;
  houses: number;
  residentialUnits: number;
  commercialUnits: number;
  totalResidents: number;
  totalVehicles: number;
  pendingVehicles: number;
  pendingVehiclesByCondominium: PendingVehicleByCondominium[];
};

export type DashboardMetrics = {
  units: number;
  residents: number;
  activeCommonAreas: number;
  reservationsByStatus: Record<ReservationStatus, number>;
};

export type DashboardData = {
  metrics: DashboardMetrics;
  upcomingReservations: ReservationWithDetails[];
  recentReservations: ReservationWithDetails[];
  recentAnnouncements: AnnouncementWithDetails[];
  unreadAnnouncementIds: string[];
  unreadReplyThreadIds: string[];
  isUnitScoped: boolean;
};

async function countUnits(
  condominiumId: string,
  unitFilter: UnitListFilter | "none",
): Promise<ServiceResult<number>> {
  if (unitFilter === "none") {
    return serviceOk(0);
  }

  const supabase = await createClient();
  const query = supabase
    .from("units")
    .select("id, towers!inner(condominium_id)", { count: "exact", head: true })
    .eq("towers.condominium_id", condominiumId);

  const filtered = applyUnitListFilter(query, unitFilter, "id");
  if (!filtered) {
    return serviceOk(0);
  }

  const { count, error } = await filtered;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(count ?? 0);
}

async function countResidents(
  condominiumId: string,
  unitFilter: UnitListFilter | "none",
): Promise<ServiceResult<number>> {
  if (unitFilter === "none") {
    return serviceOk(0);
  }

  const supabase = await createClient();
  const query = supabase
    .from("residents")
    .select("id, units!inner(towers!inner(condominium_id))", { count: "exact", head: true })
    .eq("units.towers.condominium_id", condominiumId);

  const filtered = applyUnitListFilter(query, unitFilter);
  if (!filtered) {
    return serviceOk(0);
  }

  const { count, error } = await filtered;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(count ?? 0);
}

async function countActiveCommonAreas(condominiumId: string): Promise<ServiceResult<number>> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("common_areas")
    .select("id", { count: "exact", head: true })
    .eq("condominium_id", condominiumId)
    .eq("is_active", true);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(count ?? 0);
}

export async function getGeneralCondominiumOverviewMetrics(): Promise<
  ServiceResult<GeneralCondominiumOverviewMetrics>
> {
  const supabase = await createClient();

  const [condominiumsResult, unitsResult, residentsResult, vehiclesResult, pendingVehiclesResult] =
    await Promise.all([
    supabase.from("condominiums").select("id, is_commercial"),
    supabase
      .from("units")
      .select("id, block, towers!inner(name, condominium_id)"),
    supabase.from("residents").select("id", { count: "exact", head: true }),
    supabase.from("vehicles").select("id", { count: "exact", head: true }),
    supabase
      .from("vehicles")
      .select("condominium_id, condominiums!inner(id, name, slug)")
      .eq("status", VEHICLE_STATUS.PENDING),
  ]);

  if (unitsResult.error) {
    return serviceError(mapSupabaseError(unitsResult.error));
  }

  if (residentsResult.error) {
    return serviceError(mapSupabaseError(residentsResult.error));
  }

  if (vehiclesResult.error) {
    return serviceError(mapSupabaseError(vehiclesResult.error));
  }

  if (pendingVehiclesResult.error) {
    return serviceError(mapSupabaseError(pendingVehiclesResult.error));
  }

  const pendingByCondominiumMap = new Map<string, PendingVehicleByCondominium>();

  for (const row of pendingVehiclesResult.data ?? []) {
    const condominium = row.condominiums as { id: string; name: string; slug: string };

    if (isGeneralCondominium(condominium.slug)) {
      continue;
    }

    const existing = pendingByCondominiumMap.get(condominium.id);

    if (existing) {
      existing.count += 1;
      continue;
    }

    pendingByCondominiumMap.set(condominium.id, {
      condominiumId: condominium.id,
      condominiumName: formatCondominiumDisplayName(condominium.name, condominium.slug),
      count: 1,
    });
  }

  const pendingVehiclesByCondominium = Array.from(pendingByCondominiumMap.values()).sort(
    (left, right) =>
      right.count - left.count || left.condominiumName.localeCompare(right.condominiumName, "pt-BR"),
  );

  const pendingVehicles = pendingVehiclesByCondominium.reduce(
    (total, item) => total + item.count,
    0,
  );

  let residentialCondominiums = 0;
  let commercialCondominiums = 0;
  const commercialCondominiumIds = new Set<string>();

  if (condominiumsResult.error) {
    const message = condominiumsResult.error.message ?? "";
    if (
      condominiumsResult.error.code !== "42703" &&
      !message.includes("is_commercial") &&
      !message.includes("column")
    ) {
      return serviceError(mapSupabaseError(condominiumsResult.error));
    }

    const fallback = await supabase
      .from("condominiums")
      .select("id", { count: "exact", head: true });

    if (fallback.error) {
      return serviceError(mapSupabaseError(fallback.error));
    }

    residentialCondominiums = fallback.count ?? 0;
  } else {
    for (const condominium of condominiumsResult.data ?? []) {
      if (condominium.is_commercial) {
        commercialCondominiums += 1;
        commercialCondominiumIds.add(condominium.id);
      } else {
        residentialCondominiums += 1;
      }
    }
  }

  const units = unitsResult.data ?? [];
  const houses = units.filter(
    (unit) =>
      isHouseTower(unit.towers.name) || unit.block?.trim().toLowerCase() === "casa",
  ).length;

  let residentialUnits = 0;
  let commercialUnits = 0;

  for (const unit of units) {
    if (commercialCondominiumIds.has(unit.towers.condominium_id)) {
      commercialUnits += 1;
    } else {
      residentialUnits += 1;
    }
  }

  if (condominiumsResult.error) {
    residentialUnits = units.length;
    commercialUnits = 0;
  }

  return serviceOk({
    residentialCondominiums,
    commercialCondominiums,
    houses,
    residentialUnits,
    commercialUnits,
    totalResidents: residentsResult.count ?? 0,
    totalVehicles: vehiclesResult.count ?? 0,
    pendingVehicles,
    pendingVehiclesByCondominium,
  });
}

export async function getDashboardData(
  condominiumId: string,
  scope: UnitListFilter | "none" | null = null,
  announcementViewContext?: AnnouncementViewContext,
): Promise<ServiceResult<DashboardData>> {
  const unitFilter = scope ?? {};
  const isUnitScoped = scope !== null && scope !== "none";
  const viewContext: AnnouncementViewContext = announcementViewContext ?? {
    condominiumId,
    profileId: "",
    isStaff: true,
  };

  const reservationOptions =
    unitFilter === "none"
      ? undefined
      : unitFilter.unitId
        ? { unitId: unitFilter.unitId }
        : unitFilter.unitIds
          ? { unitIds: unitFilter.unitIds }
          : undefined;

  const [
    unitsResult,
    residentsResult,
    areasResult,
    reservationCountsResult,
    upcomingResult,
    recentResult,
    announcementsResult,
    allAnnouncementsResult,
  ] = await Promise.all([
    countUnits(condominiumId, unitFilter),
    countResidents(condominiumId, unitFilter),
    countActiveCommonAreas(condominiumId),
    countReservationsByStatusForCondominium(condominiumId, reservationOptions),
    listUpcomingReservationsByCondominium(condominiumId, 5, reservationOptions),
    listRecentReservationsByCondominium(condominiumId, 5, reservationOptions),
    listRecentAnnouncementsByCondominium(viewContext, 5),
    listAnnouncementsByCondominium(viewContext),
  ]);

  if (!unitsResult.ok) {
    return serviceError(unitsResult.error);
  }

  if (!residentsResult.ok) {
    return serviceError(residentsResult.error);
  }

  if (!areasResult.ok) {
    return serviceError(areasResult.error);
  }

  if (!reservationCountsResult.ok) {
    return serviceError(reservationCountsResult.error);
  }

  if (!upcomingResult.ok) {
    return serviceError(upcomingResult.error);
  }

  if (!recentResult.ok) {
    return serviceError(recentResult.error);
  }

  if (!announcementsResult.ok) {
    return serviceError(announcementsResult.error);
  }

  if (!allAnnouncementsResult.ok) {
    return serviceError(allAnnouncementsResult.error);
  }

  const unreadState = await getAnnouncementUnreadState(
    viewContext.profileId,
    allAnnouncementsResult.data.map((announcement) => ({
      id: announcement.id,
      created_by: announcement.created_by,
    })),
  );

  return serviceOk({
    metrics: {
      units: unitsResult.data,
      residents: residentsResult.data,
      activeCommonAreas: areasResult.data,
      reservationsByStatus: reservationCountsResult.data,
    },
    upcomingReservations: upcomingResult.data,
    recentReservations: recentResult.data,
    recentAnnouncements: announcementsResult.data,
    unreadAnnouncementIds: unreadState.unreadIncomingIds,
    unreadReplyThreadIds: unreadState.unreadReplyThreadIds,
    isUnitScoped,
  });
}
