export const ACTIVE_CONDO_COOKIE = "active_condo_slug";
export const PENDING_PASSWORD_RESET_COOKIE = "pending_password_reset";

export const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"] as const;

export const PUBLIC_AUTH_PATHS = ["/auth/callback", "/auth/signout"] as const;
