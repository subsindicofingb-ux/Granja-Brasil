import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { ROLES } from "@/lib/constants";
import { CondominiumForm } from "@/components/condominiums/condominium-form";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface NewCondominiumPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function NewCondominiumPage({ params }: NewCondominiumPageProps) {
  const { condoSlug } = await params;
  const access = await requireCondoAccess(condoSlug);

  if (access.role !== ROLES.SUPER_ADMIN) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Novo condomínio"
        description="Cadastre um novo condomínio na administração geral."
        action={
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/admin/condominiums`}>Voltar</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do condomínio</CardTitle>
          <CardDescription>
            Após o cadastro, você será redirecionado ao painel do novo condomínio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CondominiumForm condoSlug={condoSlug} />
        </CardContent>
      </Card>
    </div>
  );
}
