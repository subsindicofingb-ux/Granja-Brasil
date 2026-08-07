import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OCCURRENCE_STATUS, ROLES } from "@/lib/constants";
import type { Role } from "@/lib/constants";
import type {
  OccurrenceCategory,
  OccurrenceStatus,
  OccurrenceWithDetails,
} from "@/lib/occurrences/types";
import { mapSupabaseError, serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";

const OCCURRENCE_SELECT = `
  id,
  condominium_id,
  source_condominium_id,
  unit_id,
  category,
  title,
  description,
  location_text,
  status,
  occurred_at,
  created_by,
  created_at,
  updated_at,
  closed_at,
  closed_by,
  internal_notes,
  response_text,
  attachment_url,
  attachment_name
`;

type OccurrenceRow = {
  id: string;
  condominium_id: string;
  source_condominium_id: string | null;
  unit_id: string | null;
  category: OccurrenceCategory;
  title: string;
  description: string;
  location_text: string | null;
  status: OccurrenceStatus;
  occurred_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_by: string | null;
  internal_notes: string | null;
  response_text: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
};

async function getProfileMap(profileIds: string[]) {
  const unique = [...new Set(profileIds.filter(Boolean))];
  if (unique.length === 0) {
    return new Map<string, { id: string; full_name: string }>();
  }

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", unique);
  return new Map((data ?? []).map((row) => [row.id, row]));
}

async function getUnitMap(unitIds: string[]) {
  const unique = [...new Set(unitIds.filter(Boolean))];
  if (unique.length === 0) {
    return new Map<
      string,
      { id: string; number: string; block: string | null; tower: { id: string; name: string } }
    >();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select("id, number, block, tower:towers!inner(id, name)")
    .in("id", unique);

  return new Map(
    (data ?? []).map((row) => {
      const tower = Array.isArray(row.tower) ? row.tower[0] : row.tower;
      return [
        row.id,
        {
          id: row.id,
          number: row.number,
          block: row.block,
          tower: tower as { id: string; name: string },
        },
      ];
    }),
  );
}

async function hydrateOccurrences(
  rows: OccurrenceRow[],
): Promise<OccurrenceWithDetails[]> {
  const profileMap = await getProfileMap([
    ...rows.map((row) => row.created_by),
    ...rows.map((row) => row.closed_by).filter((id): id is string => Boolean(id)),
  ]);
  const unitMap = await getUnitMap(
    rows.map((row) => row.unit_id).filter((id): id is string => Boolean(id)),
  );

  return rows.map((row) => ({
    ...row,
    author: profileMap.get(row.created_by) ?? null,
    closed_by_profile: row.closed_by ? profileMap.get(row.closed_by) ?? null : null,
    unit: row.unit_id ? unitMap.get(row.unit_id) ?? null : null,
  }));
}

function isOccurrenceManagerRole(role: Role): boolean {
  return (
    role === ROLES.SUPER_ADMIN ||
    role === ROLES.ADMIN ||
    role === ROLES.SYNDIC ||
    role === ROLES.SUB_SYNDIC ||
    role === ROLES.DOORMAN ||
    role === ROLES.STAFF
  );
}

export async function listOccurrences(options: {
  condominiumId: string;
  profileId: string;
  role: Role;
  isGranjaContext: boolean;
  status?: OccurrenceStatus | "all";
}): Promise<ServiceResult<OccurrenceWithDetails[]>> {
  try {
    const supabase = await createClient();
    const manager = isOccurrenceManagerRole(options.role);

    let query = supabase
      .from("occurrences")
      .select(OCCURRENCE_SELECT)
      .order("occurred_at", { ascending: false });

    if (options.isGranjaContext) {
      // Granja: só super/admin enxergam o livro (RLS reforça); listamos do condo Granja.
      query = query.eq("condominium_id", options.condominiumId);
    } else if (manager) {
      // Prédio: gestores veem só as do próprio condomínio.
      query = query.eq("condominium_id", options.condominiumId);
    } else {
      // Morador: só as próprias (do prédio ou enviadas à Granja a partir deste prédio).
      query = query
        .eq("created_by", options.profileId)
        .or(
          `condominium_id.eq.${options.condominiumId},source_condominium_id.eq.${options.condominiumId}`,
        );
    }

    if (options.status && options.status !== "all") {
      query = query.eq("status", options.status);
    }

    const { data, error } = await query;
    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    return serviceOk(await hydrateOccurrences((data as OccurrenceRow[] | null) ?? []));
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Erro ao carregar ocorrências.",
    );
  }
}

export async function getOccurrenceById(
  occurrenceId: string,
): Promise<ServiceResult<OccurrenceWithDetails>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("occurrences")
      .select(OCCURRENCE_SELECT)
      .eq("id", occurrenceId)
      .maybeSingle();

    if (error) {
      return serviceError(mapSupabaseError(error));
    }
    if (!data) {
      return serviceError("Ocorrência não encontrada.");
    }

    const [hydrated] = await hydrateOccurrences([data as OccurrenceRow]);
    return serviceOk(hydrated);
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Erro ao carregar ocorrência.",
    );
  }
}

