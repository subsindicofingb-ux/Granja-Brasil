import type { AccessDeviceOption } from "@/lib/access-devices/grant-types";
import type { AccessDeviceListItem } from "@/lib/access-devices/types";

type SuggestableAccessDevice = Pick<
  AccessDeviceListItem,
  "id" | "display_name" | "access_type" | "is_active"
>;

const DEFAULT_NAME_PATTERNS =
  /portaria|servi[cç]o|garagem|facilidad|brinquedoteca|academia|piscina|sal[aã]o|quadra|playground/i;

const RESIDENT_ACCESS_TYPES = new Set([
  "facial_pedestrian",
  "facial_vehicle",
  "tag_vehicle",
]);

export function suggestDefaultAccessDeviceIds(devices: SuggestableAccessDevice[]): string[] {
  const eligible = devices.filter(
    (device) => device.is_active && RESIDENT_ACCESS_TYPES.has(device.access_type),
  );

  if (eligible.length === 0) {
    return [];
  }

  const matchedByName = eligible.filter((device) =>
    DEFAULT_NAME_PATTERNS.test(device.display_name),
  );

  if (matchedByName.length > 0) {
    return matchedByName.map((device) => device.id);
  }

  return eligible
    .filter((device) => device.access_type === "facial_pedestrian")
    .map((device) => device.id);
}

export function suggestDefaultAccessDeviceIdsFromOptions(devices: AccessDeviceOption[]): string[] {
  return suggestDefaultAccessDeviceIds(
    devices.map((device) => ({
      ...device,
      is_active: true,
    })),
  );
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
