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

export async function getCondominiumBySlug(
  slug: string,
): Promise<ServiceResult<CondominiumRecord>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("condominiums")
    .select("id, name, slug, created_at, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Condomínio não encontrado.");
  }

  return serviceOk(data);
}

export async function createCondominium(input: {
  name: string;
  slug: string;
}): Promise<ServiceResult<CondominiumRecord>> {
  try {
    const admin = createAdminClient();
    const normalizedName = input.name.trim();
    const normalizedSlug = input.slug.trim().toLowerCase();

    const { data: existingBySlug, error: slugLookupError } = await admin
      .from("condominiums")
      .select("id, name, slug")
      .eq("slug", normalizedSlug)
      .maybeSingle();

    if (slugLookupError) {
      return serviceError(mapSupabaseError(slugLookupError));
    }

    if (existingBySlug) {
      return serviceError("Já existe um condomínio com este identificador.");
    }

    const { data: existingByName, error: nameLookupError } = await admin
      .from("condominiums")
      .select("id, name, slug")
      .ilike("name", normalizedName)
      .maybeSingle();

    if (nameLookupError) {
      return serviceError(mapSupabaseError(nameLookupError));
    }

    if (existingByName) {
      return serviceError("Já existe um condomínio com este nome.");
    }

    const { data, error } = await admin
      .from("condominiums")
      .insert({
        name: normalizedName,
        slug: normalizedSlug,
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
