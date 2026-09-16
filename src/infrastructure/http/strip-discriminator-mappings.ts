// The contract declares an explicit `discriminator.mapping` (so openapi-typescript generates the
// wire value and not the schema name), but Ajv with `discriminator: true` rejects it at compile
// time ("mapping is not supported"). This is the only transformation applied to the contract at
// runtime: removing `mapping` from the in-memory document before handing it to openapi-backend.
// Ajv infers the same mapping from the `enum` of each branch (research R-05; ADR-014).

/** Returns a copy of the document without any `discriminator.mapping`. Does not mutate the original. */
export function stripDiscriminatorMappings<T>(document: T): T {
  return strip(structuredClone(document)) as T;
}

function strip(node: unknown): unknown {
  if (Array.isArray(node)) {
    for (const item of node) strip(item);
    return node;
  }
  if (typeof node !== "object" || node === null) return node;
  const record = node as Record<string, unknown>;
  const discriminator = record["discriminator"];
  if (typeof discriminator === "object" && discriminator !== null && "mapping" in discriminator) {
    delete (discriminator as Record<string, unknown>)["mapping"];
  }
  for (const value of Object.values(record)) strip(value);
  return node;
}

/** Is any `discriminator.mapping` left? For the test and to fail early if something changes. */
export function hasDiscriminatorMappings(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasDiscriminatorMappings);
  if (typeof node !== "object" || node === null) return false;
  const record = node as Record<string, unknown>;
  const discriminator = record["discriminator"];
  if (typeof discriminator === "object" && discriminator !== null && "mapping" in discriminator) return true;
  return Object.values(record).some(hasDiscriminatorMappings);
}
