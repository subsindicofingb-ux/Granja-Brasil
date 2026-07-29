import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { getMemberRoleLabel } from "@/lib/auth/member-roles";
import { canCreateInCategory, canDeleteInCategory, canViewInCategory } from "@/lib/auth/permission-matrix";
import { ROLES, type Role } from "@/lib/constants";
import { listActiveAccessDevicesForCondominium } from "@/lib/services/resident-access-grants";
import { listMembershipAccessDeviceIds } from "@/lib/services/membership-access-devices";
import { MembershipAccessForm } from "@/components/auth/membership-access-form";
import { MembershipProfileForm } from "@/components/auth/membership-profile-form";
import { PageHeader } from "@/components/shared/page-shell";
import { ErrorAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface MemberDetailPageProps {
  params: Promise<{ condoSlug: string; membershipId: string }>;
}

export default async function MemberDetailPage({ params }: MemberDetailPageProps) {
  const { condoSlug, membershipId } = await params;
  const access = await requireCondoAccess(condoSlug);

  if (!canViewInCategory(access, "members") && !access.permissions.canManageMembers) {
    notFound();
  }

  const canConfigure =
    canCreateInCategory(access, "members") || canDeleteInCategory(access, "members");

  if (!canConfigure) {
    notFound();
  }

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("memberships")
    .select(
      `
      id,
      role,
      profile:profiles (
        id,
        full_name,
        avatar_url
      )
    `,
    )
    .eq("id", membershipId)
    .eq("condominium_id", access.condominium.id)
    .maybeSingle();

  if (!membership) {
    notFound();
  }

  const role = membership.role as Role;
  const profile = Array.isArray(membership.profile)
    ? membership.profile[0]
    : membership.profile;

  if (!profile) {
    notFound();
  }

  const admin = createAdminClient();
  const [{ data: authUser }, devicesResult, deviceIdsResult] = await Promise.all([
    admin.auth.admin.getUserById(profile.id),
    listActiveAccessDevicesForCondominium(access.condominium.id),
    listMembershipAccessDeviceIds(membershipId),
  ]);

  if (!devicesResult.ok) {
    return <ErrorAlert message={devicesResult.error} title="Erro ao carregar locais" />;
  }

  if (!deviceIdsResult.ok) {
    return <ErrorAlert message={deviceIdsResult.error} title="Erro ao carregar vínculos" />;
  }

  const email = authUser.user?.email ?? "";
  const phone =
    typeof authUser.user?.user_metadata?.phone === "string"
      ? authUser.user.user_metadata.phone
      : "";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={profile.full_name ?? "Membro"}
        description={`${getMemberRoleLabel(role)} · dados pessoais e pontos de acesso.`}
        action={
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/settings/members`}>Voltar</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados pessoais</CardTitle>
          <CardDescription>
            Atualize nome, e-mail, telefone e foto deste cadastro quando necessário.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MembershipProfileForm
            condoSlug={condoSlug}
            membershipId={membershipId}
            defaultValues={{
              fullName: profile.full_name ?? "",
              email,
              phone,
              avatarUrl: profile.avatar_url,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Locais de acesso</CardTitle>
          <CardDescription>
            {role === ROLES.STAFF
              ? "O funcionário só poderá abrir acesso remotamente nos locais marcados."
              : "Defina quais pontos ControlID ficam vinculados a este membro."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MembershipAccessForm
            condoSlug={condoSlug}
            membershipId={membershipId}
            accessDevices={devicesResult.data}
            defaultAccessDeviceIds={deviceIdsResult.data}
          />
        </CardContent>
      </Card>
    </div>
  );
}
