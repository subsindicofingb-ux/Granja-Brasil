import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapSupabaseError, serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";

export type CondominiumRecord = {
  id: string;
  name: string;
  slug: string;
  is_commercial: boolean;
  created_at: string;
  updated_at: string;
};

function mapCondominiumRow(row: {
  id: string;
  name: string;
  slug: string;
  is_commercial?: boolean | null;
  created_at: string;
  updated_at: string;
}): CondominiumRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    is_commercial: row.is_commercial ?? false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function isMissingCommercialColumn(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42703" ||
    error.message?.includes("is_commercial") === true ||
    error.message?.includes("column") === true
  );
}

export async function listCondominiums(): Promise<ServiceResult<CondominiumRecord[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("condominiums")
    .select("id, name, slug, is_commercial, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) {
    if (isMissingCommercialColumn(error)) {
      const fallback = await supabase
        .from("condominiums")
        .select("id, name, slug, created_at, updated_at")
        .order("name", { ascending: true });

      if (fallback.error) {
        return serviceError(mapSupabaseError(fallback.error));
      }

      return serviceOk((fallback.data ?? []).map(mapCondominiumRow));
    }

    return serviceError(mapSupabaseError(error));
  }

  return serviceOk((data ?? []).map(mapCondominiumRow));
}

export async function getCondominiumBySlug(
  slug: string,
): Promise<ServiceResult<CondominiumRecord>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("condominiums")
    .select("id, name, slug, is_commercial, created_at, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    if (isMissingCommercialColumn(error)) {
      const fallback = await supabase
        .from("condominiums")
        .select("id, name, slug, created_at, updated_at")
        .eq("slug", slug)
        .maybeSingle();

      if (fallback.error) {
        return serviceError(mapSupabaseError(fallback.error));
      }

      if (!fallback.data) {
        return serviceError("Condomínio não encontrado.");
      }

      return serviceOk(mapCondominiumRow(fallback.data));
    }

    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Condomínio não encontrado.");
  }

  return serviceOk(mapCondominiumRow(data));
}

export async function createCondominium(input: {
  name: string;
  slug: string;
  isCommercial?: boolean;
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
        is_commercial: input.isCommercial ?? false,
      })
      .select("id, name, slug, is_commercial, created_at, updated_at")
      .single();

    if (error && isMissingCommercialColumn(error)) {
      const fallback = await admin
        .from("condominiums")
        .insert({
          name: normalizedName,
          slug: normalizedSlug,
        })
        .select("id, name, slug, created_at, updated_at")
        .single();

      if (fallback.error) {
        return serviceError(mapSupabaseError(fallback.error));
      }

      return serviceOk(mapCondominiumRow(fallback.data));
    }

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    return serviceOk(mapCondominiumRow(data));
  } catch {
    return serviceError("Não foi possível cadastrar o condomínio.");
  }
}
