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

  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  return rest;
}
