"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { markCorrespondencePickedUpAction } from "@/lib/actions/correspondence";
import { CORRESPONDENCE_RECIPIENT_OTHER } from "@/lib/validations/doorman.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UnitResidentOption = {
  id: string;
  unit_id: string;
  full_name: string;
  profile_id: string | null;
};

interface CorrespondencePickupFormProps {
  condoSlug: string;
  noticeId: string;
  unitId: string;
  unitResidents: UnitResidentOption[];
}

export function CorrespondencePickupForm({
  condoSlug,
  noticeId,
  unitId,
  unitResidents,
}: CorrespondencePickupFormProps) {
  const [state, formAction, pending] = useActionState(markCorrespondencePickedUpAction, {});
  const [open, setOpen] = useState(false);
  const [pickedUpSelection, setPickedUpSelection] = useState("");
  const [manualPickedUpName, setManualPickedUpName] = useState("");

  const residentsForUnit = useMemo(
    () => unitResidents.filter((resident) => resident.unit_id === unitId),
    [unitId, unitResidents],
  );

  const isOtherPickedUp = pickedUpSelection === CORRESPONDENCE_RECIPIENT_OTHER;

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Registrar retirada
      </Button>
    );
  }

  return (
    <form action={formAction} className="w-full min-w-[240px] space-y-3 rounded-lg border bg-muted/20 p-3">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="notice_id" value={noticeId} />

      <div className="space-y-2">
        <Label htmlFor={`picked_up_resident_id-${noticeId}`}>Quem retirou</Label>
        <select
          id={`picked_up_resident_id-${noticeId}`}
          name="picked_up_resident_id"
          value={pickedUpSelection}
          onChange={(event) => {
            setPickedUpSelection(event.target.value);
            if (event.target.value !== CORRESPONDENCE_RECIPIENT_OTHER) {
              setManualPickedUpName("");
            }
          }}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          required
        >
          <option value="">Selecione quem retirou</option>
          {residentsForUnit.map((resident) => (
            <option key={resident.id} value={resident.id}>
              {resident.full_name}
            </option>
          ))}
          <option value={CORRESPONDENCE_RECIPIENT_OTHER}>Outros (informar nome manualmente)</option>
        </select>
      </div>

      {isOtherPickedUp && (
        <div className="space-y-2">
          <Label htmlFor={`picked_up_by_name-${noticeId}`}>Nome de quem retirou</Label>
          <Input
            id={`picked_up_by_name-${noticeId}`}
            name="picked_up_by_name"
            value={manualPickedUpName}
            onChange={(event) => setManualPickedUpName(event.target.value)}
            placeholder="Nome completo"
            required
          />
        </div>
      )}

      {!isOtherPickedUp && pickedUpSelection && (
        <input
          type="hidden"
          name="picked_up_by_name"
          value={residentsForUnit.find((resident) => resident.id === pickedUpSelection)?.full_name ?? ""}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando..." : "Confirmar retirada"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setPickedUpSelection("");
            setManualPickedUpName("");
          }}
        >
          Cancelar
        </Button>
      </div>

      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.success && <p className="text-xs text-emerald-700">{state.success}</p>}
    </form>
  );
}
