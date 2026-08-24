export const CONDO_UPLOADS_BUCKET = "condo-uploads";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE_NAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|webp|pdf)$/i;

export const CONDO_UPLOAD_FOLDERS = [
  "residents",
  "vehicles",
  "reservations",
  "announcements",
  "registration-requests",
  "notifications",
  "visitors",
  "members",
  "occurrences",
] as const;

const FOLDER_SET = new Set<string>(CONDO_UPLOAD_FOLDERS);

function decodePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stripQuery(value: string): string {
  const queryIndex = value.indexOf("?");
  return queryIndex >= 0 ? value.slice(0, queryIndex) : value;
}

/** Extracts `condoId/folder/file.ext` from a stored URL, app path or raw path. */
export function parseCondoUploadPath(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const raw = value.trim();
  if (!raw || raw.includes("..") || raw.includes("\\")) {
    return null;
  }

  try {
    const parsed = new URL(raw, "http://local.invalid");
    if (parsed.pathname.replace(/\/+$/, "") === "/api/uploads") {
      const pathParam = parsed.searchParams.get("path");
      if (pathParam) {
        return decodePath(pathParam);
      }
    }
  } catch {
    // URL relativa inválida — tenta os outros formatos.
  }

  const trimmed = stripQuery(raw);

  const apiMatch = trimmed.match(/\/api\/uploads\/(.+)$/i);
  if (apiMatch?.[1]) {
    return decodePath(apiMatch[1]);
  }

  const storageMatch = trimmed.match(
    /\/storage\/v1\/object\/(?:public|sign|authenticated)\/condo-uploads\/(.+)$/i,
  );
  if (storageMatch?.[1]) {
    return decodePath(storageMatch[1]);
  }

  if (!trimmed.includes("://")) {
    return trimmed.replace(/^\/+/, "");
  }

  return null;
}

export function isValidCondoUploadPath(path: string): boolean {
  const segments = path.split("/").filter(Boolean);
  if (segments.length !== 3) {
    return false;
  }

  const [condominiumId, folder, fileName] = segments;
  return (
    UUID_RE.test(condominiumId) &&
    FOLDER_SET.has(folder) &&
    FILE_NAME_RE.test(fileName)
  );
}

export function getCondoIdFromUploadPath(path: string): string | null {
  const condominiumId = path.split("/")[0];
  return condominiumId && UUID_RE.test(condominiumId) ? condominiumId : null;
}

/** Converts a stored Storage URL into an authenticated app URL. Leaves external URLs unchanged. */
export function toProtectedUploadSrc(value: string): string {
  const path = parseCondoUploadPath(value);
  if (!path || !isValidCondoUploadPath(path)) {
    return value;
  }

  return `/api/uploads?path=${encodeURIComponent(path)}`;
}

export function toAbsoluteProtectedUploadSrc(value: string, siteUrl: string): string {
  const src = toProtectedUploadSrc(value);
  if (src.startsWith("/")) {
    return `${siteUrl.replace(/\/+$/, "")}${src}`;
  }

  return src;
}
