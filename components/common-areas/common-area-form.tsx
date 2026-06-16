"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { CommonAreaFormInput } from "@/lib/common-areas/types";
import type { AllowedDay, MaintenanceBlock } from "@/lib/common-areas/types";
import { createCommonAreaAction, updateCommonAreaAction } from "@/lib/actions/common-areas";
import { DEFAULT_COMMON_AREA_FORM } from "@/lib/common-areas/defaults";
import { CommonAreaFormFields } from "@/components/common-areas/common-area-form-fields";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";

interface CommonAreaFormProps {
  condoSlug: string;
  mode: "create" | "edit";
  defaultValues?: CommonAreaFormInput & { areaId?: string };
}

function toFormDefaults(defaultValues?: CommonAreaFormInput): CommonAreaFormInput {
  if (!defaultValues) return DEFAULT_COMMON_AREA_FORM;
  return { ...DEFAULT_COMMON_AREA_FORM, ...defaultValues };
}

export function CommonAreaForm({ condoSlug, mode, defaultValues }: CommonAreaFormProps) {
  const action = mode === "create" ? createCommonAreaAction : updateCommonAreaAction;
  const [state, formAction, pending] = useActionState(action, {});
  const defaults = toFormDefaults(defaultValues);

  const [allowedDays, setAllowedDays] = useState<AllowedDay[]>(defaults.allowed_days);
  const [maintenanceBlocks, setMaintenanceBlocks] = useState<MaintenanceBlock[]>(
    defaults.maintenance_blocks,
  );

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      {mode === "edit" && defaultValues?.areaId && (
        <input type="hidden" name="area_id" value={defaultValues.areaId} />
      )}

      <FormAlert error={state.error} success={state.success} />

      <CommonAreaFormFields
        defaults={defaults}
        allowedDays={allowedDays}
        setAllowedDays={setAllowedDays}
        maintenanceBlocks={maintenanceBlocks}
        setMaintenanceBlocks={setMaintenanceBlocks}
      />

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : mode === "create" ? "Criar espaço" : "Salvar alterações"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/areas`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
