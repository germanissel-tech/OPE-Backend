# Eval: empty-catch

Fixture: `tests/audit/fixtures/empty-catch/src`.

**Defecto**: un caso de uso traga el error de su puerto y devuelve `undefined`.

**Lo ve un gate**: sí — `lint:sonarjs/no-ignored-exceptions`.

**Qué agrega la revisión cognitiva**: el `undefined` es un `NO_OP` sin motivo (constitución II):
la propuesta es un resultado `{ ok: false, reason }` con el motivo en el catálogo de
`contracts/no-op-reasons.yaml`, y la prueba que lo exige.

**Esperado**: `expected.json` (fuente `constitution#II`, severidad `high`: el gate ve el `catch`
vacío, la revisión ve el `NO_OP` sin motivo, que es lo que la constitución prohíbe).
