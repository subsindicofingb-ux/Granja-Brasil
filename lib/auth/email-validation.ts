/** Domínios descartáveis / temporários comuns — bloqueados no cadastro. */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "sharklasers.com",
  "grr.la",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "10minutemail.com",
  "10minutemail.net",
  "yopmail.com",
  "yopmail.fr",
  "trashmail.com",
  "trashmail.me",
  "discard.email",
  "dispostable.com",
  "mailnesia.com",
  "maildrop.cc",
  "getnada.com",
  "tempail.com",
  "throwaway.email",
  "fakeinbox.com",
  "moakt.com",
  "emailondeck.com",
  "mintemail.com",
  "mytemp.email",
  "tmpmail.org",
  "tmpmail.net",
]);

export function getEmailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 1 || at === normalized.length - 1) {
    return null;
  }
  return normalized.slice(at + 1);
}

export function isDisposableEmailDomain(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) {
    return false;
  }

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return true;
  }

  // Subdomínios de provedores descartáveis (ex.: abc.mailinator.com)
  for (const blocked of DISPOSABLE_EMAIL_DOMAINS) {
    if (domain.endsWith(`.${blocked}`)) {
      return true;
    }
  }

  return false;
}

export function getSignupEmailValidationError(email: string): string | null {
  const normalized = email.trim().toLowerCase();

  if (!normalized) {
    return "Informe o e-mail.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return "Informe um e-mail válido.";
  }

  if (isDisposableEmailDomain(normalized)) {
    return "Use um e-mail permanente (Gmail, Outlook, etc.). E-mails temporários não são aceitos.";
  }

  return null;
}
