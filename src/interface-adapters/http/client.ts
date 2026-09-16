// Cliente HTTP tipado para consumidores (SDK, portal), derivado de los mismos tipos generados
// desde el contrato (FR-033). openapi-fetch pesa ~2 KB gzip: apto para un tag de navegador.
import createClient, { type ClientOptions } from "openapi-fetch";
import type { paths } from "./generated/api.js";

export type { components, operations, paths } from "./generated/api.js";

export type OpeClient = ReturnType<typeof createClient<paths>>;

/** Crea un cliente tipado contra el contrato de OPE. `baseUrl` es el origen del backend. */
export function createOpeClient(options: ClientOptions & { baseUrl: string }): OpeClient {
  return createClient<paths>(options);
}
