import { after } from "next/server";
import { notifyUnitNotificationReadToSender } from "@/lib/email/notification-notifications";
import type { UnitNotificationWithDetails } from "@/lib/notifications/types";
import {
  markUnitNotificationAsRead,
  markUnitNotificationReadReceiptSent,
  markUnitNotificationSenderSeen,
} from "@/lib/services/notifications";

export async function handleUnitNotificationDetailView(input: {
  notificationId: string;
  profileId: string;
  isRecipient: boolean;
  isSender: boolean;
  readerName: string;
  notification: UnitNotificationWithDetails;
}): Promise<void> {
  if (input.isSender) {
    await markUnitNotificationSenderSeen({
      notificationId: input.notificationId,
      profileId: input.profileId,
    });
    await markUnitNotificationAsRead({
      notificationId: input.notificationId,
      profileId: input.profileId,
    });
  }

  if (!input.isRecipient) {
    return;
  }

  const readResult = await markUnitNotificationAsRead({
    notificationId: input.notificationId,
    profileId: input.profileId,
  });

  if (!readResult.ok || !readResult.data.firstRead) {
    return;
  }

  const { notification, readerName, notificationId, profileId } = input;
  const readAt = readResult.data.read_at;

  after(async () => {
    try {
      await notifyUnitNotificationReadToSender({
        notification,
        readerName,
        readAt,
      });
      await markUnitNotificationReadReceiptSent({
        notificationId,
        profileId,
      });
    } catch (error) {
      console.error("[email:notification-read]", error);
    }
  });
}
