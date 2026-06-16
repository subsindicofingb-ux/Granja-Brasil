import type { ReservationNotificationEvent } from "@/lib/reservations/types";

/**
 * Ponto único para notificações de reserva (e-mail, push, etc.).
 * Implementação real virá em módulo dedicado.
 */
export async function notifyReservationEvent(event: ReservationNotificationEvent): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    console.debug("[reservations:notify]", event);
  }
}
