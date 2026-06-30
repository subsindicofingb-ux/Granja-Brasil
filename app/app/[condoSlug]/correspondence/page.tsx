import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCondoPermission } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { resolveDoormanOperationalPanel, getOperationalCondominiumIds } from "@/lib/condominiums/doorman-panel";
import { formatUnitWithTower } from "@/lib/residents/labels";
import {
  listCorrespondenceNotices,
  listCorrespondenceNoticesForCondominiumIds,
  listCorrespondenceNoticesForGranjaDoorman,
} from "@/lib/services/correspondence";
import { listResidentsByCondominium } from "@/lib/services/residents";
import { CorrespondencePickupForm } from "@/components/doorman/correspondence-pickup-button";
import { ErrorAlert, SuccessAlert } from "@/components/shared/feedback";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

interface CorrespondencePageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ enviado?: string; retirada?: string }>;
}

export default async function CorrespondencePage({
  params,
  searchParams,
}: CorrespondencePageProps) {
  const { condoSlug } = await params;
  const { enviado, retirada } = await searchParams;
  const isGranjaSource = isGeneralCondominium(condoSlug);

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageCorrespondence,
  );

  const panelResult = await resolveDoormanOperationalPanel(condoSlug);
  const isBlockSource = panelResult.ok && panelResult.data.mode === "block";
  const blockLabel =
    panelResult.ok && panelResult.data.mode === "block"
      ? panelResult.data.panel.block.label
      : null;

  const [result, residentsResult] = await Promise.all([
    isGranjaSource
      ? listCorrespondenceNoticesForGranjaDoorman()
      : isBlockSource
        ? listCorrespondenceNoticesForCondominiumIds(
            getOperationalCondominiumIds(panelResult.data, access.condominium.id),
          )
        : listCorrespondenceNotices(access.condominium.id),
    isGranjaSource || isBlockSource
      ? listResidentsByCondominium()
      : listResidentsByCondominium({ condominiumId: access.condominium.id }),
  ]);

  if (!result.ok) {
    return <ErrorAlert message={result.error} title="Erro ao carregar correspondências" />;
  }

  const notices = result.data;
  const blockCondominiumIds =
    isBlockSource && panelResult.ok
      ? getOperationalCondominiumIds(panelResult.data, access.condominium.id)
      : null;
  const unitResidents = (residentsResult.ok ? residentsResult.data : [])
    .filter(
      (resident) =>
        !blockCondominiumIds ||
        blockCondominiumIds.includes(resident.unit.tower.condominium_id),
    )
    .map((resident) => ({
    id: resident.id,
    unit_id: resident.unit_id,
    full_name: resident.full_name,
    profile_id: resident.profile_id,
  }));

  return (
    <div className="space-y-6">
      {enviado === "1" && (
        <SuccessAlert message="Correspondência registrada e morador avisado por e-mail." />
      )}
      {retirada === "1" && (
        <SuccessAlert message="Correspondência marcada como retirada." />
      )}

      <PageHeader
        title="Correspondências"
        description={
          isGranjaSource
            ? "Registro de encomendas nos condomínios filhos."
            : isBlockSource
              ? `Registro de encomendas no bloco ${blockLabel}.`
              : "Registro de encomendas e avisos de retirada na portaria."
        }
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
          description={
            isGranjaSource
              ? "Registre encomendas informando condomínio, unidade e destinatário."
              : "Registre encomendas e cartas para avisar o destinatário ou o morador responsável."
          }
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
                    {!notice.picked_up_at ? (
                      <Badge className="bg-amber-600 hover:bg-amber-600">Aguardando retirada</Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground hover:bg-muted">Retirada</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(notice.created_at)}
                    {(isGranjaSource || isBlockSource) &&
                      notice.condominium_name &&
                      ` · ${notice.condominium_name}`}
                    {notice.unit && ` · ${formatUnitWithTower(notice.unit)}`}
                    {notice.recipient_name && ` · Dest.: ${notice.recipient_name}`}
                    {notice.target_resident &&
                      notice.notified_via_responsible &&
                      ` · Aviso ao responsável (${notice.target_resident.full_name})`}
                    {notice.target_resident &&
                      !notice.notified_via_responsible &&
                      ` · ${notice.target_resident.full_name}`}
                  </p>
                </div>
                {!notice.picked_up_at && (
                  <CorrespondencePickupForm
                    condoSlug={condoSlug}
                    noticeId={notice.id}
                    unitId={notice.unit_id}
                    unitResidents={unitResidents}
                  />
                )}
              </div>
              {notice.carrier && (
                <p className="mt-2 text-sm text-muted-foreground">Remetente: {notice.carrier}</p>
              )}
              {notice.notes && (
                <p className="mt-2 text-sm text-muted-foreground">{notice.notes}</p>
              )}
              {notice.picked_up_at && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Retirada em {formatDateTime(notice.picked_up_at)}
                  {notice.picked_up_by_name && ` por ${notice.picked_up_by_name}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
