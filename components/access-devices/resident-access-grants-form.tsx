"use client";

import { useActionState } from "react";
import { updateResidentAccessGrantsAction } from "@/lib/actions/residents";
import type { AccessDeviceOption } from "@/lib/access-devices/grant-types";
import { ResidentAccessDeviceFields } from "@/components/access-devices/resident-access-device-fields";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";

interface ResidentAccessGrantsFormProps {
  condoSlug: string;
  residentId: string;
  accessDevices: AccessDeviceOption[];
  defaultAccessDeviceIds: string[];
}

export function ResidentAccessGrantsForm({
  condoSlug,
  residentId,
  accessDevices,
  defaultAccessDeviceIds,
}: ResidentAccessGrantsFormProps) {
  const [state, formAction, pending] = useActionState(updateResidentAccessGrantsAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="resident_id" value={residentId} />

      <FormAlert error={state.error} success={state.success} />

      <ResidentAccessDeviceFields
        devices={accessDevices}
        defaultSelectedIds={defaultAccessDeviceIds}
      />

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar locais de acesso"}
      </Button>
    </form>
  );
}
