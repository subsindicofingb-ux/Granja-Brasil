import { createClient } from "@/lib/supabase/server";
import type { Resident, ResidentType } from "@/types";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";

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
  condominiumId: string,
  options?: { towerId?: string; unitId?: string },
): Promise<ServiceResult<ResidentWithUnit[]>> {
  const supabase = await createClient();

  let query = supabase
    .from("residents")
    .select(RESIDENT_SELECT)
    .eq("units.towers.condominium_id", condominiumId)
    .order("full_name", { ascending: true });

  if (options?.towerId) {
    query = query.eq("units.tower_id", options.towerId);
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
  condominiumId: string,
): Promise<ServiceResult<ResidentWithUnit>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("residents")
    .select(RESIDENT_SELECT)
    .eq("id", residentId)
    .eq("units.towers.condominium_id", condominiumId)
    .maybeSingle();

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
  condominiumId: string,
): Promise<ServiceResult<true>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("units")
    .select(
      `
      id,
      towers!inner (
        condominium_id
      )
    `,
    )
    .eq("id", unitId)
    .eq("towers.condominium_id", condominiumId)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Unidade inválida para este condomínio.");
  }

  return serviceOk(true);
}

export async function createResident(input: {
  condominiumId: string;
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
  condominiumId: string;
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
  if (resident.units.towers.condominium_id !== input.condominiumId) {
    return serviceError("Morador não pertence a este condomínio.");
  }

  return serviceOk(mapResidentRow(resident));
}
