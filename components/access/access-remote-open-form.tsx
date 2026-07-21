"use client";

import { useActionState, useState } from "react";
import { remoteOpenAccessDeviceAction } from "@/lib/actions/access-remote-open";
import type { SyncedAccessDeviceForRemoteOpen } from "@/lib/services/access-remote-open";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ACCESS_DEVICE_DIRECTION_LABELS,
  ACCESS_DEVICE_ENTRY_KIND_LABELS,
  type AccessDeviceDirection,
  type AccessDeviceEntryKind,
} from "@/lib/access-devices/constants";

type AccessRemoteOpenFormProps = {
  condoSlug: string;
  devices: SyncedAccessDeviceForRemoteOpen[];
  staffMode?: boolean;
};

export function AccessRemoteOpenForm({
  condoSlug,
  devices,
  staffMode = false,
}: AccessRemoteOpenFormProps) {
  const [state, formAction, pending] = useActionState(remoteOpenAccessDeviceAction, {});
  const [reason, setReason] = useState<"visitor" | "emergency">("visitor");
  const [deviceId, setDeviceId] = useState(devices[0]?.access_device_id ?? "");

  if (devices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {staffMode
          ? "Nenhum local de acesso ativo cadastrado neste condomínio."
          : "Nenhum local sincronizado para a sua unidade. A abertura remota só funciona nos equipamentos em que o seu cadastro ControlID estiver sincronizado."}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="reason" value={reason} />

      <FormAlert error={state.error} success={state.success} />

      <div className="space-y-2">
        <Label htmlFor="access_device_id">Local de acesso</Label>
        <select
          id="access_device_id"
          name="access_device_id"
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          required
        >
          {devices.map((device) => (
            <option key={device.access_device_id} value={device.access_device_id}>
              {device.display_name}
              {" · "}
              {ACCESS_DEVICE_ENTRY_KIND_LABELS[device.entry_kind as AccessDeviceEntryKind] ??
                device.entry_kind}
              {" · "}
              {ACCESS_DEVICE_DIRECTION_LABELS[device.direction as AccessDeviceDirection] ??
                device.direction}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {staffMode
            ? "Síndico e administração podem abrir qualquer local ativo, sem precisar de cadastro facial."
            : "Só aparecem locais em que a sua unidade está sincronizada no ControlID."}
        </p>
      </div>

      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Motivo da abertura</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
          <input
            type="radio"
            name="reason_choice"
            checked={reason === "visitor"}
            onChange={() => setReason("visitor")}
            className="mt-1"
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium">Visita</span>
            <span className="block text-xs text-muted-foreground">
              Liberar entrada para visitante autorizado da sua unidade.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-amber-200 bg-amber-50/60 p-3">
          <input
            type="radio"
            name="reason_choice"
            checked={reason === "emergency"}
            onChange={() => setReason("emergency")}
            className="mt-1"
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium">Emergência</span>
            <span className="block text-xs text-muted-foreground">
              Usar somente em situações urgentes. O envio fica registrado com a origem no app.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="notes">Observação (opcional)</Label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="Ex: visitante na portaria / emergência médica"
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
        />
      </div>

      <Button type="submit" disabled={pending || !deviceId}>
        {pending
          ? "Enviando pulso..."
          : reason === "emergency"
            ? "Enviar pulso de emergência"
            : "Enviar pulso de visita"}
      </Button>
    </form>
  );
}
