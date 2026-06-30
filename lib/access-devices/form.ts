import { isValidUuid } from "@/lib/utils";

export function parseAccessDeviceIdsFromFormData(formData: FormData): string[] {
  const values = formData.getAll("access_device_ids");
  const ids = values.filter((value): value is string => typeof value === "string" && isValidUuid(value));
  return Array.from(new Set(ids));
}
