// Puerto: de dónde salen los merchants. En esta feature, de la configuración; en la 006, del almacén.
import type { Merchant } from "../../../domain/merchant/index.js";

export interface MerchantDirectory {
  /** Merchant dueño de la credencial, o `undefined` si nadie la tiene. */
  findByIngestKey(key: string): Merchant | undefined;
  /** ¿Algún merchant registró este origen? Lo único que el preflight CORS puede preguntar. */
  isRegisteredOrigin(origin: string): boolean;
}
