# Eval: identical-domain-functions

Fixture: `tests/audit/fixtures/identical-domain-functions/src`.

**Defecto**: dos funciones de dominio con el mismo cuerpo (una regla, dos nombres).

**Lo ve un gate**: sí — `lint:sonarjs/no-identical-functions`.

**Qué agrega la revisión cognitiva**: decidir si es una regla (unificar y nombrarla por lo que
es: `toPercent`) o dos que hoy coinciden y mañana divergen (documentar por qué); proponer la
prueba de bordes que ninguna de las dos tiene.

**Esperado**: `expected.json` (fuente `lint:`, severidad `medium`).
