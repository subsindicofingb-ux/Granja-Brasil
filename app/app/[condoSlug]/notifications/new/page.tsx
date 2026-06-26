import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCondoPermission } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { loadGeneralCondoPanelData } from "@/lib/condominiums/general-condo-data";
import { listCondominiums } from "@/lib/services/condominiums-admin";
import { listUnitsByCondominium } from "@/lib/services/units";
import { UnitNotificationForm } from "@/components/notifications/unit-notification-form";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewNotificationPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function NewNotificationPage({ params }: NewNotificationPageProps) {
  const { condoSlug } = await params;
  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canSendUnitNotifications,
    { redirectTo: `/app/${condoSlug}/notifications` },
  );

  const isGranjaSource = isGeneralCondominium(condoSlug);

  const [unitsResult, condominiumsResult] = await Promise.all([
    isGranjaSource
      ? loadGeneralCondoPanelData()
      : listUnitsByCondominium(access.condominium.id).then((result) =>
          result.ok
            ? {
                ok: true as const,
                data: {
                  units: result.data,
                  condominiums: [],
                  condominiumNamesById: {} as Record<string, string>,
                },
              }
            : result,
        ),
    isGranjaSource ? listCondominiums() : Promise.resolve(null),
  ]);

  if (!unitsResult.ok) {
    redirect(`/app/${condoSlug}/notifications`);
  }

  const units = "units" in unitsResult.data ? unitsResult.data.units : [];
  const condominiumNamesById =
    "condominiumNamesById" in unitsResult.data ? unitsResult.data.condominiumNamesById : {};
  const condominiums = (condominiumsResult?.ok ? condominiumsResult.data : []).filter(
    (condominium) => condominium.id !== access.condominium.id,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Nova notificação"
        description={
          isGranjaSource
            ? "Notifique um condomínio e unidade específicos. A mensagem vai ao morador responsável."
            : "Notifique uma unidade do condomínio. A mensagem vai ao morador responsável."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da notificação</CardTitle>
        </CardHeader>
        <CardContent>
          <UnitNotificationForm
            condoSlug={condoSlug}
            isGranjaSource={isGranjaSource}
            condominiums={condominiums}
            units={units}
            condominiumNamesById={condominiumNamesById}
          />
        </CardContent>
      </Card>

      <Button variant="outline" asChild>
        <Link href={`/app/${condoSlug}/notifications`}>Voltar</Link>
      </Button>
    </div>
  );
}
