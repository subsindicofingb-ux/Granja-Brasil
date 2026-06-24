export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function textToHtmlParagraphs(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

export function buildEmailLayout(input: {
  preview: string;
  title: string;
  bodyHtml: string;
  actionLabel: string;
  actionUrl: string;
}): string {
  const preview = escapeHtml(input.preview);
  const title = escapeHtml(input.title);
  const actionLabel = escapeHtml(input.actionLabel);
  const actionUrl = escapeHtml(input.actionUrl);

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;background:linear-gradient(135deg,#eff6ff,#eef2ff);border-bottom:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#2563eb;">Granja Brasil</p>
                <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;color:#0f172a;">${title}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;font-size:15px;line-height:1.6;color:#334155;">
                ${input.bodyHtml}
                <p style="margin:28px 0 0;">
                  <a href="${actionUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:10px;">
                    ${actionLabel}
                  </a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 24px;font-size:12px;line-height:1.5;color:#64748b;border-top:1px solid #f1f5f9;">
                Você recebeu este e-mail porque há uma atualização no seu condomínio.
                Se o botão não funcionar, copie e cole este link no navegador:<br />
                <span style="word-break:break-all;">${actionUrl}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
