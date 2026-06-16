import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RegistrationRequestRecord } from "@/lib/registrations/types";
import type { RegistrationRequestStatus, RegistrationUnitKind, ResidentType } from "@/types";
import { mapSupabaseError, serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";

export type PublicCondominiumOption = {
  id: string;
  name: string;
  slug: string;
};

const REQUEST_SELECT = `
  id,
  profile_id,
  condominium_id,
  resident_type,
  unit_kind,
  unit_number,
  full_name,
  email,
  status,
  reviewed_by,
  reviewed_at,
  review_notes,
  unit_id,
  created_at,
  updated_at,
  condominium:condominiums (
    id,
    name,
    slug
  )
`;

type RequestRow = Omit<RegistrationRequestRecord, "condominium"> & {
  condominium: RegistrationRequestRecord["condominium"] | RegistrationRequestRecord["condominium"][];
};

function mapRequestRow(row: RequestRow): RegistrationRequestRecord {
  const condominium = Array.isArray(row.condominium) ? row.condominium[0] : row.condominium;
  return {
    ...row,
    condominium: condominium ?? undefined,
  };
}

export async function listPublicCondominiums(): Promise<ServiceResult<PublicCondominiumOption[]>> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("condominiums")
      .select("id, name, slug")
      .order("name", { ascending: true });

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    return serviceOk(data ?? []);
  } catch {
    return serviceError("Não foi possível carregar a lista de condomínios.");
  }
}

export async function createRegistrationRequest(input: {
  profileId: string;
  condominiumId: string;
  residentType: ResidentType;
  unitKind: RegistrationUnitKind;
  unitNumber: string;
  fullName: string;
  email: string;
}): Promise<ServiceResult<RegistrationRequestRecord>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("registration_requests")
    .insert({
      profile_id: input.profileId,
      condominium_id: input.condominiumId,
      resident_type: input.residentType,
      unit_kind: input.unitKind,
      unit_number: input.unitNumber.trim(),
      full_name: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      status: "pending",
    })
    .select(REQUEST_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(mapRequestRow(data as RequestRow));
}

export async function createRegistrationRequestAsAdmin(input: {
  profileId: string;
  condominiumId: string;
  residentType: ResidentType;
  unitKind: RegistrationUnitKind;
  unitNumber: string;
  fullName: string;
  email: string;
}): Promise<ServiceResult<RegistrationRequestRecord>> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("registration_requests")
      .insert({
        profile_id: input.profileId,
        condominium_id: input.condominiumId,
        resident_type: input.residentType,
        unit_kind: input.unitKind,
        unit_number: input.unitNumber.trim(),
        full_name: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        status: "pending",
      })
      .select(REQUEST_SELECT)
      .single();

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    return serviceOk(mapRequestRow(data as RequestRow));
  } catch {
    return serviceError("Não foi possível registrar a solicitação de cadastro.");
  }
}

export async function listRegistrationRequestsByCondominium(
  condominiumId: string,
  status?: RegistrationRequestStatus,
): Promise<ServiceResult<RegistrationRequestRecord[]>> {
  const supabase = await createClient();

  let query = supabase
    .from("registration_requests")
    .select(REQUEST_SELECT)
    .eq("condominium_id", condominiumId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(((data as RequestRow[] | null) ?? []).map(mapRequestRow));
}

export async function countPendingRegistrationRequests(
  condominiumId: string,
): Promise<ServiceResult<number>> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("registration_requests")
    .select("id", { count: "exact", head: true })
    .eq("condominium_id", condominiumId)
    .eq("status", "pending");

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(count ?? 0);
}

export async function listRegistrationRequestsForProfile(
  profileId: string,
): Promise<ServiceResult<RegistrationRequestRecord[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("registration_requests")
    .select(REQUEST_SELECT)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(((data as RequestRow[] | null) ?? []).map(mapRequestRow));
}

export async function getRegistrationRequestById(
  requestId: string,
  condominiumId: string,
): Promise<ServiceResult<RegistrationRequestRecord>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("registration_requests")
    .select(REQUEST_SELECT)
    .eq("id", requestId)
    .eq("condominium_id", condominiumId)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Solicitação não encontrada.");
  }

  return serviceOk(mapRequestRow(data as RequestRow));
}

