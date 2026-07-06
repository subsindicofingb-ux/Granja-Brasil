import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import {
  filterAnnouncementsForContext,
  type AnnouncementViewContext,
} from "@/lib/announcements/context-visibility";
import { matchesAnnouncementCondominiumFilter } from "@/lib/announcements/targeting";
import { getTowerById } from "@/lib/services/towers";
import { getGranjaCondominiumId } from "@/lib/condominiums/granja-shared-areas";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";
import type {
  AnnouncementRecord,
  AnnouncementWithDetails,
} from "@/lib/announcements/types";
import type { Database } from "@/types/database.types";
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
  target_condominium_id,
  target_profile_id,
  parent_id,
  attachment_url,
  attachment_name,
  staff_only,
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
  profiles!announcements_created_by_fkey (
    id,
    full_name
  )
`;

function mapAnnouncement(row: AnnouncementRow): AnnouncementRecord {
  return {
    id: row.id,
    condominium_id: row.condominium_id,
    tower_id: row.tower_id,
    target_condominium_id: row.target_condominium_id,
    target_profile_id: row.target_profile_id,
    parent_id: row.parent_id,
    attachment_url: row.attachment_url,
    attachment_name: row.attachment_name,
    staff_only: row.staff_only,
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
  targetCondominiumId?: string;
  includeCondominiumWide?: boolean;
};

function applyAnnouncementListFilters(
  announcements: AnnouncementWithDetails[],
  options: AnnouncementListOptions | undefined,
  granjaCondominiumId: string | null,
): AnnouncementWithDetails[] {
  let filtered = announcements;

  if (options?.targetCondominiumId) {
    filtered = filtered.filter((announcement) =>
      matchesAnnouncementCondominiumFilter(
        announcement,
        options.targetCondominiumId,
        granjaCondominiumId,
      ),
    );
  }

  if (options?.towerId) {
    filtered = filtered.filter((announcement) => {
      if (options.includeCondominiumWide === false) {
        return announcement.tower_id === options.towerId;
      }

      return announcement.tower_id == null || announcement.tower_id === options.towerId;
    });
  }

  return filtered;
}

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

async function validateTargetCondominium(
  targetCondominiumId: string | null,
  granjaCondominiumId: string | null,
): Promise<ServiceResult<null>> {
  if (!targetCondominiumId) {
    return serviceOk(null);
  }

  if (!granjaCondominiumId) {
    return serviceError("Destino por condomínio disponível apenas na administração geral.");
  }

  if (targetCondominiumId === granjaCondominiumId) {
    return serviceError("Selecione um condomínio específico, não a administração geral.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("condominiums")
    .select("id")
    .eq("id", targetCondominiumId)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Condomínio de destino inválido.");
  }

  return serviceOk(null);
}

async function validateTargetProfile(
  targetProfileId: string | null,
  condominiumId: string,
  granjaCondominiumId: string | null,
  isGranjaSource: boolean,
): Promise<ServiceResult<null>> {
  if (!targetProfileId) {
    return serviceOk(null);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("residents")
    .select("profile_id, units!inner(towers!inner(condominium_id))")
    .eq("profile_id", targetProfileId);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const condoIds = (data ?? []).map(
    (row) => (row.units as { towers: { condominium_id: string } }).towers.condominium_id,
  );

  if (condoIds.length === 0) {
    return serviceError("Morador de destino inválido.");
  }

  if (isGranjaSource) {
    const valid = condoIds.some((condoId) => condoId !== granjaCondominiumId);

    if (!valid) {
      return serviceError("O morador selecionado não pertence a um condomínio válido.");
    }

    return serviceOk(null);
  }

  if (!condoIds.includes(condominiumId)) {
    return serviceError("O morador selecionado não pertence a este condomínio.");
  }

  return serviceOk(null);
}

export type { AnnouncementViewContext } from "@/lib/announcements/context-visibility";

export async function listAnnouncementsByCondominium(
  viewContext: AnnouncementViewContext,
  options?: AnnouncementListOptions,
): Promise<ServiceResult<AnnouncementWithDetails[]>> {
  const supabase = await createClient();
  const granjaCondominiumId = await getGranjaCondominiumId();

  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_DETAIL_SELECT)
    .order("published_at", { ascending: false });

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const inContext = filterAnnouncementsForContext(
    ((data as AnnouncementDetailRow[] | null) ?? []).map(mapAnnouncementDetail),
    viewContext,
    granjaCondominiumId,
  );

  const announcements = applyAnnouncementListFilters(inContext, options, granjaCondominiumId);

  return serviceOk(announcements);
}

export async function listRecentAnnouncementsByCondominium(
  viewContext: AnnouncementViewContext,
  limit = 5,
): Promise<ServiceResult<AnnouncementWithDetails[]>> {
  const supabase = await createClient();
  const granjaCondominiumId = await getGranjaCondominiumId();
  const filters = getMemberVisibleAnnouncementFilters();

  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_DETAIL_SELECT)
    .eq("publication_status", filters.publication_status)
    .lte("published_at", filters.nowIso)
    .or(filters.expires_or)
    .order("published_at", { ascending: false })
    .limit(limit * 4);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const announcements = filterAnnouncementsForContext(
    filterAnnouncementsVisibleToMembers(
      ((data as AnnouncementDetailRow[] | null) ?? []).map(mapAnnouncementDetail),
    ),
    viewContext,
    granjaCondominiumId,
  ).slice(0, limit);

  return serviceOk(announcements);
}

export async function getAnnouncementById(
  announcementId: string,
  _condominiumId: string,
): Promise<ServiceResult<AnnouncementWithDetails>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_DETAIL_SELECT)
    .eq("id", announcementId)
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
  target_condominium_id: string | null;
  target_profile_id: string | null;
  publication_status: AnnouncementRecord["publication_status"];
  published_at: string;
  expires_at: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
};

type AnnouncementInsert = Database["public"]["Tables"]["announcements"]["Insert"];

async function getAnnouncementWriteClient() {
  if (getSupabaseServiceRoleKey() && getSupabasePublicEnv()) {
    return createAdminClient();
  }
  return await createClient();
}

async function insertAnnouncementRecord(
  payload: AnnouncementInsert,
): Promise<ServiceResult<AnnouncementWithDetails>> {
  const writeClient = await getAnnouncementWriteClient();

  const { data, error } = await writeClient
    .from("announcements")
    .insert(payload)
    .select(ANNOUNCEMENT_DETAIL_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(mapAnnouncementDetail(data as AnnouncementDetailRow));
}

function toDbPayload(input: AnnouncementWriteInput) {
  return {
    title: input.title,
    body: input.body,
    priority: input.priority,
    tower_id: input.tower_id,
    target_condominium_id: input.target_condominium_id,
    target_profile_id: input.target_profile_id,
    publication_status: input.publication_status,
    published_at: input.published_at,
    expires_at: input.expires_at,
    attachment_url: input.attachment_url ?? null,
    attachment_name: input.attachment_name ?? null,
  };
}

async function validateAnnouncementWriteInput(
  input: AnnouncementWriteInput,
  condominiumId: string,
): Promise<ServiceResult<null>> {
  const granjaCondominiumId = await getGranjaCondominiumId();
  const isGranjaSource = granjaCondominiumId === condominiumId;

  const towerCheck = await validateTowerForCondominium(
    input.target_profile_id ? null : input.tower_id,
    condominiumId,
  );

  if (!towerCheck.ok) {
    return towerCheck;
  }

  const condoTargetCheck = await validateTargetCondominium(
    input.target_profile_id ? null : input.target_condominium_id,
    isGranjaSource ? granjaCondominiumId : null,
  );

  if (!condoTargetCheck.ok) {
    return condoTargetCheck;
  }

  const profileCheck = await validateTargetProfile(
    input.target_profile_id,
    condominiumId,
    granjaCondominiumId,
    isGranjaSource,
  );

  if (!profileCheck.ok) {
    return profileCheck;
  }

  return serviceOk(null);
}

export async function createAnnouncement(input: {
  condominiumId: string;
  createdBy: string;
  data: AnnouncementWriteInput;
}): Promise<ServiceResult<AnnouncementWithDetails>> {
  const validation = await validateAnnouncementWriteInput(input.data, input.condominiumId);

  if (!validation.ok) {
    return serviceError(validation.error);
  }

  return insertAnnouncementRecord({
    condominium_id: input.condominiumId,
    created_by: input.createdBy,
    ...toDbPayload(input.data),
  });
}

export async function updateAnnouncement(input: {
  announcementId: string;
  condominiumId: string;
  data: AnnouncementWriteInput;
}): Promise<ServiceResult<AnnouncementWithDetails>> {
  const validation = await validateAnnouncementWriteInput(input.data, input.condominiumId);

  if (!validation.ok) {
    return serviceError(validation.error);
  }

  const supabase = await createClient();

  const updatePayload = toDbPayload(input.data);
  if (input.data.attachment_url) {
    updatePayload.attachment_url = input.data.attachment_url;
    updatePayload.attachment_name = input.data.attachment_name ?? null;
  }

  const { data, error } = await supabase
    .from("announcements")
    .update(updatePayload)
    .eq("id", input.announcementId)
    .eq("condominium_id", input.condominiumId)
    .select(ANNOUNCEMENT_DETAIL_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(mapAnnouncementDetail(data as AnnouncementDetailRow));
}

export async function markAnnouncementAsRead(input: {
  announcementId: string;
  profileId: string;
}): Promise<ServiceResult<{ read_at: string; is_new_read: boolean }>> {
  const readAt = new Date().toISOString();
  const readClient = await getAnnouncementWriteClient();

  const { data: existingRead, error: existingError } = await readClient
    .from("announcement_reads")
    .select("read_at")
    .eq("announcement_id", input.announcementId)
    .eq("profile_id", input.profileId)
    .maybeSingle();

  if (!existingError && existingRead?.read_at) {
    return serviceOk({ read_at: existingRead.read_at as string, is_new_read: false });
  }

  const sessionClient = await createClient();

  const { data: rpcReadAt, error: rpcError } = await sessionClient.rpc("mark_announcement_read", {
    p_announcement_id: input.announcementId,
  });

  if (!rpcError && rpcReadAt) {
    return serviceOk({ read_at: rpcReadAt as string, is_new_read: true });
  }

  const { data: updatedRows, error: updateError } = await readClient
    .from("announcement_reads")
    .update({ read_at: readAt })
    .eq("announcement_id", input.announcementId)
    .eq("profile_id", input.profileId)
    .select("read_at");

  if (!updateError && updatedRows && updatedRows.length > 0) {
    return serviceOk({ read_at: updatedRows[0].read_at as string, is_new_read: true });
  }

  const { data, error } = await readClient
    .from("announcement_reads")
    .insert({
      announcement_id: input.announcementId,
      profile_id: input.profileId,
      read_at: readAt,
    })
    .select("read_at")
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk({ read_at: data.read_at, is_new_read: true });
}

export type AnnouncementUnreadState = {
  unreadIncomingIds: string[];
  unreadReplyThreadIds: string[];
};

function toTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export async function getAnnouncementUnreadState(
  profileId: string,
  announcements: Pick<AnnouncementRecord, "id" | "created_by">[],
): Promise<AnnouncementUnreadState> {
  if (announcements.length === 0) {
    return { unreadIncomingIds: [], unreadReplyThreadIds: [] };
  }

  let readClient;

  try {
    readClient = await getAnnouncementWriteClient();
  } catch (error) {
    console.error("[announcements:read-client]", error);
    return { unreadIncomingIds: [], unreadReplyThreadIds: [] };
  }
  const announcementIds = announcements.map((announcement) => announcement.id);
  const incomingCandidates = announcements.filter(
    (announcement) => announcement.created_by !== profileId,
  );
  const ownThreads = announcements.filter(
    (announcement) => announcement.created_by === profileId,
  );

  const { data: readRows, error: readError } = await readClient
    .from("announcement_reads")
    .select("announcement_id, read_at")
    .eq("profile_id", profileId)
    .in("announcement_id", announcementIds);

  const readAtByAnnouncementId = readError
    ? new Map<string, string>()
    : new Map(
        (readRows ?? []).map((row) => [row.announcement_id, row.read_at as string]),
      );

  const unreadIncomingIds = incomingCandidates
    .filter((announcement) => !readAtByAnnouncementId.has(announcement.id))
    .map((announcement) => announcement.id);

  let unreadReplyThreadIds: string[] = [];

  if (ownThreads.length > 0) {
    const { data: replyRows, error: replyError } = await readClient
      .from("announcements")
      .select("parent_id, published_at")
      .in(
        "parent_id",
        ownThreads.map((announcement) => announcement.id),
      )
      .neq("created_by", profileId);

    if (!replyError) {
      const latestReplyAtByParentId = new Map<string, string>();

      for (const row of replyRows ?? []) {
        const parentId = row.parent_id as string;
        const publishedAt = row.published_at as string;
        const currentLatest = latestReplyAtByParentId.get(parentId);

        if (!currentLatest || toTimestamp(publishedAt) > toTimestamp(currentLatest)) {
          latestReplyAtByParentId.set(parentId, publishedAt);
        }
      }

      unreadReplyThreadIds = ownThreads
        .filter((announcement) => {
          const latestReplyAt = latestReplyAtByParentId.get(announcement.id);
          if (!latestReplyAt) {
            return false;
          }

          const readAt = readAtByAnnouncementId.get(announcement.id);
          if (!readAt) {
            return true;
          }

          return toTimestamp(latestReplyAt) > toTimestamp(readAt);
        })
        .map((announcement) => announcement.id);
    }
  }

  return { unreadIncomingIds, unreadReplyThreadIds };
}

export async function getUnreadAnnouncementIds(
  profileId: string,
  announcements: Pick<AnnouncementRecord, "id" | "created_by">[],
): Promise<Set<string>> {
  const state = await getAnnouncementUnreadState(profileId, announcements);

  return new Set([...state.unreadIncomingIds, ...state.unreadReplyThreadIds]);
}

async function clearAnnouncementReadsForOthers(
  announcementId: string,
  excludeProfileId: string,
  preserveProfileId?: string | null,
): Promise<void> {
  const writeClient = await getAnnouncementWriteClient();

  let query = writeClient
    .from("announcement_reads")
    .delete()
    .eq("announcement_id", announcementId)
    .neq("profile_id", excludeProfileId);

  if (preserveProfileId) {
    query = query.neq("profile_id", preserveProfileId);
  }

  await query;
}

async function markAnnouncementReplyUnreadForAuthor(input: {
  announcementId: string;
  profileId: string;
  replyPublishedAt: string;
}): Promise<void> {
  const writeClient = await getAnnouncementWriteClient();
  const unreadCursorAt = new Date(
    new Date(input.replyPublishedAt).getTime() - 1000,
  ).toISOString();

  await writeClient.from("announcement_reads").upsert(
    {
      announcement_id: input.announcementId,
      profile_id: input.profileId,
      read_at: unreadCursorAt,
    },
    { onConflict: "announcement_id,profile_id" },
  );
}

export async function getAnnouncementReadStatus(input: {
  announcementId: string;
  profileId: string;
}): Promise<ServiceResult<{ read_at: string | null }>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("announcement_reads")
    .select("read_at")
    .eq("announcement_id", input.announcementId)
    .eq("profile_id", input.profileId)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk({ read_at: data?.read_at ?? null });
}

export type AnnouncementReadReceipt = {
  profile_id: string;
  full_name: string;
  read_at: string;
};

export async function listAnnouncementReadReceipts(
  announcementId: string,
): Promise<ServiceResult<AnnouncementReadReceipt[]>> {
  const readClient = await getAnnouncementWriteClient();

  const { data, error } = await readClient
    .from("announcement_reads")
    .select(
      `
      profile_id,
      read_at,
      profiles!announcement_reads_profile_id_fkey (
        full_name
      )
    `,
    )
    .eq("announcement_id", announcementId)
    .order("read_at", { ascending: false });

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const receipts: AnnouncementReadReceipt[] = ((data ?? []) as Array<{
    profile_id: string;
    read_at: string;
    profiles: { full_name: string } | null;
  }>).map((row) => ({
    profile_id: row.profile_id,
    full_name: row.profiles?.full_name ?? "Usuário",
    read_at: row.read_at,
  }));

  return serviceOk(receipts);
}

export async function countAnnouncementReads(
  announcementId: string,
): Promise<ServiceResult<number>> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("announcement_reads")
    .select("*", { count: "exact", head: true })
    .eq("announcement_id", announcementId);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(count ?? 0);
}

export async function listAnnouncementReplies(
  parentAnnouncementId: string,
): Promise<ServiceResult<AnnouncementWithDetails[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_DETAIL_SELECT)
    .eq("parent_id", parentAnnouncementId)
    .order("created_at", { ascending: true });

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(((data as AnnouncementDetailRow[] | null) ?? []).map(mapAnnouncementDetail));
}

export async function createResidentAnnouncement(input: {
  contextCondominiumId: string;
  createdBy: string;
  destination: "condominium" | "granja";
  title: string;
  body: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}): Promise<ServiceResult<AnnouncementWithDetails>> {
  const granjaCondominiumId = await getGranjaCondominiumId();

  if (input.destination === "granja") {
    if (!granjaCondominiumId) {
      return serviceError("Administração Granja Brasil não configurada.");
    }

    if (input.contextCondominiumId === granjaCondominiumId) {
      return serviceError("Moradores devem enviar mensagens a partir do condomínio de residência.");
    }
  }

  const publishedAt = new Date().toISOString();

  return insertAnnouncementRecord({
    condominium_id:
      input.destination === "granja" ? granjaCondominiumId! : input.contextCondominiumId,
    created_by: input.createdBy,
    staff_only: true,
    title: input.title,
    body: input.body,
    priority: "normal",
    publication_status: "published",
    published_at: publishedAt,
    expires_at: null,
    target_profile_id: null,
    target_condominium_id:
      input.destination === "granja" ? input.contextCondominiumId : null,
    tower_id: null,
    parent_id: null,
    attachment_url: input.attachmentUrl ?? null,
    attachment_name: input.attachmentName ?? null,
  });
}

export async function createStaffToGranjaAnnouncement(input: {
  sourceCondominiumId: string;
  createdBy: string;
  title: string;
  body: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}): Promise<ServiceResult<AnnouncementWithDetails>> {
  const granjaCondominiumId = await getGranjaCondominiumId();

  if (!granjaCondominiumId) {
    return serviceError("Administração Granja Brasil não configurada.");
  }

  if (input.sourceCondominiumId === granjaCondominiumId) {
    return serviceError("Use esta opção a partir do condomínio que você gerencia.");
  }

  const publishedAt = new Date().toISOString();

  return insertAnnouncementRecord({
    condominium_id: granjaCondominiumId,
    created_by: input.createdBy,
    staff_only: true,
    title: input.title,
    body: input.body,
    priority: "normal",
    publication_status: "published",
    published_at: publishedAt,
    expires_at: null,
    target_profile_id: null,
    target_condominium_id: input.sourceCondominiumId,
    tower_id: null,
    parent_id: null,
    attachment_url: input.attachmentUrl ?? null,
    attachment_name: input.attachmentName ?? null,
  });
}

export async function createDoormanToResidentAnnouncement(input: {
  condominiumId: string;
  createdBy: string;
  targetProfileId: string;
  title: string;
  body: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}): Promise<ServiceResult<AnnouncementWithDetails>> {
  const publishedAt = new Date().toISOString();

  return insertAnnouncementRecord({
    condominium_id: input.condominiumId,
    created_by: input.createdBy,
    staff_only: false,
    title: input.title,
    body: input.body,
    priority: "normal",
    publication_status: "published",
    published_at: publishedAt,
    expires_at: null,
    target_profile_id: input.targetProfileId,
    target_condominium_id: null,
    tower_id: null,
    parent_id: null,
    attachment_url: input.attachmentUrl ?? null,
    attachment_name: input.attachmentName ?? null,
  });
}

export async function createAnnouncementReply(input: {
  parentAnnouncementId: string;
  createdBy: string;
  body: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}): Promise<ServiceResult<AnnouncementWithDetails>> {
  const supabase = await createClient();

  const { data: parent, error: parentError } = await supabase
    .from("announcements")
    .select("id, condominium_id, staff_only, target_condominium_id, target_profile_id, parent_id, created_by")
    .eq("id", input.parentAnnouncementId)
    .maybeSingle();

  if (parentError) {
    return serviceError(mapSupabaseError(parentError));
  }

  if (!parent || parent.parent_id) {
    return serviceError("Conversa não encontrada para resposta.");
  }

  const publishedAt = new Date().toISOString();
  const result = await insertAnnouncementRecord({
    condominium_id: parent.condominium_id,
    created_by: input.createdBy,
    parent_id: parent.id,
    staff_only: parent.staff_only,
    target_condominium_id: parent.target_condominium_id,
    target_profile_id: parent.target_profile_id,
    title: "Resposta",
    body: input.body,
    priority: "normal",
    publication_status: "published",
    published_at: publishedAt,
    expires_at: null,
    tower_id: null,
    attachment_url: input.attachmentUrl ?? null,
    attachment_name: input.attachmentName ?? null,
  });

  if (result.ok) {
    await clearAnnouncementReadsForOthers(parent.id, input.createdBy, parent.created_by);

    if (parent.created_by && parent.created_by !== input.createdBy) {
      await markAnnouncementReplyUnreadForAuthor({
        announcementId: parent.id,
        profileId: parent.created_by,
        replyPublishedAt: result.data.published_at,
      });
    }
  }

  return result;
}
