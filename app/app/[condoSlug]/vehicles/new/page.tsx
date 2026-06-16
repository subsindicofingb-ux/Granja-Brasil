import Link from "next/link";
import { requireCondoPermission } from "@/lib/auth/access";
import { listResidentsByCondominium } from "@/lib/services/residents";
import { listUnitsByCondominium } from "@/lib/services/units";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface NewVehiclePageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function NewVehiclePage({ params }: NewVehiclePageProps) {
  const { condoSlug } = await params;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageVehicles,
    { redirectTo: `/app/${condoSlug}/vehicles` },
  );

  const [unitsResult, residentsResult] = await Promise.all([
    listUnitsByCondominium(access.condominium.id),
    listResidentsByCondominium(access.condominium.id),
  ]);

  if (!unitsResult.ok) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message={unitsResult.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/vehicles`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  if (!residentsResult.ok) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message={residentsResult.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/vehicles`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title="Novo veículo"
        description="Cadastre placa, TAG de acesso e foto do veículo."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do veículo</CardTitle>
        </CardHeader>
        <CardContent>
          <VehicleForm
            condoSlug={condoSlug}
            units={unitsResult.data}
            residents={residentsResult.data}
            mode="create"
          />
        </CardContent>
      </Card>
    </div>
  );
}
