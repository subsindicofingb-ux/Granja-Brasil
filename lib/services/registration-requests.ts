import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import type { RegistrationRequestRecord } from "@/lib/registrations/types";
import {
  REGISTRATION_PROFILE_TYPES,
  REGISTRATION_UNIT_KIND,
  RESIDENT_TYPES,
  ROLES,
  type RegistrationProfileType,
  type Role,
} from "@/lib/constants";
import crypto from "crypto";
import type { RegistrationRequestStatus, RegistrationUnitKind, ResidentType } from "@/types";
import { isHouseTower, formatUnitWithTower } from "@/lib/residents/labels";
import {
  encodeProfileTypeInReviewNotes,
  isMissingProfileTypeColumnError,
  REGISTRATION_UNIT_NOT_APPLICABLE,
  requiresRegistrationUnit,
  resolveRegistrationProfileType,
} from "@/lib/registrations/profile-type";
import { mapSupabaseError, serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";
import { revokeResidentMembershipIfOrphaned } from "@/lib/auth/membership-cleanup";
import { clearUnitResponsibleExcept } from "@/lib/services/notifications";
import { isDoormanRegistrationAutoFulfill } from "@/lib/access-devices/sync-env";
import {
  assertUniqueRegistrationContactInUnit,
  mapResidentContactUniqueError,
  normalizeResidentEmail,
} from "@/lib/residents/contact-uniqueness";

export type PublicCondominiumOption = {
  id: string;
  name: string;
  slug: string;
};

export type PublicUnitOption = {
  id: string;
  label: string;
};

const REQUEST_SELECT = `
  *,
  condominium:condominiums (
    id,
    name,
    slug
  )
`;

type RequestRow = Omit<RegistrationRequestRecord, "condominium" | "profile_type"> & {
  profile_type?: RegistrationProfileType;
  condominium: RegistrationRequestRecord["condominium"] | RegistrationRequestRecord["condominium"][];
};

function mapRequestRow(row: RequestRow): RegistrationRequestRecord {
  const condominium = Array.isArray(row.condominium) ? row.condominium[0] : row.condominium;
  return {
    ...row,
    profile_type: resolveRegistrationProfileType({
      profile_type: row.profile_type,
      review_notes: row.review_notes,
      resident_type: row.resident_type,
    }),
    condominium: condominium
      ? {
          ...condominium,
          name: formatCondominiumDisplayName(condominium.name, condominium.slug),
        }
      : undefined,
  };
}

function mapProfileTypeToResidentType(profileType: RegistrationProfileType): ResidentType {
  switch (profileType) {
    case "syndic":
    case "staff":
      return RESIDENT_TYPES.RESPONSIBLE;
    case "visitor":
      return RESIDENT_TYPES.DEPENDENT;
    case "service_provider":
      return RESIDENT_TYPES.TENANT;
    case "other":
      return RESIDENT_TYPES.OWNER;
    default:
      return RESIDENT_TYPES.OWNER;
  }
}

function mapProfileTypeToMembershipRole(profileType: RegistrationProfileType): Role {
  switch (profileType) {
    case "syndic":
      return ROLES.SYNDIC;
    case "staff":
      return ROLES.STAFF;
    default:
      return ROLES.RESIDENT;
  }
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

    return serviceOk(
      (data ?? []).map((condo) => ({
        ...condo,
        name: formatCondominiumDisplayName(condo.name, condo.slug),
      })),
    );
  } catch {
    return serviceError("Não foi possível carregar a lista de condomínios.");
  }
}

export async function listPublicUnitsByCondominium(
  condominiumId: string,
): Promise<ServiceResult<PublicUnitOption[]>> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("units")
      .select(
        `
        id,
        number,
        block,
        towers!inner (
          name,
          condominium_id
        )
      `,
      )
      .eq("towers.condominium_id", condominiumId)
      .order("number", { ascending: true });

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    return serviceOk(
      (data ?? []).map((row) => ({
        id: row.id,
        label: formatUnitWithTower({
          number: row.number,
          block: row.block,
          tower: { name: row.towers.name },
        }),
      })),
    );
  } catch {
    return serviceError("Não foi possível carregar as unidades do condomínio.");
  }
}

