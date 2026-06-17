import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { ROLES } from "@/lib/constants";
import { CondominiumForm } from "@/components/condominiums/condominium-form";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewCondominiumFromUnitsPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function NewCondominiumFromUnitsPage({
  params,
}: NewCondominiumFromUnitsPageProps) {
  const { condoSlug } = await params;
  const access = await requireCondoAccess(condoSlug);

  if (!isGeneralCondominium(condoSlug) || access.role !== ROLES.SUPER_ADMIN) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Novo condomínio"
        description="Cadastre um novo condomínio na administração geral."
        action={
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/units`}>Voltar</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do condomínio</CardTitle>
        </CardHeader>
        <CardContent>
          <CondominiumForm condoSlug={condoSlug} returnTo="units" />
        </CardContent>
      </Card>
    </div>
  );
}
