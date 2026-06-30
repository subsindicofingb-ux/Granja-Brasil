import type {
  AccessDeviceDirection,
  AccessDeviceEntryKind,
  AccessDeviceType,
} from "@/lib/access-devices/constants";

export type AccessDeviceRecord = {
  id: string;
  condominium_id: string;
  display_name: string;
  access_type: AccessDeviceType;
  manufacturer: string;
  model: string;
  host_url: string;
  api_username: string;
  direction: AccessDeviceDirection;
  entry_kind: AccessDeviceEntryKind;
  is_active: boolean;
  is_pilot: boolean;
  last_connection_ok_at: string | null;
  last_connection_error: string | null;
  created_at: string;
  updated_at: string;
  shared_condominium_ids: string[];
  owner_condominium?: {
    id: string;
    name: string;
    slug: string;
  };
};

export type AccessDeviceListItem = Omit<AccessDeviceRecord, "api_username"> & {
  is_owned: boolean;
};
