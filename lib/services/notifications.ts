import { createClient } from "@/lib/supabase/server";
import { RESIDENT_TYPES } from "@/lib/constants";
import type { UnitNotificationReply, UnitNotificationWithDetails } from "@/lib/notifications/types";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";

const NOTIFICATION_SELECT = `
  id,
  source_condominium_id,
  target_condominium_id,
  target_unit_id,
  target_profile_id,
  title,
  body,
  attachment_url,
  attachment_name,
  created_by,
  created_at,
  updated_at,
  sender_last_seen_at,
  source_condominium:condominiums!unit_notifications_source_condominium_id_fkey (
    id,
    name,
    slug
  ),
  target_condominium:condominiums!unit_notifications_target_condominium_id_fkey (
    id,
    name,
    slug
  ),
  target_unit:units!unit_notifications_target_unit_id_fkey (
    id,
    number,
    block,
    tower:towers!inner (
      id,
      name
    )
  )
`;

type NotificationRow = {
  id: string;
  source_condominium_id: string;
  target_condominium_id: string;
  target_unit_id: string;
  target_profile_id: string;
  title: string;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  sender_last_seen_at: string | null;
  source_condominium: { id: string; name: string; slug: string } | null;
  target_condominium: { id: string; name: string; slug: string } | null;
  target_unit: {
    id: string;
    number: string;
    block: string | null;
    tower: { id: string; name: string };
  } | null;
};

