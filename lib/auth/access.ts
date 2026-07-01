import { redirect } from "next/navigation";
import type { Role } from "@/lib/constants";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import { setActiveCondoSlug } from "@/lib/auth/active-condo";
import { ensureProfile, getAuthUser, requireSession, isSuperAdmin } from "@/lib/auth/session";
import {
  buildCondoAccess,
  type CondoAccess,
  type MembershipWithCondo,
} from "@/lib/auth/types";
import { ROLES } from "@/lib/constants";
import { isProfileUnitResponsible } from "@/lib/services/notifications";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

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
  if (!user || !isSupabaseConfigured()) {
    return [];
  }

  await ensureProfile(user);

  try {
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
        condominium: {
          ...row.condominium,
          name: formatCondominiumDisplayName(row.condominium.name, row.condominium.slug),
        },
      }));
  } catch {
    return [];
  }
}

export async function getAccessibleCondominiums(): Promise<MembershipWithCondo[]> {
  const memberships = await getUserMemberships();
  const superAdmin = await isSuperAdmin();

  if (!superAdmin) {
    return memberships;
  }

  try {
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
          condominium: {
            ...condominium,
            name: formatCondominiumDisplayName(condominium.name, condominium.slug),
          },
        });
      }
    }

    return Array.from(bySlug.values());
  } catch {
    return memberships;
  }
}

async function enrichCondoAccess(access: CondoAccess): Promise<CondoAccess> {
  if (access.role !== ROLES.RESIDENT) {
    return access;
  }

  const isResponsible = await isProfileUnitResponsible({
    profileId: access.profile.id,
    condominiumId: access.condominium.id,
  });

  if (!isResponsible) {
    return access;
  }

  return {
    ...access,
    permissions: {
      ...access.permissions,
      canViewUnitNotifications: true,
    },
  };
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
    return enrichCondoAccess(
      buildCondoAccess({
        membershipId: membership.id,
        role: membership.role,
        condominium: membership.condominium,
        profile,
        email: user.email ?? "",
      }),
    );
  }

  const superAdmin = await isSuperAdmin();
  if (!superAdmin) {
    return null;
  }

  try {
    const supabase = await createClient();
    const { data: condominium } = await supabase
      .from("condominiums")
      .select("id, name, slug")
      .eq("slug", slug)
      .maybeSingle();

    if (!condominium) {
      return null;
    }

    return enrichCondoAccess(
      buildCondoAccess({
        membershipId: null,
        role: "super_admin",
        condominium: {
          ...condominium,
          name: formatCondominiumDisplayName(condominium.name, condominium.slug),
        },
        profile,
        email: user.email ?? "",
      }),
    );
  } catch {
    return null;
  }
}

export async function requireCondoAccess(slug: string): Promise<CondoAccess> {
  const access = await getCondoAccess(slug);
  if (!access) {
    const memberships = await getUserMemberships();
    const superAdmin = await isSuperAdmin();

    if (!superAdmin && memberships.length === 0) {
      redirect("/app/aguardando-aprovacao");
    }

    redirect("/app");
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
