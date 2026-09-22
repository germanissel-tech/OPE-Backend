# Eval universal: empty-catch

Fixture: `fixture/src/application/pricing/quote-price.ts`.

**Defecto**: un caso de uso traga el error de su puerto y devuelve `undefined`.

**Lo ve un gate**: sí — `sonarjs/no-ignored-exceptions` del lint (`requires.json`).

**Qué agrega la revisión cognitiva**: el resultado explícito con motivo en lugar del
`undefined`, y la prueba que lo exige.

**Esperado**: `expected.json` con la fuente del gate (`lint:sonarjs/no-ignored-exceptions`).
Un proyecto cuya constitución prohíba el silencio (un principio "fail-closed") eleva la fuente a
esa sección en su propia evaluación: eso es lo que la revisión cognitiva aporta y lo que la
universal no puede asumir.
