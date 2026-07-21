import { requireCondoAccess } from "@/lib/auth/access";
import { AccessRemoteOpenForm } from "@/components/access/access-remote-open-form";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listSyncedAccessDevicesForProfile } from "@/lib/services/access-remote-open";
import { ErrorAlert } from "@/components/shared/feedback";
import { formatDateTime } from "@/lib/utils";
import { listRecentRemoteOpenEventsForCondo } from "@/lib/services/access-remote-open";
import { ROLES } from "@/lib/constants";

interface AccessOpenPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function AccessOpenPage({ params }: AccessOpenPageProps) {
  const { condoSlug } = await params;
  const access = await requireCondoAccess(condoSlug);

  const devicesResult = await listSyncedAccessDevicesForProfile({
    profileId: access.profile.id,
    condominiumId: access.condominium.id,
  });

  const historyResult = await listRecentRemoteOpenEventsForCondo({
    condominiumId: access.condominium.id,
    limit: access.role === ROLES.RESIDENT ? 10 : 15,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Abrir acesso"
        description="Envie um pulso remoto para a sua visita ou em emergência. Só funciona nos locais sincronizados da sua unidade e cada abertura fica registrada."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pulso remoto</CardTitle>
        </CardHeader>
        <CardContent>
          {!devicesResult.ok ? (
            <ErrorAlert message={devicesResult.error ?? "Não foi possível carregar os locais."} />
          ) : (
            <AccessRemoteOpenForm condoSlug={condoSlug} devices={devicesResult.data} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {access.role === ROLES.RESIDENT
              ? "Suas aberturas recentes"
              : "Últimas aberturas remotas"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!historyResult.ok ? (
            <ErrorAlert message={historyResult.error ?? "Erro ao carregar histórico."} />
          ) : historyResult.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma abertura remota registrada.</p>
          ) : (
            historyResult.data.map((event) => (
              <div key={event.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">
                  {event.device_name ?? "Equipamento"}
                  {" · "}
                  {event.reason === "emergency" ? "Emergência" : "Visita"}
                  {" · "}
                  {event.result === "ok" ? "OK" : "Erro"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(event.created_at)}
                  {event.resident_name ? ` · ${event.resident_name}` : ""}
                  {" · origem: "}
                  {event.origin === "app_resident"
                    ? "app morador"
                    : event.origin === "app_doorman"
                      ? "app portaria"
                      : "app equipe"}
                </p>
                {event.error_message && (
                  <p className="mt-1 text-xs text-destructive">{event.error_message}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
