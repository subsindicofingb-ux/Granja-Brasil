"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateMembershipAccessDevicesAction } from "@/lib/actions/membership-access";
import type { AccessDeviceOption } from "@/lib/access-devices/grant-types";
import { ResidentAccessDeviceFields } from "@/components/access-devices/resident-access-device-fields";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";

interface MembershipAccessFormProps {
  condoSlug: string;
  membershipId: string;
  accessDevices: AccessDeviceOption[];
  defaultAccessDeviceIds: string[];
}

export function MembershipAccessForm({
  condoSlug,
  membershipId,
  accessDevices,
  defaultAccessDeviceIds,
}: MembershipAccessFormProps) {
  const [state, formAction, pending] = useActionState(updateMembershipAccessDevicesAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="membership_id" value={membershipId} />

      <FormAlert error={state.error} success={state.success} />

      <ResidentAccessDeviceFields
        devices={accessDevices}
        defaultSelectedIds={defaultAccessDeviceIds}
      />

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar locais de acesso"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/settings/members`}>Voltar</Link>
        </Button>
      </div>
    </form>
  );
}
