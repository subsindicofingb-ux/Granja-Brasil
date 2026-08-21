import { renderBrandIcon } from "@/lib/brand/render-icon";

export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return renderBrandIcon(32);
}
