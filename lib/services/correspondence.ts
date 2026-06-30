import { createClient } from "@/lib/supabase/server";
import { DEMO_CONDO_SLUG, RESIDENT_TYPES } from "@/lib/constants";
import type { CorrespondenceNotice } from "@/lib/correspondence/types";
import { listResidentsByCondominium } from "@/lib/services/residents";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";
import { CORRESPONDENCE_RECIPIENT_OTHER } from "@/lib/validations/doorman.schema";

const CORRESPONDENCE_SELECT = `
  id,
  condominium_id,
  unit_id,
  target_profile_id,
  recipient_name,
  notified_via_responsible,
  description,
  carrier,
  notes,
  created_by,
  created_at,
  picked_up_at,
  picked_up_by_name
`;

type CorrespondenceRow = {
  id: string;
  condominium_id: string;
  unit_id: string;
  target_profile_id: string;
  recipient_name: string | null;
  notified_via_responsible: boolean;
  description: string;
  carrier: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  picked_up_at: string | null;
  picked_up_by_name: string | null;
};

function normalizeResidentName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

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

async function getTargetProfileMap(profileIds: string[]) {
  return getAuthorMap(profileIds);
}

async function getUnitMap(unitIds: string[]) {
  if (unitIds.length === 0) {
    return new Map<
      string,
      { id: string; number: string; block: string | null; tower: { id: string; name: string } }
    >();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select("id, number, block, tower:towers!inner(id, name)")
    .in("id", unitIds);

  return new Map(
    (data ?? []).map((unit) => [
      unit.id,
      {
        id: unit.id,
        number: unit.number,
        block: unit.block,
        tower: unit.tower as { id: string; name: string },
      },
    ]),
  );
}

async function getCondominiumNameMap(condominiumIds: string[]) {
  if (condominiumIds.length === 0) {
    return new Map<string, string>();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("condominiums")
    .select("id, name")
    .in("id", condominiumIds);

  return new Map((data ?? []).map((condominium) => [condominium.id, condominium.name]));
}

async function getGranjaCondominiumId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("condominiums")
    .select("id")
    .eq("slug", DEMO_CONDO_SLUG)
    .maybeSingle();

  return data?.id ?? null;
}

function mapCorrespondenceRow(
  row: CorrespondenceRow,
  extras: {
    author: { id: string; full_name: string } | null;
    targetProfile: { id: string; full_name: string } | null;
    unit: CorrespondenceNotice["unit"];
    condominiumName?: string;
  },
): CorrespondenceNotice {
  return {
    id: row.id,
    condominium_id: row.condominium_id,
    unit_id: row.unit_id,
    target_profile_id: row.target_profile_id,
    recipient_name: row.recipient_name,
    notified_via_responsible: row.notified_via_responsible,
    description: row.description,
    carrier: row.carrier,
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
    picked_up_at: row.picked_up_at,
    picked_up_by_name: row.picked_up_by_name,
    unit: extras.unit,
    target_resident: extras.targetProfile
      ? { id: extras.targetProfile.id, full_name: extras.targetProfile.full_name }
      : null,
    author: extras.author,
    condominium_name: extras.condominiumName,
  };
}

async function enrichCorrespondenceRows(rows: CorrespondenceRow[]): Promise<CorrespondenceNotice[]> {
  const unitIds = [...new Set(rows.map((row) => row.unit_id))];
  const condominiumIds = [...new Set(rows.map((row) => row.condominium_id))];
  const profileIds = [
    ...new Set([
      ...rows.map((row) => row.created_by),
      ...rows.map((row) => row.target_profile_id),
    ]),
  ];

  const [authorMap, targetProfileMap, unitMap, condominiumNameMap] = await Promise.all([
    getAuthorMap(profileIds),
    getTargetProfileMap(profileIds),
    getUnitMap(unitIds),
    getCondominiumNameMap(condominiumIds),
  ]);

  return rows.map((row) =>
    mapCorrespondenceRow(row, {
      author: authorMap.get(row.created_by) ?? null,
      targetProfile: targetProfileMap.get(row.target_profile_id) ?? null,
      unit: unitMap.get(row.unit_id),
      condominiumName: condominiumNameMap.get(row.condominium_id),
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
      "Esta unidade não possui morador responsável cadastrado.",
    );
  }

  return serviceOk(data.profile_id);
}

export async function resolveCorrespondenceTargetProfile(input: {
  unitId: string;
  recipientResidentId?: string | null;
  recipientName?: string | null;
}): Promise<
  ServiceResult<{
    profileId: string;
    recipientName: string | null;
    notifiedViaResponsible: boolean;
  }>
> {
  const recipientName = input.recipientName?.trim() || null;

  if (
    input.recipientResidentId &&
    input.recipientResidentId !== CORRESPONDENCE_RECIPIENT_OTHER
  ) {
    const residentsResult = await listResidentsByCondominium({ unitId: input.unitId });
    if (!residentsResult.ok) {
      return serviceError(residentsResult.error);
    }

    const selectedResident = residentsResult.data.find(
      (resident) => resident.id === input.recipientResidentId && resident.profile_id,
    );

    if (!selectedResident?.profile_id) {
      return serviceError("Morador inválido para esta unidade.");
    }

    return serviceOk({
      profileId: selectedResident.profile_id,
      recipientName: selectedResident.full_name,
      notifiedViaResponsible: false,
    });
  }

  if (recipientName) {
    const residentsResult = await listResidentsByCondominium({ unitId: input.unitId });
    if (!residentsResult.ok) {
      return serviceError(residentsResult.error);
    }

    const normalizedRecipient = normalizeResidentName(recipientName);
    const matchedResident = residentsResult.data.find(
      (resident) =>
        resident.profile_id &&
        normalizeResidentName(resident.full_name) === normalizedRecipient,
    );

    if (matchedResident?.profile_id) {
      return serviceOk({
        profileId: matchedResident.profile_id,
        recipientName,
        notifiedViaResponsible: false,
      });
    }
  }

  const responsibleResult = await getUnitResponsibleProfileId(input.unitId);
  if (!responsibleResult.ok) {
    return serviceError(responsibleResult.error);
  }

  return serviceOk({
    profileId: responsibleResult.data,
    recipientName,
    notifiedViaResponsible: true,
  });
}

export async function listCorrespondenceNotices(
  condominiumId: string,
): Promise<ServiceResult<CorrespondenceNotice[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("correspondence_notices")
    .select(CORRESPONDENCE_SELECT)
    .eq("condominium_id", condominiumId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(await enrichCorrespondenceRows((data as CorrespondenceRow[] | null) ?? []));
}

export async function listCorrespondenceNoticesForCondominiumIds(
  condominiumIds: string[],
): Promise<ServiceResult<CorrespondenceNotice[]>> {
  if (condominiumIds.length === 0) {
    return serviceOk([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("correspondence_notices")
    .select(CORRESPONDENCE_SELECT)
    .in("condominium_id", condominiumIds)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(await enrichCorrespondenceRows((data as CorrespondenceRow[] | null) ?? []));
}

export async function listCorrespondenceNoticesForGranjaDoorman(): Promise<
  ServiceResult<CorrespondenceNotice[]>
> {
  const granjaId = await getGranjaCondominiumId();
  if (!granjaId) {
    return serviceOk([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("correspondence_notices")
    .select(CORRESPONDENCE_SELECT)
    .neq("condominium_id", granjaId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(await enrichCorrespondenceRows((data as CorrespondenceRow[] | null) ?? []));
}

export async function listPendingCorrespondenceForProfile(
  profileId: string,
  options?: { condominiumId?: string },
): Promise<ServiceResult<CorrespondenceNotice[]>> {
  const supabase = await createClient();

  let query = supabase
    .from("correspondence_notices")
    .select(CORRESPONDENCE_SELECT)
    .eq("target_profile_id", profileId)
    .is("picked_up_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (options?.condominiumId) {
    query = query.eq("condominium_id", options.condominiumId);
  }

  const { data, error } = await query;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(await enrichCorrespondenceRows((data as CorrespondenceRow[] | null) ?? []));
}

export async function createCorrespondenceNotice(input: {
  condominiumId: string;
  unitId: string;
  targetProfileId: string;
  recipientName?: string | null;
  notifiedViaResponsible: boolean;
  description: string;
  carrier?: string | null;
  notes?: string | null;
  createdBy: string;
}): Promise<ServiceResult<CorrespondenceNotice>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("correspondence_notices")
    .insert({
      condominium_id: input.condominiumId,
      unit_id: input.unitId,
      target_profile_id: input.targetProfileId,
      recipient_name: input.recipientName?.trim() || null,
      notified_via_responsible: input.notifiedViaResponsible,
      description: input.description.trim(),
      carrier: input.carrier?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: input.createdBy,
    })
    .select(CORRESPONDENCE_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(
    (
      await enrichCorrespondenceRows([data as CorrespondenceRow])
    )[0],
  );
}

export async function markCorrespondenceAsPickedUp(
  noticeId: string,
  pickedUpByName: string,
): Promise<ServiceResult<CorrespondenceNotice>> {
  const supabase = await createClient();
  const normalizedName = pickedUpByName.trim();

  if (!normalizedName) {
    return serviceError("Informe o nome de quem retirou.");
  }

  const { data, error } = await supabase
    .from("correspondence_notices")
    .update({
      picked_up_at: new Date().toISOString(),
      picked_up_by_name: normalizedName,
    })
    .eq("id", noticeId)
    .is("picked_up_at", null)
    .select(CORRESPONDENCE_SELECT)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Correspondência não encontrada ou já retirada.");
  }

  return serviceOk(
    (
      await enrichCorrespondenceRows([data as CorrespondenceRow])
    )[0],
  );
}

export async function countPendingCorrespondenceNotices(
  condominiumId?: string,
  condominiumIds?: string[],
): Promise<ServiceResult<number>> {
  const supabase = await createClient();

  let query = supabase
    .from("correspondence_notices")
    .select("id", { count: "exact", head: true })
    .is("picked_up_at", null);

  if (condominiumIds && condominiumIds.length > 0) {
    query = query.in("condominium_id", condominiumIds);
  } else if (condominiumId) {
    query = query.eq("condominium_id", condominiumId);
  } else {
    const granjaId = await getGranjaCondominiumId();
    if (granjaId) {
      query = query.neq("condominium_id", granjaId);
    }
  }

  const { count, error } = await query;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(count ?? 0);
}
