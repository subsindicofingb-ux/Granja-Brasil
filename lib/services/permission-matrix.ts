import {
  buildDefaultPermissionMatrix,
  parsePermissionMatrix,
  type RolePermissionMatrix,
} from "@/lib/auth/permission-matrix";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";

let cachedMatrix: RolePermissionMatrix | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30_000;

export async function loadPermissionMatrix(): Promise<RolePermissionMatrix> {
  const now = Date.now();
  if (cachedMatrix && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedMatrix;
  }

  if (!isSupabaseConfigured()) {
    cachedMatrix = buildDefaultPermissionMatrix();
    cacheLoadedAt = now;
    return cachedMatrix;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("app_permission_matrix")
      .select("matrix")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data?.matrix) {
      cachedMatrix = buildDefaultPermissionMatrix();
    } else {
      cachedMatrix = parsePermissionMatrix(data.matrix);
    }
  } catch {
    cachedMatrix = buildDefaultPermissionMatrix();
  }

  cacheLoadedAt = now;
  return cachedMatrix;
}

export function invalidatePermissionMatrixCache(): void {
  cachedMatrix = null;
  cacheLoadedAt = 0;
}

export async function savePermissionMatrix(input: {
  matrix: RolePermissionMatrix;
  updatedByProfileId: string;
}): Promise<ServiceResult<RolePermissionMatrix>> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("app_permission_matrix").upsert(
      {
        id: 1,
        matrix: input.matrix,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedByProfileId,
      },
      { onConflict: "id" },
    );

    if (error) {
      return serviceError(error.message);
    }

    invalidatePermissionMatrixCache();
    return serviceOk(input.matrix);
  } catch {
    return serviceError("Não foi possível salvar a matriz de permissões.");
  }
}
