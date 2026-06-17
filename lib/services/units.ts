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
  condominiumId?: string,
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
    .order("number", { ascending: true });

  if (condominiumId) {
    query = query.eq("towers.condominium_id", condominiumId);
  }

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
  towerId?: string;
  number: string;
  block: string | null;
}): Promise<ServiceResult<UnitWithTower>> {
  const existing = await getUnitById(input.unitId, input.condominiumId);
  if (!existing.ok) {
    return serviceError(existing.error);
  }

  const towerId = input.towerId ?? existing.data.tower_id;
  const supabase = await createClient();

  const { data: tower, error: towerError } = await supabase
    .from("towers")
    .select("id")
    .eq("id", towerId)
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
      tower_id: towerId,
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

export type UnitLinkedCounts = {
  residents: number;
  reservations: number;
};

export async function getUnitLinkedCounts(
  unitId: string,
  condominiumId: string,
): Promise<ServiceResult<UnitLinkedCounts>> {
  const existing = await getUnitById(unitId, condominiumId);
  if (!existing.ok) {
    return serviceError(existing.error);
  }

  const supabase = await createClient();

  const [residentsResult, reservationsResult] = await Promise.all([
    supabase
      .from("residents")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", unitId),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", unitId),
  ]);

  if (residentsResult.error) {
    return serviceError(mapSupabaseError(residentsResult.error));
  }

  if (reservationsResult.error) {
    return serviceError(mapSupabaseError(reservationsResult.error));
  }

  return serviceOk({
    residents: residentsResult.count ?? 0,
    reservations: reservationsResult.count ?? 0,
  });
}

export async function deleteUnit(input: {
  unitId: string;
  condominiumId: string;
  force?: boolean;
}): Promise<ServiceResult<void>> {
  const existing = await getUnitById(input.unitId, input.condominiumId);
  if (!existing.ok) {
    return serviceError(existing.error);
  }

  const linkedResult = await getUnitLinkedCounts(input.unitId, input.condominiumId);
  if (!linkedResult.ok) {
    return serviceError(linkedResult.error);
  }

  const hasLinkedRecords =
    linkedResult.data.residents > 0 || linkedResult.data.reservations > 0;

  if (hasLinkedRecords && !input.force) {
    const parts: string[] = [];
    if (linkedResult.data.residents > 0) {
      parts.push(
        `${linkedResult.data.residents} morador${linkedResult.data.residents > 1 ? "es" : ""}`,
      );
    }
    if (linkedResult.data.reservations > 0) {
      parts.push(
        `${linkedResult.data.reservations} reserva${linkedResult.data.reservations > 1 ? "s" : ""}`,
      );
    }

    return serviceError(
      `Esta unidade possui ${parts.join(" e ")} vinculados. Confirme novamente para excluir.`,
    );
  }

  const supabase = await createClient();

  if (input.force && linkedResult.data.reservations > 0) {
    const { error: reservationsError } = await supabase
      .from("reservations")
      .delete()
      .eq("unit_id", input.unitId);

    if (reservationsError) {
      return serviceError(mapSupabaseError(reservationsError));
    }
  }

  const { error } = await supabase.from("units").delete().eq("id", input.unitId);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(undefined);
}
