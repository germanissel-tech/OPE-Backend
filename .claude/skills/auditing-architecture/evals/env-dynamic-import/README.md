# Eval: env-dynamic-import

Fixture: `tests/audit/fixtures/env-dynamic-import/src`.

**Defecto**: el servidor carga un módulo cuya ruta viene del entorno (`import()` calculado): un
seam de pruebas que en producción es un punto de ejecución de código.

**Lo ve un gate**: sí — `shape/no-computed-dynamic-import` (regla 4).

**Qué agrega la revisión cognitiva**: que el seam no se "protege" con un guardia de modo sino
que se saca: la prueba que lo necesita es una entrada de proceso propia (`start(config, { handlers })`).

**Esperado**: `expected.json` (fuente `constitution#I`, severidad `high`).
