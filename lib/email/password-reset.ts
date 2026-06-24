import { buildEmailLayout, escapeHtml } from "@/lib/email/format";
import { sendEmail } from "@/lib/email/send-email";

export async function sendPasswordResetEmail(input: {
  to: string;
  recoveryLink: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const safeLink = input.recoveryLink.trim();
  const footerHtml = `Este e-mail foi enviado porque alguém solicitou redefinir a senha da sua conta no Granja Brasil.
                Se não foi você, ignore esta mensagem. O link abaixo expira em breve.<br /><br />
                Se o botão não funcionar, copie e cole este endereço no navegador:<br />
                <span style="word-break:break-all;">${escapeHtml(safeLink)}</span>`;

  const result = await sendEmail({
    to: [input.to],
    subject: "Redefinir sua senha no Granja Brasil",
    text: [
      "Olá,",
      "",
      "Recebemos um pedido para redefinir a senha da sua conta no Granja Brasil.",
      "Se você não fez este pedido, ignore este e-mail.",
      "",
      "Para criar uma nova senha, acesse o link abaixo (válido por tempo limitado):",
      safeLink,
      "",
      "Granja Brasil",
      "Gestão inteligente do seu condomínio",
    ].join("\n"),
    html: buildEmailLayout({
      preview: "Use o link abaixo para criar uma nova senha da sua conta.",
      title: "Redefinir sua senha",
      bodyHtml:
        "<p>Olá,</p><p>Recebemos um pedido para redefinir a senha da sua conta no <strong>Granja Brasil</strong>.</p><p>Se você não fez este pedido, pode ignorar este e-mail com segurança.</p>",
      actionLabel: "Criar nova senha",
      actionUrl: safeLink,
      footerHtml,
    }),
    tags: [{ name: "category", value: "password-reset" }],
  });

  if (!result.ok) {
    return result;
  }

  return { ok: true };
}
