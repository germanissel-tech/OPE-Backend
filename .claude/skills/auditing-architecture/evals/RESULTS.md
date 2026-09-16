# Resultados de evaluación (histórico, fechado)

Cada corrida sigue `SKILL.md` de punta a punta sobre `tests/audit/fixtures/<eval>/src`:
gates (`run-gates.mjs`), hallazgos propuestos, refutación, `verify-finding.mjs` y comparación
con `expected.json` (archivo, línea, `rule.source`, severidad, `verified: true`). Tres corridas
consecutivas por eval (SC-005 de la feature 005).

## 2026-09-16 — Opus 5, primera evaluación

| Eval                            | Corrida A | Corrida B | Corrida C | Gate que lo ve                        |
| ------------------------------- | --------- | --------- | --------- | ------------------------------------- |
| controller-instantiates-infra   | MATCH     | MATCH     | MATCH     | `shape/new-only-in-composition`       |
| identical-domain-functions      | MATCH     | MATCH     | MATCH     | `lint/sonarjs/no-identical-functions` |
| empty-catch                     | MATCH     | MATCH     | MATCH     | `lint/sonarjs/no-ignored-exceptions`  |

Notas:

- En las tres corridas, `arch/no-orphans` aparece sobre el archivo único de cada fixture; se
  refutó como artefacto del alcance (un árbol de un archivo no tiene importadores), no como
  defecto. Queda en el anexo de refutados, no en la lista principal.
- `empty-catch`: la fuente esperada pasó de `lint:sonarjs/no-ignored-exceptions` (medium) a
  `constitution#II. Fail-closed` (high) durante la corrida A: el gate ve el `catch` vacío, pero
  lo que la revisión agrega —y lo que la constitución prohíbe— es el `NO_OP` sin motivo. El
  README del eval lo explica.
- Los `rule.id` variaron entre corridas (son slugs libres); archivo, línea, fuente y severidad
  no variaron.

## 2026-09-16 — desafío: el `bootstrap.ts` que la skill no habría atrapado

El usuario revisó `src/composition/bootstrap.ts` y preguntó si era profesional. No lo era en
cuatro puntos (perfil hardcodeado con `if` sobre configuración, seam de pruebas vía `import()`
de una ruta del entorno, orden de cierre inferido de `Object.values`, overrides resueltos en el
root), y ninguna corrida previa de la skill los habría reportado: los criterios no hablaban del
composition root y `refutacion.md` ofrecía "es el composition root" como motivo de descarte.

Cambios: regla 4 de `shape` (`no-computed-dynamic-import`, determinista), criterio
"Composition root — elige, no adivina" con fuente ADR-013 / constitución I, atajo de
refutación cerrado, `shape:<regla>` como fuente válida, y dos evals nuevos que reproducen el
código viejo.

| Eval                | Corrida A | Corrida B | Corrida C | Gate que lo ve                    |
| ------------------- | --------- | --------- | --------- | --------------------------------- |
| hardcoded-profile   | MATCH     | MATCH     | MATCH     | ninguno (cognitivo)               |
| env-dynamic-import  | MATCH     | MATCH     | MATCH     | `shape/no-computed-dynamic-import` |

En las tres corridas `hardcoded-profile` produjo además los hallazgos del orden de cierre
(línea 22) y del override resuelto en el root (línea 18), ambos `ADR-013`/`high` y verificados;
el esperado es el del perfil y los otros dos son correctos (el README del eval lo dice).
