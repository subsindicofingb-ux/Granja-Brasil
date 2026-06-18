import { DEMO_CONDO_SLUG } from "@/lib/constants";
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
  const { data } = await supabase
    .from("condominiums")
    .select("id")
    .eq("slug", DEMO_CONDO_SLUG)
    .maybeSingle();

  cachedGranjaCondominiumId = data?.id ?? null;
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
