import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export function extractCondoSlugFromAppPath(pathname: string): string | null {
  if (!pathname.startsWith("/app/")) {
    return null;
  }

  const remainder = pathname.slice("/app/".length);
  if (!remainder) {
    return null;
  }

  const slug = remainder.split("/")[0]?.trim();
  return slug || null;
}

export async function canAccessCondoSlug(
  supabase: SupabaseClient<Database>,
  condoSlug: string,
): Promise<boolean> {
  const { data: isSuperAdmin, error: rpcError } = await supabase.rpc("is_super_admin");

  if (!rpcError && isSuperAdmin) {
    return true;
  }

  const { data: membership, error } = await supabase
    .from("memberships")
    .select("id, condominium:condominiums!inner(slug)")
    .eq("condominiums.slug", condoSlug)
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(membership);
}

export async function resolveSafeAppRedirect(
  supabase: SupabaseClient<Database>,
  redirectTo: string,
): Promise<string> {
  const normalized = redirectTo.startsWith("/") ? redirectTo : "/app";
  const condoSlug = extractCondoSlugFromAppPath(normalized);

  if (!condoSlug) {
    return normalized === "/app" || normalized.startsWith("/app?") ? normalized : "/app";
  }

  const allowed = await canAccessCondoSlug(supabase, condoSlug);
  return allowed ? normalized : "/app";
}
