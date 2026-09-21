---
numero: 16
titulo: Gates de calidad — forma del código, duplicación, código muerto y mutación sobre el diff
estado: aceptada
fecha: 2026-09-16
fuente: specs/005-auditoria-calidad/research.md
---

# ADR-016 — Gates de calidad

## Contexto

El tipado estricto (ADR-011, ADR-012) y las reglas de dependencia entre anillos (ADR-006,
ADR-013) verifican qué tipos circulan y qué puede depender de qué. No verifican la forma del
código (funciones largas, anidadas, con muchas ramas), el conocimiento duplicado (funciones
iguales, bloques copiados, exports sin uso) ni si las pruebas protegen algo. Son las tres
patologías del código generado por agentes: hermoso línea por línea, acumulativo, y con
pruebas que confirman lo que el código ya hace. Un check que se puede saltar no es un check.

## Decisión

1. **Forma del código** (`eslint-plugin-sonarjs` + reglas core de ESLint, en `lint`):
   complejidad cognitiva ≤ 15, anidamiento ≤ 3, ≤ 4 parámetros, ≤ 60 líneas por función
   (esta última apagada en `tests/`: los callbacks de `describe` agrupan casos); funciones
   idénticas, ramas idénticas, condiciones repetidas, `if` colapsables, booleanos redundantes
   y `catch` que ignoran el error: error; números mágicos (salvo 0, 1, −1, índices) en `src/`:
   error. Cada umbral lleva su justificación en la configuración.
2. **Duplicación estructural** (jscpd, `check:duplication`): ≥ 5 líneas / 50 tokens iguales
   en `src/` bloquea; en `tests/` y `scripts/` se informa.
3. **Código muerto** (knip, `check:dead-code`): archivos, exports, dependencias sin uso y
   dependencias sin declarar bloquean; tipos exportados sin uso se informan (son el contrato
   público de un módulo y no tienen costo en runtime). Las exclusiones y las dependencias
   usadas por CLI llevan motivo.
4. **Mutación sobre el diff** (Stryker, `test:mutation`): en cada cambio se mutan sólo las
   líneas de `src/` que el cambio introduce o modifica respecto de `origin/main`; ningún
   mutante puede sobrevivir (el veredicto se lee del reporte JSON, no del exit code de
   Stryker). El repositorio completo se muta de forma programada e informativa. Quedan fuera
   tipos generados, composición, `main.ts` y los `index.ts`. El mutador `StringLiteral` está
   excluido: los strings de prosa (`detail` de Problem Details, mensajes de log) no son
   comportamiento, y todo literal tipado (slugs, motivos, estados) ya es un error de
   compilación al mutarse bajo el checker de TypeScript. Un mutante equivalente o inalcanzable
   se marca en línea con `// Stryker disable next-line <mutador>: <motivo>`.
5. **Runner de Stryker parcheado para Vitest 5**: `@stryker-mutator/vitest-runner` 10.0
   construye el nombre de las pruebas con `' '` y Vitest 5 las filtra con `' > '`
   (stryker-js#6210), lo que reporta todo mutante como sobreviviente. Se aplica localmente el
   fix de stryker-js#6214 (`patches/`, `patch-package` en `postinstall`). **Condición de
   retiro**: cuando el runner publique el fix, subir la versión y borrar el parche;
   `patch-package` falla la instalación si el parche ya no aplica. No se degrada Vitest.
6. **Un mutante sobreviviente sin pruebas ejecutadas no es una prueba débil sino un runner
   roto**: `mutation-diff.mjs` falla con mensaje propio en ese caso.
7. **Forma de los anillos** (`tests/architecture/shape.test.ts`): ≤ 300 líneas por archivo en
   `domain/` y `application/`; un controller por `operationId`; instanciación de gateways,
   adaptadores y servidor sólo en `composition/` (constitución I).
8. **Un comando**: `npm run quality` encadena `lint`, `arch`, `check:duplication`,
   `check:dead-code` y `check:language`, falla en el primero rojo y lo nombra. Corre en CI.
9. Toda regla tiene un fixture que la viola y una prueba que confirma la falla (ADR-009).

## Consecuencias

- Una función larga, un bloque copiado o un export huérfano rompen el build; la excepción va
  en línea con motivo y se cuenta.
- Un cambio con pruebas que no matan sus propios mutantes no entra; el costo es proporcional
  al tamaño del cambio, no del repositorio.
- Hay un parche local en `patches/` con fecha de vencimiento implícita (la publicación del fix
  upstream). Subir `@stryker-mutator/vitest-runner` obliga a revisarlo.

## Enmienda 2026-09-21 — mutantes estáticos y ritmo en dos velocidades

Un mutante en código que se ejecuta fuera de un `it` (carga de módulo, `beforeAll` →
`bootstrap`, semilla, lectores de configuración) es **estático** para Stryker: no se atribuye a
ningún test, corre la suite entera y necesita reiniciar el proceso de pruebas. Con
`@stryker-mutator/vitest-runner` 10.0.0 esa activación no es fiable: el mismo mutante sale muerto
en una corrida y vivo en otra, y aplicado a mano lo matan las pruebas. Se comprobó en la feature
017 (US2: 733 de 1407 mutantes estáticos, una corrida de horas y ~200 falsos sobrevivientes).

Decisión (dueño, 2026-09-21):

- `ignoreStatic: true` en `stryker.config.json`. Un mutante estático que además cubre un test
  sigue corriendo contra ese test (híbrido); uno sin cobertura por test queda `Ignored` con su
  motivo, que `mutation-diff.mjs` no cuenta como excepción sin declarar.
- El gate se juzga en **CI, en cada push** (job propio). El ritmo local por historia es la suite
  rápida (`format:check`, `typecheck`, `quality`, `npm test`); la corrida completa de mutación no
  se repite localmente. Ante un sobreviviente en CI, `--files <archivo>` local.
- Deuda anotada para la feature de calidad: investigar la activación de estáticos en el runner
  (o reducir lo que los tests de integración ejecutan en `beforeAll`, para que el código de
  arranque vuelva a medirse).

La regla de fondo no cambia: un cambio no entra a `main` con un mutante real vivo en sus líneas.
