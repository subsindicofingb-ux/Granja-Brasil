import { sendReservationMovementNotification } from "@/lib/email/reservation-notifications";
import type { ReservationNotificationEvent } from "@/lib/reservations/types";

/**
 * Ponto único para notificações de reserva (e-mail, push, etc.).
 */
export async function notifyReservationEvent(event: ReservationNotificationEvent): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    console.debug("[reservations:notify]", event);
  }

  try {
    await sendReservationMovementNotification(event);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[reservations:notify:error]", error);
    }
  }
}
