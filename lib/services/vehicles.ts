import { createClient } from "@/lib/supabase/server";
import type { Vehicle } from "@/types";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";

export type VehicleWithUnit = Vehicle & {
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
  resident: {
    id: string;
    full_name: string;
  } | null;
};

type VehicleRow = {
  id: string;
  condominium_id: string;
  unit_id: string;
  resident_id: string | null;
  brand: string;
  model: string;
  color: string | null;
  license_plate: string;
  tag_number: string | null;
  photo_url: string | null;
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
  residents: {
    id: string;
    full_name: string;
  } | null;
};

function mapVehicleRow(row: VehicleRow): VehicleWithUnit {
  return {
    id: row.id,
    condominium_id: row.condominium_id,
    unit_id: row.unit_id,
    resident_id: row.resident_id,
    brand: row.brand,
    model: row.model,
    color: row.color,
    license_plate: row.license_plate,
    tag_number: row.tag_number,
    photo_url: row.photo_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
    unit: {
      id: row.units.id,
      number: row.units.number,
      block: row.units.block,
      tower_id: row.units.tower_id,
      tower: row.units.towers,
    },
    resident: row.residents,
  };
}

const VEHICLE_SELECT = `
  id,
  condominium_id,
  unit_id,
  resident_id,
  brand,
  model,
  color,
  license_plate,
  tag_number,
  photo_url,
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
  ),
  residents (
    id,
    full_name
  )
`;

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

async function assertResidentInUnit(
  residentId: string | null,
  unitId: string,
  condominiumId: string,
): Promise<ServiceResult<true>> {
  if (!residentId) {
    return serviceOk(true);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("residents")
    .select(
      `
      id,
      unit_id,
      units!inner (
        towers!inner (
          condominium_id
        )
      )
    `,
    )
    .eq("id", residentId)
    .eq("unit_id", unitId)
    .eq("units.towers.condominium_id", condominiumId)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Morador inválido para a unidade selecionada.");
  }

  return serviceOk(true);
}

export async function listVehiclesByCondominium(
  condominiumId: string,
  options?: { unitId?: string; unitIds?: string[] },
): Promise<ServiceResult<VehicleWithUnit[]>> {
  const supabase = await createClient();

  let query = supabase
    .from("vehicles")
    .select(VEHICLE_SELECT)
    .eq("units.towers.condominium_id", condominiumId)
    .order("brand", { ascending: true })
    .order("model", { ascending: true });

  if (options?.unitId) {
    query = query.eq("unit_id", options.unitId);
  } else if (options?.unitIds) {
    query = query.in("unit_id", options.unitIds);
  }

  const { data, error } = await query;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(((data as VehicleRow[] | null) ?? []).map(mapVehicleRow));
}

export async function getVehicleById(
  vehicleId: string,
  condominiumId: string,
): Promise<ServiceResult<VehicleWithUnit>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vehicles")
    .select(VEHICLE_SELECT)
    .eq("id", vehicleId)
    .eq("units.towers.condominium_id", condominiumId)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Veículo não encontrado neste condomínio.");
  }

  return serviceOk(mapVehicleRow(data as VehicleRow));
}

export async function createVehicle(input: {
  condominiumId: string;
  unitId: string;
  residentId: string | null;
  brand: string;
  model: string;
  color: string | null;
  licensePlate: string;
  tagNumber: string | null;
  photoUrl: string | null;
}): Promise<ServiceResult<VehicleWithUnit>> {
  const unitCheck = await assertUnitInCondominium(input.unitId, input.condominiumId);
  if (!unitCheck.ok) {
    return serviceError(unitCheck.error ?? "Unidade inválida.");
  }

  const residentCheck = await assertResidentInUnit(
    input.residentId,
    input.unitId,
    input.condominiumId,
  );
  if (!residentCheck.ok) {
    return serviceError(residentCheck.error ?? "Morador inválido.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      condominium_id: input.condominiumId,
      unit_id: input.unitId,
      resident_id: input.residentId,
      brand: input.brand,
      model: input.model,
      color: input.color,
      license_plate: input.licensePlate.trim().toUpperCase(),
      tag_number: input.tagNumber,
      photo_url: input.photoUrl,
    })
    .select(VEHICLE_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(mapVehicleRow(data as VehicleRow));
}

export async function updateVehicle(input: {
  vehicleId: string;
  condominiumId: string;
  unitId: string;
  residentId: string | null;
  brand: string;
  model: string;
  color: string | null;
  licensePlate: string;
  tagNumber: string | null;
  photoUrl: string | null;
}): Promise<ServiceResult<VehicleWithUnit>> {
  const unitCheck = await assertUnitInCondominium(input.unitId, input.condominiumId);
  if (!unitCheck.ok) {
    return serviceError(unitCheck.error ?? "Unidade inválida.");
  }

  const residentCheck = await assertResidentInUnit(
    input.residentId,
    input.unitId,
    input.condominiumId,
  );
  if (!residentCheck.ok) {
    return serviceError(residentCheck.error ?? "Morador inválido.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vehicles")
    .update({
      condominium_id: input.condominiumId,
      unit_id: input.unitId,
      resident_id: input.residentId,
      brand: input.brand,
      model: input.model,
      color: input.color,
      license_plate: input.licensePlate.trim().toUpperCase(),
      tag_number: input.tagNumber,
      photo_url: input.photoUrl,
    })
    .eq("id", input.vehicleId)
    .select(VEHICLE_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const vehicle = data as VehicleRow;
  if (vehicle.units.towers.condominium_id !== input.condominiumId) {
    return serviceError("Veículo não pertence a este condomínio.");
  }

  return serviceOk(mapVehicleRow(vehicle));
}
