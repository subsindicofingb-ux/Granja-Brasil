"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { savePermissionMatrixAction } from "@/lib/actions/permission-matrix";
import {
  CONFIGURABLE_ROLE_LABELS,
  CONFIGURABLE_ROLES,
  PERMISSION_CATEGORY_IDS,
  PERMISSION_CATEGORY_LABELS,
  matrixFieldName,
  type RolePermissionMatrix,
} from "@/lib/auth/permission-matrix";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";

interface PermissionMatrixFormProps {
  condoSlug: string;
  matrix: RolePermissionMatrix;
}

export function PermissionMatrixForm({ condoSlug, matrix }: PermissionMatrixFormProps) {
  const [state, formAction, pending] = useActionState(savePermissionMatrixAction, {});

  useEffect(() => {
    if (state.success) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state.success]);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <FormAlert error={state.error} success={state.success} />

      <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Marque o que cada papel pode <strong>ver</strong>, <strong>cadastrar</strong> ou{" "}
        <strong>excluir</strong> em cada categoria. Em <strong>Dashboard</strong>, Ver exibe o
        painel, Cadastrar libera atalhos de criação e Excluir mostra pendências e alertas. Em{" "}
        <strong>Espaços comuns</strong>, apenas Cadastrar permite criar ou editar áreas. Super Admin
        mantém acesso total e só outro Super Admin pode cadastrar ou excluir Super Admin.
      </div>

      <div className="space-y-8">
        {PERMISSION_CATEGORY_IDS.map((category) => (
          <section key={category} className="overflow-hidden rounded-xl border">
            <div className="border-b bg-muted/40 px-4 py-3">
              <h2 className="font-medium">{PERMISSION_CATEGORY_LABELS[category]}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b bg-muted/20">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Papel</th>
                    <th className="px-4 py-3 text-center font-medium">Ver</th>
                    <th className="px-4 py-3 text-center font-medium">Cadastrar</th>
                    <th className="px-4 py-3 text-center font-medium">Excluir</th>
                  </tr>
                </thead>
                <tbody>
                  {CONFIGURABLE_ROLES.map((role) => (
                    <tr key={role} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{CONFIGURABLE_ROLE_LABELS[role]}</td>
                      {(["view", "create", "delete"] as const).map((action) => (
                        <td key={action} className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            name={matrixFieldName(role, category, action)}
                            defaultChecked={matrix[role][category][action]}
                            className="h-4 w-4 rounded border-input"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar hierarquia"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={`/app/${condoSlug}/settings`}>Voltar</Link>
        </Button>
      </div>
    </form>
  );
}
