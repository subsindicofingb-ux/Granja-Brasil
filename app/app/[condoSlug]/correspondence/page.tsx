import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCondoPermission } from "@/lib/auth/access";
import { formatUnitWithTower } from "@/lib/residents/labels";
import { listCorrespondenceNotices } from "@/lib/services/correspondence";
import { ErrorAlert, SuccessAlert } from "@/components/shared/feedback";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

interface CorrespondencePageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ enviado?: string }>;
}

export default async function CorrespondencePage({
  params,
  searchParams,
}: CorrespondencePageProps) {
  const { condoSlug } = await params;
  const { enviado } = await searchParams;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageCorrespondence,
  );

  const result = await listCorrespondenceNotices(access.condominium.id);

  if (!result.ok) {
    return <ErrorAlert message={result.error} title="Erro ao carregar correspondências" />;
  }

  const notices = result.data;

  return (
    <div className="space-y-6">
      {enviado === "1" && (
        <SuccessAlert message="Correspondência registrada e morador avisado por e-mail." />
      )}

      <PageHeader
        title="Correspondências"
        description="Registro de encomendas e avisos de retirada na portaria."
        action={
          <Button asChild>
            <Link href={`/app/${condoSlug}/correspondence/new`}>
              <Plus className="h-4 w-4" />
              Nova correspondência
            </Link>
          </Button>
        }
      />

      {notices.length === 0 ? (
        <EmptyState
          title="Nenhuma correspondência registrada"
          description="Registre encomendas e cartas para avisar o morador responsável da unidade."
          action={
            <Button asChild>
              <Link href={`/app/${condoSlug}/correspondence/new`}>Registrar correspondência</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => (
            <div key={notice.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{notice.description}</h3>
                    {!notice.picked_up_at && (
                      <Badge className="bg-amber-600 hover:bg-amber-600">Aguardando retirada</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(notice.created_at)}
                    {notice.unit && ` · ${formatUnitWithTower(notice.unit)}`}
                    {notice.target_resident && ` · ${notice.target_resident.full_name}`}
                  </p>
                </div>
              </div>
              {notice.carrier && (
                <p className="mt-2 text-sm text-muted-foreground">Remetente: {notice.carrier}</p>
              )}
              {notice.notes && (
                <p className="mt-2 text-sm text-muted-foreground">{notice.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
