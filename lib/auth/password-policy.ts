export const PASSWORD_MIN_LENGTH = 6;

export const PASSWORD_REQUIREMENTS_HINT =
  "Mínimo de 6 caracteres, com letra maiúscula, letra minúscula, número e símbolo (ex.: ! @ # $ %).";

export function isPasswordPolicyCompliant(password: string): boolean {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return false;
  }

  return (
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function getPasswordPolicyError(password: string): string | null {
  if (!password) {
    return "Informe a senha.";
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }

  if (!isPasswordPolicyCompliant(password)) {
    return PASSWORD_REQUIREMENTS_HINT;
  }

  return null;
}

export function formatPasswordPolicyError(message: unknown): string | null {
  const text = message instanceof Error ? message.message : String(message);
  const lower = text.toLowerCase();

  if (
    lower.includes("password should contain") ||
    lower.includes("password is too weak") ||
    lower.includes("password requirements") ||
    lower.includes("weak password") ||
    lower.includes("at least one character of each category")
  ) {
    return PASSWORD_REQUIREMENTS_HINT;
  }

  return null;
}
