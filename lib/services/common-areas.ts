import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { ALLOWED_DAYS } from "@/lib/common-areas/types";
import type {
  AllowedDay,
  CommonAreaRecord,
  MaintenanceBlock,
  OperatingHours,
} from "@/lib/common-areas/types";
import {
  resolveBufferDays,
  resolveMinAdvanceDays,
} from "@/lib/common-areas/defaults";
import {
  getGranjaCondominiumId,
  isEligibleForGranjaSharedCommonAreas,
  type CondominiumContext,
} from "@/lib/condominiums/granja-shared-areas";
import type { Json } from "@/types/database.types";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";

type CommonAreaRow = {
  id: string;
  condominium_id: string;
  name: string;
  capacity: number;
  description: string | null;
  is_active: boolean;
  requires_approval: boolean;
  requires_payment?: boolean;
  max_duration_minutes: number | null;
  min_advance_minutes: number;
  min_advance_days?: number | null;
  max_advance_days: number | null;
  max_reservations_per_unit: number | null;
  reservation_period_days: number;
  buffer_minutes: number;
  buffer_days?: number | null;
  operating_hours: OperatingHours | string;
  allowed_days: AllowedDay[] | string;
  maintenance_blocks: MaintenanceBlock[] | string;
  rules: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function parseOperatingHours(value: unknown): OperatingHours {
  if (typeof value === "object" && value !== null && "start" in value && "end" in value) {
    return {
      start: String((value as OperatingHours).start),
      end: String((value as OperatingHours).end),
    };
  }
  return { start: "08:00", end: "22:00" };
}

function parseAllowedDays(value: unknown): AllowedDay[] {
  if (!Array.isArray(value)) return [...ALLOWED_DAYS];
  return value.filter((day): day is AllowedDay =>
    ALLOWED_DAYS.includes(day as AllowedDay),
  );
}

function parseMaintenanceBlocks(value: unknown): MaintenanceBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is MaintenanceBlock => {
      return (
        typeof item === "object" &&
        item !== null &&
        "title" in item &&
        "start_at" in item &&
        "end_at" in item
      );
    })
    .map((item) => ({
      title: String(item.title),
      start_at: String(item.start_at),
      end_at: String(item.end_at),
      reason: item.reason ? String(item.reason) : null,
    }));
}

