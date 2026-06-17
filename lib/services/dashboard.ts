import { createClient } from "@/lib/supabase/server";
import type { ReservationStatus } from "@/lib/constants";
import type { UnitListFilter } from "@/lib/auth/unit-scope";
import type { AnnouncementWithDetails } from "@/lib/announcements/types";
import { listRecentAnnouncementsByCondominium } from "@/lib/services/announcements";
import {
  countReservationsByStatusForCondominium,
  listRecentReservationsByCondominium,
  listUpcomingReservationsByCondominium,
} from "@/lib/services/reservations";
import type { ReservationWithDetails } from "@/lib/reservations/types";
import { applyUnitListFilter } from "@/lib/services/unit-filter";
import { isHouseTower } from "@/lib/residents/labels";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";

export type GeneralCondominiumOverviewMetrics = {
  condominiums: number;
  houses: number;
  units: number;
  commercialSpaces: number;
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

  const [condominiumsResult, commercialResult, unitsResult] = await Promise.all([
    supabase.from("condominiums").select("id", { count: "exact", head: true }),
    supabase
      .from("condominiums")
      .select("id", { count: "exact", head: true })
      .eq("is_commercial", true),
    supabase.from("units").select("id, block, towers!inner(name)"),
  ]);

  if (condominiumsResult.error) {
    return serviceError(mapSupabaseError(condominiumsResult.error));
  }

  let commercialSpaces = 0;
  if (commercialResult.error) {
    const message = commercialResult.error.message ?? "";
    if (
      commercialResult.error.code !== "42703" &&
      !message.includes("is_commercial") &&
      !message.includes("column")
    ) {
      return serviceError(mapSupabaseError(commercialResult.error));
    }
  } else {
    commercialSpaces = commercialResult.count ?? 0;
  }

  if (unitsResult.error) {
    return serviceError(mapSupabaseError(unitsResult.error));
  }

  const units = unitsResult.data ?? [];
  const houses = units.filter(
    (unit) =>
      isHouseTower(unit.towers.name) || unit.block?.trim().toLowerCase() === "casa",
  ).length;

  return serviceOk({
    condominiums: condominiumsResult.count ?? 0,
    houses,
    units: units.length,
    commercialSpaces,
  });
}

export async function getDashboardData(
  condominiumId: string,
  scope: UnitListFilter | "none" | null = null,
): Promise<ServiceResult<DashboardData>> {
  const unitFilter = scope ?? {};
  const isUnitScoped = scope !== null && scope !== "none";

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
  ] = await Promise.all([
    countUnits(condominiumId, unitFilter),
    countResidents(condominiumId, unitFilter),
    countActiveCommonAreas(condominiumId),
    countReservationsByStatusForCondominium(condominiumId, reservationOptions),
    listUpcomingReservationsByCondominium(condominiumId, 5, reservationOptions),
    listRecentReservationsByCondominium(condominiumId, 5, reservationOptions),
    listRecentAnnouncementsByCondominium(condominiumId, 5),
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
    isUnitScoped,
  });
}
