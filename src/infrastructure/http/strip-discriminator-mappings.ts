// El contrato declara `discriminator.mapping` explícito (así openapi-typescript genera el valor de
// cable y no el nombre del esquema), pero Ajv con `discriminator: true` lo rechaza al compilar
// ("mapping is not supported"). Esta es la única transformación que se le hace al contrato en
// runtime: quitar `mapping` del documento en memoria antes de dárselo a openapi-backend. Ajv
// infiere el mismo mapeo desde el `enum` de cada rama (research R-05; ADR-014).

/** Devuelve una copia del documento sin ningún `discriminator.mapping`. No muta el original. */
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

/** ¿Queda algún `discriminator.mapping`? Para la prueba y para fallar temprano si algo cambia. */
export function hasDiscriminatorMappings(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasDiscriminatorMappings);
  if (typeof node !== "object" || node === null) return false;
  const record = node as Record<string, unknown>;
  const discriminator = record["discriminator"];
  if (typeof discriminator === "object" && discriminator !== null && "mapping" in discriminator) return true;
  return Object.values(record).some(hasDiscriminatorMappings);
}
