import { buildEmailLayout } from "@/lib/email/format";
import { sendEmail } from "@/lib/email/send-email";

export async function sendPasswordResetEmail(input: {
  to: string;
  recoveryLink: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await sendEmail({
    to: [input.to],
    subject: "Redefinir senha — Granja Brasil",
    text: `Recebemos uma solicitação para redefinir sua senha.\n\nAcesse o link abaixo (válido por tempo limitado):\n${input.recoveryLink}\n\nSe você não solicitou, ignore este e-mail.`,
    html: buildEmailLayout({
      preview: "Redefina sua senha do Granja Brasil.",
      title: "Redefinir senha",
      bodyHtml:
        "<p>Recebemos uma solicitação para redefinir a senha da sua conta.</p><p>Se você não solicitou, ignore este e-mail.</p>",
      actionLabel: "Criar nova senha",
      actionUrl: input.recoveryLink,
    }),
    tags: [{ name: "category", value: "password-reset" }],
  });

  if (!result.ok) {
    return result;
  }

  return { ok: true };
}
