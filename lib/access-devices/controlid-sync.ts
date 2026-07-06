import { buildControlIdRegistration } from "@/lib/access-devices/registration";
import { normalizeAccessDeviceHostUrl } from "@/lib/access-devices/controlid-client";
import { normalizePhotoForControlId } from "@/lib/access-devices/photo-normalize";

export { normalizeAccessDeviceHostUrl };

type ControlIdLoginResponse = {
  session?: string;
};

type ControlIdCreateObjectsResponse = {
  ids?: number[];
};

type ControlIdLoadUsersResponse = {
  users?: Array<{
    id: number;
    registration?: string;
    name?: string;
  }>;
};

type ControlIdChangesResponse = {
  changes?: number;
};

const REQUEST_TIMEOUT_MS = 30_000;

async function postControlIdJson<T>(
  baseUrl: string,
  path: string,
  session: string | null,
  body?: unknown,
): Promise<T> {
  const sessionQuery = session ? `?session=${encodeURIComponent(session)}` : "";
  const response = await fetch(`${baseUrl}${path}${sessionQuery}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`ControlID respondeu HTTP ${response.status} em ${path}.`);
  }

  const text = await response.text();
  if (!text.trim()) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

export async function loginControlIdSession(input: {
  hostUrl: string;
  username: string;
  password: string;
}): Promise<{ session: string; baseUrl: string }> {
  const baseUrl = normalizeAccessDeviceHostUrl(input.hostUrl);
  const data = await postControlIdJson<ControlIdLoginResponse>(baseUrl, "/login.fcgi", null, {
    login: input.username,
    password: input.password,
  });

  if (!data.session) {
    throw new Error("Login recusado. Verifique usuário e senha do equipamento.");
  }

  return { session: data.session, baseUrl };
}

export async function logoutControlIdSession(baseUrl: string, session: string): Promise<void> {
  try {
    await postControlIdJson(baseUrl, "/logout.fcgi", session);
  } catch {
    // Best effort — session expires on device anyway.
  }
}

export async function testControlIdConnection(input: {
  hostUrl: string;
  username: string;
  password: string;
}): Promise<{ ok: true; session: string } | { ok: false; error: string }> {
  try {
    const { session } = await loginControlIdSession(input);
    return { ok: true, session };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível conectar ao equipamento. Verifique host, porta, DDNS e rede.",
    };
  }
}

export async function loadControlIdUserByRegistration(input: {
  baseUrl: string;
  session: string;
  registration: string;
}): Promise<{ id: number; registration: string; name: string } | null> {
  const data = await postControlIdJson<ControlIdLoadUsersResponse>(
    input.baseUrl,
    "/load_objects.fcgi",
    input.session,
    {
      object: "users",
      fields: ["id", "registration", "name"],
      where: {
        users: { registration: input.registration },
      },
      limit: 1,
    },
  );

  const user = data.users?.[0];
  if (!user?.id) {
    return null;
  }

  return {
    id: user.id,
    registration: user.registration ?? input.registration,
    name: user.name ?? "",
  };
}

export async function createControlIdUser(input: {
  baseUrl: string;
  session: string;
  registration: string;
  name: string;
}): Promise<number> {
  const data = await postControlIdJson<ControlIdCreateObjectsResponse>(
    input.baseUrl,
    "/create_objects.fcgi",
    input.session,
    {
      object: "users",
      values: [
        {
          registration: input.registration,
          name: input.name,
          password: "",
        },
      ],
    },
  );

  const userId = data.ids?.[0];
  if (!userId) {
    throw new Error("ControlID não retornou o ID do usuário criado.");
  }

  return userId;
}

export async function loadControlIdUserById(input: {
  baseUrl: string;
  session: string;
  userId: number;
}): Promise<{ id: number; registration: string; name: string } | null> {
  const data = await postControlIdJson<ControlIdLoadUsersResponse>(
    input.baseUrl,
    "/load_objects.fcgi",
    input.session,
    {
      object: "users",
      fields: ["id", "registration", "name"],
      where: {
        users: { id: input.userId },
      },
      limit: 1,
    },
  );

  const user = data.users?.[0];
  if (!user?.id) {
    return null;
  }

  return {
    id: user.id,
    registration: user.registration ?? "",
    name: user.name ?? "",
  };
}

async function resolveOrCreateControlIdUser(input: {
  baseUrl: string;
  session: string;
  registration: string;
  residentName: string;
  preferredUserId?: number | null;
}): Promise<number> {
  if (input.preferredUserId) {
    const byId = await loadControlIdUserById({
      baseUrl: input.baseUrl,
      session: input.session,
      userId: input.preferredUserId,
    });

    if (byId) {
      await updateControlIdUserName({
        baseUrl: input.baseUrl,
        session: input.session,
        userId: byId.id,
        name: input.residentName,
      });
      return byId.id;
    }
  }

  const byRegistration = await loadControlIdUserByRegistration({
    baseUrl: input.baseUrl,
    session: input.session,
    registration: input.registration,
  });

  if (byRegistration) {
    await updateControlIdUserName({
      baseUrl: input.baseUrl,
      session: input.session,
      userId: byRegistration.id,
      name: input.residentName,
    });
    return byRegistration.id;
  }

  return createControlIdUser({
    baseUrl: input.baseUrl,
    session: input.session,
    registration: input.registration,
    name: input.residentName,
  });
}

export async function updateControlIdUserName(input: {
  baseUrl: string;
  session: string;
  userId: number;
  name: string;
}): Promise<void> {
  const data = await postControlIdJson<ControlIdChangesResponse>(
    input.baseUrl,
    "/modify_objects.fcgi",
    input.session,
    {
      object: "users",
      values: { name: input.name },
      where: {
        users: { id: input.userId },
      },
    },
  );

  if ((data.changes ?? 0) < 1) {
    throw new Error("ControlID não encontrou o usuário para atualizar.");
  }
}

export async function destroyControlIdUser(input: {
  baseUrl: string;
  session: string;
  userId: number;
}): Promise<void> {
  const data = await postControlIdJson<ControlIdChangesResponse>(
    input.baseUrl,
    "/destroy_objects.fcgi",
    input.session,
    {
      object: "users",
      where: {
        users: { id: input.userId },
      },
    },
  );

  if ((data.changes ?? 0) >= 1) {
    return;
  }

  const stillExists = await loadControlIdUserById({
    baseUrl: input.baseUrl,
    session: input.session,
    userId: input.userId,
  });

  if (!stillExists) {
    return;
  }

  throw new Error("ControlID não removeu o usuário.");
}

type ControlIdUserImagesResponse = {
  user_ids?: number[];
};

type ControlIdImageError = {
  code?: number;
  message?: string;
};

type ControlIdSetImageResponse = {
  success?: boolean;
  errors?: ControlIdImageError[];
  user_id?: number;
};

type ControlIdSetImageListResponse = {
  results?: Array<ControlIdSetImageResponse & { user_id?: number }>;
};

function formatControlIdImageErrors(errors: ControlIdImageError[] | undefined): string {
  const messages = (errors ?? [])
    .map((error) => error.message?.trim())
    .filter((message): message is string => Boolean(message));

  return messages.length > 0 ? messages.join("; ") : "Erro desconhecido ao cadastrar foto.";
}

function assertControlIdImageAccepted(
  response: ControlIdSetImageResponse,
  fallbackMessage: string,
): void {
  if (response.success === false || (response.errors?.length ?? 0) > 0) {
    throw new Error(formatControlIdImageErrors(response.errors) || fallbackMessage);
  }
}

async function controlIdUserHasPhoto(input: {
  baseUrl: string;
  session: string;
  userId: number;
}): Promise<boolean> {
  const data = await postControlIdJson<ControlIdUserImagesResponse>(
    input.baseUrl,
    "/user_list_images.fcgi",
    input.session,
  );

  return (data.user_ids ?? []).includes(input.userId);
}

export async function setControlIdUserImage(input: {
  baseUrl: string;
  session: string;
  userId: number;
  imageBytes: Buffer;
  timestamp?: number;
}): Promise<void> {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const response = await fetch(
    `${input.baseUrl}/user_set_image.fcgi?session=${encodeURIComponent(input.session)}&user_id=${input.userId}&timestamp=${timestamp}&match=0`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array(input.imageBytes),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    },
  );

  const responseText = await response.text().catch(() => "");

  if (responseText.trim()) {
    let data: ControlIdSetImageResponse | null = null;
    try {
      data = JSON.parse(responseText) as ControlIdSetImageResponse;
    } catch {
      data = null;
    }

    if (data) {
      assertControlIdImageAccepted(
        data,
        "ControlID recusou o envio da foto sem detalhes adicionais.",
      );
      return;
    }
  }

  if (response.ok) {
    return;
  }

  throw new Error(
    `ControlID recusou o envio da foto (HTTP ${response.status})${responseText ? `: ${responseText.slice(0, 200)}` : ""}.`,
  );
}

export async function setControlIdUserImageBase64(input: {
  baseUrl: string;
  session: string;
  userId: number;
  imageBase64: string;
  timestamp?: number;
}): Promise<void> {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const data = await postControlIdJson<ControlIdSetImageListResponse>(
    input.baseUrl,
    "/user_set_image_list.fcgi",
    input.session,
    {
      match: false,
      user_images: [
        {
          user_id: input.userId,
          timestamp,
          image: input.imageBase64,
        },
      ],
    },
  );

  const result = data.results?.find((entry) => entry.user_id === input.userId) ?? data.results?.[0];
  if (!result) {
    throw new Error("ControlID não retornou o resultado do envio da foto.");
  }

  assertControlIdImageAccepted(result, "ControlID recusou o envio da foto em lote.");
}

async function uploadControlIdUserPhoto(input: {
  baseUrl: string;
  session: string;
  userId: number;
  imageBytes: Buffer;
}): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);
  const jpegBytes = await normalizePhotoForControlId(input.imageBytes);

  await setControlIdUserImage({
    ...input,
    imageBytes: jpegBytes,
    timestamp,
  });

  if (await controlIdUserHasPhoto(input)) {
    return;
  }

  await setControlIdUserImageBase64({
    baseUrl: input.baseUrl,
    session: input.session,
    userId: input.userId,
    imageBase64: jpegBytes.toString("base64"),
    timestamp,
  });

  if (!(await controlIdUserHasPhoto(input))) {
    throw new Error(
      "Usuário criado no equipamento, mas a foto não gerou reconhecimento facial. Use foto JPG frontal, rosto centralizado e boa iluminação.",
    );
  }
}

export async function fetchResidentPhotoBytes(photoUrl: string): Promise<{
  bytes: Buffer;
  contentType: string;
}> {
  const response = await fetch(photoUrl, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Não foi possível baixar a foto do morador (HTTP ${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);

  if (bytes.length === 0) {
    throw new Error("A foto do morador está vazia.");
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  return { bytes, contentType };
}

export type SyncResidentToDeviceInput = {
  hostUrl: string;
  username: string;
  password: string;
  residentId: string;
  residentName: string;
  photoUrl: string | null;
  requiresPhoto: boolean;
  existingControlIdUserId?: number | null;
  registration?: string;
};

export type SyncResidentToDeviceResult = {
  controlIdUserId: number;
  controlIdRegistration: string;
};

export async function syncResidentToControlIdDevice(
  input: SyncResidentToDeviceInput,
): Promise<SyncResidentToDeviceResult> {
  const registration = input.registration ?? buildControlIdRegistration(input.residentId);
  const { session, baseUrl } = await loginControlIdSession({
    hostUrl: input.hostUrl,
    username: input.username,
    password: input.password,
  });

  try {
    const userId = await resolveOrCreateControlIdUser({
      baseUrl,
      session,
      registration,
      residentName: input.residentName,
      preferredUserId: input.existingControlIdUserId,
    });

    if (input.requiresPhoto) {
      if (!input.photoUrl) {
        throw new Error("Foto obrigatória para sincronização facial.");
      }

      const photo = await fetchResidentPhotoBytes(input.photoUrl);
      await uploadControlIdUserPhoto({
        baseUrl,
        session,
        userId,
        imageBytes: photo.bytes,
      });
    }

    return {
      controlIdUserId: userId,
      controlIdRegistration: registration,
    };
  } finally {
    await logoutControlIdSession(baseUrl, session);
  }
}

export async function removeResidentFromControlIdDevice(input: {
  hostUrl: string;
  username: string;
  password: string;
  controlIdUserId?: number | null;
  registration?: string | null;
}): Promise<void> {
  const { session, baseUrl } = await loginControlIdSession({
    hostUrl: input.hostUrl,
    username: input.username,
    password: input.password,
  });

  try {
    let userId = input.controlIdUserId ?? null;

    if (userId) {
      const byId = await loadControlIdUserById({
        baseUrl,
        session,
        userId,
      });
      if (!byId) {
        userId = null;
      }
    }

    if (!userId && input.registration) {
      const byRegistration = await loadControlIdUserByRegistration({
        baseUrl,
        session,
        registration: input.registration,
      });
      userId = byRegistration?.id ?? null;
    }

    if (!userId) {
      return;
    }

    await destroyControlIdUser({
      baseUrl,
      session,
      userId,
    });
  } finally {
    await logoutControlIdSession(baseUrl, session);
  }
}
