---
paths:
  - "src/**"
  - "tests/**"
  - "eslint.config.mjs"
---

# Gates de calidad (ADR-016, verificado por `quality` y `test:mutation`)

- Forma del código en el lint (`eslint-plugin-sonarjs` + core): complejidad cognitiva ≤ 15,
  anidamiento ≤ 3, ≤ 4 parámetros, ≤ 60 líneas por función (apagada en `tests/`), sin funciones ni
  ramas idénticas, sin `catch` que ignore el error; números mágicos sólo con nombre en `src/` (0, 1,
  −1 e índices exceptuados); strings repetidos sin tipar sólo con nombre en `src/`
  (`ope/no-magic-strings`, regla propia con tipos en `scripts/lint/`); forma de casos de uso,
  dependencias y errores (`ope/use-case-shape`, `ope/dependencies-are-interfaces`,
  `ope/domain-error-shape`, `ope/no-throw-domain-error`, `ope/no-generic-catch-in-application`,
  ADR-023); dominio sin funciones sueltas (`ope/domain-no-loose-functions`, ADR-024). Cada umbral lleva su justificación en `eslint.config.mjs`; los bloques
  por alcance (`SHAPE_RULES`, `SRC_ONLY_RULES`, `APPLICATION_RULES`, `USE_CASE_RULES`,
  `DOMAIN_RULES`, `DOMAIN_ERROR_RULES`, `TEST_ONLY_RULES`) se exportan para las pruebas.
- Duplicación: ≥ 5 líneas / 50 tokens iguales en `src/` no entran. Código muerto: `knip.json`
  lista las entradas y las exclusiones; los motivos están en el encabezado de
  `scripts/check-dead-code.mjs` (knip no admite comentarios).
- Mutación: un cambio no entra si un mutante de sus propias líneas sobrevive. `StringLiteral`
  está excluido (prosa; los literales tipados ya son errores de compilación al mutarse). El
  runner lleva `patches/@stryker-mutator+vitest-runner+10.0.0.patch` hasta que stryker-js#6210
  se publique; `patch-package` lo aplica en `postinstall` y falla si deja de aplicar.
- Forma de los anillos (`scripts/shape-rules.mjs`, `tests/architecture/shape.test.ts`): ≤ 300
  líneas por archivo en `domain/` y `application/`; un controller por `operationId`; ningún `new`
  de un paquete npm fuera de `composition/`, `infrastructure/` y los gateways; ningún `import()`
  calculado; ninguna condición sobre `config.<campo>` en `composition/` (salvo `config.ts`);
  ningún carácter de control crudo en el fuente (un separador como U+001F se escribe como su
  escape, nunca como el carácter); un módulo de composición exporta sólo sus componentes y a sí
  mismo (`composition-module-shape`) y construye la implementación de un puerto sólo dentro del
  builder de un enlace (`port-implementations-only-in-bind`, ADR-033).
- Excepciones: en línea y con motivo, como las de lint (`Lint exceptions: N`); en mutación,
  `// Stryker disable next-line <mutador>: <motivo>`.
- **Cómo se trabaja el gate de mutación** (la corrida completa cuesta minutos; no se repite por
  cada arreglo): el archivo incremental `reports/mutation/stryker-incremental.json` **no se
  borra** — la segunda corrida re-testea sólo lo que cambió; `--all` escribe en otro archivo y
  nunca alimenta al gate. Ante un superviviente, en este orden: (1) describir el daño observable
  del mutante; (2) clasificarlo — real, equivalente, sólo diagnóstico, específico del runner —
  antes de tocar nada; (3) si es real, la prueba que pasa con el original y falla con el mutante;
  si es equivalente, reestructurar el código para que el mutante no exista, no una excepción;
  (4) confirmar con `npm run test:mutation -- --files <archivo>[:l1-l2]` (un minuto), no con la
  corrida completa. La corrida completa del gate la hace **CI en cada push** (job propio): es el
  juez; localmente no se espera. Un mutante **estático** (código que corre fuera de un `it`: carga
  de módulo, `beforeAll` → `bootstrap`, semilla, lectores de configuración) se ignora
  (`ignoreStatic`, ADR-016 enmendado 2026-09-21): el runner de Vitest no lo activa de forma fiable
  y da falsos sobrevivientes; si además lo cubre un test, sigue corriendo contra ese test. Nunca
  se cambia producción sólo para satisfacer la herramienta.
- **Ritmo de las pruebas, en dos velocidades** (decisión del dueño, 2026-09-21): por historia,
  local y en minutos — `format:check`, `typecheck`, `quality`, `npm test` (proyecto `fast`) — y
  commit. Por hito — el cierre de la feature (antes de la PR) y cada push de la rama — CI corre
  todo: `contract:check`, `quality`, `test:scoped` (el proyecto `tools` sólo cuando el cambio
  toca una herramienta), `test:contract`, `release-check` y `test:mutation` en su job. Ante un
  sobreviviente en CI, `test:mutation -- --files <archivo>` local (un minuto), nunca la corrida
  completa. La `--all` informativa y `test:load` son medidas de tendencia para hitos más gruesos
  (varias features, un piloto), no gates.
