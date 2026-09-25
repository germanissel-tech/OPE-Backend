---
paths:
  - "src/**"
  - "tests/**"
  - "eslint.config.mjs"
---

# Gates de calidad (ADR-016, verificado por `quality` y `test:mutation`)

- **Cada umbral vive donde se lo declara, con su motivo al lado**, y ahí se lo cambia: la forma del
  código y las reglas `ope/*` en `eslint.config.mjs`, la duplicación en
  `scripts/check-duplication.mjs`, el código muerto en el encabezado de
  `scripts/check-dead-code.mjs` (knip no admite comentarios) y el largo de un archivo de anillo en
  `scripts/shape-rules.mjs`. `tests/lint/lint.test.ts` falla si un umbral numérico aparece sin su
  motivo, así que la configuración es la fuente completa; copiar los números acá sólo los
  condenaría a quedar viejos.
- **Prohibiciones de forma, que ningún umbral expresa** (`scripts/shape-rules.mjs`, verificadas por
  `tests/architecture/shape.test.ts`): ningún `new` de un paquete npm fuera de `composition/`,
  `infrastructure/` y los gateways; ningún `import()` calculado; ninguna condición sobre
  `config.<campo>` en `composition/` (salvo `config.ts`); ningún carácter de control crudo en el
  fuente (un separador como U+001F se escribe como su escape, nunca como el carácter); la
  implementación de un puerto se construye sólo dentro del builder de un enlace
  (`port-implementations-only-in-bind`, ADR-033).
- Mutación: un cambio no entra si un mutante de sus propias líneas sobrevive. `StringLiteral`
  está excluido (prosa; los literales tipados ya son errores de compilación al mutarse). El
  runner lleva `patches/@stryker-mutator+vitest-runner+10.0.0.patch` hasta que stryker-js#6210
  se publique; `patch-package` lo aplica en `postinstall` y falla si deja de aplicar.
- Excepciones: en línea y con motivo, como las de lint (`Lint exceptions: N`); en mutación,
  `// Stryker disable next-line <mutador>: <motivo>`.
- **Los supervivientes que este repo produce una y otra vez**, con lo que mata a cada uno (feature
  027, donde aparecieron todos juntos al cerrar). Reconocerlos al escribir cuesta menos que triarlos
  después:
  - `...(x === undefined ? {} : { x })` sobre un tipo **interno**: los dos brazos son el mismo input
    y ninguna prueba los distingue. Se declara `x?: T | undefined` y se pasa el valor; la guarda
    queda **una sola vez**, en el borde donde la ausencia se observa. Restar una excepción es mejor
    que sumar una.
  - `a ?? ""` dentro de una clave de búsqueda: lo mata una prueba con dos entradas que difieren
    **sólo** en esa parte de la clave.
  - un comparador (`a - b`): lo mata un caso donde el orden de entrada **no** es el ordenado; con la
    entrada ya ordenada, invertir el comparador no cambia nada.
  - el `details` de un `DomainError`: se afirma `details`, no sólo `code`.
  - un piso redundante (`Math.max(0, n - k)` antes de un `slice`): ninguna prueba lo mata porque no
    hace nada —`slice(-k)` ya lo hace— y la respuesta es borrarlo.
- **Por historia, el gate acotado**: `npm run test:mutation -- --files <archivo>:<desde>-<hasta>`
  re-juzga sólo esas líneas mientras el código está fresco; la corrida completa del diff se guarda
  para el cierre. Sin rangos re-juzga el archivo entero con `--force`, que puede costar más que el
  diff completo.
- **Una corrida larga se escribe a un archivo, nunca a una tubería**: pasarla por `tail` descarta lo
  único que hay que leer y obliga a repetirla. Y no se edita `src/` mientras corre: el veredicto deja
  de ser del código que quedó.
- **Ante un mutante que sobrevive, el procedimiento es una skill**: `triaging-mutants`
  (`.claude/skills/triaging-mutants/SKILL.md`). Cuatro pasos en orden —describir el daño observable,
  clasificar el mutante antes de tocar nada, la prueba o la reestructuración según la clase,
  confirmar acotado— que se **ejecutan**, y por eso no se leen de paso desde acá. Por qué los
  mutantes estáticos se ignoran y por qué el juez es CI está en ADR-016.
- **Ritmo de las pruebas, en dos velocidades** (decisión del dueño, 2026-09-21): por historia,
  local y en minutos — `format:check`, `typecheck`, `quality`, `npm test` (proyecto `fast`) — y
  commit. Por hito — el cierre de la feature (antes de la PR) y cada push de la rama — CI corre
  todo: `contract:check`, `quality`, `test:scoped` (el proyecto `tools` sólo cuando el cambio
  toca una herramienta), `test:contract`, `release-check` y `test:mutation` en su job. La `--all` informativa y `test:load` son medidas de tendencia para hitos más gruesos
  (varias features, un piloto), no gates.
