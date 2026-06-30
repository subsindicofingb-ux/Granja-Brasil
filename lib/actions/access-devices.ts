"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { testControlIdConnection } from "@/lib/access-devices/controlid-client";
import {
  decryptAccessDevicePassword,
  encryptAccessDevicePassword,
  isAccessDeviceEncryptionConfigured,
} from "@/lib/access-devices/crypto";
import {
  createAccessDevice,
  getAccessDeviceById,
  getAccessDevicePasswordEncrypted,
  recordAccessDeviceConnectionResult,
  updateAccessDevice,
} from "@/lib/services/access-devices";
import {
  parseAccessDeviceFormData,
  parseAccessDeviceTestFormData,
} from "@/lib/validations/access-device.schema";

function revalidateAccessDevicePaths(condoSlug: string) {
  revalidatePath(`/app/${condoSlug}/settings/access-devices`);
  revalidatePath(`/app/${condoSlug}/settings`);
}

function filterSharedCondominiumIds(
  ownerCondominiumId: string,
  sharedCondominiumIds: string[] | undefined,
): string[] {
  return Array.from(
    new Set((sharedCondominiumIds ?? []).filter((id) => id !== ownerCondominiumId)),
  );
}

function ensureEncryptionConfigured(): AuthActionState | null {
  if (!isAccessDeviceEncryptionConfigured()) {
    return {
      error:
        "Configure ACCESS_DEVICE_ENCRYPTION_KEY no servidor antes de salvar equipamentos.",
    };
  }

  return null;
}

export async function createAccessDeviceAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageAccessDevices,
    { redirectTo: `/app/${condoSlug}/settings/access-devices` },
  );

  const encryptionError = ensureEncryptionConfigured();
  if (encryptionError) {
    return encryptionError;
  }

  const parsed = parseAccessDeviceFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (!parsed.data.api_password) {
    return { error: "Informe a senha da API do equipamento." };
  }

  let encryptedPassword: string;
  try {
    encryptedPassword = encryptAccessDevicePassword(parsed.data.api_password);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível proteger a senha.",
    };
  }

  const result = await createAccessDevice({
    condominiumId: access.condominium.id,
    createdBy: access.profile.id,
    displayName: parsed.data.display_name,
    accessType: parsed.data.access_type,
    manufacturer: parsed.data.manufacturer,
    model: parsed.data.model,
    hostUrl: parsed.data.host_url,
    apiUsername: parsed.data.api_username,
    apiPasswordEncrypted: encryptedPassword,
    direction: parsed.data.direction,
    entryKind: parsed.data.entry_kind,
    isActive: parsed.data.is_active,
    isPilot: parsed.data.is_pilot,
    sharedCondominiumIds: filterSharedCondominiumIds(
      access.condominium.id,
      parsed.data.shared_condominium_ids,
    ),
  });

  if (!result.ok) {
    return { error: result.error ?? "Não foi possível cadastrar o equipamento." };
  }

  revalidateAccessDevicePaths(condoSlug);
  redirect(`/app/${condoSlug}/settings/access-devices/${result.data.id}?criado=1`);
}

export async function updateAccessDeviceAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const deviceId = String(formData.get("device_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageAccessDevices,
    { redirectTo: `/app/${condoSlug}/settings/access-devices` },
  );

  const parsed = parseAccessDeviceFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  let encryptedPassword: string | undefined;
  if (parsed.data.api_password) {
    const encryptionError = ensureEncryptionConfigured();
    if (encryptionError) {
      return encryptionError;
    }

    try {
      encryptedPassword = encryptAccessDevicePassword(parsed.data.api_password);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Não foi possível proteger a senha.",
      };
    }
  }

  const result = await updateAccessDevice({
    deviceId,
    condominiumId: access.condominium.id,
    displayName: parsed.data.display_name,
    accessType: parsed.data.access_type,
    manufacturer: parsed.data.manufacturer,
    model: parsed.data.model,
    hostUrl: parsed.data.host_url,
    apiUsername: parsed.data.api_username,
    apiPasswordEncrypted: encryptedPassword,
    direction: parsed.data.direction,
    entryKind: parsed.data.entry_kind,
    isActive: parsed.data.is_active,
    isPilot: parsed.data.is_pilot,
    sharedCondominiumIds: filterSharedCondominiumIds(
      access.condominium.id,
      parsed.data.shared_condominium_ids,
    ),
  });

  if (!result.ok) {
    return { error: result.error ?? "Não foi possível atualizar o equipamento." };
  }

  revalidateAccessDevicePaths(condoSlug);
  revalidatePath(`/app/${condoSlug}/settings/access-devices/${deviceId}`);

  return { success: "Equipamento atualizado com sucesso." };
}

export async function testAccessDeviceConnectionAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageAccessDevices,
    { redirectTo: `/app/${condoSlug}/settings/access-devices` },
  );

  const parsed = parseAccessDeviceTestFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const password = parsed.data.api_password;

  if (!password && parsed.data.device_id) {
    return { error: "Informe a senha para testar a conexão." };
  }

  const testResult = await testControlIdConnection({
    hostUrl: parsed.data.host_url,
    username: parsed.data.api_username,
    password,
  });

  if (parsed.data.device_id) {
    await recordAccessDeviceConnectionResult({
      deviceId: parsed.data.device_id,
      ok: testResult.ok,
      errorMessage: testResult.ok ? undefined : testResult.error,
    });
    revalidateAccessDevicePaths(condoSlug);
    revalidatePath(`/app/${condoSlug}/settings/access-devices/${parsed.data.device_id}`);
  }

  if (!testResult.ok) {
    return { error: testResult.error };
  }

  return { success: "Conexão realizada com sucesso. Login na API ControlID OK." };
}

export async function testSavedAccessDeviceConnectionAction(
  deviceId: string,
  condoSlug: string,
): Promise<AuthActionState> {
  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageAccessDevices,
    { redirectTo: `/app/${condoSlug}/settings/access-devices` },
  );

  const deviceResult = await getAccessDeviceById(deviceId, access.condominium.id);
  if (!deviceResult.ok) {
    return { error: deviceResult.error ?? "Equipamento não encontrado." };
  }

  if (!deviceResult.data.is_owned) {
    return { error: "Somente o condomínio proprietário pode testar este equipamento." };
  }

  const encryptedResult = await getAccessDevicePasswordEncrypted(deviceId);
  if (!encryptedResult.ok) {
    return { error: encryptedResult.error ?? "Senha do equipamento indisponível." };
  }

  if (!isAccessDeviceEncryptionConfigured()) {
    return {
      error:
        "Configure ACCESS_DEVICE_ENCRYPTION_KEY no servidor para testar equipamentos salvos.",
    };
  }

  let password: string;
  try {
    password = decryptAccessDevicePassword(encryptedResult.data);
  } catch {
    return { error: "Não foi possível ler a senha salva do equipamento." };
  }

  const testResult = await testControlIdConnection({
    hostUrl: deviceResult.data.host_url,
    username: deviceResult.data.api_username,
    password,
  });

  await recordAccessDeviceConnectionResult({
    deviceId,
    ok: testResult.ok,
    errorMessage: testResult.ok ? undefined : testResult.error,
  });

  revalidateAccessDevicePaths(condoSlug);
  revalidatePath(`/app/${condoSlug}/settings/access-devices/${deviceId}`);

  if (!testResult.ok) {
    return { error: testResult.error };
  }

  return { success: "Conexão realizada com sucesso. Login na API ControlID OK." };
}
