export const APP_SESSION_TAB_KEY = "gb_app_session_tab";

export function buildTabSessionRedirect(next: string): string {
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  return `/auth/tab-session?next=${encodeURIComponent(destination)}`;
}

export function markAppSessionTab(): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(APP_SESSION_TAB_KEY, "1");
}

export function clearAppSessionTab(): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(APP_SESSION_TAB_KEY);
}

export function hasAppSessionTab(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return sessionStorage.getItem(APP_SESSION_TAB_KEY) === "1";
}
