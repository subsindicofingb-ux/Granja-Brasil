import { sendVisitorAuthorizationRequestNotification } from "@/lib/email/visitor-notifications";
import type { VisitorAuthorizationWithDetails } from "@/lib/visitor-authorizations/types";

export async function notifyVisitorAuthorizationRequest(input: {
  authorization: VisitorAuthorizationWithDetails;
  condominiumId: string;
  requesterName: string;
}): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    console.debug("[visitors:notify]", {
      authorizationId: input.authorization.id,
      condominiumId: input.condominiumId,
    });
  }

  await sendVisitorAuthorizationRequestNotification(input);
}
