import { createClient } from "@/lib/supabase/server";
import type { Vehicle } from "@/types";
import { VEHICLE_STATUS, type VehicleStatus } from "@/lib/constants";
import { resolveUnitContext } from "@/lib/services/unit-access";
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

export type VehicleWithUnitAndCondominium = VehicleWithUnit & {
  condominium: {
    id: string;
    name: string;
    slug: string;
  };
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
  status: VehicleStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
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
    status: row.status ?? VEHICLE_STATUS.APPROVED,
    reviewed_by: row.reviewed_by ?? null,
    reviewed_at: row.reviewed_at ?? null,
    review_notes: row.review_notes ?? null,
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
  status,
  reviewed_by,
  reviewed_at,
  review_notes,
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

const VEHICLE_CONSULT_SELECT = `
  ${VEHICLE_SELECT.trim()},
  condominiums!inner (
    id,
    name,
    slug
  )
`;

type VehicleConsultRow = VehicleRow & {
  condominiums: {
    id: string;
    name: string;
    slug: string;
  };
};

function normalizeLicensePlateQuery(plate: string): string {
  return plate.replace(/[\s-]/g, "").trim().toUpperCase();
}

function mapVehicleConsultRow(row: VehicleConsultRow): VehicleWithUnitAndCondominium {
  return {
    ...mapVehicleRow(row),
    condominium: row.condominiums,
  };
}

async function assertUnitInCondominium(
  unitId: string,
  scopeCondominiumId?: string,
): Promise<ServiceResult<{ unitCondominiumId: string }>> {
  return resolveUnitContext(unitId, scopeCondominiumId);
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
  options?: { unitId?: string; unitIds?: string[]; status?: VehicleStatus },
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

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(((data as VehicleRow[] | null) ?? []).map(mapVehicleRow));
}

export async function countVehicles(options?: {
  condominiumId?: string;
  status?: VehicleStatus;
}): Promise<ServiceResult<number>> {
  const supabase = await createClient();

  let query = supabase.from("vehicles").select("id", { count: "exact", head: true });

  if (options?.condominiumId) {
    query = query.eq("condominium_id", options.condominiumId);
  }

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { count, error } = await query;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(count ?? 0);
}

export async function searchVehiclesForConsult(options?: {
  condominiumId?: string;
  condominiumIds?: string[];
  plate?: string;
  unitId?: string;
  unitIds?: string[];
  includeUnapproved?: boolean;
}): Promise<ServiceResult<VehicleWithUnitAndCondominium[]>> {
  const plateQuery = options?.plate ? normalizeLicensePlateQuery(options.plate) : "";

  if (!plateQuery) {
    return serviceOk([]);
  }

  const supabase = await createClient();

  let query = supabase
    .from("vehicles")
    .select(VEHICLE_CONSULT_SELECT)
    .ilike("license_plate", `%${plateQuery}%`)
    .order("license_plate", { ascending: true })
    .limit(50);

  if (!options?.includeUnapproved) {
    query = query.eq("status", VEHICLE_STATUS.APPROVED);
  }

  if (options?.condominiumIds?.length) {
    query = query.in("condominium_id", options.condominiumIds);
  } else if (options?.condominiumId) {
    query = query.eq("condominium_id", options.condominiumId);
  }

  if (options?.unitId) {
    query = query.eq("unit_id", options.unitId);
  } else if (options?.unitIds) {
    query = query.in("unit_id", options.unitIds);
  }

  const { data, error } = await query;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(
    ((data as unknown as VehicleConsultRow[] | null) ?? []).map(mapVehicleConsultRow),
  );
}

export async function listPendingVehiclesForConsult(): Promise<
  ServiceResult<VehicleWithUnitAndCondominium[]>
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vehicles")
    .select(VEHICLE_CONSULT_SELECT)
    .eq("status", VEHICLE_STATUS.PENDING)
    .order("created_at", { ascending: false });

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(
    ((data as unknown as VehicleConsultRow[] | null) ?? []).map(mapVehicleConsultRow),
  );
}

