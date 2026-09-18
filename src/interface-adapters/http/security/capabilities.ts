// Capabilities by consumer (ADR-020, ADR-025): replica of `consumers.<name>.capabilities` in
// contracts/api-map.yaml (the source); a test verifies they match. A credential grants every
// capability of its consumer; the server checks `x-required-capabilities` of the operation
// against them before validating the body.
export const CONSUMER_CAPABILITIES = {
  sdk: ["events:write", "config:read", "diagnostics:write", "orders:corroborate"],
  platform: ["orders:write", "returns:write", "catalog:write"],
} as const;

export type Consumer = keyof typeof CONSUMER_CAPABILITIES;
