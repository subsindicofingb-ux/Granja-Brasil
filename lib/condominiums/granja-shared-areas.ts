import { getGranjaCondoSlug } from "@/lib/constants";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { createClient } from "@/lib/supabase/server";

export type CondominiumContext = {
  condominiumId: string;
  condominiumSlug: string;
};

let cachedGranjaCondominiumId: string | null | undefined;

export async function getGranjaCondominiumId(): Promise<string | null> {
  if (cachedGranjaCondominiumId !== undefined) {
    return cachedGranjaCondominiumId;
  }

  const supabase = await createClient();

  const { data: rpcId, error: rpcError } = await supabase.rpc("granja_condominium_id");

  if (!rpcError && typeof rpcId === "string" && rpcId.length > 0) {
    cachedGranjaCondominiumId = rpcId;
    return cachedGranjaCondominiumId;
  }

  const granjaSlug = getGranjaCondoSlug();
  const { data: bySlug } = await supabase
    .from("condominiums")
    .select("id")
    .eq("slug", granjaSlug)
    .maybeSingle();

  if (bySlug?.id) {
    cachedGranjaCondominiumId = bySlug.id;
    return cachedGranjaCondominiumId;
  }

  const { data: byName } = await supabase
    .from("condominiums")
    .select("id")
    .ilike("name", "Granja Brasil")
    .limit(1)
    .maybeSingle();

  cachedGranjaCondominiumId = byName?.id ?? null;
  return cachedGranjaCondominiumId;
}

export async function isEligibleForGranjaSharedCommonAreas(
  context: CondominiumContext,
): Promise<boolean> {
  if (isGeneralCondominium(context.condominiumSlug)) {
    return false;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("condominiums")
    .select("is_commercial")
    .eq("id", context.condominiumId)
    .maybeSingle();

  return !data?.is_commercial;
}
