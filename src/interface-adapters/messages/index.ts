// Public API of the messages module (adapters): what the composition wires. Presenters stay internal.
export { memoryTextStore } from "./gateways/memory-text-store.js";
export { sqliteTextStore } from "./gateways/sqlite-text-store.js";
export { makePublishText } from "./controllers/publish-text.js";
export { makePublishMerchantText } from "./controllers/publish-merchant-text.js";
export { makeListTextVersions } from "./controllers/list-text-versions.js";
export { makeGetTextVersion } from "./controllers/get-text-version.js";
export { makeListMerchantTextVersions } from "./controllers/list-merchant-text-versions.js";
export { makeGetMerchantTextVersion } from "./controllers/get-merchant-text-version.js";
