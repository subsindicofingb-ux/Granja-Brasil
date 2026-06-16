"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/constants";
import { clearActiveCondoSlug } from "@/lib/auth/active-condo";
import { requireCondoAccess } from "@/lib/auth/access";
import { ensureProfile, getAuthUser } from "@/lib/auth/session";
import type { AuthActionState } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function signInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/app");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Credenciais inválidas. Verifique e-mail e senha." };
  }

  if (data.user) {
    await ensureProfile(data.user);
  }

  revalidatePath("/", "layout");
  redirect(redirectTo.startsWith("/") ? redirectTo : "/app");
}

export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !password) {
    return { error: "Preencha todos os campos." };
  }

  if (password.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/app`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    await ensureProfile(data.user);
  }

  revalidatePath("/", "layout");
  redirect("/app");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearActiveCondoSlug();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function selectCondominiumAction(slug: string) {
  await requireCondoAccess(slug);
  redirect(`/app/${slug}`);
}

export async function selectCondominiumFormAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) {
    redirect("/app");
  }
  await selectCondominiumAction(slug);
}

export async function addMembershipAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as Role;

  if (!condoSlug || !email || !role) {
    return { error: "Preencha e-mail e papel." };
  }

  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canManageMembers) {
    return { error: "Sem permissão para gerenciar membros." };
  }

  const admin = createAdminClient();
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    return { error: "Não foi possível buscar usuários." };
  }

  const targetUser = listed.users.find(
    (user) => user.email?.toLowerCase() === email,
  );

  if (!targetUser) {
    return {
      error:
        "Usuário não encontrado. Peça para a pessoa criar conta em /signup antes de vincular.",
    };
  }

  await admin.from("profiles").upsert(
    {
      id: targetUser.id,
      full_name:
        (targetUser.user_metadata?.full_name as string | undefined) ??
        targetUser.email?.split("@")[0] ??
        "Usuário",
    },
    { onConflict: "id" },
  );

  const supabase = await createClient();
  const { error: insertError } = await supabase.from("memberships").insert({
    profile_id: targetUser.id,
    condominium_id: access.condominium.id,
    role,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "Este usuário já possui vínculo neste condomínio." };
    }
    return { error: insertError.message };
  }

  revalidatePath(`/app/${condoSlug}/settings/members`);
  return { success: "Membro vinculado com sucesso." };
}

export async function removeMembershipAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const membershipId = String(formData.get("membership_id") ?? "");

  if (!condoSlug || !membershipId) {
    return { error: "Dados inválidos." };
  }

  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canManageMembers) {
    return { error: "Sem permissão para remover membros." };
  }

  const currentUser = await getAuthUser();
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("memberships")
    .select("id, profile_id, role")
    .eq("id", membershipId)
    .eq("condominium_id", access.condominium.id)
    .maybeSingle();

  if (!membership) {
    return { error: "Vínculo não encontrado." };
  }

  if (membership.profile_id === currentUser?.id) {
    return { error: "Você não pode remover o próprio vínculo." };
  }

  const { error } = await supabase.from("memberships").delete().eq("id", membershipId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/${condoSlug}/settings/members`);
  return { success: "Vínculo removido." };
}

export async function linkResidentProfileAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const residentId = String(formData.get("resident_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!condoSlug || !residentId || !email) {
    return { error: "Dados incompletos." };
  }

  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canManageResidents) {
    return { error: "Sem permissão para vincular moradores." };
  }

  const admin = createAdminClient();
  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const targetUser = listed?.users.find((user) => user.email?.toLowerCase() === email);

  if (!targetUser) {
    return { error: "Usuário não encontrado. A pessoa precisa ter conta em /signup." };
  }

  await admin.from("profiles").upsert(
    {
      id: targetUser.id,
      full_name:
        (targetUser.user_metadata?.full_name as string | undefined) ??
        targetUser.email?.split("@")[0] ??
        "Usuário",
    },
    { onConflict: "id" },
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("residents")
    .update({ profile_id: targetUser.id })
    .eq("id", residentId);

  if (error) {
    return { error: error.message };
  }

  // Garante membership resident se ainda não existir
  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("id")
    .eq("profile_id", targetUser.id)
    .eq("condominium_id", access.condominium.id)
    .maybeSingle();

  if (!existingMembership) {
    await supabase.from("memberships").insert({
      profile_id: targetUser.id,
      condominium_id: access.condominium.id,
      role: "resident",
    });
  }

  revalidatePath(`/app/${condoSlug}/residents`);
  return { success: "Morador vinculado ao usuário." };
}
