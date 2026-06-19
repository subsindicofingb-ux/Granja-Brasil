"use client";

import { useActionState } from "react";
import { getMemberRoleLabel } from "@/lib/auth/member-roles";
import { removeMembershipAction } from "@/lib/auth/actions";
import type { Role } from "@/lib/constants";
import { Button } from "@/components/ui/button";

interface MemberRow {
  id: string;
  role: Role;
  profile: {
    id: string;
    full_name: string;
  } | null;
}

interface MembershipListProps {
  condoSlug: string;
  members: MemberRow[];
  currentProfileId: string;
  canManage: boolean;
}

export function MembershipList({
  condoSlug,
  members,
  currentProfileId,
  canManage,
}: MembershipListProps) {
  const [state, formAction, pending] = useActionState(removeMembershipAction, {});

  return (
    <div className="space-y-4">
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.success}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Nome</th>
              <th className="px-4 py-3 text-left font-medium">Papel</th>
              {canManage && <th className="px-4 py-3 text-right font-medium">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">
                  {member.profile?.full_name ?? "—"}
                  {member.profile?.id === currentProfileId && (
                    <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {getMemberRoleLabel(member.role)}
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    {member.profile?.id !== currentProfileId ? (
                      <form action={formAction}>
                        <input type="hidden" name="condo_slug" value={condoSlug} />
                        <input type="hidden" name="membership_id" value={member.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          className="text-destructive hover:text-destructive"
                        >
                          Remover
                        </Button>
                      </form>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
