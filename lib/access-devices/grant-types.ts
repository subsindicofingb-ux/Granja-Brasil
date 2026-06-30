import type { AccessDeviceType } from "@/lib/access-devices/constants";

export type AccessGrantSyncStatus = "pending" | "synced" | "error";

export type AccessDeviceOption = {
  id: string;
  display_name: string;
  access_type: AccessDeviceType;
  is_pilot: boolean;
  is_owned: boolean;
};

export type ResidentAccessGrantRecord = {
  id: string;
  resident_id: string;
  access_device_id: string;
  sync_status: AccessGrantSyncStatus;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
  access_device?: AccessDeviceOption;
};
