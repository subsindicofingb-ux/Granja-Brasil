import { BRAND_NAME } from "@/lib/brand";
import { DEMO_CONDO_SLUG } from "@/lib/constants";

export function isGeneralCondominium(slug: string): boolean {
  return slug === DEMO_CONDO_SLUG;
}

export function formatCondominiumDisplayName(name: string, slug: string): string {
  if (isGeneralCondominium(slug)) {
    return BRAND_NAME;
  }

  return name;
}