async function getAuthorMap(profileIds: string[]) {
  if (profileIds.length === 0) {
    return new Map<string, { id: string; full_name: string }>();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", profileIds);

  return new Map((data ?? []).map((profile) => [profile.id, profile]));
}

async function getReadMap(notificationIds: string[], profileId: string) {
  if (notificationIds.length === 0) {
    return new Map<string, string>();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("unit_notification_reads")
    .select("notification_id, read_at")
    .eq("profile_id", profileId)
    .in("notification_id", notificationIds);

  return new Map((data ?? []).map((row) => [row.notification_id, row.read_at]));
}

async function getTargetResidentsMap(unitIds: string[]) {
  if (unitIds.length === 0) {
    return new Map<string, { id: string; full_name: string }>();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("residents")
    .select("id, full_name, unit_id, profile_id, type")
    .in("unit_id", unitIds)
    .eq("type", RESIDENT_TYPES.RESPONSIBLE);

  const map = new Map<string, { id: string; full_name: string }>();
  for (const resident of data ?? []) {
    if (resident.profile_id) {
      map.set(resident.unit_id, { id: resident.id, full_name: resident.full_name });
    }
  }

  return map;
}

async function getRecipientReadMap(
  rows: Pick<NotificationRow, "id" | "target_profile_id">[],
): Promise<Map<string, string>> {
  const notificationIds = rows.map((row) => row.id);
  if (notificationIds.length === 0) {
    return new Map();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("unit_notification_reads")
    .select("notification_id, profile_id, read_at")
    .in("notification_id", notificationIds);

  const targetByNotification = new Map(rows.map((row) => [row.id, row.target_profile_id]));
  const map = new Map<string, string>();

  for (const read of data ?? []) {
    if (read.profile_id === targetByNotification.get(read.notification_id)) {
      map.set(read.notification_id, read.read_at);
    }
  }

  return map;
}

type ReplySummary = {
  count: number;
  latestOtherReplyAt: string | null;
};

async function getReplySummaryMap(
  notificationIds: string[],
  viewerProfileId: string,
): Promise<Map<string, ReplySummary>> {
  if (notificationIds.length === 0) {
    return new Map();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("unit_notification_replies")
    .select("notification_id, created_by, created_at")
    .in("notification_id", notificationIds)
    .order("created_at", { ascending: false });

  const map = new Map<string, ReplySummary>();

  for (const reply of data ?? []) {
    const current = map.get(reply.notification_id) ?? { count: 0, latestOtherReplyAt: null };
    current.count += 1;

    if (
      reply.created_by !== viewerProfileId &&
      (!current.latestOtherReplyAt || reply.created_at > current.latestOtherReplyAt)
    ) {
      current.latestOtherReplyAt = reply.created_at;
    }

    map.set(reply.notification_id, current);
  }

  return map;
}

function hasUnreadActivity(input: {
  row: NotificationRow;
  viewerProfileId: string;
  readAt: string | null;
  recipientReadAt: string | null;
  replySummary: ReplySummary | undefined;
}): boolean {
  const { row, viewerProfileId, readAt, recipientReadAt, replySummary } = input;
  const isRecipient = row.target_profile_id === viewerProfileId;
  const isSender = row.created_by === viewerProfileId;
  const senderSeenAt = row.sender_last_seen_at ?? readAt;
  const baseline = senderSeenAt ?? row.created_at;

  if (isRecipient) {
    if (!readAt) {
      return true;
    }

    if (
      replySummary?.latestOtherReplyAt &&
      replySummary.latestOtherReplyAt > readAt
    ) {
      return true;
    }
  }

  if (isSender) {
    if (recipientReadAt && (!senderSeenAt || recipientReadAt > senderSeenAt)) {
      return true;
    }

    if (
      replySummary?.latestOtherReplyAt &&
      replySummary.latestOtherReplyAt > baseline
    ) {
      return true;
    }
  }

  return false;
}

function mapNotificationRow(
  row: NotificationRow,
  extras: {
    author: { id: string; full_name: string } | null;
    targetResident: { id: string; full_name: string } | null;
    readAt: string | null;
    recipientReadAt: string | null;
    replySummary: ReplySummary | undefined;
    viewerProfileId: string;
  },
): UnitNotificationWithDetails {
  return {
    id: row.id,
    source_condominium_id: row.source_condominium_id,
    target_condominium_id: row.target_condominium_id,
    target_unit_id: row.target_unit_id,
    target_profile_id: row.target_profile_id,
    title: row.title,
    body: row.body,
    attachment_url: row.attachment_url,
    attachment_name: row.attachment_name,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    source_condominium: row.source_condominium,
    target_condominium: row.target_condominium,
    target_unit: row.target_unit,
    target_resident: extras.targetResident,
    author: extras.author,
    read_at: extras.readAt,
    recipient_read_at: extras.recipientReadAt,
    reply_count: extras.replySummary?.count ?? 0,
    has_unread_activity: hasUnreadActivity({
      row,
      viewerProfileId: extras.viewerProfileId,
      readAt: extras.readAt,
      recipientReadAt: extras.recipientReadAt,
      replySummary: extras.replySummary,
    }),
  };
}

async function mapNotificationRows(
  rows: NotificationRow[],
  profileId: string,
): Promise<UnitNotificationWithDetails[]> {
  const authorMap = await getAuthorMap([...new Set(rows.map((row) => row.created_by))]);
  const readMap = await getReadMap(
    rows.map((row) => row.id),
    profileId,
  );
  const recipientReadMap = await getRecipientReadMap(rows);
  const replySummaryMap = await getReplySummaryMap(
    rows.map((row) => row.id),
    profileId,
  );
  const residentMap = await getTargetResidentsMap([...new Set(rows.map((row) => row.target_unit_id))]);

  return rows.map((row) =>
    mapNotificationRow(row, {
      author: authorMap.get(row.created_by) ?? null,
      targetResident: residentMap.get(row.target_unit_id) ?? null,
      readAt: readMap.get(row.id) ?? null,
      recipientReadAt: recipientReadMap.get(row.id) ?? null,
      replySummary: replySummaryMap.get(row.id),
      viewerProfileId: profileId,
    }),
  );
}

export async function getUnitResponsibleProfileId(
  unitId: string,
): Promise<ServiceResult<string>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("residents")
    .select("profile_id")
    .eq("unit_id", unitId)
    .eq("type", RESIDENT_TYPES.RESPONSIBLE)
    .not("profile_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data?.profile_id) {
    return serviceError(
      "Esta unidade não possui morador responsável cadastrado. Defina-o ao aprovar o cadastro.",
    );
  }

  return serviceOk(data.profile_id);
}

export async function isProfileUnitResponsible(input: {
  profileId: string;
  condominiumId: string;
}): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("residents")
    .select("id, units!inner(towers!inner(condominium_id))")
    .eq("profile_id", input.profileId)
    .eq("type", RESIDENT_TYPES.RESPONSIBLE)
    .eq("units.towers.condominium_id", input.condominiumId)
    .limit(1);

  if (error) {
    return false;
  }

  return (data?.length ?? 0) > 0;
}

export async function listUnitNotificationsForContext(input: {
  profileId: string;
  sourceCondominiumId?: string;
  targetCondominiumId?: string;
  recipientOnly?: boolean;
}): Promise<ServiceResult<UnitNotificationWithDetails[]>> {
  const supabase = await createClient();

  let query = supabase.from("unit_notifications").select(NOTIFICATION_SELECT).order("created_at", {
    ascending: false,
  });

  if (input.recipientOnly) {
    query = query.eq("target_profile_id", input.profileId);
  } else if (input.sourceCondominiumId) {
    query = query.eq("source_condominium_id", input.sourceCondominiumId);
  } else if (input.targetCondominiumId) {
    query = query.eq("target_condominium_id", input.targetCondominiumId);
  } else {
    query = query.eq("target_profile_id", input.profileId);
  }

  const { data, error } = await query;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(await mapNotificationRows((data as NotificationRow[] | null) ?? [], input.profileId));
}

export async function getUnitNotificationById(
  notificationId: string,
  profileId: string,
): Promise<ServiceResult<UnitNotificationWithDetails>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("unit_notifications")
    .select(NOTIFICATION_SELECT)
    .eq("id", notificationId)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Notificação não encontrada.");
  }

  const [mapped] = await mapNotificationRows([data as NotificationRow], profileId);
  return serviceOk(mapped);
}

export async function createUnitNotification(input: {
  sourceCondominiumId: string;
  targetCondominiumId: string;
  targetUnitId: string;
  createdBy: string;
  title: string;
  body: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}): Promise<ServiceResult<UnitNotificationWithDetails>> {
  const responsibleResult = await getUnitResponsibleProfileId(input.targetUnitId);
  if (!responsibleResult.ok) {
    return serviceError(responsibleResult.error);
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("unit_notifications")
    .insert({
      source_condominium_id: input.sourceCondominiumId,
      target_condominium_id: input.targetCondominiumId,
      target_unit_id: input.targetUnitId,
      target_profile_id: responsibleResult.data,
      title: input.title.trim(),
      body: input.body.trim(),
      attachment_url: input.attachmentUrl ?? null,
      attachment_name: input.attachmentName ?? null,
      created_by: input.createdBy,
    })
    .select(NOTIFICATION_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const [mapped] = await mapNotificationRows([data as NotificationRow], input.createdBy);
  return serviceOk(mapped);
}

export async function markUnitNotificationAsRead(input: {
  notificationId: string;
  profileId: string;
}): Promise<ServiceResult<{ read_at: string; firstRead: boolean }>> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("unit_notification_reads")
    .select("read_at")
    .eq("notification_id", input.notificationId)
    .eq("profile_id", input.profileId)
    .maybeSingle();

  const readAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("unit_notification_reads")
    .upsert(
      {
        notification_id: input.notificationId,
        profile_id: input.profileId,
        read_at: readAt,
      },
      { onConflict: "notification_id,profile_id" },
    )
    .select("read_at")
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk({
    read_at: data.read_at,
    firstRead: !existing?.read_at,
  });
}

export async function markUnitNotificationReadReceiptSent(input: {
  notificationId: string;
  profileId: string;
}): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("unit_notification_reads")
    .update({ read_receipt_sent_at: new Date().toISOString() })
    .eq("notification_id", input.notificationId)
    .eq("profile_id", input.profileId);
}

export async function markUnitNotificationSenderSeen(input: {
  notificationId: string;
  profileId: string;
}): Promise<ServiceResult<true>> {
  const supabase = await createClient();

  const { error, data } = await supabase
    .from("unit_notifications")
    .update({ sender_last_seen_at: new Date().toISOString() })
    .eq("id", input.notificationId)
    .eq("created_by", input.profileId)
    .select("id")
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Não foi possível registrar a visualização da notificação.");
  }

  return serviceOk(true);
}

