// Merchant (01-arquitectura-mvp.md §0.1): el comercio que instala OPE. Lo mínimo para esta feature:
// identidad, credenciales de ingesta y orígenes registrados (ADR-014).
import type { MerchantId } from "../shared-kernel/index.js";

export interface Merchant {
  merchantId: MerchantId;
  /** Claves de ingesta activas: una, o dos durante una rotación. Públicas (viajan en el tag). */
  ingestKeys: readonly string[];
  /** Orígenes registrados de la tienda: `scheme://host[:port]`, sin path. */
  origins: readonly string[];
}

/** Forma canónica de un origen: scheme y host en minúsculas, sin path ni barra final. */
export function normalizeOrigin(origin: string): string | undefined {
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#\s]+)$/i.exec(origin.trim());
  if (!match) return undefined;
  const [, scheme = "", authority = ""] = match;
  return `${scheme.toLowerCase()}://${authority.toLowerCase()}`;
}

/**
 * ¿Puede este origen hablar en nombre del merchant? Sin `Origin` (servidor a servidor, pruebas)
 * no hay nada que verificar: el control es del par credencial + origen cuando el origen existe.
 */
export function originAllowed(merchant: Merchant, origin: string | undefined): boolean {
  if (origin === undefined) return true;
  const wanted = normalizeOrigin(origin);
  if (wanted === undefined) return false;
  return merchant.origins.some((o) => normalizeOrigin(o) === wanted);
}

/** Resuelve la credencial a su merchant. Comparación exacta; una clave pertenece a un solo merchant. */
export function findByIngestKey(merchants: readonly Merchant[], key: string): Merchant | undefined {
  if (key === "") return undefined;
  return merchants.find((m) => m.ingestKeys.includes(key));
}
