import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PENDING_PASSWORD_RESET_COOKIE } from "@/lib/auth/constants";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60,
};

export async function hasPendingPasswordReset(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(PENDING_PASSWORD_RESET_COOKIE)?.value === "1";
}

export async function setPendingPasswordReset(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(PENDING_PASSWORD_RESET_COOKIE, "1", cookieOptions);
  } catch {
    // Cookies só podem ser alterados em Server Actions/Route Handlers.
  }
}

export async function clearPendingPasswordReset(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(PENDING_PASSWORD_RESET_COOKIE);
  } catch {
    // Ignora em contextos onde cookies não podem ser alterados.
  }
}

export function applyPendingPasswordResetCookie(response: NextResponse): NextResponse {
  response.cookies.set(PENDING_PASSWORD_RESET_COOKIE, "1", cookieOptions);
  return response;
}
