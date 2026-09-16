import type { Clock } from "../../ports/clock.js";

/** Reloj del sistema. Se cablea en src/main.ts; las pruebas inyectan uno fijo. */
export const systemClock: Clock = { now: () => new Date() };
