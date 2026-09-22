# Eval: magic-signal-strings

Fixture: `tests/audit/fixtures/magic-signal-strings/src`.

**Defecto**: `"SIGINT"` y `"SIGTERM"` escritos dos veces cada uno; la segunda vez entran a
`shutdown(signal: string)`, donde un typo compila. La lista de señales que apagan el proceso no
tiene nombre. Es el `start.ts` posterior al primer refactor de la 005, condensado.

**Lo ve un gate**: sí — `lint/ope/no-magic-strings` (`scripts/lint/no-magic-strings.mjs`): un
literal repetido en un archivo donde alguna ocurrencia no está verificada por un tipo literal.
La primera ocurrencia (`process.once("SIGINT", …)`, tipo `NodeJS.Signals`) no se marca: ahí el
compilador es la constante.

**Qué agrega la revisión cognitiva**: la forma correcta no es `const SIGINT = "SIGINT"` sino la
**lista con nombre y tipo** (`SHUTDOWN_SIGNALS … satisfies readonly NodeJS.Signals[]`) y pasar la
señal por parámetro tipado, que elimina la repetición en vez de nombrarla.

**Esperado**: `expected.json` (fuente `lint:ope/no-magic-strings`, severidad `medium`, línea 13:
la primera ocurrencia sin tipar). Un segundo hallazgo en la línea 16 es correcto y opcional.
