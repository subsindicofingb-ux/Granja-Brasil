import { createClient } from "@/lib/supabase/server";
import { VISITOR_AUTHORIZATION_STATUS } from "@/lib/constants";
import type { VisitorAuthorizationStatus } from "@/lib/constants";
import { getUnitById } from "@/lib/services/units";
import { mapSupabaseError, serviceError, type ServiceResult } from "@/lib/services/types";
import { isInDoormanConsultWindow } from "@/lib/visitor-authorizations/status";
import type {
  VisitorAuthorizationRecord,
  VisitorAuthorizationWithDetails,
} from "@/lib/visitor-authorizations/types";

type VisitorAuthorizationRow = VisitorAuthorizationRecord;

type VisitorAuthorizationDetailRow = VisitorAuthorizationRow & {
  units: {
    id: string;
    number: string;
    block: string | null;
    towers: {
      id: string;
      name: string;
    };
  };
  requester: { id: string; full_name: string } | null;
  reviewer: { id: string; full_name: string } | null;
};

const VISITOR_SELECT = `
  id,
  condominium_id,
  unit_id,
  guest_type,
  full_name,
  document_type,
  document_number,
  company_name,
  vehicle_plate,
  access_starts_at,
  access_ends_at,
  status,
  notes,
  doorman_notes,
  requested_by,
  reviewed_by,
  reviewed_at,
  created_at,
  updated_at
`;

const VISITOR_DETAIL_SELECT = `
  ${VISITOR_SELECT},
  units!inner (
    id,
    number,
    block,
    towers!inner (
      id,
      name
    )
  ),
  requester:profiles!visitor_authorizations_requested_by_fkey (
    id,
    full_name
  ),
  reviewer:profiles!visitor_authorizations_reviewed_by_fkey (
    id,
    full_name
  )
`;

function mapVisitorAuthorization(row: VisitorAuthorizationRow): VisitorAuthorizationRecord {
  return { ...row };
}

function mapVisitorDetail(row: VisitorAuthorizationDetailRow): VisitorAuthorizationWithDetails {
  return {
    ...mapVisitorAuthorization(row),
    unit: {
      id: row.units.id,
      number: row.units.number,
      block: row.units.block,
      tower: row.units.towers,
    },
    requester: row.requester,
    reviewer: row.reviewer,
  };
}

export type VisitorAuthorizationListOptions = {
  unitId?: string;
  status?: VisitorAuthorizationStatus | "all";
  guestType?: VisitorAuthorizationRecord["guest_type"] | "all";
  consultWindowOnly?: boolean;
  search?: string;
};

  condominiumId: string,
  options?: VisitorAuthorizationListOptions,
): Promise<ServiceResult<VisitorAuthorizationWithDetails[]>> {
  const supabase = await createClient();

  let query = supabase
    .from("visitor_authorizations")
    .select(VISITOR_DETAIL_SELECT)
    .eq("condominium_id", condominiumId)
    .order("access_starts_at", { ascending: false });

  if (options?.unitId) {
    query = query.eq("unit_id", options.unitId);
  }

  if (options?.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  if (options?.guestType && options.guestType !== "all") {
    query = query.eq("guest_type", options.guestType);
  }

  const { data, error } = await query;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  let rows = ((data as VisitorAuthorizationDetailRow[] | null) ?? []).map(mapVisitorDetail);

  if (options?.consultWindowOnly) {
    rows = rows.filter((row) => isInDoormanConsultWindow(row));
  }

  if (options?.search) {
    const term = options.search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (row) =>
          row.full_name.toLowerCase().includes(term) ||
          row.document_number?.toLowerCase().includes(term) ||
          row.vehicle_plate?.toLowerCase().includes(term) ||
          row.company_name?.toLowerCase().includes(term) ||
          row.unit.number.toLowerCase().includes(term) ||
          row.unit.tower.name.toLowerCase().includes(term),
      );
    }
  }

  return { data: rows, error: null };
}

export async function listVisitorAuthorizationsByUnit(
  unitId: string,
  condominiumId: string,
): Promise<ServiceResult<VisitorAuthorizationWithDetails[]>> {
  return listVisitorAuthorizationsByCondominium(condominiumId, { unitId });
}

export async function getVisitorAuthorizationById(
  authorizationId: string,
  condominiumId: string,
): Promise<ServiceResult<VisitorAuthorizationWithDetails>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("visitor_authorizations")
    .select(VISITOR_DETAIL_SELECT)
    .eq("id", authorizationId)
    .eq("condominium_id", condominiumId)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Autorização não encontrada neste condomínio.");
  }

  return { data: mapVisitorDetail(data as VisitorAuthorizationDetailRow), error: null };
}

type VisitorWriteInput = {
  unit_id: string;
  guest_type: VisitorAuthorizationRecord["guest_type"];
  full_name: string;
  document_type: string | null;
  document_number: string | null;
  company_name: string | null;
  vehicle_plate: string | null;
  access_starts_at: string;
  access_ends_at: string;
  notes: string | null;
};

function toDbPayload(input: VisitorWriteInput) {
  return {
    unit_id: input.unit_id,
    guest_type: input.guest_type,
    full_name: input.full_name,
    document_type: input.document_type,
    document_number: input.document_number,
    company_name: input.company_name,
    vehicle_plate: input.vehicle_plate,
    access_starts_at: input.access_starts_at,
    access_ends_at: input.access_ends_at,
    notes: input.notes,
  };
}

async function validateUnitForCondominium(
  unitId: string,
  condominiumId: string,
): Promise<ServiceResult<null>> {
  const unitResult = await getUnitById(unitId, condominiumId);
  if (unitResult.error) {
    return serviceError("Unidade inválida para este condomínio.");
  }
  return { data: null, error: null };
}

