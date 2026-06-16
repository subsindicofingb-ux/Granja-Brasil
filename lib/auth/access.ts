import { notFound, redirect } from "next/navigation";
import type { Role } from "@/lib/constants";
import { setActiveCondoSlug } from "@/lib/auth/active-condo";
import { ensureProfile, getAuthUser, requireSession, isSuperAdmin } from "@/lib/auth/session";
import {
  buildCondoAccess,
  type CondoAccess,
  type MembershipWithCondo,
} from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

type MembershipRow = {
  id: string;
  role: Role;
  condominium: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export async function getUserMemberships(): Promise<MembershipWithCondo[]> {
  const user = await getAuthUser();
  if (!user) {
    return [];
  }

  await ensureProfile(user);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("memberships")
    .select(
      `
      id,
      role,
      condominium:condominiums (
        id,
        name,
        slug
      )
    `,
    )
    .eq("profile_id", user.id)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as MembershipRow[])
    .filter((row): row is MembershipRow & { condominium: NonNullable<MembershipRow["condominium"]> } =>
      Boolean(row.condominium),
    )
    .map((row) => ({
      id: row.id,
      role: row.role,
      condominium: row.condominium,
    }));
}

export async function getAccessibleCondominiums(): Promise<MembershipWithCondo[]> {
  const memberships = await getUserMemberships();
  const superAdmin = await isSuperAdmin();

  if (!superAdmin) {
    return memberships;
  }

  const supabase = await createClient();
  const { data: condominiums } = await supabase
    .from("condominiums")
    .select("id, name, slug")
    .order("name");

  const bySlug = new Map<string, MembershipWithCondo>();

  for (const membership of memberships) {
    bySlug.set(membership.condominium.slug, membership);
  }

  for (const condominium of condominiums ?? []) {
    if (!bySlug.has(condominium.slug)) {
      bySlug.set(condominium.slug, {
        id: `super-admin-${condominium.id}`,
        role: "super_admin",
        condominium,
      });
    }
  }

  return Array.from(bySlug.values());
}

export async function getCondoAccess(slug: string): Promise<CondoAccess | null> {
  const session = await getSessionForAccess();
  if (!session) {
    return null;
  }

  const { user, profile } = session;
  const memberships = await getUserMemberships();
  const membership = memberships.find((item) => item.condominium.slug === slug);

  if (membership) {
    return buildCondoAccess({
      membershipId: membership.id,
      role: membership.role,
      condominium: membership.condominium,
      profile,
      email: user.email ?? "",
    });
  }

  const superAdmin = await isSuperAdmin();
  if (!superAdmin) {
    return null;
  }

  const supabase = await createClient();
  const { data: condominium } = await supabase
    .from("condominiums")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!condominium) {
    return null;
  }

  return buildCondoAccess({
    membershipId: null,
    role: "super_admin",
    condominium,
    profile,
    email: user.email ?? "",
  });
}

export async function requireCondoAccess(slug: string): Promise<CondoAccess> {
  const access = await getCondoAccess(slug);
  if (!access) {
    notFound();
  }

  await setActiveCondoSlug(slug);
  return access;
}

export async function requireCondoPermission(
  slug: string,
  check: (access: CondoAccess) => boolean,
  options?: { redirectTo?: string },
): Promise<CondoAccess> {
  const access = await requireCondoAccess(slug);

  if (!check(access)) {
    redirect(options?.redirectTo ?? `/app/${slug}`);
  }

  return access;
}

async function getSessionForAccess() {
  const user = await getAuthUser();
  if (!user) {
    return null;
  }

  const profile = await ensureProfile(user);
  return { user, profile };
}

export async function requireSessionWithMemberships() {
  const session = await requireSession();
  const memberships = await getUserMemberships();

  return { session, memberships };
}
