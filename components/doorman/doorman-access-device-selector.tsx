"use client";

import { useMemo } from "react";
import type { AccessDeviceOption } from "@/lib/access-devices/grant-types";
import { suggestDefaultAccessDeviceIdsFromOptions } from "@/lib/access-devices/suggested-grants";
import { ResidentAccessDeviceFields } from "@/components/access-devices/resident-access-device-fields";

interface DoormanAccessDeviceSelectorProps {
  devicesByCondominiumId: Record<string, AccessDeviceOption[]>;
  selectedCondominiumId: string;
  includeAllBlockDevices?: boolean;
}

export function DoormanAccessDeviceSelector({
  devicesByCondominiumId,
  selectedCondominiumId,
  includeAllBlockDevices = false,
}: DoormanAccessDeviceSelectorProps) {
  const devices = useMemo(() => {
    if (includeAllBlockDevices) {
      const seen = new Set<string>();
      const merged: AccessDeviceOption[] = [];
      for (const list of Object.values(devicesByCondominiumId)) {
        for (const device of list) {
          if (seen.has(device.id)) {
            continue;
          }
          seen.add(device.id);
          merged.push(device);
        }
      }
      return merged.sort((left, right) =>
        left.display_name.localeCompare(right.display_name, "pt-BR"),
      );
    }

    return devicesByCondominiumId[selectedCondominiumId] ?? [];
  }, [devicesByCondominiumId, includeAllBlockDevices, selectedCondominiumId]);
  const defaultSelectedIds = useMemo(
    () => suggestDefaultAccessDeviceIdsFromOptions(devices),
    [devices],
  );

  return (
    <ResidentAccessDeviceFields
      key={includeAllBlockDevices ? "block-all" : selectedCondominiumId}
      devices={devices}
      defaultSelectedIds={defaultSelectedIds}
    />
  );
}
