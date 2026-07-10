import { headers } from "next/headers";

export async function getSignupClientMetadata(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  const ipAddress =
    forwardedFor?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    null;

  return {
    ipAddress,
    userAgent: headersList.get("user-agent"),
  };
}
