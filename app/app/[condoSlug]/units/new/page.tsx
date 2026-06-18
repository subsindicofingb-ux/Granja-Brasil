import { requireCondoPermission } from "@/lib/auth/access";
import { formatCondominiumDisplayName, isGeneralCondominium } from "@/lib/condominiums/display";
import { listCondominiums } from "@/lib/services/condominiums-admin";
import { listTowersByCondominium } from "@/lib/services/towers";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { UnitForm } from "@/components/units/unit-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isValidUuid } from "@/lib/utils";
import Link from "next/link";

interface NewUnitPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ tower?: string; condominium?: string }>;
}

export default async function NewUnitPage({ params, searchParams }: NewUnitPageProps) {
  const { condoSlug } = await params;
  const { tower: preselectedTower, condominium: preselectedCondominiumSlug } = await searchParams;
  const preselectedTowerId = isValidUuid(preselectedTower) ? preselectedTower : undefined;
  const isGeneralCondo = isGeneralCondominium(condoSlug);

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageStructure,
    { redirectTo: `/app/${condoSlug}/units` },
  );

  if (isGeneralCondo) {
    const condominiumsResult = await listCondominiums();

    if (!condominiumsResult.ok) {
      return (
        <div className="mx-auto max-w-lg space-y-4">
          <ErrorAlert message={condominiumsResult.error} />
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/units`}>Voltar</Link>
          </Button>
        </div>
      );
    }

    const condominiums = condominiumsResult.data.map((condominium) => ({
      id: condominium.id,
      name: formatCondominiumDisplayName(condominium.name, condominium.slug),
    }));
    const preselectedCondominiumId = preselectedCondominiumSlug
      ? condominiumsResult.data.find(
          (condominium) => condominium.slug === preselectedCondominiumSlug.trim().toLowerCase(),
        )?.id
      : undefined;

    return (
      <div className="mx-auto max-w-lg space-y-6">
        <PageHeader
          title="Nova unidade"
          description={`Cadastre um apartamento ou sala no condomínio ${access.condominium.name}.`}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados da unidade</CardTitle>
          </CardHeader>
          <CardContent>
            <UnitForm
              condoSlug={condoSlug}
              condoName={access.condominium.name}
              towers={[]}
              condominiums={condominiums}
              mode="create"
              requiresTower
              allowHouseModality
              defaultValues={{
                towerId: preselectedCondominiumId ?? preselectedTowerId,
              }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const towersResult = await listTowersByCondominium(access.condominium.id);

  if (!towersResult.ok) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message={towersResult.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/units`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const towers = towersResult.data.map((tower) => ({ id: tower.id, name: tower.name }));

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title="Nova unidade"
        description={`Cadastre um apartamento ou sala no condomínio ${access.condominium.name}.`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da unidade</CardTitle>
        </CardHeader>
        <CardContent>
          <UnitForm
            condoSlug={condoSlug}
            condoName={access.condominium.name}
            towers={towers}
            mode="create"
            requiresTower={false}
            defaultValues={{
              towerId: preselectedTowerId,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
