import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND_LOGO_SRC } from "@/lib/brand";

let cachedLogoBase64: string | null = null;

async function getLogoBase64(): Promise<string> {
  if (cachedLogoBase64) {
    return cachedLogoBase64;
  }

  const logoPath = join(process.cwd(), "public", BRAND_LOGO_SRC.replace(/^\//, ""));
  const logoBuffer = await readFile(logoPath);
  cachedLogoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  return cachedLogoBase64;
}

export async function renderBrandIcon(size: number, paddingRatio = 0.12) {
  const logoBase64 = await getLogoBase64();
  const innerSize = Math.round(size * (1 - paddingRatio * 2));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoBase64}
          alt=""
          width={innerSize}
          height={innerSize}
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    {
      width: size,
      height: size,
    },
  );
}
