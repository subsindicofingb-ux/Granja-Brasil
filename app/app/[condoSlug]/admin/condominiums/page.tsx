import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { ROLES } from "@/lib/constants";
import { listCondominiums } from "@/lib/services/condominiums-admin";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

interface CondominiumsAdminPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function CondominiumsAdminPage({ params }: CondominiumsAdminPageProps) {
  const { condoSlug } = await params;
  const access = await requireCondoAccess(condoSlug);

  if (access.role !== ROLES.SUPER_ADMIN) {
    notFound();
  }

  const result = await listCondominiums();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Condomínios"
        description="Cadastro e listagem de condomínios na administração geral."
        action={
          <Button asChild>
            <Link href={`/app/${condoSlug}/admin/condominiums/new`}>Novo condomínio</Link>
          </Button>
        }
      />

      {!result.ok && <ErrorAlert message={result.error ?? "Erro ao carregar condomínios."} />}

      {result.ok && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Condomínios cadastrados</CardTitle>
            <CardDescription>
              {(result.data ?? []).length} condomínio(s) no sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(result.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum condomínio cadastrado.</p>
            ) : (
              (result.data ?? []).map((condominium) => (
                <div
                  key={condominium.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{condominium.name}</p>
                    <p className="text-sm text-muted-foreground">/{condominium.slug}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Criado em {formatDateTime(condominium.created_at)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/app/${condominium.slug}`}>Abrir painel</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