export async function createOccurrence(input: {
  condominiumId: string;
  sourceCondominiumId?: string | null;
  createdBy: string;
  category: OccurrenceCategory;
  title: string;
  description: string;
  locationText?: string | null;
  unitId?: string | null;
  occurredAt: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}): Promise<ServiceResult<OccurrenceWithDetails>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("occurrences")
      .insert({
        condominium_id: input.condominiumId,
        source_condominium_id: input.sourceCondominiumId ?? null,
        created_by: input.createdBy,
        category: input.category,
        title: input.title,
        description: input.description,
        location_text: input.locationText?.trim() || null,
        unit_id: input.unitId || null,
        occurred_at: input.occurredAt,
        status: OCCURRENCE_STATUS.OPEN,
        attachment_url: input.attachmentUrl ?? null,
        attachment_name: input.attachmentName ?? null,
      })
      .select(OCCURRENCE_SELECT)
      .single();

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    const [hydrated] = await hydrateOccurrences([data as OccurrenceRow]);
    return serviceOk(hydrated);
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Erro ao registrar ocorrência.",
    );
  }
}

export async function updateOccurrenceStatus(input: {
  occurrenceId: string;
  status: OccurrenceStatus;
  actorId: string;
  responseText?: string | null;
  internalNotes?: string | null;
}): Promise<ServiceResult<OccurrenceWithDetails>> {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const isClosed = input.status === OCCURRENCE_STATUS.CLOSED;

    const { data, error } = await supabase
      .from("occurrences")
      .update({
        status: input.status,
        response_text: input.responseText?.trim() || null,
        internal_notes: input.internalNotes?.trim() || null,
        closed_at: isClosed ? now : null,
        closed_by: isClosed ? input.actorId : null,
      })
      .eq("id", input.occurrenceId)
      .select(OCCURRENCE_SELECT)
      .single();

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    const [hydrated] = await hydrateOccurrences([data as OccurrenceRow]);
    return serviceOk(hydrated);
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Erro ao atualizar ocorrência.",
    );
  }
}

/** Usado só para e-mail (bypass de listagem). */
export async function getOccurrenceByIdAdmin(
  occurrenceId: string,
): Promise<ServiceResult<OccurrenceWithDetails>> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("occurrences")
      .select(OCCURRENCE_SELECT)
      .eq("id", occurrenceId)
      .maybeSingle();

    if (error) {
      return serviceError(mapSupabaseError(error));
    }
    if (!data) {
      return serviceError("Ocorrência não encontrada.");
    }

    const [hydrated] = await hydrateOccurrences([data as OccurrenceRow]);
    return serviceOk(hydrated);
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Erro ao carregar ocorrência.",
    );
  }
}
