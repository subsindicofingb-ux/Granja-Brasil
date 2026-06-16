export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  if (
    url.includes("your-project") ||
    anonKey.includes("your-anon-key") ||
    url.includes("example.supabase.co") ||
    url.includes("vercel.app") ||
    url.includes("supabase.com/dashboard")
  ) {
    return null;
  }

  if (!url.startsWith("https://") || !url.includes(".supabase.co")) {
    return null;
  }

  return { url, anonKey };
}

export function isSupabaseConfigured() {
  return getSupabasePublicEnv() !== null;
}

export function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? null;
}
