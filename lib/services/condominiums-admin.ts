import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapSupabaseError, serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";

export type CondominiumRecord = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

export async function listCondominiums(): Promise<ServiceResult<CondominiumRecord[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("condominiums")
    .select("id, name, slug, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(data ?? []);
}

export async function createCondominium(input: {
  name: string;
  slug: string;
}): Promise<ServiceResult<CondominiumRecord>> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("condominiums")
      .insert({
        name: input.name.trim(),
        slug: input.slug.trim().toLowerCase(),
      })
      .select("id, name, slug, created_at, updated_at")
      .single();

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    return serviceOk(data);
  } catch {
    return serviceError("Não foi possível cadastrar o condomínio.");
  }
}
