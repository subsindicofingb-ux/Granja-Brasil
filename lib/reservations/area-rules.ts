import { DEMO_CONDO_SLUG } from "@/lib/constants";

function normalizeAreaName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function requiresGuestCount(areaName: string): boolean {
  const normalized = normalizeAreaName(areaName);
  return (
    normalized.includes("festa") ||
    normalized.includes("salao") ||
    normalized.includes("churrasqueira")
  );
}

export function requiresPaymentReceipt(input: {
  requires_payment: boolean;
  name: string;
  areaCondominiumId: string;
  granjaCondominiumId: string | null;
}): boolean {
  if (input.requires_payment) {
    return true;
  }

  if (!input.granjaCondominiumId) {
    return false;
  }

  if (input.areaCondominiumId !== input.granjaCondominiumId) {
    return false;
  }

  return normalizeAreaName(input.name).includes("churrasqueira");
}

export function isGranjaCondominiumSlug(slug: string): boolean {
  return slug === DEMO_CONDO_SLUG;
}
