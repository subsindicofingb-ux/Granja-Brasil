"use client";

import { useActionState, useState } from "react";
import { updateVisitorAuthorizationAccessAction } from "@/lib/actions/visitor-authorizations";
import type { AccessDeviceOption } from "@/lib/access-devices/grant-types";
import { ResidentAccessDeviceFields } from "@/components/access-devices/resident-access-device-fields";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VisitorAccessEditFormProps {
  condoSlug: string;
  authorizationId: string;
  accessStartsAt: string;
  accessEndsAt: string;
  syncControlId: boolean;
  accessDevices: AccessDeviceOption[];
  defaultAccessDeviceIds: string[];
}

export function VisitorAccessEditForm({
  condoSlug,
  authorizationId,
  accessStartsAt,
  accessEndsAt,
  syncControlId: initialSyncControlId,
  accessDevices,
  defaultAccessDeviceIds,
}: VisitorAccessEditFormProps) {
  const [state, formAction, pending] = useActionState(updateVisitorAuthorizationAccessAction, {});
  const [syncControlId, setSyncControlId] = useState(initialSyncControlId);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="authorization_id" value={authorizationId} />

      <FormAlert error={state.error} success={state.success} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="access_starts_at">Início do acesso</Label>
          <Input
            id="access_starts_at"
            name="access_starts_at"
            type="datetime-local"
            defaultValue={accessStartsAt}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="access_ends_at">Fim do acesso</Label>
          <Input
            id="access_ends_at"
            name="access_ends_at"
            type="datetime-local"
            defaultValue={accessEndsAt}
            required
          />
        </div>
      </div>

      {accessDevices.length > 0 && (
        <div className="space-y-3 rounded-md border p-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="sync_controlid"
              value="1"
              checked={syncControlId}
              onChange={(event) => setSyncControlId(event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Liberar nos ControlIDs</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Selecione os equipamentos em que o visitante poderá ser sincronizado.
              </span>
            </span>
          </label>
          {syncControlId && (
            <ResidentAccessDeviceFields
              devices={accessDevices}
              defaultSelectedIds={defaultAccessDeviceIds}
            />
          )}
        </div>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar período e ControlIDs"}
      </Button>
    </form>
  );
}
