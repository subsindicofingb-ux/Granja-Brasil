import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServiceRoleKey, isSupabaseConfigured } from "@/lib/supabase/env";
import type { Profile } from "@/types";
import type { SessionUser } from "@/lib/auth/types";

function getDisplayNameFromUser(user: User): string {
  return (
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Usuário"
  );
}

function getAvatarFromUser(user: User): string | null {
  return (
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null
  );
}

function buildProfileFromUser(user: User): Profile {
  const now = new Date().toISOString();

  return {
    id: user.id,
    full_name: getDisplayNameFromUser(user),
    avatar_url: getAvatarFromUser(user),
    created_at: now,
    updated_at: now,
  };
}

export async function getAuthUser() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
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
  if (!isSupabaseConfigured()) {
    return buildProfileFromUser(user);
  }

  try {
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    const fullName = getDisplayNameFromUser(user);

    const { data: inserted } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name: fullName,
        avatar_url: getAvatarFromUser(user),
      })
      .select("*")
      .single();

    if (inserted) {
      return inserted;
    }

    const { data: existingAfterInsert } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (existingAfterInsert) {
      return existingAfterInsert;
    }

    if (getSupabaseServiceRoleKey()) {
      const admin = createAdminClient();
      const { data: upserted } = await admin
        .from("profiles")
        .upsert(
          {
            id: user.id,
            full_name: fullName,
            avatar_url: getAvatarFromUser(user),
          },
          { onConflict: "id" },
        )
        .select("*")
        .single();

      if (upserted) {
        return upserted;
      }
    }
  } catch {
    // Banco indisponível ou migrations pendentes — segue com profile derivado do auth.
  }

  return buildProfileFromUser(user);
}

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    return data;
  } catch {
    return null;
  }
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
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("is_super_admin");
    if (error) {
      return false;
    }
    return Boolean(data);
  } catch {
    return false;
  }
}