async function findOrCreateUnitForRequest(input: {
  condominiumId: string;
  unitKind: RegistrationUnitKind;
  unitNumber: string;
  unitId?: string;
}): Promise<ServiceResult<string>> {
  const supabase = await createClient();

  if (input.unitId) {
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
      .eq("id", input.unitId)
      .eq("towers.condominium_id", input.condominiumId)
      .maybeSingle();

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    if (!data) {
      return serviceError("Unidade selecionada não pertence a este condomínio.");
    }

    return serviceOk(data.id);
  }

  const towerName = input.unitKind === "house" ? "Casa" : null;

  let towerQuery = supabase
    .from("towers")
    .select("id, name")
    .eq("condominium_id", input.condominiumId);

  if (towerName) {
    towerQuery = towerQuery.ilike("name", towerName);
  }

  const { data: towers, error: towersError } = await towerQuery;

  if (towersError) {
    return serviceError(mapSupabaseError(towersError));
  }

  const towerIds = (towers ?? []).map((tower) => tower.id);

  if (towerIds.length > 0) {
    const { data: existingUnit, error: unitError } = await supabase
      .from("units")
      .select("id")
      .in("tower_id", towerIds)
      .eq("number", input.unitNumber.trim())
      .maybeSingle();

    if (unitError) {
      return serviceError(mapSupabaseError(unitError));
    }

    if (existingUnit) {
      return serviceOk(existingUnit.id);
    }
  }

  let towerId = towerIds[0] ?? null;

  if (!towerId) {
    const defaultTowerName = input.unitKind === "house" ? "Casa" : "Apartamentos";
    const { data: newTower, error: createTowerError } = await supabase
      .from("towers")
      .insert({
        condominium_id: input.condominiumId,
        name: defaultTowerName,
        floors: 1,
      })
      .select("id")
      .single();

    if (createTowerError) {
      return serviceError(mapSupabaseError(createTowerError));
    }

    towerId = newTower.id;
  }

  const { data: createdUnit, error: createUnitError } = await supabase
    .from("units")
    .insert({
      tower_id: towerId,
      number: input.unitNumber.trim(),
      block: input.unitKind === "house" ? "Casa" : null,
    })
    .select("id")
    .single();

  if (createUnitError) {
    return serviceError(mapSupabaseError(createUnitError));
  }

  return serviceOk(createdUnit.id);
}

export async function approveRegistrationRequest(input: {
  requestId: string;
  condominiumId: string;
  reviewerProfileId: string;
  unitId?: string;
  reviewNotes?: string;
}): Promise<ServiceResult<RegistrationRequestRecord>> {
  const requestResult = await getRegistrationRequestById(input.requestId, input.condominiumId);
  if (!requestResult.ok) {
    return serviceError(requestResult.error ?? "Solicitação não encontrada.");
  }

  const request = requestResult.data;

  if (request.status !== "pending") {
    return serviceError("Esta solicitação já foi analisada.");
  }

  const unitResult = await findOrCreateUnitForRequest({
    condominiumId: input.condominiumId,
    unitKind: request.unit_kind,
    unitNumber: request.unit_number,
    unitId: input.unitId,
  });

  if (!unitResult.ok) {
    return serviceError(unitResult.error ?? "Não foi possível vincular a unidade.");
  }

  const supabase = await createClient();

  const { data: resident, error: residentError } = await supabase
    .from("residents")
    .insert({
      unit_id: unitResult.data,
      profile_id: request.profile_id,
      full_name: request.full_name,
      email: request.email,
      type: request.resident_type,
    })
    .select("id")
    .single();

  if (residentError) {
    return serviceError(mapSupabaseError(residentError));
  }

  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("id")
    .eq("profile_id", request.profile_id)
    .eq("condominium_id", input.condominiumId)
    .maybeSingle();

  if (!existingMembership) {
    const { error: membershipError } = await supabase.from("memberships").insert({
      profile_id: request.profile_id,
      condominium_id: input.condominiumId,
      role: "resident",
    });

    if (membershipError) {
      return serviceError(mapSupabaseError(membershipError));
    }
  }

  const { data, error } = await supabase
    .from("registration_requests")
    .update({
      status: "approved",
      reviewed_by: input.reviewerProfileId,
      reviewed_at: new Date().toISOString(),
      review_notes: input.reviewNotes?.trim() || null,
      unit_id: unitResult.data,
    })
    .eq("id", input.requestId)
    .eq("condominium_id", input.condominiumId)
    .select(REQUEST_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  void resident;
  return serviceOk(mapRequestRow(data as RequestRow));
}

export async function rejectRegistrationRequest(input: {
  requestId: string;
  condominiumId: string;
  reviewerProfileId: string;
  reviewNotes?: string;
}): Promise<ServiceResult<RegistrationRequestRecord>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("registration_requests")
    .update({
      status: "rejected",
      reviewed_by: input.reviewerProfileId,
      reviewed_at: new Date().toISOString(),
      review_notes: input.reviewNotes?.trim() || null,
    })
    .eq("id", input.requestId)
    .eq("condominium_id", input.condominiumId)
    .eq("status", "pending")
    .select(REQUEST_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(mapRequestRow(data as RequestRow));
}
