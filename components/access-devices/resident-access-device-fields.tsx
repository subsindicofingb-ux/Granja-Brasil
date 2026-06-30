"use client";

import { ACCESS_DEVICE_TYPE_LABELS } from "@/lib/access-devices/constants";
import type { AccessDeviceOption } from "@/lib/access-devices/grant-types";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

interface ResidentAccessDeviceFieldsProps {
  devices: AccessDeviceOption[];
  defaultSelectedIds?: string[];
  disabled?: boolean;
}

export function ResidentAccessDeviceFields({
  devices,
  defaultSelectedIds = [],
  disabled = false,
}: ResidentAccessDeviceFieldsProps) {
  if (devices.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
        Nenhum local de acesso ativo cadastrado para este condomínio.
      </div>
    );
  }

  const selectedSet = new Set(defaultSelectedIds);

  return (
    <div className="space-y-2">
      <Label>Locais de acesso</Label>
      <p className="text-xs text-muted-foreground">
        Selecione os pontos de controle facial ou TAG liberados para este morador.
      </p>
      <div className="space-y-2 rounded-md border p-3">
        {devices.map((device) => (
          <label
            key={device.id}
            className="flex items-start gap-2 text-sm leading-snug"
          >
            <input
              type="checkbox"
              name="access_device_ids"
              value={device.id}
              defaultChecked={selectedSet.has(device.id)}
              disabled={disabled}
              className="mt-1"
            />
            <span>
              <span className="font-medium">{device.display_name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {ACCESS_DEVICE_TYPE_LABELS[device.access_type]}
                {device.is_pilot ? (
                  <>
                    {" · "}
                    <Badge className="border-amber-300 bg-amber-50 px-1 py-0 text-[10px] text-amber-900">
                      Piloto
                    </Badge>
                  </>
                ) : null}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

interface ResidentAccessDeviceSummaryProps {
  grants: Array<{
    access_device?: {
      display_name: string;
      access_type: AccessDeviceOption["access_type"];
      is_pilot: boolean;
    };
    sync_status: "pending" | "synced" | "error";
    sync_error?: string | null;
  }>;
}

const SYNC_STATUS_LABELS = {
  pending: "Aguardando sync",
  synced: "Sincronizado",
  error: "Erro no sync",
} as const;

const SYNC_STATUS_CLASSES = {
  pending: "border-amber-300 bg-amber-50 text-amber-900",
  synced: "border-green-300 bg-green-50 text-green-900",
  error: "border-red-300 bg-red-50 text-red-900",
} as const;

export function ResidentAccessDeviceSummary({ grants }: ResidentAccessDeviceSummaryProps) {
  if (grants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum local de acesso vinculado.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {grants.map((grant, index) => (
        <li
          key={`${grant.access_device?.display_name ?? "device"}-${index}`}
          className="flex items-start justify-between gap-3 text-sm"
        >
          <div>
            <p className="font-medium">{grant.access_device?.display_name ?? "Local"}</p>
            {grant.access_device && (
              <p className="text-xs text-muted-foreground">
                {ACCESS_DEVICE_TYPE_LABELS[grant.access_device.access_type]}
              </p>
            )}
          </div>
          <div className="text-right">
            <Badge className={`shrink-0 ${SYNC_STATUS_CLASSES[grant.sync_status]}`}>
              {SYNC_STATUS_LABELS[grant.sync_status]}
            </Badge>
            {grant.sync_error && grant.sync_status === "error" && (
              <p className="mt-1 max-w-[12rem] text-xs text-red-700">{grant.sync_error}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
