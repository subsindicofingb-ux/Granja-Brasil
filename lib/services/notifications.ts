import { createClient } from "@/lib/supabase/server";
import { RESIDENT_TYPES } from "@/lib/constants";
import type { UnitNotificationWithDetails } from "@/lib/notifications/types";
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
  source_condominium: { id: string; name: string; slug: string };
  target_condominium: { id: string; name: string; slug: string };
  target_unit: {
    id: string;
    number: string;
    block: string | null;
    tower: { id: string; name: string };
  };
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

function mapNotificationRow(
  row: NotificationRow,
  extras: {
    author: { id: string; full_name: string } | null;
    targetResident: { id: string; full_name: string } | null;
    readAt: string | null;
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
  const residentMap = await getTargetResidentsMap([...new Set(rows.map((row) => row.target_unit_id))]);

  return rows.map((row) =>
    mapNotificationRow(row, {
      author: authorMap.get(row.created_by) ?? null,
      targetResident: residentMap.get(row.target_unit_id) ?? null,
      readAt: readMap.get(row.id) ?? null,
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
}): Promise<ServiceResult<{ read_at: string }>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("unit_notification_reads")
    .upsert(
      {
        notification_id: input.notificationId,
        profile_id: input.profileId,
        read_at: new Date().toISOString(),
      },
      { onConflict: "notification_id,profile_id" },
    )
    .select("read_at")
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk({ read_at: data.read_at });
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
