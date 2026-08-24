import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  canCurrentUserAccessCondoUpload,
  downloadCondoUploadBytes,
} from "@/lib/storage/condo-uploads";
import {
  getCondoIdFromUploadPath,
  isValidCondoUploadPath,
} from "@/lib/storage/condo-upload-path";

export const runtime = "nodejs";

function pathFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const path = url.searchParams.get("path")?.trim() ?? "";
  if (!path || !isValidCondoUploadPath(path)) {
    return null;
  }

  return path;
}

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const path = pathFromRequest(request);
  if (!path) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }

  const condominiumId = getCondoIdFromUploadPath(path);
  if (!condominiumId || !(await canCurrentUserAccessCondoUpload(condominiumId))) {
    return NextResponse.json({ error: "Sem permissão para ver este arquivo." }, { status: 403 });
  }

  try {
    const file = await downloadCondoUploadBytes(path);
    const fileName = path.split("/").at(-1) ?? "arquivo";
    const isInline =
      file.contentType.startsWith("image/") || file.contentType === "application/pdf";

    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `${isInline ? "inline" : "attachment"}; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }
}
