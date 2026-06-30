import { z } from "zod";
import {
  ACCESS_DEVICE_DIRECTIONS,
  ACCESS_DEVICE_ENTRY_KINDS,
  ACCESS_DEVICE_TYPES,
} from "@/lib/access-devices/constants";

const accessDeviceTypeValues = [
  ACCESS_DEVICE_TYPES.FACIAL_PEDESTRIAN,
  ACCESS_DEVICE_TYPES.FACIAL_VEHICLE,
  ACCESS_DEVICE_TYPES.TAG_VEHICLE,
  ACCESS_DEVICE_TYPES.VISITOR_TEMP,
  ACCESS_DEVICE_TYPES.STAFF_MAINTENANCE,
] as const;

const accessDeviceDirectionValues = [
  ACCESS_DEVICE_DIRECTIONS.ENTRY,
  ACCESS_DEVICE_DIRECTIONS.EXIT,
  ACCESS_DEVICE_DIRECTIONS.BOTH,
] as const;

const accessDeviceEntryKindValues = [
  ACCESS_DEVICE_ENTRY_KINDS.PEDESTRIAN,
  ACCESS_DEVICE_ENTRY_KINDS.VEHICLE,
] as const;

export const accessDeviceFormSchema = z.object({
  display_name: z.string().trim().min(1, "Informe o nome do local de acesso.").max(120),
  access_type: z.enum(accessDeviceTypeValues),
  manufacturer: z.string().trim().min(1).max(80).default("ControlID"),
  model: z.string().trim().min(1).max(80).default("iDFace"),
  host_url: z.string().trim().min(1, "Informe o host ou IP público do equipamento.").max(500),
  api_username: z.string().trim().min(1, "Informe o usuário da API.").max(80),
  api_password: z.string().max(200).optional(),
  direction: z.enum(accessDeviceDirectionValues),
  entry_kind: z.enum(accessDeviceEntryKindValues),
  is_active: z.boolean(),
  is_pilot: z.boolean(),
  shared_condominium_ids: z.array(z.string().uuid()).optional(),
});

export function parseAccessDeviceFormData(formData: FormData) {
  const sharedRaw = formData.getAll("shared_condominium_ids");
  const sharedIds = sharedRaw
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);

  return accessDeviceFormSchema.safeParse({
    display_name: formData.get("display_name"),
    access_type: formData.get("access_type"),
    manufacturer: formData.get("manufacturer") || "ControlID",
    model: formData.get("model") || "iDFace",
    host_url: formData.get("host_url"),
    api_username: formData.get("api_username"),
    api_password: String(formData.get("api_password") ?? "").trim() || undefined,
    direction: formData.get("direction"),
    entry_kind: formData.get("entry_kind"),
    is_active: formData.get("is_active") === "on",
    is_pilot: formData.get("is_pilot") === "on",
    shared_condominium_ids: sharedIds.length > 0 ? sharedIds : undefined,
  });
}

export const accessDeviceTestSchema = z.object({
  device_id: z.string().uuid().optional(),
  host_url: z.string().trim().min(1, "Informe o host do equipamento.").max(500),
  api_username: z.string().trim().min(1, "Informe o usuário.").max(80),
  api_password: z.string().min(1, "Informe a senha para testar a conexão.").max(200),
});

export function parseAccessDeviceTestFormData(formData: FormData) {
  const deviceId = String(formData.get("device_id") ?? "").trim();

  return accessDeviceTestSchema.safeParse({
    device_id: deviceId || undefined,
    host_url: formData.get("host_url"),
    api_username: formData.get("api_username"),
    api_password: formData.get("api_password"),
  });
}
