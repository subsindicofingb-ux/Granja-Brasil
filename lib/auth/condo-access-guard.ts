import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  PENDING_APPROVAL_PATH,
  userHasAppAccess,
} from "@/lib/auth/pending-approval";

const ALLOWED_NON_APP_REDIRECTS = new Set(["/reset-password", "/signup"]);
const RESERVED_APP_SEGMENTS = new Set(["aguardando-aprovacao"]);

export async function userHasAnyMembership(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  const { data: isSuperAdmin, error: rpcError } = await supabase.rpc("is_super_admin");

  if (!rpcError && isSuperAdmin) {
    return true;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data, error } = await supabase
    .from("memberships")
    .select("id")
    .eq("profile_id", user.id)
    .limit(1);

  return !error && (data?.length ?? 0) > 0;
}

export function extractCondoSlugFromAppPath(pathname: string): string | null {
  if (!pathname.startsWith("/app/")) {
    return null;
  }

  const remainder = pathname.slice("/app/".length);
  if (!remainder) {
    return null;
  }

  const slug = remainder.split("/")[0]?.trim();
  if (!slug || RESERVED_APP_SEGMENTS.has(slug)) {
    return null;
  }

  return slug;
}

export async function canAccessCondoSlug(
  supabase: SupabaseClient<Database>,
  condoSlug: string,
): Promise<boolean> {
  const { data: isSuperAdmin, error: rpcError } = await supabase.rpc("is_super_admin");

  if (!rpcError && isSuperAdmin) {
    return true;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  // Filtra pelo usuário atual: staff (síndico/admin/portaria) enxerga todas as
  // memberships do condomínio via RLS; maybeSingle() falha com várias linhas.
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("id, condominium:condominiums!inner(slug)")
    .eq("profile_id", user.id)
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

  if (ALLOWED_NON_APP_REDIRECTS.has(normalized)) {
    return normalized;
  }

  if (normalized === PENDING_APPROVAL_PATH || normalized.startsWith(`${PENDING_APPROVAL_PATH}?`)) {
    return normalized;
  }

  if (!(await userHasAppAccess(supabase))) {
    return PENDING_APPROVAL_PATH;
  }

  const condoSlug = extractCondoSlugFromAppPath(normalized);

  if (!condoSlug) {
    return normalized === "/app" || normalized.startsWith("/app?") ? normalized : "/app";
  }

  const allowed = await canAccessCondoSlug(supabase, condoSlug);
  return allowed ? normalized : "/app";
}
