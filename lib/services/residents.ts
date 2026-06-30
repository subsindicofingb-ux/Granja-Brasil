import { createClient } from "@/lib/supabase/server";
import { buildAnnouncementResidentUnitLabel } from "@/lib/announcements/resident-labels";
import type { Resident, ResidentType } from "@/types";
import { removeResidentFromAccessDevicesForDelete } from "@/lib/services/access-sync";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";
import { resolveUnitContext } from "@/lib/services/unit-access";

export type ResidentWithUnit = Resident & {
  unit: {
    id: string;
    number: string;
    block: string | null;
    tower_id: string;
    tower: {
      id: string;
      name: string;
      condominium_id: string;
    };
  };
};

type ResidentRow = {
  id: string;
  unit_id: string;
  profile_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  type: ResidentType;
  created_at: string;
  updated_at: string;
  units: {
    id: string;
    number: string;
    block: string | null;
    tower_id: string;
    towers: {
      id: string;
      name: string;
      condominium_id: string;
    };
  };
};

function mapResidentRow(row: ResidentRow): ResidentWithUnit {
  return {
    id: row.id,
    unit_id: row.unit_id,
    profile_id: row.profile_id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    photo_url: row.photo_url,
    type: row.type,
    created_at: row.created_at,
    updated_at: row.updated_at,
    unit: {
      id: row.units.id,
      number: row.units.number,
      block: row.units.block,
      tower_id: row.units.tower_id,
      tower: row.units.towers,
    },
  };
}

const RESIDENT_SELECT = `
  id,
  unit_id,
  profile_id,
  full_name,
  email,
  phone,
  photo_url,
  type,
  created_at,
  updated_at,
  units!inner (
    id,
    number,
    block,
    tower_id,
    towers!inner (
      id,
      name,
      condominium_id
    )
  )
`;

export async function listResidentsByCondominium(
  options?: {
    condominiumId?: string;
    unitId?: string;
  },
): Promise<ServiceResult<ResidentWithUnit[]>> {
  const supabase = await createClient();

  let query = supabase.from("residents").select(RESIDENT_SELECT).order("full_name", {
    ascending: true,
  });

  if (options?.condominiumId) {
    query = query.eq("units.towers.condominium_id", options.condominiumId);
  }

  if (options?.unitId) {
    query = query.eq("unit_id", options.unitId);
  }

  const { data, error } = await query;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(((data as ResidentRow[] | null) ?? []).map(mapResidentRow));
}

