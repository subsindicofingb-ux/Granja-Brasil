import Link from "next/link";
import { requireCondoAccess } from "@/lib/auth/access";
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
              Vincule contas autenticadas e defina papéis (admin, síndico, morador, portaria).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/app/${condoSlug}/settings/members`}>Gerenciar membros</Link>
            </Button>
          </CardContent>
        </Card>
      </PermissionGate>
    </div>
  );
}
