import {
  ACCESS_DEVICE_DIRECTION_LABELS,
  ACCESS_DEVICE_TYPE_LABELS,
  type AccessDeviceDirection,
  type AccessDeviceType,
} from "@/lib/access-devices/constants";
import { formatDateTime } from "@/lib/utils";

export function getAccessDeviceTypeLabel(type: AccessDeviceType): string {
  return ACCESS_DEVICE_TYPE_LABELS[type] ?? type;
}

export function getAccessDeviceDirectionLabel(direction: AccessDeviceDirection): string {
  return ACCESS_DEVICE_DIRECTION_LABELS[direction] ?? direction;
}

export function formatAccessDeviceConnectionStatus(input: {
  lastConnectionOkAt: string | null;
  lastConnectionError: string | null;
}): string {
  if (input.lastConnectionOkAt) {
    return `OK em ${formatDateTime(input.lastConnectionOkAt)}`;
  }

  if (input.lastConnectionError) {
    return input.lastConnectionError;
  }

  return "Ainda não testado";
}
