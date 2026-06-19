type SendEmailInput = {
  to: string[];
  subject: string;
  html: string;
  text: string;
};

type SendEmailResult = { ok: true } | { ok: false; error: string };

export function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() ?? "Granja Brasil <noreply@granja-brasil.app>";

  if (!apiKey) {
    return null;
  }

  return { apiKey, from };
}

export function isEmailConfigured(): boolean {
  return getResendConfig() !== null;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const config = getResendConfig();

  if (!config) {
    return { ok: false, error: "E-mail não configurado (RESEND_API_KEY)." };
  }

  const recipients = [...new Set(input.to.map((email) => email.trim().toLowerCase()).filter(Boolean))];

  if (recipients.length === 0) {
    return { ok: false, error: "Nenhum destinatário de e-mail." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: recipients,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: body || `Falha ao enviar e-mail (${response.status}).` };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao enviar e-mail.",
    };
  }
}
