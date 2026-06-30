import Link from "next/link";
import { requireCondoPermission } from "@/lib/auth/access";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import { listCondominiums } from "@/lib/services/condominiums-admin";
import { AccessDeviceForm } from "@/components/access-devices/access-device-form";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewAccessDevicePageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function NewAccessDevicePage({ params }: NewAccessDevicePageProps) {
  const { condoSlug } = await params;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageAccessDevices,
    { redirectTo: `/app/${condoSlug}/settings/access-devices` },
  );

  const condominiumsResult = await listCondominiums();
  if (!condominiumsResult.ok) {
    return <ErrorAlert message={condominiumsResult.error} title="Erro ao carregar condomínios" />;
  }

  const shareableCondominiums = condominiumsResult.data.filter(
    (condominium) => condominium.id !== access.condominium.id,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Novo local de acesso"
        description="Cadastre um ponto ControlID com nome livre. Sugestão piloto: Brinquedoteca."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equipamento ControlID</CardTitle>
        </CardHeader>
        <CardContent>
          <AccessDeviceForm
            condoSlug={condoSlug}
            mode="create"
            shareableCondominiums={shareableCondominiums}
            defaultValues={{
              displayName: "",
              isActive: true,
              isPilot: false,
            }}
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Condomínio proprietário: {formatCondominiumDisplayName(access.condominium.name, condoSlug)}
      </p>

      <Button variant="outline" asChild>
        <Link href={`/app/${condoSlug}/settings/access-devices`}>Voltar</Link>
      </Button>
    </div>
  );
}
