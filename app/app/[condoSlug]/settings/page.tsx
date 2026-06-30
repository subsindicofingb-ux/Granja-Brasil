import Link from "next/link";
import { requireCondoAccess } from "@/lib/auth/access";
import {
  getAssignableMemberRoles,
  getMemberRoleLabel,
  isGranjaOnlyMemberRole,
} from "@/lib/auth/member-roles";
import { ROLES } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-shell";
import { PermissionGate, RoleBadge } from "@/components/auth/permission-gate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SettingsPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { condoSlug } = await params;
  const access = await requireCondoAccess(condoSlug);
  const assignableMemberRoles = getAssignableMemberRoles(access.role);
  const granjaMemberRoles = assignableMemberRoles.filter((role) =>
    isGranjaOnlyMemberRole(role),
  );
  const condoMemberRoles = assignableMemberRoles.filter(
    (role) => !isGranjaOnlyMemberRole(role),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Configurações"
        description="Preferências e dados do condomínio."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sua sessão</CardTitle>
          <CardDescription>Papel atual neste condomínio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Usuário</span>
            <span className="font-medium">{access.profile.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">E-mail</span>
            <span className="font-medium">{access.profile.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Papel</span>
            <RoleBadge access={access} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Condomínio</CardTitle>
          <CardDescription>Condomínio ativo selecionado na sessão.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nome</span>
            <span className="font-medium">{access.condominium.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Slug</span>
            <span className="font-medium">{access.condominium.slug}</span>
          </div>
        </CardContent>
      </Card>

      <PermissionGate access={access} allow={(ctx) => ctx.role === ROLES.SUPER_ADMIN}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Administração geral</CardTitle>
            <CardDescription>Cadastro de condomínios na plataforma.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/app/${condoSlug}/admin/condominiums`}>Gerenciar condomínios</Link>
            </Button>
          </CardContent>
        </Card>
      </PermissionGate>

      <PermissionGate
        access={access}
        allow={(ctx) => ctx.permissions.canManageAccessDevices}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Locais de acesso ControlID</CardTitle>
            <CardDescription>
              Cadastre portaria, garagem, academia e outros pontos com nomes livres e tipos de uso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/app/${condoSlug}/settings/access-devices`}>
                Gerenciar locais de acesso
              </Link>
            </Button>
          </CardContent>
        </Card>
      </PermissionGate>

      <PermissionGate
        access={access}
        allow={(ctx) => ctx.permissions.canManageRegistrationRequests}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Solicitações de cadastro</CardTitle>
            <CardDescription>
              Aprove ou recuse novos moradores que se cadastraram informando condomínio e unidade.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/app/${condoSlug}/settings/registration-requests`}>
                Ver solicitações
              </Link>
            </Button>
          </CardContent>
        </Card>
      </PermissionGate>

      <PermissionGate
        access={access}
        allow={(ctx) => ctx.permissions.canManageMembers}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Membros e permissões</CardTitle>
            <CardDescription>
              {access.role === ROLES.SUPER_ADMIN
                ? "Vincule contas autenticadas e defina papéis no condomínio."
                : "Você pode vincular morador, porteiro, funcionário e sub-síndico. Síndico e administrador são cadastrados pela Granja."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {condoMemberRoles.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {condoMemberRoles.map((role) => (
                  <Button key={role} variant="outline" className="justify-start" asChild>
                    <Link href={`/app/${condoSlug}/settings/members?role=${role}`}>
                      Cadastrar {getMemberRoleLabel(role).toLowerCase()}
                    </Link>
                  </Button>
                ))}
              </div>
            )}

            {granjaMemberRoles.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {granjaMemberRoles.map((role) => (
                  <Button key={role} variant="outline" className="justify-start" asChild>
                    <Link href={`/app/${condoSlug}/settings/members?role=${role}`}>
                      Cadastrar {getMemberRoleLabel(role).toLowerCase()}
                    </Link>
                  </Button>
                ))}
              </div>
            )}

            <Button asChild>
              <Link href={`/app/${condoSlug}/settings/members`}>Gerenciar membros</Link>
            </Button>
          </CardContent>
        </Card>
      </PermissionGate>
    </div>
  );
}
