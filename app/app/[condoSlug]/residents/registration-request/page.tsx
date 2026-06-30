import Link from "next/link";
import { requireCondoPermission } from "@/lib/auth/access";
import { resolveDoormanOperationalPanel } from "@/lib/condominiums/doorman-panel";
import { listUnitsByCondominium } from "@/lib/services/units";
import { DoormanRegistrationRequestForm } from "@/components/doorman/doorman-registration-request-form";
import { ErrorAlert, SuccessAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RegistrationRequestPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ enviado?: string }>;
}

export default async function RegistrationRequestPage({
  params,
  searchParams,
}: RegistrationRequestPageProps) {
  const { condoSlug } = await params;
  const { enviado } = await searchParams;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canRegisterResidentsWithApproval,
    { redirectTo: `/app/${condoSlug}` },
  );

  const panelResult = await resolveDoormanOperationalPanel(condoSlug);
  if (!panelResult.ok) {
    return <ErrorAlert message={panelResult.error} title="Erro ao carregar condomínios" />;
  }

  if (panelResult.data.mode === "granja") {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message="Solicitações de cadastro são feitas nos condomínios filhos." />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  if (panelResult.data.mode === "block") {
    const { panel } = panelResult.data;

    return (
      <div className="mx-auto max-w-lg space-y-6">
        {enviado === "1" && (
          <SuccessAlert message="Solicitação enviada. O síndico analisará o cadastro em breve." />
        )}

        <PageHeader
          title="Solicitar cadastro de morador"
          description={`Envie os dados para aprovação do síndico no bloco ${panel.block.label}.`}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do morador</CardTitle>
          </CardHeader>
          <CardContent>
            <DoormanRegistrationRequestForm
              condoSlug={condoSlug}
              isBlockSource
              condominiums={panel.condominiums}
              units={panel.units}
              condominiumNamesById={panel.condominiumNamesById}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const unitsResult = await listUnitsByCondominium(access.condominium.id);

  if (!unitsResult.ok) {
    return <ErrorAlert message={unitsResult.error} title="Erro ao carregar unidades" />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {enviado === "1" && (
        <SuccessAlert message="Solicitação enviada. O síndico analisará o cadastro em breve." />
      )}

      <PageHeader
        title="Solicitar cadastro de morador"
        description="Envie os dados para aprovação do síndico antes de liberar o acesso."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do morador</CardTitle>
        </CardHeader>
        <CardContent>
          <DoormanRegistrationRequestForm condoSlug={condoSlug} units={unitsResult.data} />
        </CardContent>
      </Card>
    </div>
  );
}