function mapCommonArea(row: CommonAreaRow): CommonAreaRecord {
  return {
    id: row.id,
    condominium_id: row.condominium_id,
    name: row.name,
    capacity: row.capacity,
    description: row.description,
    is_active: row.is_active,
    requires_approval: row.requires_approval,
    requires_payment: row.requires_payment ?? false,
    min_advance_days: resolveMinAdvanceDays(row.min_advance_days, row.min_advance_minutes),
    max_advance_days: row.max_advance_days,
    max_reservations_per_unit: row.max_reservations_per_unit,
    reservation_period_days: row.reservation_period_days,
    buffer_days: resolveBufferDays(row.buffer_days, row.buffer_minutes),
    operating_hours: parseOperatingHours(row.operating_hours),
    allowed_days: parseAllowedDays(row.allowed_days),
    maintenance_blocks: parseMaintenanceBlocks(row.maintenance_blocks),
    rules: row.rules ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const COMMON_AREA_SELECT = `
  id,
  condominium_id,
  name,
  capacity,
  description,
  is_active,
  requires_approval,
  requires_payment,
  min_advance_days,
  max_advance_days,
  max_reservations_per_unit,
  reservation_period_days,
  buffer_days,
  operating_hours,
  allowed_days,
  maintenance_blocks,
  rules,
  created_at,
  updated_at
`;

export type CommonAreaListOptions = {
  isActive?: boolean;
};

async function listCommonAreasWithClient(
  supabase: SupabaseClient<Database>,
  condominiumId: string,
  options?: CommonAreaListOptions,
): Promise<ServiceResult<CommonAreaRecord[]>> {
  let query = supabase
    .from("common_areas")
    .select(COMMON_AREA_SELECT)
    .eq("condominium_id", condominiumId)
    .order("name", { ascending: true });

  if (options?.isActive !== undefined) {
    query = query.eq("is_active", options.isActive);
  }

  const { data, error } = await query;

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(((data as CommonAreaRow[] | null) ?? []).map(mapCommonArea));
}

export async function listCommonAreasByCondominium(
  condominiumId: string,
  options?: CommonAreaListOptions,
): Promise<ServiceResult<CommonAreaRecord[]>> {
  const supabase = await createClient();
  return listCommonAreasWithClient(supabase, condominiumId, options);
}

function mergeCommonAreas(primary: CommonAreaRecord[], secondary: CommonAreaRecord[]) {
  const byId = new Map<string, CommonAreaRecord>();

  for (const area of primary) {
    byId.set(area.id, area);
  }

  for (const area of secondary) {
    byId.set(area.id, area);
  }

  return Array.from(byId.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export async function listReservableCommonAreasForContext(
  context: CondominiumContext,
  options?: CommonAreaListOptions,
): Promise<ServiceResult<CommonAreaRecord[]>> {
  const ownResult = await listCommonAreasByCondominium(context.condominiumId, options);

  if (!ownResult.ok) {
    return ownResult;
  }

  if (!(await isEligibleForGranjaSharedCommonAreas(context))) {
    return ownResult;
  }

  const granjaCondominiumId = await getGranjaCondominiumId();

  if (!granjaCondominiumId || granjaCondominiumId === context.condominiumId) {
    return ownResult;
  }

  const granjaSupabase = getSupabaseServiceRoleKey()
    ? createAdminClient()
    : await createClient();
  const granjaResult = await listCommonAreasWithClient(
    granjaSupabase,
    granjaCondominiumId,
    options,
  );

  if (!granjaResult.ok || granjaResult.data.length === 0) {
    const fallbackResult = await listCommonAreasByCondominium(granjaCondominiumId, options);

    if (fallbackResult.ok && fallbackResult.data.length > 0) {
      return serviceOk(mergeCommonAreas(ownResult.data, fallbackResult.data));
    }

    if (!granjaResult.ok) {
      return ownResult;
    }
  }

  return serviceOk(mergeCommonAreas(ownResult.data, granjaResult.data));
}

export async function getBookableCommonAreaById(
  areaId: string,
  context: CondominiumContext,
): Promise<ServiceResult<CommonAreaRecord>> {
  const ownResult = await getCommonAreaById(areaId, context.condominiumId);

  if (ownResult.ok) {
    return ownResult;
  }

  if (!(await isEligibleForGranjaSharedCommonAreas(context))) {
    return ownResult;
  }

  const granjaCondominiumId = await getGranjaCondominiumId();

  if (!granjaCondominiumId || granjaCondominiumId === context.condominiumId) {
    return ownResult;
  }

  return getCommonAreaById(areaId, granjaCondominiumId);
}

export async function getCommonAreaById(
  areaId: string,
  condominiumId: string,
): Promise<ServiceResult<CommonAreaRecord>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("common_areas")
    .select(COMMON_AREA_SELECT)
    .eq("id", areaId)
    .eq("condominium_id", condominiumId)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Espaço comum não encontrado neste condomínio.");
  }

  return serviceOk(mapCommonArea(data as CommonAreaRow));
}

type CommonAreaWriteInput = Omit<
  CommonAreaRecord,
  "id" | "condominium_id" | "created_at" | "updated_at" | "rules"
> & { rules?: Record<string, unknown> };

function toDbPayload(input: CommonAreaWriteInput) {
  return {
    name: input.name,
    description: input.description,
    capacity: input.capacity,
    is_active: input.is_active,
    requires_approval: input.requires_approval,
    requires_payment: input.requires_payment,
    max_duration_minutes: null,
    min_advance_minutes: 0,
    min_advance_days: input.min_advance_days,
    max_advance_days: input.max_advance_days,
    max_reservations_per_unit: input.max_reservations_per_unit,
    reservation_period_days: input.reservation_period_days,
    buffer_minutes: 0,
    buffer_days: input.buffer_days,
    operating_hours: input.operating_hours,
    allowed_days: input.allowed_days,
    maintenance_blocks: input.maintenance_blocks,
    rules: (input.rules ?? {}) as Json,
  };
}

export async function createCommonArea(input: {
  condominiumId: string;
  data: CommonAreaWriteInput;
}): Promise<ServiceResult<CommonAreaRecord>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("common_areas")
    .insert({
      condominium_id: input.condominiumId,
      ...toDbPayload(input.data),
    })
    .select(COMMON_AREA_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(mapCommonArea(data as CommonAreaRow));
}

export async function updateCommonArea(input: {
  areaId: string;
  condominiumId: string;
  data: CommonAreaWriteInput;
}): Promise<ServiceResult<CommonAreaRecord>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("common_areas")
    .update(toDbPayload(input.data))
    .eq("id", input.areaId)
    .eq("condominium_id", input.condominiumId)
    .select(COMMON_AREA_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(mapCommonArea(data as CommonAreaRow));
}
