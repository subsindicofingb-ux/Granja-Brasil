import { requireCondoPermission } from "@/lib/auth/access";
import { PageHeader } from "@/components/shared/page-shell";
import { TowerForm } from "@/components/towers/tower-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewTowerPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function NewTowerPage({ params }: NewTowerPageProps) {
  const { condoSlug } = await params;

  await requireCondoPermission(
    condoSlug,
    (access) => access.permissions.canManageStructure,
    { redirectTo: `/app/${condoSlug}/towers` },
  );

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title="Nova torre"
        description="Cadastre uma torre ou bloco do condomínio."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da torre</CardTitle>
        </CardHeader>
        <CardContent>
          <TowerForm condoSlug={condoSlug} mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
