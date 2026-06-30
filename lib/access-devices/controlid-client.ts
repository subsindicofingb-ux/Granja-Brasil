export function normalizeAccessDeviceHostUrl(hostUrl: string): string {
  let normalized = hostUrl.trim();
  if (!normalized) {
    throw new Error("Informe o host do equipamento.");
  }

  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `http://${normalized}`;
  }

  return normalized.replace(/\/+$/, "");
}

type ControlIdLoginResponse = {
  session?: string;
};

export async function testControlIdConnection(input: {
  hostUrl: string;
  username: string;
  password: string;
}): Promise<{ ok: true; session: string } | { ok: false; error: string }> {
  let baseUrl: string;

  try {
    baseUrl = normalizeAccessDeviceHostUrl(input.hostUrl);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Host inválido." };
  }

  try {
    const response = await fetch(`${baseUrl}/login.fcgi`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        login: input.username,
        password: input.password,
      }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Equipamento respondeu com erro HTTP ${response.status}.`,
      };
    }

    const data = (await response.json()) as ControlIdLoginResponse;

    if (!data.session) {
      return {
        ok: false,
        error: "Login recusado. Verifique usuário e senha do equipamento.",
      };
    }

    return { ok: true, session: data.session };
  } catch {
    return {
      ok: false,
      error:
        "Não foi possível conectar ao equipamento. Verifique host, porta, DDNS e rede.",
    };
  }
}
