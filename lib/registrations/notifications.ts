import { sendRegistrationRequestNotification } from "@/lib/email/registration-notifications";
import type { RegistrationRequestNotificationEvent } from "@/lib/registrations/types";

export async function notifyRegistrationRequestEvent(
  event: RegistrationRequestNotificationEvent,
): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    console.debug("[registrations:notify]", event);
  }

  await sendRegistrationRequestNotification(event);
}
