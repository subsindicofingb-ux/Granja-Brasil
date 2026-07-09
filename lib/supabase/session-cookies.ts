type CookieOptions = {
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
  priority?: "low" | "medium" | "high";
  partitioned?: boolean;
};

export function asBrowserSessionCookieOptions(
  options?: CookieOptions,
): CookieOptions {
  if (!options) {
    return { path: "/", sameSite: "lax" };
  }

  return {
    ...options,
    path: options.path ?? "/",
    sameSite: options.sameSite ?? "lax",
  };
}
