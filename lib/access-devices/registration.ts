/**
 * Matrícula ControlID (campo `registration` no iDFace/iDAccess).
 *
 * Padrão único do Granja Brasil:
 * - 8 dígitos, zero à esquerda
 * - Derivado deterministicamente do UUID do morador (mesmo morador = mesma matrícula sempre)
 * - Usado em create, update, remove e busca no equipamento
 */
export function buildControlIdRegistration(residentId: string): string {
  const compact = residentId.replace(/-/g, "").slice(0, 12);
  const numeric = BigInt(`0x${compact}`) % BigInt(99_999_999);
  return numeric.toString().padStart(8, "0");
}