export async function deleteVehicle(input: {
  vehicleId: string;
  scopeCondominiumId?: string;
}): Promise<ServiceResult<true>> {
  const vehicleResult = await getVehicleById(input.vehicleId, {
    condominiumId: input.scopeCondominiumId,
  });

  if (!vehicleResult.ok) {
    return serviceError(vehicleResult.error);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vehicles").delete().eq("id", input.vehicleId);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(true);
}

export async function getVehicleById(
  vehicleId: string,
  options?: { condominiumId?: string },
): Promise<ServiceResult<VehicleWithUnit>> {
  const supabase = await createClient();

  let query = supabase.from("vehicles").select(VEHICLE_SELECT).eq("id", vehicleId);

  if (options?.condominiumId) {
    query = query.eq("units.towers.condominium_id", options.condominiumId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Veículo não encontrado neste condomínio.");
  }

  return serviceOk(mapVehicleRow(data as VehicleRow));
}

export async function createVehicle(input: {
  scopeCondominiumId?: string;
  unitId: string;
  residentId: string | null;
  brand: string;
  model: string;
  color: string | null;
  licensePlate: string;
  tagNumber: string | null;
  photoUrl: string | null;
  status?: VehicleStatus;
}): Promise<ServiceResult<VehicleWithUnit>> {
  const unitCheck = await assertUnitInCondominium(input.unitId, input.scopeCondominiumId);
  if (!unitCheck.ok) {
    return serviceError(unitCheck.error ?? "Unidade inválida.");
  }

  const residentCheck = await assertResidentInUnit(
    input.residentId,
    input.unitId,
    unitCheck.data.unitCondominiumId,
  );
  if (!residentCheck.ok) {
    return serviceError(residentCheck.error ?? "Morador inválido.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      condominium_id: unitCheck.data.unitCondominiumId,
      unit_id: input.unitId,
      resident_id: input.residentId,
      brand: input.brand,
      model: input.model,
      color: input.color,
      license_plate: input.licensePlate.trim().toUpperCase(),
      tag_number: input.tagNumber,
      photo_url: input.photoUrl,
      status: input.status ?? VEHICLE_STATUS.APPROVED,
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
  scopeCondominiumId?: string;
  unitId: string;
  residentId: string | null;
  brand: string;
  model: string;
  color: string | null;
  licensePlate: string;
  tagNumber: string | null;
  photoUrl: string | null;
}): Promise<ServiceResult<VehicleWithUnit>> {
  const unitCheck = await assertUnitInCondominium(input.unitId, input.scopeCondominiumId);
  if (!unitCheck.ok) {
    return serviceError(unitCheck.error ?? "Unidade inválida.");
  }

  const residentCheck = await assertResidentInUnit(
    input.residentId,
    input.unitId,
    unitCheck.data.unitCondominiumId,
  );
  if (!residentCheck.ok) {
    return serviceError(residentCheck.error ?? "Morador inválido.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vehicles")
    .update({
      condominium_id: unitCheck.data.unitCondominiumId,
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

  if (input.scopeCondominiumId) {
    const vehicle = data as VehicleRow;
    if (vehicle.units.towers.condominium_id !== input.scopeCondominiumId) {
      return serviceError("Veículo não pertence a este condomínio.");
    }
  }

  return serviceOk(mapVehicleRow(data as VehicleRow));
}

export async function reviewVehicle(input: {
  vehicleId: string;
  scopeCondominiumId?: string;
  reviewerProfileId: string;
  action: "approve" | "reject";
  reviewNotes?: string;
}): Promise<ServiceResult<VehicleWithUnit>> {
  const vehicleResult = await getVehicleById(input.vehicleId, {
    condominiumId: input.scopeCondominiumId,
  });

  if (!vehicleResult.ok) {
    return serviceError(vehicleResult.error);
  }

  if (vehicleResult.data.status !== VEHICLE_STATUS.PENDING) {
    return serviceError("Este veículo já foi analisado.");
  }

  const supabase = await createClient();
  const nextStatus =
    input.action === "approve" ? VEHICLE_STATUS.APPROVED : VEHICLE_STATUS.REJECTED;

  const { data, error } = await supabase
    .from("vehicles")
    .update({
      status: nextStatus,
      reviewed_by: input.reviewerProfileId,
      reviewed_at: new Date().toISOString(),
      review_notes: input.reviewNotes?.trim() || null,
    })
    .eq("id", input.vehicleId)
    .eq("status", VEHICLE_STATUS.PENDING)
    .select(VEHICLE_SELECT)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Veículo não encontrado ou já analisado.");
  }

  return serviceOk(mapVehicleRow(data as VehicleRow));
}
