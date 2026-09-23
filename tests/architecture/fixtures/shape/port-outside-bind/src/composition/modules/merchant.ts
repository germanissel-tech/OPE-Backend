// Fixture (feature 020, FR-015): un módulo de composición que construye implementaciones de
// puerto fuera del builder de un enlace — un gateway instanciado en lo que sirve, y una política
// escrita en el medio del cableado.
import { MemoryMerchantStore, memoryMerchantStore } from "../../interface-adapters/merchant/index.js";

export const rotation = (): RotationPolicy => ({ maxGraceMs: () => Promise.resolve(0) });

export const merchantModule = compositionModule({
  provides: [bind(MerchantStorePort, {}, () => memoryMerchantStore())],
  serves: {
    handlers: {
      getMerchant: handler({}, () => new MemoryMerchantStore()),
    },
  },
});
