import { PASSWORD_REQUIREMENTS_HINT } from "@/lib/auth/password-policy";

export function PasswordRequirementsHint() {
  return <p className="text-xs text-muted-foreground">{PASSWORD_REQUIREMENTS_HINT}</p>;
}
