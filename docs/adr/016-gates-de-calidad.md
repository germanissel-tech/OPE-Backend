---
numero: 16
titulo: Gates de calidad — forma del código, duplicación, código muerto y mutación sobre el diff
estado: propuesta
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
   mutante puede sobrevivir. El repositorio completo se muta de forma programada e
   informativa. Quedan fuera tipos generados, composición y `main.ts`.
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
