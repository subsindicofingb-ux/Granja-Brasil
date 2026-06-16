import { cookies } from "next/headers";
import { ACTIVE_CONDO_COOKIE } from "@/lib/auth/constants";

export async function getActiveCondoSlug(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_CONDO_COOKIE)?.value ?? null;
}

export async function setActiveCondoSlug(slug: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_CONDO_COOKIE, slug, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearActiveCondoSlug(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_CONDO_COOKIE);
}
