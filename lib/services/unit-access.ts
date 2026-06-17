import { createClient } from "@/lib/supabase/server";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";

export async function resolveUnitContext(
  unitId: string,
  scopeCondominiumId?: string,
): Promise<ServiceResult<{ unitCondominiumId: string }>> {
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
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Unidade inválida.");
  }

  const unitCondominiumId = data.towers.condominium_id;

  if (scopeCondominiumId && unitCondominiumId !== scopeCondominiumId) {
    return serviceError("Unidade inválida para este condomínio.");
  }

  return serviceOk({ unitCondominiumId });
}
