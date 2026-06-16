import { createClient } from "@/lib/supabase/server";
import type { ReservationStatus } from "@/lib/constants";
import type { AnnouncementWithDetails } from "@/lib/announcements/types";
import { listRecentAnnouncementsByCondominium } from "@/lib/services/announcements";
import {
  countReservationsByStatusForCondominium,
  listRecentReservationsByCondominium,
  listUpcomingReservationsByCondominium,
} from "@/lib/services/reservations";
import type { ReservationWithDetails } from "@/lib/reservations/types";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";

export type DashboardMetrics = {
  towers: number;
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
};

async function countTowers(condominiumId: string): Promise<ServiceResult<number>> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("towers")
    .select("id", { count: "exact", head: true })
    .eq("condominium_id", condominiumId);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(count ?? 0);
}

async function countUnits(condominiumId: string): Promise<ServiceResult<number>> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("units")
    .select("id, towers!inner(condominium_id)", { count: "exact", head: true })
    .eq("towers.condominium_id", condominiumId);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(count ?? 0);
}

async function countResidents(condominiumId: string): Promise<ServiceResult<number>> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("residents")
    .select("id, units!inner(towers!inner(condominium_id))", { count: "exact", head: true })
    .eq("units.towers.condominium_id", condominiumId);

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

export async function getDashboardData(
  condominiumId: string,
): Promise<ServiceResult<DashboardData>> {
  const [
    towersResult,
    unitsResult,
    residentsResult,
    areasResult,
    reservationCountsResult,
    upcomingResult,
    recentResult,
    announcementsResult,
  ] = await Promise.all([
    countTowers(condominiumId),
    countUnits(condominiumId),
    countResidents(condominiumId),
    countActiveCommonAreas(condominiumId),
    countReservationsByStatusForCondominium(condominiumId),
    listUpcomingReservationsByCondominium(condominiumId, 5),
    listRecentReservationsByCondominium(condominiumId, 5),
    listRecentAnnouncementsByCondominium(condominiumId, 5),
  ]);

  if (!towersResult.ok) {
    return serviceError(towersResult.error);
  }

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
      towers: towersResult.data,
      units: unitsResult.data,
      residents: residentsResult.data,
      activeCommonAreas: areasResult.data,
      reservationsByStatus: reservationCountsResult.data,
    },
    upcomingReservations: upcomingResult.data,
    recentReservations: recentResult.data,
    recentAnnouncements: announcementsResult.data,
  });
}
