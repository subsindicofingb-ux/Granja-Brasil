import { buildControlIdRegistration } from "@/lib/access-devices/registration";
import { normalizeAccessDeviceHostUrl } from "@/lib/access-devices/controlid-client";

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
  await postControlIdJson<ControlIdChangesResponse>(
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
}

export async function setControlIdUserImage(input: {
  baseUrl: string;
  session: string;
  userId: number;
  imageBytes: Buffer;
  contentType?: string;
}): Promise<void> {
  const response = await fetch(
    `${input.baseUrl}/user_set_image.fcgi?session=${encodeURIComponent(input.session)}&user_id=${input.userId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": input.contentType ?? "image/jpeg",
      },
      body: new Uint8Array(input.imageBytes),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`ControlID recusou o envio da foto (HTTP ${response.status}).`);
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

  if (bytes.length > 1_000_000) {
    throw new Error("A foto do morador excede 1 MB (limite ControlID).");
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
};

export type SyncResidentToDeviceResult = {
  controlIdUserId: number;
  controlIdRegistration: string;
};

export async function syncResidentToControlIdDevice(
  input: SyncResidentToDeviceInput,
): Promise<SyncResidentToDeviceResult> {
  const registration = buildControlIdRegistration(input.residentId);
  const { session, baseUrl } = await loginControlIdSession({
    hostUrl: input.hostUrl,
    username: input.username,
    password: input.password,
  });

  try {
    let userId = input.existingControlIdUserId ?? null;

    if (!userId) {
      const existing = await loadControlIdUserByRegistration({
        baseUrl,
        session,
        registration,
      });
      userId = existing?.id ?? null;
    }

    if (userId) {
      await updateControlIdUserName({
        baseUrl,
        session,
        userId,
        name: input.residentName,
      });
    } else {
      userId = await createControlIdUser({
        baseUrl,
        session,
        registration,
        name: input.residentName,
      });
    }

    if (input.requiresPhoto) {
      if (!input.photoUrl) {
        throw new Error("Foto obrigatória para sincronização facial.");
      }

      const photo = await fetchResidentPhotoBytes(input.photoUrl);
      await setControlIdUserImage({
        baseUrl,
        session,
        userId,
        imageBytes: photo.bytes,
        contentType: photo.contentType,
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
  controlIdUserId: number;
}): Promise<void> {
  const { session, baseUrl } = await loginControlIdSession({
    hostUrl: input.hostUrl,
    username: input.username,
    password: input.password,
  });

  try {
    await destroyControlIdUser({
      baseUrl,
      session,
      userId: input.controlIdUserId,
    });
  } finally {
    await logoutControlIdSession(baseUrl, session);
  }
}
