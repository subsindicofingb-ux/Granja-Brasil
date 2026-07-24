import type { AccessDeviceOption } from "@/lib/access-devices/grant-types";
import type { AccessDeviceListItem } from "@/lib/access-devices/types";

type SuggestableAccessDevice = Pick<
  AccessDeviceListItem,
  "id" | "display_name" | "access_type" | "is_active"
>;

/**
 * Locais de acesso iniciam desmarcados no cadastro.
 * O operador marca apenas onde o morador deve ter acesso.
 */
export function suggestDefaultAccessDeviceIds(
  _devices: SuggestableAccessDevice[],
): string[] {
  return [];
}

export function suggestDefaultAccessDeviceIdsFromOptions(
  _devices: AccessDeviceOption[],
): string[] {
  return [];
}

export function mapDevicesToOptions(devices: AccessDeviceListItem[]) {
  return devices.map((device) => ({
    id: device.id,
    display_name: device.display_name,
    access_type: device.access_type,
    is_pilot: device.is_pilot,
    is_owned: device.is_owned,
  }));
}
