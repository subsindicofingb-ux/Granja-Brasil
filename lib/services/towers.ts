import { createClient } from "@/lib/supabase/server";
import type { Tower } from "@/types";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";

export async function listTowersByCondominium(
  condominiumId: string,
): Promise<ServiceResult<Tower[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("towers")
    .select("*")
    .eq("condominium_id", condominiumId)
    .order("name", { ascending: true });

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(data ?? []);
}

export async function getTowerById(
  towerId: string,
  condominiumId: string,
): Promise<ServiceResult<Tower>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("towers")
    .select("*")
    .eq("id", towerId)
    .eq("condominium_id", condominiumId)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceError("Torre não encontrada neste condomínio.");
  }

  return serviceOk(data);
}

export async function createTower(input: {
  condominiumId: string;
  name: string;
  floors: number;
}): Promise<ServiceResult<Tower>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("towers")
    .insert({
      condominium_id: input.condominiumId,
      name: input.name,
      floors: input.floors,
    })
    .select("*")
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(data);
}

export async function updateTower(input: {
  towerId: string;
  condominiumId: string;
  name: string;
  floors: number;
}): Promise<ServiceResult<Tower>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("towers")
    .update({
      name: input.name,
      floors: input.floors,
    })
    .eq("id", input.towerId)
    .eq("condominium_id", input.condominiumId)
    .select("*")
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk(data);
}

export async function countTowersByCondominium(condominiumId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("towers")
    .select("*", { count: "exact", head: true })
    .eq("condominium_id", condominiumId);

  return count ?? 0;
}
