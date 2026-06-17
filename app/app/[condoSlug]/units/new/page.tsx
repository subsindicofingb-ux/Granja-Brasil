import { requireCondoPermission } from "@/lib/auth/access";
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
  searchParams: Promise<{ tower?: string }>;
}

export default async function NewUnitPage({ params, searchParams }: NewUnitPageProps) {
  const { condoSlug } = await params;
  const { tower: preselectedTower } = await searchParams;
  const preselectedTowerId = isValidUuid(preselectedTower) ? preselectedTower : undefined;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageStructure,
    { redirectTo: `/app/${condoSlug}/units` },
  );

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
            defaultValues={{
              towerId: preselectedTowerId,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
