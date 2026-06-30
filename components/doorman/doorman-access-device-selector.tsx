"use client";

import { useMemo } from "react";
import type { AccessDeviceOption } from "@/lib/access-devices/grant-types";
import { suggestDefaultAccessDeviceIdsFromOptions } from "@/lib/access-devices/suggested-grants";
import { ResidentAccessDeviceFields } from "@/components/access-devices/resident-access-device-fields";

interface DoormanAccessDeviceSelectorProps {
  devicesByCondominiumId: Record<string, AccessDeviceOption[]>;
  selectedCondominiumId: string;
}

export function DoormanAccessDeviceSelector({
  devicesByCondominiumId,
  selectedCondominiumId,
}: DoormanAccessDeviceSelectorProps) {
  const devices = useMemo(
    () => devicesByCondominiumId[selectedCondominiumId] ?? [],
    [devicesByCondominiumId, selectedCondominiumId],
  );
  const defaultSelectedIds = useMemo(
    () => suggestDefaultAccessDeviceIdsFromOptions(devices),
    [devices],
  );

  return (
    <ResidentAccessDeviceFields
      key={selectedCondominiumId}
      devices={devices}
      defaultSelectedIds={defaultSelectedIds}
    />
  );
}
