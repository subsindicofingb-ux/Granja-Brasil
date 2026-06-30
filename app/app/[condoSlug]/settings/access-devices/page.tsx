import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCondoPermission } from "@/lib/auth/access";
import { formatAccessDeviceConnectionStatus, getAccessDeviceTypeLabel } from "@/lib/access-devices/labels";
import { listAccessDevicesForCondominium } from "@/lib/services/access-devices";
import { ErrorAlert } from "@/components/shared/feedback";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AccessDevicesPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function AccessDevicesPage({ params }: AccessDevicesPageProps) {
  const { condoSlug } = await params;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageAccessDevices,
    { redirectTo: `/app/${condoSlug}/settings` },
  );

  const devicesResult = await listAccessDevicesForCondominium(access.condominium.id);

  if (!devicesResult.ok) {
    return <ErrorAlert message={devicesResult.error} title="Erro ao carregar locais de acesso" />;
  }

  const devices = devicesResult.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Locais de acesso"
        description="Cadastre pontos ControlID com nomes livres e tipos de uso por condomínio."
        action={
          <Button asChild>
            <Link href={`/app/${condoSlug}/settings/access-devices/new`}>
              <Plus className="h-4 w-4" />
              Novo local
            </Link>
          </Button>
        }
      />

      {devices.length === 0 ? (
        <EmptyState
          title="Nenhum local cadastrado"
          description="Comece pelo equipamento piloto Brinquedoteca ou cadastre portaria, garagem e áreas comuns."
          action={
            <Button asChild>
              <Link href={`/app/${condoSlug}/settings/access-devices/new`}>Cadastrar local</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-left font-medium">Host</th>
                <th className="px-4 py-3 text-left font-medium">Conexão</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{device.display_name}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {!device.is_active && <Badge className="border bg-background">Inativo</Badge>}
                      {device.is_pilot && <Badge className="border-amber-300 bg-amber-50 text-amber-900">Piloto</Badge>}
                      {!device.is_owned && <Badge className="border bg-background">Compartilhado</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {getAccessDeviceTypeLabel(device.access_type)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{device.host_url}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatAccessDeviceConnectionStatus({
                      lastConnectionOkAt: device.last_connection_ok_at,
                      lastConnectionError: device.last_connection_error,
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/app/${condoSlug}/settings/access-devices/${device.id}`}>
                        {device.is_owned ? "Editar" : "Ver"}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button variant="outline" asChild>
        <Link href={`/app/${condoSlug}/settings`}>Voltar às configurações</Link>
      </Button>
    </div>
  );
}
