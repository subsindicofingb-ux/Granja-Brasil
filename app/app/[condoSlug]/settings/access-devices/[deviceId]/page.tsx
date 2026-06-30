import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoPermission } from "@/lib/auth/access";
import { getAccessDeviceById } from "@/lib/services/access-devices";
import { listCondominiums } from "@/lib/services/condominiums-admin";
import { AccessDeviceForm } from "@/components/access-devices/access-device-form";
import { ErrorAlert, SuccessAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AccessDeviceDetailPageProps {
  params: Promise<{ condoSlug: string; deviceId: string }>;
  searchParams: Promise<{ criado?: string }>;
}

export default async function AccessDeviceDetailPage({
  params,
  searchParams,
}: AccessDeviceDetailPageProps) {
  const { condoSlug, deviceId } = await params;
  const { criado } = await searchParams;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageAccessDevices,
    { redirectTo: `/app/${condoSlug}/settings/access-devices` },
  );

  const [deviceResult, condominiumsResult] = await Promise.all([
    getAccessDeviceById(deviceId, access.condominium.id),
    listCondominiums(),
  ]);

  if (!deviceResult.ok || !deviceResult.data) {
    notFound();
  }

  if (!condominiumsResult.ok) {
    return <ErrorAlert message={condominiumsResult.error} title="Erro ao carregar condomínios" />;
  }

  const device = deviceResult.data;
  const shareableCondominiums = condominiumsResult.data.filter(
    (condominium) => condominium.id !== access.condominium.id,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {criado === "1" && <SuccessAlert message="Local de acesso cadastrado com sucesso." />}

      <PageHeader
        title={device.display_name}
        description={
          device.is_owned
            ? "Edite nome, tipo de uso e conexão ControlID."
            : "Visualização de equipamento compartilhado de outro condomínio."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {device.is_owned ? "Configuração do equipamento" : "Detalhes do equipamento"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {device.is_owned ? (
            <AccessDeviceForm
              condoSlug={condoSlug}
              mode="edit"
              shareableCondominiums={shareableCondominiums}
              defaultValues={{
                deviceId: device.id,
                displayName: device.display_name,
                accessType: device.access_type,
                manufacturer: device.manufacturer,
                model: device.model,
                hostUrl: device.host_url,
                apiUsername: device.api_username,
                direction: device.direction,
                entryKind: device.entry_kind,
                isActive: device.is_active,
                isPilot: device.is_pilot,
                sharedCondominiumIds: device.shared_condominium_ids,
              }}
            />
          ) : (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Proprietário:</span>{" "}
                {device.owner_condominium?.name ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Host:</span> {device.host_url}
              </p>
              <p className="text-muted-foreground">
                Somente o condomínio proprietário pode editar este equipamento.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" asChild>
        <Link href={`/app/${condoSlug}/settings/access-devices`}>Voltar à lista</Link>
      </Button>
    </div>
  );
}