export async function createVisitorAuthorization(input: {
  condominiumId: string;
  requestedBy: string;
  createdByStaff: boolean;
  data: VisitorWriteInput;
}): Promise<ServiceResult<VisitorAuthorizationWithDetails>> {
  const unitCheck = await validateUnitForCondominium(input.data.unit_id, input.condominiumId);
  if (unitCheck.error) {
    return serviceError(unitCheck.error);
  }

  const status = input.createdByStaff
    ? VISITOR_AUTHORIZATION_STATUS.APPROVED
    : VISITOR_AUTHORIZATION_STATUS.PENDING;

  const supabase = await createClient();

  const insertPayload: Record<string, unknown> = {
    condominium_id: input.condominiumId,
    requested_by: input.requestedBy,
    status,
    ...toDbPayload(input.data),
  };

  if (input.createdByStaff) {
    insertPayload.reviewed_by = input.requestedBy;
    insertPayload.reviewed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("visitor_authorizations")
    .insert(insertPayload)
    .select(VISITOR_DETAIL_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return { data: mapVisitorDetail(data as VisitorAuthorizationDetailRow), error: null };
}

export async function updateVisitorAuthorization(input: {
  authorizationId: string;
  condominiumId: string;
  data: VisitorWriteInput;
}): Promise<ServiceResult<VisitorAuthorizationWithDetails>> {
  const unitCheck = await validateUnitForCondominium(input.data.unit_id, input.condominiumId);
  if (unitCheck.error) {
    return serviceError(unitCheck.error);
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("visitor_authorizations")
    .update(toDbPayload(input.data))
    .eq("id", input.authorizationId)
    .eq("condominium_id", input.condominiumId)
    .select(VISITOR_DETAIL_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return { data: mapVisitorDetail(data as VisitorAuthorizationDetailRow), error: null };
}

async function updateVisitorStatus(input: {
  authorizationId: string;
  condominiumId: string;
  status: VisitorAuthorizationStatus;
  reviewedBy: string;
  validate?: (record: VisitorAuthorizationWithDetails) => string | null;
}): Promise<ServiceResult<VisitorAuthorizationWithDetails>> {
  const current = await getVisitorAuthorizationById(input.authorizationId, input.condominiumId);
  if (current.error) {
    return serviceError(current.error);
  }

  if (input.validate) {
    const validationError = input.validate(current.data);
    if (validationError) {
      return serviceError(validationError);
    }
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("visitor_authorizations")
    .update({
      status: input.status,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.authorizationId)
    .eq("condominium_id", input.condominiumId)
    .select(VISITOR_DETAIL_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return { data: mapVisitorDetail(data as VisitorAuthorizationDetailRow), error: null };
}

export async function approveVisitorAuthorization(
  authorizationId: string,
  condominiumId: string,
  reviewedBy: string,
): Promise<ServiceResult<VisitorAuthorizationWithDetails>> {
  return updateVisitorStatus({
    authorizationId,
    condominiumId,
    status: VISITOR_AUTHORIZATION_STATUS.APPROVED,
    reviewedBy,
    validate: (record) =>
      record.status === VISITOR_AUTHORIZATION_STATUS.PENDING
        ? null
        : "Somente autorizações pendentes podem ser aprovadas.",
  });
}

export async function rejectVisitorAuthorization(
  authorizationId: string,
  condominiumId: string,
  reviewedBy: string,
): Promise<ServiceResult<VisitorAuthorizationWithDetails>> {
  return updateVisitorStatus({
    authorizationId,
    condominiumId,
    status: VISITOR_AUTHORIZATION_STATUS.REJECTED,
    reviewedBy,
    validate: (record) =>
      record.status === VISITOR_AUTHORIZATION_STATUS.PENDING
        ? null
        : "Somente autorizações pendentes podem ser rejeitadas.",
  });
}

export async function cancelVisitorAuthorization(
  authorizationId: string,
  condominiumId: string,
): Promise<ServiceResult<VisitorAuthorizationWithDetails>> {
  const current = await getVisitorAuthorizationById(authorizationId, condominiumId);
  if (current.error) {
    return serviceError(current.error);
  }

  if (
    current.data.status !== VISITOR_AUTHORIZATION_STATUS.PENDING &&
    current.data.status !== VISITOR_AUTHORIZATION_STATUS.APPROVED
  ) {
    return serviceError("Esta autorização não pode ser cancelada.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("visitor_authorizations")
    .update({ status: VISITOR_AUTHORIZATION_STATUS.CANCELLED })
    .eq("id", authorizationId)
    .eq("condominium_id", condominiumId)
    .select(VISITOR_DETAIL_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return { data: mapVisitorDetail(data as VisitorAuthorizationDetailRow), error: null };
}

export async function updateVisitorDoormanNotes(input: {
  authorizationId: string;
  condominiumId: string;
  doormanNotes: string | null;
}): Promise<ServiceResult<VisitorAuthorizationWithDetails>> {
  const current = await getVisitorAuthorizationById(input.authorizationId, input.condominiumId);
  if (current.error) {
    return serviceError(current.error);
  }

  if (
    current.data.status !== VISITOR_AUTHORIZATION_STATUS.PENDING &&
    current.data.status !== VISITOR_AUTHORIZATION_STATUS.APPROVED
  ) {
    return serviceError("Notas da portaria só podem ser registradas em autorizações pendentes ou aprovadas.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("visitor_authorizations")
    .update({ doorman_notes: input.doormanNotes })
    .eq("id", input.authorizationId)
    .eq("condominium_id", input.condominiumId)
    .select(VISITOR_DETAIL_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return { data: mapVisitorDetail(data as VisitorAuthorizationDetailRow), error: null };
}
