import { sendRegistrationApprovedNotification, sendRegistrationRequestNotification } from "@/lib/email/registration-notifications";
import type {
  RegistrationApprovedNotificationEvent,
  RegistrationRequestNotificationEvent,
} from "@/lib/registrations/types";

export async function notifyRegistrationRequestEvent(
  event: RegistrationRequestNotificationEvent,
): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    console.debug("[registrations:notify]", event);
  }

  await sendRegistrationRequestNotification(event);
}

export async function notifyRegistrationApprovedEvent(
  event: RegistrationApprovedNotificationEvent,
): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    console.debug("[registrations:approved]", event);
  }

  await sendRegistrationApprovedNotification(event);
}