export async function countUnreadUnitNotifications(profileId: string): Promise<ServiceResult<number>> {
  const supabase = await createClient();

  const { data: notifications, error } = await supabase
    .from("unit_notifications")
    .select("id")
    .eq("target_profile_id", profileId);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const ids = (notifications ?? []).map((row) => row.id);
  if (ids.length === 0) {
    return serviceOk(0);
  }

  const { data: reads, error: readsError } = await supabase
    .from("unit_notification_reads")
    .select("notification_id")
    .eq("profile_id", profileId)
    .in("notification_id", ids);

  if (readsError) {
    return serviceError(mapSupabaseError(readsError));
  }

  const readIds = new Set((reads ?? []).map((row) => row.notification_id));
  return serviceOk(ids.filter((id) => !readIds.has(id)).length);
}

export async function countNotificationDashboardAlerts(
  profileId: string,
  options?: { sourceCondominiumId?: string },
): Promise<ServiceResult<number>> {
  const [receivedResult, sentResult] = await Promise.all([
    listUnitNotificationsForContext({
      profileId,
      recipientOnly: true,
    }),
    options?.sourceCondominiumId
      ? listUnitNotificationsForContext({
          profileId,
          sourceCondominiumId: options.sourceCondominiumId,
        })
      : Promise.resolve({ ok: true as const, data: [] }),
  ]);

  if (!receivedResult.ok) {
    return serviceError(receivedResult.error);
  }

  if (!sentResult.ok) {
    return serviceError(sentResult.error);
  }

  const alerts = [...receivedResult.data, ...sentResult.data].filter(
    (notification) => notification.has_unread_activity,
  );

  return serviceOk(new Set(alerts.map((notification) => notification.id)).size);
}

