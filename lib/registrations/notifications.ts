import type { RegistrationRequestNotificationEvent } from "@/lib/registrations/types";

/**
 * Ponto único para notificar síndico/admin sobre nova solicitação de cadastro.
 * E-mail/push podem ser plugados aqui depois.
 */
export async function notifyRegistrationRequestEvent(
  event: RegistrationRequestNotificationEvent,
): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    console.debug("[registrations:notify]", event);
  }
}
