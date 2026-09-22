# Eval: mode-flag-across-layers

Fixture: `tests/audit/fixtures/mode-flag-across-layers/src`.

**Defecto**: el composition root lee `config.mode` para descartar los handlers cableados y le
pasa la bandera al servidor, que vuelve a decidir con `if (mode === "mock")`. Una decisión
tomada dos veces, en dos capas, sobre algo que no es la implementación de ningún puerto. Es el
`bootstrap.ts` + `build-server.ts` anteriores a ADR-018, condensados.

**Lo ve un gate**: a medias. `shape/no-config-branch-in-root` marca la línea 13 de
`bootstrap.ts` (la rama sobre `config.mode`). La bandera que baja a infraestructura y el
`if (mode === …)` en `build-server.ts` no los ve ningún gate: son criterio cognitivo.

**Qué agrega la revisión cognitiva**: que la corrección no es mover el `if`, sino eliminar el
modo: el servidor responde 501 sin handler, siempre; quien quiera otras respuestas cablea
otros handlers, y el root no arranca si el contrato declara una operación sin servir. En este
repo la conclusión fue retirar el mock (ADR-018).

**Esperado**: `expected.json` (archivo `build-server.ts`, línea 15, fuente `ADR-018`, severidad
`high`). Un hallazgo `shape:no-config-branch-in-root` sobre `bootstrap.ts:13` es correcto y
esperable, pero es el gate hablando: se cita, no se repite.