const REPLY_SELECT = `
  id,
  notification_id,
  created_by,
  body,
  attachment_url,
  attachment_name,
  created_at
`;

export async function listUnitNotificationReplies(
  notificationId: string,
): Promise<ServiceResult<UnitNotificationReply[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("unit_notification_replies")
    .select(REPLY_SELECT)
    .eq("notification_id", notificationId)
    .order("created_at", { ascending: true });

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const authorMap = await getAuthorMap([...new Set((data ?? []).map((row) => row.created_by))]);

  return serviceOk(
    ((data ?? []) as Array<{
      id: string;
      notification_id: string;
      created_by: string;
      body: string;
      attachment_url: string | null;
      attachment_name: string | null;
      created_at: string;
    }>).map((row) => ({
      id: row.id,
      notification_id: row.notification_id,
      created_by: row.created_by,
      body: row.body,
      attachment_url: row.attachment_url,
      attachment_name: row.attachment_name,
      created_at: row.created_at,
      author: authorMap.get(row.created_by) ?? null,
    })),
  );
}

export async function createUnitNotificationReply(input: {
  notificationId: string;
  createdBy: string;
  body: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}): Promise<ServiceResult<UnitNotificationReply>> {
  const supabase = await createClient();

  const { data: notification, error: notificationError } = await supabase
    .from("unit_notifications")
    .select("id, created_by, target_profile_id")
    .eq("id", input.notificationId)
    .maybeSingle();

  if (notificationError) {
    return serviceError(mapSupabaseError(notificationError));
  }

  if (!notification) {
    return serviceError("Notificação não encontrada.");
  }

  if (
    notification.created_by !== input.createdBy &&
    notification.target_profile_id !== input.createdBy
  ) {
    return serviceError("Sem permissão para responder esta notificação.");
  }

  const { data, error } = await supabase
    .from("unit_notification_replies")
    .insert({
      notification_id: input.notificationId,
      created_by: input.createdBy,
      body: input.body.trim(),
      attachment_url: input.attachmentUrl ?? null,
      attachment_name: input.attachmentName ?? null,
    })
    .select(REPLY_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const authorMap = await getAuthorMap([input.createdBy]);

  return serviceOk({
    ...(data as {
      id: string;
      notification_id: string;
      created_by: string;
      body: string;
      attachment_url: string | null;
      attachment_name: string | null;
      created_at: string;
    }),
    author: authorMap.get(input.createdBy) ?? null,
  });
}

export async function clearUnitResponsibleExcept(input: {
  unitId: string;
  profileId: string;
}): Promise<ServiceResult<true>> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("residents")
    .update({ type: RESIDENT_TYPES.OWNER })
    .eq("unit_id", input.unitId)
    .eq("type", RESIDENT_TYPES.RESPONSIBLE)
    .neq("profile_id", input.profileId);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(true);
}
