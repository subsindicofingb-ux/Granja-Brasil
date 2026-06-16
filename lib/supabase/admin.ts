import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "@/lib/supabase/env";

/**
 * Cliente Supabase com service role — apenas server-side.
 * Bypassa RLS. Nunca expor ao browser.
 */
export function createAdminClient() {
  const env = getSupabasePublicEnv();
  const key = getSupabaseServiceRoleKey();

  if (!env || !key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL");
  }

  return createServerClient<Database>(env.url, key, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
