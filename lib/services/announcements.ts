import { createClient } from "@/lib/supabase/server";
import { getTowerById } from "@/lib/services/towers";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";
import type {
  AnnouncementRecord,
  AnnouncementWithDetails,
} from "@/lib/announcements/types";
import {
  filterAnnouncementsVisibleToMembers,
  getMemberVisibleAnnouncementFilters,
} from "@/lib/announcements/visibility";

type AnnouncementRow = AnnouncementRecord;

type AnnouncementDetailRow = AnnouncementRow & {
  towers: { id: string; name: string } | null;
  profiles: { id: string; full_name: string } | null;
};

const ANNOUNCEMENT_SELECT = `
  id,
  condominium_id,
  tower_id,
  title,
  body,
  priority,
  publication_status,
  published_at,
  expires_at,
  created_by,
  created_at,
  updated_at
`;

const ANNOUNCEMENT_DETAIL_SELECT = `
  ${ANNOUNCEMENT_SELECT},
  towers (
    id,
    name
  ),
  profiles (
    id,
    full_name
  )
`;

function mapAnnouncement(row: AnnouncementRow): AnnouncementRecord {
  return {
    id: row.id,
    condominium_id: row.condominium_id,
    tower_id: row.tower_id,
    title: row.title,
    body: row.body,
    priority: row.priority,
    publication_status: row.publication_status,
    published_at: row.published_at,
    expires_at: row.expires_at,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapAnnouncementDetail(row: AnnouncementDetailRow): AnnouncementWithDetails {
  return {
    ...mapAnnouncement(row),
    tower: row.towers,
    author: row.profiles,
  };
}

export type AnnouncementListOptions = {
  towerId?: string;
  includeCondominiumWide?: boolean;
};

async function validateTowerForCondominium(
  towerId: string | null,
  condominiumId: string,
): Promise<ServiceResult<null>> {
  if (!towerId) {
    return serviceOk(null);
  }

  const towerResult = await getTowerById(towerId, condominiumId);

  if (!towerResult.ok) {
    return serviceError("Torre inválida para este condomínio.");
  }

  return serviceOk(null);
}

export async function listAnnouncementsByCondominium(
  condominiumId: string,
  options?: AnnouncementListOptions,
): Promise<ServiceResult<AnnouncementWithDetails[]>> {
  const supabase = await createClient();

  let query = supabase
    .from("announcements")
    .select(ANNOUNCEMENT_DETAIL_SELECT)
    .eq("condominium_id", condominiumId)
    .order("published_at", { ascending: false });

  if (options?.towerId) {
    if (options.includeCondominiumWide === false) {
      query = query.eq("tower_id", options.towerId);
    } else {
      query = query.or(`tower_id.is.null,tower_id.eq.${options.towerId}`);
    }
  }

  const { data, error } = await query;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(((data as AnnouncementDetailRow[] | null) ?? []).map(mapAnnouncementDetail));
}

export async function listRecentAnnouncementsByCondominium(
  condominiumId: string,
  limit = 5,
): Promise<ServiceResult<AnnouncementWithDetails[]>> {
  const supabase = await createClient();
  const filters = getMemberVisibleAnnouncementFilters();

  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_DETAIL_SELECT)
    .eq("condominium_id", condominiumId)
    .eq("publication_status", filters.publication_status)
    .lte("published_at", filters.nowIso)
    .or(filters.expires_or)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const announcements = ((data as AnnouncementDetailRow[] | null) ?? []).map(
    mapAnnouncementDetail,
  );

  return serviceOk(filterAnnouncementsVisibleToMembers(announcements));
}

export async function getAnnouncementById(
  announcementId: string,
  condominiumId: string,
): Promise<ServiceResult<AnnouncementWithDetails>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_DETAIL_SELECT)
    .eq("id", announcementId)
    .eq("condominium_id", condominiumId)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Aviso não encontrado neste condomínio.");
  }

  return serviceOk(mapAnnouncementDetail(data as AnnouncementDetailRow));
}

type AnnouncementWriteInput = {
  title: string;
  body: string;
  priority: AnnouncementRecord["priority"];
  tower_id: string | null;
  publication_status: AnnouncementRecord["publication_status"];
  published_at: string;
  expires_at: string | null;
};

function toDbPayload(input: AnnouncementWriteInput) {
  return {
    title: input.title,
    body: input.body,
    priority: input.priority,
    tower_id: input.tower_id,
    publication_status: input.publication_status,
    published_at: input.published_at,
    expires_at: input.expires_at,
  };
}

export async function createAnnouncement(input: {
  condominiumId: string;
  createdBy: string;
  data: AnnouncementWriteInput;
}): Promise<ServiceResult<AnnouncementWithDetails>> {
  const towerCheck = await validateTowerForCondominium(input.data.tower_id, input.condominiumId);

  if (!towerCheck.ok) {
    return serviceError(towerCheck.error);
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("announcements")
    .insert({
      condominium_id: input.condominiumId,
      created_by: input.createdBy,
      ...toDbPayload(input.data),
    })
    .select(ANNOUNCEMENT_DETAIL_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(mapAnnouncementDetail(data as AnnouncementDetailRow));
}

export async function updateAnnouncement(input: {
  announcementId: string;
  condominiumId: string;
  data: AnnouncementWriteInput;
}): Promise<ServiceResult<AnnouncementWithDetails>> {
  const towerCheck = await validateTowerForCondominium(input.data.tower_id, input.condominiumId);

  if (!towerCheck.ok) {
    return serviceError(towerCheck.error);
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("announcements")
    .update(toDbPayload(input.data))
    .eq("id", input.announcementId)
    .eq("condominium_id", input.condominiumId)
    .select(ANNOUNCEMENT_DETAIL_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(mapAnnouncementDetail(data as AnnouncementDetailRow));
}
