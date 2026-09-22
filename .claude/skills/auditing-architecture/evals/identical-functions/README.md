# Eval universal: identical-functions

Fixture: `fixture/src/domain/pricing/percent.ts` (la ruta del esperado es relativa a la raíz del
proyecto anfitrión con el plugin en `plugins/`; un anfitrión que instala el plugin en otro
lugar reescribe `file` al correrla).

**Defecto**: dos funciones idénticas con nombres distintos en un módulo de dominio.

**Lo ve un gate**: sí — la regla `sonarjs/no-identical-functions` del lint. Por eso es
universal: la corre cualquier proyecto cuyo perfil liste esa regla (`requires.json`).

**Qué agrega la revisión cognitiva**: la propuesta con nombre (`toPercent`) y la prueba que
fija el redondeo y el recorte.

**Esperado**: `expected.json` (fuente `lint:sonarjs/no-identical-functions`, severidad la que
el perfil impone a `lint:`; `medium` en la convención por defecto).
