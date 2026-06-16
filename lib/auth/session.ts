import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/types";
import type { SessionUser } from "@/lib/auth/types";

export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getAuthUserId(): Promise<string | null> {
  const user = await getAuthUser();
  return user?.id ?? null;
}

export async function requireAuthUser(): Promise<User> {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function ensureProfile(user: User): Promise<Profile> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Usuário";

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      full_name: fullName,
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    })
    .select("*")
    .single();

  if (inserted) {
    return inserted;
  }

  // Fallback via service role se RLS/trigger falhar
  const admin = createAdminClient();
  const { data: upserted, error: upsertError } = await admin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name: fullName,
        avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (upsertError || !upserted) {
    throw new Error(insertError?.message ?? upsertError?.message ?? "Falha ao garantir profile");
  }

  return upserted;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data;
}

export async function getSession(): Promise<SessionUser | null> {
  const user = await getAuthUser();
  if (!user) {
    return null;
  }

  const profile = await ensureProfile(user);

  return {
    user,
    profile,
  };
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_super_admin");
  if (error) {
    return false;
  }
  return Boolean(data);
}
