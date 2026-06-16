import { createClient } from "@/lib/supabase/server";
import type { Unit } from "@/types";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";

export type UnitWithTower = Unit & {
  tower: {
    id: string;
    name: string;
    condominium_id: string;
  };
};

type UnitRow = {
  id: string;
  tower_id: string;
  number: string;
  block: string | null;
  created_at: string;
  updated_at: string;
  towers: {
    id: string;
    name: string;
    condominium_id: string;
  };
};

function mapUnitRow(row: UnitRow): UnitWithTower {
  return {
    id: row.id,
    tower_id: row.tower_id,
    number: row.number,
    block: row.block,
    created_at: row.created_at,
    updated_at: row.updated_at,
    tower: row.towers,
  };
}

export async function listUnitsByCondominium(
  condominiumId: string,
  options?: { towerId?: string },
): Promise<ServiceResult<UnitWithTower[]>> {
  const supabase = await createClient();

  let query = supabase
    .from("units")
    .select(
      `
      id,
      tower_id,
      number,
      block,
      created_at,
      updated_at,
      towers!inner (
        id,
        name,
        condominium_id
      )
    `,
    )
    .eq("towers.condominium_id", condominiumId)
    .order("number", { ascending: true });

  if (options?.towerId) {
    query = query.eq("tower_id", options.towerId);
  }

  const { data, error } = await query;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(((data as UnitRow[] | null) ?? []).map(mapUnitRow));
}

export async function getUnitById(
  unitId: string,
  condominiumId: string,
): Promise<ServiceResult<UnitWithTower>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("units")
    .select(
      `
      id,
      tower_id,
      number,
      block,
      created_at,
      updated_at,
      towers!inner (
        id,
        name,
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
    return serviceError("Unidade não encontrada neste condomínio.");
  }

  return serviceOk(mapUnitRow(data as UnitRow));
}

export async function createUnit(input: {
  towerId: string;
  condominiumId: string;
  number: string;
  block: string | null;
}): Promise<ServiceResult<UnitWithTower>> {
  const supabase = await createClient();

  const { data: tower, error: towerError } = await supabase
    .from("towers")
    .select("id, name, condominium_id")
    .eq("id", input.towerId)
    .eq("condominium_id", input.condominiumId)
    .maybeSingle();

  if (towerError) {
    return serviceError(mapSupabaseError(towerError));
  }

  if (!tower) {
    return serviceError("Torre inválida para este condomínio.");
  }

  const { data, error } = await supabase
    .from("units")
    .insert({
      tower_id: input.towerId,
      number: input.number,
      block: input.block,
    })
    .select(
      `
      id,
      tower_id,
      number,
      block,
      created_at,
      updated_at,
      towers!inner (
        id,
        name,
        condominium_id
      )
    `,
    )
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(mapUnitRow(data as UnitRow));
}

export async function updateUnit(input: {
  unitId: string;
  condominiumId: string;
  towerId: string;
  number: string;
  block: string | null;
}): Promise<ServiceResult<UnitWithTower>> {
  const supabase = await createClient();

  const { data: tower, error: towerError } = await supabase
    .from("towers")
    .select("id")
    .eq("id", input.towerId)
    .eq("condominium_id", input.condominiumId)
    .maybeSingle();

  if (towerError) {
    return serviceError(mapSupabaseError(towerError));
  }

  if (!tower) {
    return serviceError("Torre inválida para este condomínio.");
  }

  const { data, error } = await supabase
    .from("units")
    .update({
      tower_id: input.towerId,
      number: input.number,
      block: input.block,
    })
    .eq("id", input.unitId)
    .select(
      `
      id,
      tower_id,
      number,
      block,
      created_at,
      updated_at,
      towers!inner (
        id,
        name,
        condominium_id
      )
    `,
    )
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const unit = data as UnitRow;
  if (unit.towers.condominium_id !== input.condominiumId) {
    return serviceError("Unidade não pertence a este condomínio.");
  }

  return serviceOk(mapUnitRow(unit));
}
