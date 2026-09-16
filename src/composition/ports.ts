// Contenedor tipado de puertos (ADR-013). Un perfil tiene que proveer todos los campos: agregar
// un puerto acá sin proveerlo en un perfil no compila (FR-003).
import type { Clock, IdGenerator } from "../application/shared-kernel/index.js";

export interface Ports {
  clock: Clock;
  ids: IdGenerator;
}

/** Un gateway puede necesitar apagarse (conexiones, timers). En memoria no hay nada que cerrar. */
export interface Closable {
  close(): Promise<void> | void;
}

export function isClosable(value: unknown): value is Closable {
  return typeof value === "object" && value !== null && "close" in value && typeof value.close === "function";
}
