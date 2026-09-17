// The contract declares an explicit `discriminator.mapping` (so openapi-typescript generates the
// wire value and not the schema name), but Ajv with `discriminator: true` rejects it at compile
// time ("mapping is not supported"). This is the only transformation applied to the contract at
// runtime: removing `mapping` from the in-memory document before handing it to openapi-backend.
// Ajv infers the same mapping from the `enum` of each branch (research R-05; ADR-014).

/** The one OpenAPI object this module touches: a `discriminator` with the `mapping` Ajv rejects. */
interface Discriminator {
  mapping?: unknown;
}

/** Every `discriminator` object of the document that carries a `mapping`, in document order. */
function* discriminatorsWithMapping(node: unknown): Generator<Discriminator> {
  if (typeof node !== "object" || node === null) return;
  // An array has no `discriminator` property: the same read covers both shapes.
  const discriminator = (node as { discriminator?: unknown }).discriminator;
  if (typeof discriminator === "object" && discriminator !== null && "mapping" in discriminator) {
    yield discriminator;
  }
  for (const value of Object.values(node)) yield* discriminatorsWithMapping(value);
}

/** Returns a copy of the document without any `discriminator.mapping`. Does not mutate the original. */
export function stripDiscriminatorMappings<T>(document: T): T {
  const copy = structuredClone(document);
  for (const discriminator of discriminatorsWithMapping(copy)) delete discriminator.mapping;
  return copy;
}

/** Is any `discriminator.mapping` left? For the test and to fail early if something changes. */
export function hasDiscriminatorMappings(node: unknown): boolean {
  return !discriminatorsWithMapping(node).next().done;
}
