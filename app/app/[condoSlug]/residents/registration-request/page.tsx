import Link from "next/link";
import { requireCondoPermission } from "@/lib/auth/access";
import { isDoormanRegistrationAutoFulfill } from "@/lib/access-devices/sync-env";
import { resolveDoormanOperationalPanel } from "@/lib/condominiums/doorman-panel";
import { listUnitsByCondominium } from "@/lib/services/units";
import { loadActiveAccessDevicesByCondominiumIds } from "@/lib/services/resident-access-grants";
import { DoormanRegistrationRequestForm } from "@/components/doorman/doorman-registration-request-form";
import { ErrorAlert, SuccessAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RegistrationRequestPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ enviado?: string; fila?: string }>;
}

export default async function RegistrationRequestPage({
  params,
  searchParams,
}: RegistrationRequestPageProps) {
  const { condoSlug } = await params;
  const { enviado, fila } = await searchParams;
  const autoFulfill = isDoormanRegistrationAutoFulfill();
  const successMessage =
    fila === "1" || !autoFulfill
      ? "Solicitação enviada para a fila de aprovação. O responsável será notificado por e-mail."
      : "Morador cadastrado. Acesso ControlID liberado nos locais selecionados e síndico notificado por e-mail.";

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
    const accessDevicesResult = await loadActiveAccessDevicesByCondominiumIds(
      panel.condominiums.map((condominium) => condominium.id),
    );
    const accessDevicesByCondominiumId = accessDevicesResult.ok ? accessDevicesResult.data : {};

    return (
      <div className="mx-auto max-w-lg space-y-6">
        {enviado === "1" && <SuccessAlert message={successMessage} />}

        <PageHeader
          title="Solicitar cadastro de morador"
          description={
            autoFulfill
              ? `Cadastre o morador e libere o ControlID nos locais selecionados. O síndico do bloco ${panel.block.label} será notificado por e-mail.`
              : `Envie a solicitação para a fila de aprovação do bloco ${panel.block.label}. Após aprovação, o ControlID será sincronizado nos locais marcados.`
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do morador</CardTitle>
          </CardHeader>
          <CardContent>
            <DoormanRegistrationRequestForm
              condoSlug={condoSlug}
              isBlockSource
              autoFulfill={autoFulfill}
              condominiums={panel.condominiums}
              units={panel.units}
              condominiumNamesById={panel.condominiumNamesById}
              accessDevicesByCondominiumId={accessDevicesByCondominiumId}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const unitsResult = await listUnitsByCondominium(access.condominium.id);
  const accessDevicesResult = await loadActiveAccessDevicesByCondominiumIds([access.condominium.id]);
  const accessDevices = accessDevicesResult.ok
    ? (accessDevicesResult.data[access.condominium.id] ?? [])
    : [];

  if (!unitsResult.ok) {
    return <ErrorAlert message={unitsResult.error} title="Erro ao carregar unidades" />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {enviado === "1" && <SuccessAlert message={successMessage} />}

      <PageHeader
        title="Solicitar cadastro de morador"
        description={
          autoFulfill
            ? "Cadastre o morador, envie a foto e libere o ControlID nos locais marcados. O síndico receberá um e-mail informativo."
            : "Envie a solicitação para a fila de aprovação. Após aprovação, o morador será cadastrado e o ControlID sincronizado nos locais marcados."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do morador</CardTitle>
        </CardHeader>
        <CardContent>
          <DoormanRegistrationRequestForm
            condoSlug={condoSlug}
            autoFulfill={autoFulfill}
            units={unitsResult.data}
            accessDevices={accessDevices}
          />
        </CardContent>
      </Card>
    </div>
  );
}
