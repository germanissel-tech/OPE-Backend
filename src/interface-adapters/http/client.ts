// Typed HTTP client for consumers (SDK, portal), derived from the same types generated from the
// contract (FR-033). openapi-fetch weighs ~2 KB gzip: fit for a browser tag.
import createClient, { type ClientOptions } from "openapi-fetch";
import type { paths } from "./generated/api.js";

export type { components, operations, paths } from "./generated/api.js";

export type OpeClient = ReturnType<typeof createClient<paths>>;

/** Creates a typed client against the OPE contract. `baseUrl` is the backend origin. */
export function createOpeClient(options: ClientOptions & { baseUrl: string }): OpeClient {
  return createClient<paths>(options);
}
