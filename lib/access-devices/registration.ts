export function buildControlIdRegistration(residentId: string): string {
  const compact = residentId.replace(/-/g, "").slice(0, 12);
  const numeric = BigInt(`0x${compact}`) % BigInt(99_999_999);
  return numeric.toString().padStart(8, "0");
}