async function getUnitRegistrationMeta(
  unitId: string,
  condominiumId: string,
): Promise<ServiceResult<{ unitKind: RegistrationUnitKind; unitNumber: string }>> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("units")
      .select(
        `
        number,
        towers!inner (
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
      return serviceError("Unidade inválida para este condomínio.");
    }

    return serviceOk({
      unitKind: isHouseTower(data.towers.name) ? "house" : "apartment",
      unitNumber: data.number,
    });
  } catch {
    return serviceError("Não foi possível validar a unidade selecionada.");
  }
}

export async function createRegistrationRequest(input: {
  profileId: string;
  condominiumId: string;
  residentType: ResidentType;
  unitId: string;
  fullName: string;
  email: string;
}): Promise<ServiceResult<RegistrationRequestRecord>> {
  const unitMeta = await getUnitRegistrationMeta(input.unitId, input.condominiumId);
  if (!unitMeta.ok) {
    return serviceError(unitMeta.error ?? "Unidade inválida.");
  }

  const supabase = await createClient();
  const normalizedEmail = input.email.trim().toLowerCase();

  const { data: existingPending } = await supabase
    .from("registration_requests")
    .select("id")
    .eq("profile_id", input.profileId)
    .eq("condominium_id", input.condominiumId)
    .eq("status", "pending")
    .maybeSingle();

  const basePayload = {
    profile_id: input.profileId,
    condominium_id: input.condominiumId,
    resident_type: input.residentType,
    requested_unit_id: input.unitId,
    unit_kind: unitMeta.data.unitKind,
    unit_number: unitMeta.data.unitNumber,
    full_name: input.fullName.trim(),
    email: normalizedEmail,
    status: "pending" as const,
  };

  const result = existingPending
    ? await supabase
        .from("registration_requests")
        .update(basePayload)
        .eq("id", existingPending.id)
        .select(REQUEST_SELECT)
        .single()
    : await supabase
        .from("registration_requests")
        .insert(basePayload)
        .select(REQUEST_SELECT)
        .single();

  if (result.error) {
    return serviceError(mapSupabaseError(result.error));
  }

  return serviceOk(mapRequestRow(result.data as RequestRow));
}

async function ensureRegistrationProfile(
  profileId: string,
  fullName: string,
): Promise<ServiceResult<void>> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").upsert(
      {
        id: profileId,
        full_name: fullName.trim() || "Usuário",
      },
      { onConflict: "id" },
    );

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    return serviceOk(undefined);
  } catch {
    return serviceError("Não foi possível preparar o perfil para o cadastro.");
  }
}

async function resolveProfileIdForRegistrationEmail(
  fullName: string,
  email: string,
): Promise<ServiceResult<string>> {
  try {
    const admin = createAdminClient();
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    const existingUser =
      data.users.find((user) => user.email?.toLowerCase() === normalizedEmail) ?? null;

    if (existingUser) {
      const profileResult = await ensureRegistrationProfile(existingUser.id, fullName);
      if (!profileResult.ok) {
        return serviceError(profileResult.error ?? "Não foi possível preparar o perfil.");
      }

      return serviceOk(existingUser.id);
    }

    const tempPassword = crypto.randomUUID();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName.trim() },
    });

    if (createError) {
      return serviceError(mapSupabaseError(createError));
    }

    if (!created.user) {
      return serviceError("Não foi possível preparar o cadastro do morador.");
    }

    const profileResult = await ensureRegistrationProfile(created.user.id, fullName);
    if (!profileResult.ok) {
      return serviceError(profileResult.error ?? "Não foi possível preparar o perfil.");
    }

    return serviceOk(created.user.id);
  } catch {
    return serviceError("Não foi possível preparar o cadastro do morador.");
  }
}

export async function createDoormanRegistrationRequest(input: {
  condominiumId: string;
  unitId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  photoUrl?: string | null;
  residentType: ResidentType;
  accessDeviceIds?: string[];
  doormanProfileId: string;
}): Promise<
  ServiceResult<{
    request: RegistrationRequestRecord;
    residentId: string | null;
    queued: boolean;
  }>
> {
  const profileResult = await resolveProfileIdForRegistrationEmail(input.fullName, input.email);
  if (!profileResult.ok) {
    return profileResult;
  }

  const uniqueCheck = await assertUniqueRegistrationContactInUnit({
    unitId: input.unitId,
    condominiumId: input.condominiumId,
    email: input.email,
    phone: input.phone,
  });

  if (!uniqueCheck.ok) {
    return serviceError(uniqueCheck.error ?? "E-mail ou telefone já cadastrado nesta unidade.");
  }

  const requestResult = await createRegistrationRequestAsAdmin({
    profileId: profileResult.data,
    condominiumId: input.condominiumId,
    profileType: REGISTRATION_PROFILE_TYPES.RESIDENT,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    photoUrl: input.photoUrl,
    unitId: input.unitId,
    residentType: input.residentType,
  });

  if (!requestResult.ok) {
    return requestResult;
  }

  if (input.accessDeviceIds && input.accessDeviceIds.length > 0) {
    const { replaceRegistrationRequestAccessDevices } = await import(
      "@/lib/services/resident-access-grants"
    );
    const grantsResult = await replaceRegistrationRequestAccessDevices({
      registrationRequestId: requestResult.data.id,
      condominiumId: input.condominiumId,
      accessDeviceIds: input.accessDeviceIds,
    });

    if (!grantsResult.ok) {
      return serviceError(grantsResult.error ?? "Solicitação criada, mas locais de acesso falharam.");
    }
  }

  if (!isDoormanRegistrationAutoFulfill()) {
    return serviceOk({
      request: requestResult.data,
      residentId: null,
      queued: true,
    });
  }

  const fulfillResult = await fulfillRegistrationRequest({
    requestId: requestResult.data.id,
    condominiumId: input.condominiumId,
    reviewerProfileId: input.doormanProfileId,
    accessDeviceIds: input.accessDeviceIds,
    reviewNotes: "Cadastro realizado pela portaria.",
  });

  if (!fulfillResult.ok) {
    return serviceError(fulfillResult.error ?? "Não foi possível concluir o cadastro do morador.");
  }

  return serviceOk({
    request: fulfillResult.data.request,
    residentId: fulfillResult.data.residentId,
    queued: false,
  });
}

export async function fulfillRegistrationRequest(input: {
  requestId: string;
  condominiumId: string;
  reviewerProfileId: string;
  unitId?: string;
  reviewNotes?: string;
  residentType?: ResidentType;
  markAsUnitResponsible?: boolean;
  accessDeviceIds?: string[];
}): Promise<
  ServiceResult<{
    request: RegistrationRequestRecord;
    residentId: string | null;
  }>
> {
  const admin = createAdminClient();

  const { data: requestRow, error: requestError } = await admin
    .from("registration_requests")
    .select(REQUEST_SELECT)
    .eq("id", input.requestId)
    .eq("condominium_id", input.condominiumId)
    .eq("status", "pending")
    .maybeSingle();

  if (requestError) {
    return serviceError(mapSupabaseError(requestError));
  }

  if (!requestRow) {
    return serviceError("Solicitação não encontrada ou já analisada.");
  }

  const request = mapRequestRow(requestRow as RequestRow);
  const needsUnit = requiresRegistrationUnit(request.profile_type);
  let resolvedUnitId = input.unitId ?? request.requested_unit_id ?? request.unit_id ?? null;

  if (
    needsUnit &&
    !resolvedUnitId &&
    request.unit_kind &&
    request.unit_number &&
    request.unit_number !== REGISTRATION_UNIT_NOT_APPLICABLE
  ) {
    const unitResult = await findOrCreateUnitForRequest({
      condominiumId: input.condominiumId,
      unitKind: request.unit_kind,
      unitNumber: request.unit_number,
      unitId: request.requested_unit_id ?? undefined,
    });

    if (!unitResult.ok) {
      return serviceError(unitResult.error ?? "Não foi possível vincular a unidade.");
    }

    resolvedUnitId = unitResult.data;
  }

  if (needsUnit && !resolvedUnitId) {
    return serviceError("Unidade da solicitação não encontrada.");
  }

  if (needsUnit && resolvedUnitId) {
    const unitCheck = await getUnitRegistrationMeta(resolvedUnitId, input.condominiumId);
    if (!unitCheck.ok) {
      return serviceError(unitCheck.error ?? "Unidade inválida.");
    }
  }

  const resolvedResidentType = input.markAsUnitResponsible
    ? RESIDENT_TYPES.RESPONSIBLE
    : (input.residentType ?? request.resident_type);

  let residentId: string | null = null;

  if (needsUnit && resolvedUnitId) {
    const { data: existingResident } = await admin
      .from("residents")
      .select("id")
      .eq("profile_id", request.profile_id)
      .eq("unit_id", resolvedUnitId)
      .maybeSingle();

    const uniqueCheck = await assertUniqueRegistrationContactInUnit({
      unitId: resolvedUnitId,
      condominiumId: input.condominiumId,
      email: request.email,
      phone: request.phone,
      excludeRegistrationRequestId: input.requestId,
      excludeResidentId: existingResident?.id,
    });

    if (!uniqueCheck.ok) {
      return serviceError(uniqueCheck.error ?? "E-mail ou telefone já cadastrado nesta unidade.");
    }

    if (input.markAsUnitResponsible) {
      const clearResult = await clearUnitResponsibleExcept({
        unitId: resolvedUnitId,
        profileId: request.profile_id,
      });

      if (!clearResult.ok) {
        return serviceError(clearResult.error ?? "Não foi possível atualizar o responsável da unidade.");
      }
    }

    const residentPayload = {
      unit_id: resolvedUnitId,
      profile_id: request.profile_id,
      full_name: request.full_name,
      email: normalizeResidentEmail(request.email),
      phone: request.phone,
      photo_url: request.photo_url,
      type: resolvedResidentType,
    };

    if (existingResident?.id) {
      const { error: updateResidentError } = await admin
        .from("residents")
        .update(residentPayload)
        .eq("id", existingResident.id);

      if (updateResidentError) {
        const uniqueMessage = mapResidentContactUniqueError(updateResidentError.message);
        return serviceError(uniqueMessage ?? mapSupabaseError(updateResidentError));
      }

      residentId = existingResident.id;
    } else {
      const { data: createdResident, error: residentError } = await admin
        .from("residents")
        .insert(residentPayload)
        .select("id")
        .single();

      if (residentError) {
        const uniqueMessage = mapResidentContactUniqueError(residentError.message);
        return serviceError(uniqueMessage ?? mapSupabaseError(residentError));
      }

      residentId = createdResident.id;
    }

    let accessDeviceIds = input.accessDeviceIds;

    if (accessDeviceIds === undefined) {
      const { data: grantRows } = await admin
        .from("registration_request_access_devices")
        .select("access_device_id")
        .eq("registration_request_id", input.requestId);

      accessDeviceIds = (grantRows ?? []).map((row) => row.access_device_id);
    }

    if (accessDeviceIds.length > 0) {
      const { replaceResidentAccessGrants } = await import("@/lib/services/resident-access-grants");
      const grantsResult = await replaceResidentAccessGrants({
        residentId,
        condominiumId: input.condominiumId,
        accessDeviceIds,
      });

      if (!grantsResult.ok) {
        return serviceError(grantsResult.error ?? "Morador criado, mas locais de acesso falharam.");
      }
    }
  }

  const { data: approvedRequest, error: approveError } = await admin
    .from("registration_requests")
    .update({
      status: "approved",
      resident_type: resolvedResidentType,
      reviewed_by: input.reviewerProfileId,
      reviewed_at: new Date().toISOString(),
      review_notes: input.reviewNotes?.trim() || null,
      unit_id: resolvedUnitId,
    })
    .eq("id", input.requestId)
    .eq("condominium_id", input.condominiumId)
    .eq("status", "pending")
    .select(REQUEST_SELECT)
    .maybeSingle();

  if (approveError) {
    return serviceError(mapSupabaseError(approveError));
  }

  if (!approvedRequest) {
    return serviceError("Não foi possível concluir a aprovação da solicitação.");
  }

  const { data: existingMembership } = await admin
    .from("memberships")
    .select("id")
    .eq("profile_id", request.profile_id)
    .eq("condominium_id", input.condominiumId)
    .maybeSingle();

  if (!existingMembership) {
    const { error: membershipError } = await admin.from("memberships").insert({
      profile_id: request.profile_id,
      condominium_id: input.condominiumId,
      role: mapProfileTypeToMembershipRole(request.profile_type),
    });

    if (membershipError) {
      return serviceError(mapSupabaseError(membershipError));
    }
  }

  return serviceOk({
    request: mapRequestRow(approvedRequest as RequestRow),
    residentId,
  });
}

/** @deprecated Use fulfillRegistrationRequest */
export async function fulfillDoormanRegistrationRequest(input: {
  requestId: string;
  condominiumId: string;
  doormanProfileId: string;
  accessDeviceIds?: string[];
}): Promise<ServiceResult<{ residentId: string }>> {
  const result = await fulfillRegistrationRequest({
    requestId: input.requestId,
    condominiumId: input.condominiumId,
    reviewerProfileId: input.doormanProfileId,
    accessDeviceIds: input.accessDeviceIds,
    reviewNotes: "Cadastro realizado pela portaria.",
  });

  if (!result.ok) {
    return serviceError(result.error);
  }

  if (!result.data.residentId) {
    return serviceError("Morador não foi criado.");
  }

  return serviceOk({ residentId: result.data.residentId });
}

export async function createRegistrationRequestAsAdmin(input: {
  profileId: string;
  condominiumId: string;
  profileType: RegistrationProfileType;
  fullName: string;
  email: string;
  phone?: string | null;
  photoUrl?: string | null;
  unitId?: string;
  unitNumber?: string;
  unitKind?: RegistrationUnitKind;
  residentType?: ResidentType;
}): Promise<ServiceResult<RegistrationRequestRecord>> {
  let unitKind: RegistrationUnitKind;
  let unitNumber: string;
  let requestedUnitId: string | null = null;

  if (!requiresRegistrationUnit(input.profileType)) {
    unitKind = REGISTRATION_UNIT_KIND.APARTMENT;
    unitNumber = REGISTRATION_UNIT_NOT_APPLICABLE;
  } else if (input.unitId) {
    const unitMeta = await getUnitRegistrationMeta(input.unitId, input.condominiumId);
    if (!unitMeta.ok) {
      return serviceError(unitMeta.error ?? "Unidade inválida.");
    }

    unitKind = unitMeta.data.unitKind;
    unitNumber = unitMeta.data.unitNumber;
    requestedUnitId = input.unitId;
  } else if (input.unitNumber?.trim()) {
    unitKind = input.unitKind ?? REGISTRATION_UNIT_KIND.APARTMENT;
    unitNumber = input.unitNumber.trim();
  } else {
    return serviceError("Informe a unidade.");
  }

  const residentType = input.residentType ?? mapProfileTypeToResidentType(input.profileType);

  try {
    const admin = createAdminClient();

    const profileResult = await ensureRegistrationProfile(input.profileId, input.fullName);
    if (!profileResult.ok) {
      return serviceError(profileResult.error ?? "Não foi possível preparar o perfil.");
    }

    const { data: condominium, error: condominiumError } = await admin
      .from("condominiums")
      .select("id")
      .eq("id", input.condominiumId)
      .maybeSingle();

    if (condominiumError) {
      return serviceError(mapSupabaseError(condominiumError));
    }

    if (!condominium) {
      return serviceError("Condomínio não encontrado. Selecione novamente.");
    }

    if (requestedUnitId) {
      const { data: unit, error: unitError } = await admin
        .from("units")
        .select(
          `
          id,
          towers!inner (
            condominium_id
          )
        `,
        )
        .eq("id", requestedUnitId)
        .eq("towers.condominium_id", input.condominiumId)
        .maybeSingle();

      if (unitError) {
        return serviceError(mapSupabaseError(unitError));
      }

      if (!unit) {
        return serviceError("Unidade inválida para este condomínio. Selecione novamente.");
      }
    }

    const normalizedEmail = input.email.trim().toLowerCase();

    const basePayload = {
      profile_id: input.profileId,
      condominium_id: input.condominiumId,
      resident_type: residentType,
      requested_unit_id: requestedUnitId,
      unit_kind: unitKind,
      unit_number: unitNumber,
      full_name: input.fullName.trim(),
      email: normalizedEmail,
      phone: input.phone?.trim() || null,
      photo_url: input.photoUrl ?? null,
      status: "pending" as const,
    };

    const { data: existingPending } = await admin
      .from("registration_requests")
      .select("id")
      .eq("condominium_id", input.condominiumId)
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .maybeSingle();

    if (requiresRegistrationUnit(input.profileType)) {
      const uniqueCheck = await assertUniqueRegistrationContactInUnit({
        unitId: requestedUnitId ?? undefined,
        condominiumId: input.condominiumId,
        unitNumber,
        email: input.email,
        phone: input.phone,
        excludeRegistrationRequestId: existingPending?.id,
      });

      if (!uniqueCheck.ok) {
        return serviceError(uniqueCheck.error ?? "E-mail ou telefone já cadastrado nesta unidade.");
      }
    }

    let result = existingPending
      ? await admin
          .from("registration_requests")
          .update({
            ...basePayload,
            profile_type: input.profileType,
            reviewed_by: null,
            reviewed_at: null,
            review_notes: null,
            unit_id: null,
          })
          .eq("id", existingPending.id)
          .select(REQUEST_SELECT)
          .single()
      : await admin
          .from("registration_requests")
          .insert({
            ...basePayload,
            profile_type: input.profileType,
          })
          .select(REQUEST_SELECT)
          .single();

    if (result.error && isMissingProfileTypeColumnError(result.error.message)) {
      result = existingPending
        ? await admin
            .from("registration_requests")
            .update({
              ...basePayload,
              review_notes: encodeProfileTypeInReviewNotes(input.profileType),
              reviewed_by: null,
              reviewed_at: null,
              unit_id: null,
            })
            .eq("id", existingPending.id)
            .select(REQUEST_SELECT)
            .single()
        : await admin
            .from("registration_requests")
            .insert({
              ...basePayload,
              review_notes: encodeProfileTypeInReviewNotes(input.profileType),
            })
            .select(REQUEST_SELECT)
            .single();
    }

    if (result.error) {
      if (result.error.code === "23505") {
        return serviceError("Você já possui uma solicitação pendente neste condomínio.");
      }
      return serviceError(mapSupabaseError(result.error));
    }

    return serviceOk(mapRequestRow(result.data as RequestRow));
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

export async function listAllPendingRegistrationRequests(): Promise<
  ServiceResult<RegistrationRequestRecord[]>
> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("registration_requests")
      .select(REQUEST_SELECT)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    return serviceOk(((data as RequestRow[] | null) ?? []).map(mapRequestRow));
  } catch {
    return serviceError("Não foi possível carregar as solicitações.");
  }
}

export async function countAllPendingRegistrationRequests(): Promise<ServiceResult<number>> {
  try {
    const admin = createAdminClient();

    const { count, error } = await admin
      .from("registration_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    return serviceOk(count ?? 0);
  } catch {
    return serviceError("Não foi possível contar as solicitações.");
  }
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
    const { data: existingUnits, error: unitError } = await supabase
      .from("units")
      .select("id")
      .in("tower_id", towerIds)
      .eq("number", input.unitNumber.trim())
      .order("created_at", { ascending: true })
      .limit(1);

    if (unitError) {
      return serviceError(mapSupabaseError(unitError));
    }

    const existingUnit = existingUnits?.[0];
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
  residentType?: ResidentType;
  markAsUnitResponsible?: boolean;
  accessDeviceIds?: string[];
}): Promise<ServiceResult<RegistrationRequestRecord>> {
  const result = await fulfillRegistrationRequest({
    requestId: input.requestId,
    condominiumId: input.condominiumId,
    reviewerProfileId: input.reviewerProfileId,
    unitId: input.unitId,
    reviewNotes: input.reviewNotes,
    residentType: input.residentType,
    markAsUnitResponsible: input.markAsUnitResponsible,
    accessDeviceIds: input.accessDeviceIds,
  });

  if (!result.ok) {
    return serviceError(result.error);
  }

  return serviceOk(result.data.request);
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
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Solicitação não encontrada ou já analisada.");
  }

  const request = mapRequestRow(data as RequestRow);
  await revokeResidentMembershipIfOrphaned({
    profileId: request.profile_id,
    condominiumId: input.condominiumId,
  });

  return serviceOk(request);
}
