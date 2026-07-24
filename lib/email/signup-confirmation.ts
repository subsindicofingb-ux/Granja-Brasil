import { buildEmailLayout, textToHtmlParagraphs } from "@/lib/email/format";
import { isEmailConfigured, sendEmail } from "@/lib/email/send-email";

export async function sendSignupConfirmationEmail(input: {
  to: string;
  fullName: string;
  confirmLink: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "E-mail não configurado (RESEND_API_KEY)." };
  }

  const text = [
    `Olá, ${input.fullName},`,
    "",
    "Recebemos seu cadastro no Granja Brasil.",
    "Para confirmar que este e-mail é seu, toque no botão abaixo.",
    "",
    "Depois disso, aguarde a aprovação do responsável do condomínio.",
    "",
    "Se você não solicitou este cadastro, ignore esta mensagem.",
  ].join("\n");

  return sendEmail({
    to: [input.to],
    subject: "Confirme seu e-mail — Granja Brasil",
    text,
    html: buildEmailLayout({
      preview: "Confirme seu e-mail para concluir o cadastro no Granja Brasil.",
      title: "Confirme seu e-mail",
      bodyHtml: textToHtmlParagraphs(text),
      actionLabel: "Confirmar e-mail",
      actionUrl: input.confirmLink,
    }),
    tags: [{ name: "category", value: "signup-confirm" }],
  });
}
