import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { getRolePermissions } from "@/lib/auth/roles";
import { AddMembershipForm } from "@/components/auth/add-membership-form";
import { MembershipList } from "@/components/auth/membership-list";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/constants";
import { ROLES } from "@/lib/constants";

interface MembersPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ role?: string }>;
}

type MemberRow = {
  id: string;
  role: Role;
  profile: { id: string; full_name: string } | null;
};

const STAFF_ROLES = new Set<Role>([ROLES.SYNDIC, ROLES.DOORMAN, ROLES.ADMIN, ROLES.RESIDENT]);

function resolveDefaultRole(roleParam: string | undefined): Role | undefined {
  if (!roleParam || !STAFF_ROLES.has(roleParam as Role)) {
    return undefined;
  }

  return roleParam as Role;
}

export default async function MembersPage({ params, searchParams }: MembersPageProps) {
  const { condoSlug } = await params;
  const { role: roleParam } = await searchParams;
  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canManageMembers) {
    notFound();
  }

  const defaultRole = resolveDefaultRole(roleParam);
  const roleLabel = defaultRole ? getRolePermissions(defaultRole).label : null;

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("memberships")
    .select(
      `
      id,
      role,
      profile:profiles (
        id,
        full_name
      )
    `,
    )
    .eq("condominium_id", access.condominium.id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={roleLabel ? `Cadastrar ${roleLabel.toLowerCase()}` : "Membros"}
        description={
          roleLabel
            ? `Vincule um usuário autenticado como ${roleLabel.toLowerCase()} neste condomínio.`
            : "Vincule usuários autenticados ao condomínio com papéis e permissões."
        }
        action={
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/settings`}>Voltar</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {roleLabel ? `Vincular ${roleLabel.toLowerCase()}` : "Vincular membro"}
          </CardTitle>
          <CardDescription>
            Busca usuário por e-mail no Supabase Auth e cria membership (respeita RLS).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddMembershipForm condoSlug={condoSlug} defaultRole={defaultRole} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membros ativos</CardTitle>
          <CardDescription>
            Papéis controlam o que cada usuário pode ver e alterar via RLS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MembershipList
            condoSlug={condoSlug}
            members={(members as MemberRow[] | null) ?? []}
            currentProfileId={access.profile.id}
            canManage={access.permissions.canManageMembers}
          />
        </CardContent>
      </Card>
    </div>
  );
}
