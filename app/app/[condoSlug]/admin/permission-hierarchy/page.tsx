import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { buildDefaultPermissionMatrix } from "@/lib/auth/permission-matrix";
import { PermissionMatrixForm } from "@/components/settings/permission-matrix-form";
import { PageHeader } from "@/components/shared/page-shell";
import { ROLES } from "@/lib/constants";
import { loadPermissionMatrix } from "@/lib/services/permission-matrix";

interface PermissionHierarchyPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function PermissionHierarchyPage({ params }: PermissionHierarchyPageProps) {
  const { condoSlug } = await params;
  const access = await requireCondoAccess(condoSlug);

  if (access.role !== ROLES.SUPER_ADMIN) {
    notFound();
  }

  const matrixResult = await loadPermissionMatrix();
  const matrix = matrixResult ?? buildDefaultPermissionMatrix();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Hierarquia de permissões"
        description="Configure o que cada papel pode ver, cadastrar e excluir por categoria."
      />
      <PermissionMatrixForm condoSlug={condoSlug} matrix={matrix} />
    </div>
  );
}