export async function getResidentById(
  residentId: string,
  options?: { condominiumId?: string },
): Promise<ServiceResult<ResidentWithUnit>> {
  const supabase = await createClient();

  let query = supabase.from("residents").select(RESIDENT_SELECT).eq("id", residentId);

  if (options?.condominiumId) {
    query = query.eq("units.towers.condominium_id", options.condominiumId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Morador não encontrado neste condomínio.");
  }

  return serviceOk(mapResidentRow(data as ResidentRow));
}

async function assertUnitInCondominium(
  unitId: string,
  condominiumId?: string,
): Promise<ServiceResult<true>> {
  const unitContext = await resolveUnitContext(unitId, condominiumId);
  if (!unitContext.ok) {
    return serviceError(unitContext.error);
  }

  return serviceOk(true);
}

export async function createResident(input: {
  condominiumId?: string;
  unitId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  type: ResidentType;
}): Promise<ServiceResult<ResidentWithUnit>> {
  const unitCheck = await assertUnitInCondominium(input.unitId, input.condominiumId);
  if (!unitCheck.ok) {
    return serviceError(unitCheck.error ?? "Unidade inválida.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("residents")
    .insert({
      unit_id: input.unitId,
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      photo_url: input.photoUrl,
      type: input.type,
    })
    .select(RESIDENT_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(mapResidentRow(data as ResidentRow));
}

export async function updateResident(input: {
  residentId: string;
  condominiumId?: string;
  unitId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  type: ResidentType;
}): Promise<ServiceResult<ResidentWithUnit>> {
  const unitCheck = await assertUnitInCondominium(input.unitId, input.condominiumId);
  if (!unitCheck.ok) {
    return serviceError(unitCheck.error ?? "Unidade inválida.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("residents")
    .update({
      unit_id: input.unitId,
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      photo_url: input.photoUrl,
      type: input.type,
    })
    .eq("id", input.residentId)
    .select(RESIDENT_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const resident = data as ResidentRow;
  if (
    input.condominiumId &&
    resident.units.towers.condominium_id !== input.condominiumId
  ) {
    return serviceError("Morador não pertence a este condomínio.");
  }

  return serviceOk(mapResidentRow(resident));
}

export async function deleteResident(input: {
  residentId: string;
  condominiumId?: string;
}): Promise<ServiceResult<{ removed: number; controlIdErrors: string[] }>> {
  const supabase = await createClient();

  const residentResult = await getResidentById(input.residentId, {
    condominiumId: input.condominiumId,
  });

  if (!residentResult.ok) {
    return serviceError(residentResult.error);
  }

  const removalResult = await removeResidentFromAccessDevicesForDelete(input.residentId);
  if (!removalResult.ok) {
    return serviceError(removalResult.error);
  }

  const { error } = await supabase.from("residents").delete().eq("id", input.residentId);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk({
    removed: removalResult.data.removed,
    controlIdErrors: removalResult.data.errors,
  });
}

export async function getLinkedResidentForProfile(input: {
  profileId: string;
  condominiumId: string;
  unitId?: string;
}): Promise<ServiceResult<{ id: string; unit_id: string } | null>> {
  const supabase = await createClient();

  let query = supabase
    .from("residents")
    .select("id, unit_id, units!inner(towers!inner(condominium_id))")
    .eq("profile_id", input.profileId)
    .eq("units.towers.condominium_id", input.condominiumId);

  if (input.unitId) {
    query = query.eq("unit_id", input.unitId);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceOk(null);
  }

  return serviceOk({ id: data.id, unit_id: data.unit_id });
}

export type AnnouncementResidentTarget = {
  profile_id: string;
  full_name: string;
  unit_label: string;
  condominium_name?: string;
};

export async function listResidentsWithProfileForAnnouncement(input: {
  condominiumId?: string;
  excludeCondominiumId?: string;
  includeAllSubCondominiums?: boolean;
}): Promise<ServiceResult<AnnouncementResidentTarget[]>> {
  const residentsResult = await listResidentsByCondominium(
    input.includeAllSubCondominiums ? undefined : { condominiumId: input.condominiumId },
  );

  if (!residentsResult.ok) {
    return serviceError(residentsResult.error);
  }

  const condoNameById = new Map<string, string>();

  if (input.includeAllSubCondominiums) {
    const supabase = await createClient();
    const { data: condos } = await supabase.from("condominiums").select("id, name");

    for (const condo of condos ?? []) {
      if (input.excludeCondominiumId && condo.id === input.excludeCondominiumId) {
        continue;
      }

      condoNameById.set(condo.id, condo.name);
    }
  }

  const seen = new Set<string>();
  const targets: AnnouncementResidentTarget[] = [];

  for (const resident of residentsResult.data ?? []) {
    if (!resident.profile_id || seen.has(resident.profile_id)) {
      continue;
    }

    const condoId = resident.unit.tower.condominium_id;

    if (input.excludeCondominiumId && condoId === input.excludeCondominiumId) {
      continue;
    }

    if (input.condominiumId && condoId !== input.condominiumId) {
      continue;
    }

    if (input.includeAllSubCondominiums && !condoNameById.has(condoId)) {
      continue;
    }

    seen.add(resident.profile_id);
    targets.push({
      profile_id: resident.profile_id,
      full_name: resident.full_name,
      unit_label: buildAnnouncementResidentUnitLabel(resident),
      condominium_name: condoNameById.get(condoId),
    });
  }

  return serviceOk(
    targets.sort((a, b) => {
      const condoCompare = (a.condominium_name ?? "").localeCompare(
        b.condominium_name ?? "",
        "pt-BR",
      );

      if (condoCompare !== 0) {
        return condoCompare;
      }

      const unitCompare = a.unit_label.localeCompare(b.unit_label, "pt-BR", { numeric: true });

      if (unitCompare !== 0) {
        return unitCompare;
      }

      return a.full_name.localeCompare(b.full_name, "pt-BR");
    }),
  );
}
