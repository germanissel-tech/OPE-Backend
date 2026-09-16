import type { Clock } from "../../../application/shared-kernel/index.js";

/** Reloj del sistema. Lo cablea el perfil de composición; las pruebas inyectan uno fijo. */
export const systemClock: Clock = { now: () => new Date() };
