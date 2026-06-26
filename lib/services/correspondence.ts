import { createClient } from "@/lib/supabase/server";
import { RESIDENT_TYPES } from "@/lib/constants";
import type { CorrespondenceNotice } from "@/lib/correspondence/types";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";

const CORRESPONDENCE_SELECT = `
  id,
  condominium_id,
  unit_id,
  target_profile_id,
  description,
  carrier,
  notes,
  created_by,
  created_at,
  picked_up_at
`;

type CorrespondenceRow = {
  id: string;
  condominium_id: string;
  unit_id: string;
  target_profile_id: string;
  description: string;
  carrier: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  picked_up_at: string | null;
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

async function getResidentMap(unitIds: string[]) {
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

function mapCorrespondenceRow(
  row: CorrespondenceRow,
  extras: {
    author: { id: string; full_name: string } | null;
    targetResident: { id: string; full_name: string } | null;
    unit: CorrespondenceNotice["unit"];
  },
): CorrespondenceNotice {
  return {
    id: row.id,
    condominium_id: row.condominium_id,
    unit_id: row.unit_id,
    target_profile_id: row.target_profile_id,
    description: row.description,
    carrier: row.carrier,
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
    picked_up_at: row.picked_up_at,
    unit: extras.unit,
    target_resident: extras.targetResident,
    author: extras.author,
  };
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

  const rows = (data as CorrespondenceRow[] | null) ?? [];
  const unitIds = [...new Set(rows.map((row) => row.unit_id))];
  const [authorMap, residentMap, unitMap] = await Promise.all([
    getAuthorMap([...new Set(rows.map((row) => row.created_by))]),
    getResidentMap(unitIds),
    getUnitMap(unitIds),
  ]);

  return serviceOk(
    rows.map((row) =>
      mapCorrespondenceRow(row, {
        author: authorMap.get(row.created_by) ?? null,
        targetResident: residentMap.get(row.unit_id) ?? null,
        unit: unitMap.get(row.unit_id),
      }),
    ),
  );
}

export async function createCorrespondenceNotice(input: {
  condominiumId: string;
  unitId: string;
  targetProfileId: string;
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

  const row = data as CorrespondenceRow;
  const [authorMap, residentMap, unitMap] = await Promise.all([
    getAuthorMap([row.created_by]),
    getResidentMap([row.unit_id]),
    getUnitMap([row.unit_id]),
  ]);

  return serviceOk(
    mapCorrespondenceRow(row, {
      author: authorMap.get(row.created_by) ?? null,
      targetResident: residentMap.get(row.unit_id) ?? null,
      unit: unitMap.get(row.unit_id),
    }),
  );
}

export async function countPendingCorrespondenceNotices(
  condominiumId: string,
): Promise<ServiceResult<number>> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("correspondence_notices")
    .select("id", { count: "exact", head: true })
    .eq("condominium_id", condominiumId)
    .is("picked_up_at", null);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(count ?? 0);
}
