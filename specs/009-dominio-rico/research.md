# Research — Feature 009: dominio rico e invariantes por construcción

**Fecha**: 2026-09-18 · **Estado**: completo. Decisión transversal → ADR-024.

## R-01 Clases con constructor privado y unión discriminada (verificado)

- **Decisión**: cada concepto con invariantes es una clase con `private constructor`, campos
  `readonly` asignados en el constructor (sin _parameter properties_, `erasableSyntaxOnly`),
  `static of(...)` → `Result<T, E>` y `static rehydrate(...)` → `T`. `Decision` es la unión
  `NoOpDecision | InterveneDecision` de dos clases con base abstracta `DecisionBase`
  (identidad, `belongsTo`) y `outcome` literal en cada subclase.
- **Verificado** (`node_modules/.cache/probe-009/probe.test.ts`, compilado con el `tsconfig`
  del repo y ejecutado con Vitest): (1) `switch (d.outcome)` estrecha a `NoOpDecision` /
  `InterveneDecision` (`d.reason` sólo existe en la primera); (2) `expect(instance).toEqual({…})`
  compara por campos propios e **ignora el prototipo** → las aserciones existentes sobre
  decisiones (`toEqual`, `toMatchObject`) siguen válidas; `toStrictEqual` sí distingue (no se
  usa en la suite); (3) `JSON.stringify` serializa sólo los campos → los ledgers en memoria y
  cualquier volcado no cambian.
- **Alternativa rechazada**: `Decision` como interfaz discriminada + funciones (`isIntervention(d)`):
  es lo que hay; la unión de clases da el mismo estrechamiento y además impide el estado
  `INTERVENE` sin intervención por construcción.

## R-02 Qué es clase y qué queda como tipo

| Concepto                                              | Forma                                                                                                         | Por qué                                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `EventBatch`                                          | clase; `of(events, now)` → `Result<EventBatch, IngestionError>`; `rehydrate` no aplica (no se persiste)       | invariantes de coherencia y tolerancia; expone `sessionId`, `visitorId`, `events`, `noOpReason()` (stub del plano de decisión, PROPUESTO → 011) |
| `Decision`                                            | `NoOpDecision \| InterveneDecision`; `NoOpDecision.of(...)`, `InterveneDecision.of(...)`, `rehydrate(record)` | estado ilegal hoy representable; el ledger la persiste                                                                                          |
| `Experiment`                                          | clase; `of(...)` → `Result<Experiment, ExperimentError>`; `rehydrate`; `assign(visitorId)`; `isActive()`      | rango de la tasa, semilla no vacía; comportamiento de asignación                                                                                |
| `Merchant`                                            | clase; `of(...)` → `Result<Merchant, MerchantError>`; `rehydrate`; `owns(key)`, `allowsOrigin(origin)`        | orígenes normalizados una vez; comportamiento                                                                                                   |
| `Origin`                                              | value object; `Origin.parse(text)` → `Origin \| undefined`; `equals`                                          | normalización en un solo lugar                                                                                                                  |
| `Exposure`, `Assignment`, ids, `Arm`, `ServiceHealth` | tipos                                                                                                         | sin reglas                                                                                                                                      |

- `ExperimentError` nuevo en `domain/experiment/errors.ts` (`invalid-treatment-share`,
  `invalid-seed`) y `MerchantError` gana `invalid-origin`. Son errores de **configuración**
  (nadie los recibe por HTTP): igual se declaran en `problem-types.yaml` para no romper la
  invariante "todo `code` está en el catálogo" (prueba de réplica de la 008); el catálogo
  admite entradas sin operación que las use (como los tipos de infraestructura `not-found`).
- `serviceHealth(...)` (module `system`) pasa a `ServiceHealth.of(...)`? No: `ServiceHealth`
  no tiene reglas; el caso de uso construye el valor directamente. La función desaparece.

## R-03 Asignación idéntica bit a bit

- `Experiment.assign(visitorId)` = `fnv1a32(merchantId ␟ experimentId ␟ seed ␟ visitorId) % 100
< treatmentShare * 100`. Con `treatmentShare = treatmentPercent / 100` y percent entero,
  `bucket < share * 100` es exacto en IEEE 754 para 0..100 (`n / 100 * 100` devuelve `n` para
  todo entero 0..100; verificado por bucle en la prueba de regresión). `fnv1a32` y la clave
  pasan a ser privados del módulo (`assignment.ts` sin exports públicos, o funciones internas
  de `experiment.ts`).
- **Prueba de regresión (FR-041)**: `tests/unit/domain/experiment/assignment-regression.test.ts`
  compara los brazos de 100 000 visitantes contra un **fingerprint precomputado antes del
  refactor** (hash FNV de la secuencia de brazos para tres repartos: 50, 20, 80) generado con
  el código actual y guardado en el test como constante. Cualquier cambio en la función
  cambia el fingerprint.

## R-04 Regla "sin funciones sueltas en el dominio"

- ESLint `ope/domain-no-loose-functions`, `files: ["**/domain/**/*.ts"]`, sin tipos (AST):
  reporta `export function` y `export const x = <arrow|function>`; opción `allow` con los
  archivos exceptuados: `shared-kernel/ids.ts` (`as*Id`), `shared-kernel/result.ts`
  (`ok`/`fail`), `shared-kernel/time.ts` (`seconds`/`minutes`/`hours`: primitivas del núcleo).
  Fixture `tests/lint/fixtures/as-src/domain/demo/loose.ts`.
- Alternativa rechazada: regla de forma textual en `shape-rules.mjs`: no distingue `export const
X = 1` de `export const f = () => …` sin parsear.

## R-05 Puertos asíncronos y política de dedup

- Todo puerto: `Promise<…>` en cada método (`MerchantDirectory.findByIngestKey`,
  `isRegisteredOrigin`, `ExperimentDirectory.activeFor`, `EventDedup.claim`, `*Ledger.find`/`record`).
  Los gateways en memoria devuelven `Promise.resolve(...)`; `cors.ts` (infraestructura) consulta
  `isRegisteredOrigin` de forma asíncrona (`@fastify/cors` admite `origin` como función con
  callback/promesa — verificar en implementación; si no, el CORS policy se precomputa en
  composición como hoy con un `Set`).
- `DEDUP_WINDOW` (`ttlMs`, `maxIds`) se declara en `application/ingestion/policies/dedup-window.ts`
  y se exporta por el índice; `memoryEventDedup(clock, window)` deja de tener default propio y
  la composición pasa la política.

## R-06 Validación en el dueño, fail-closed en configuración

- `composition/config.ts` sigue parseando el JSON (forma, tipos) y **delega las reglas de
  negocio** a `Experiment.of` / `Merchant.of`: un `fail` se convierte en
  `ConfigError(campo, error.message)` con el campo derivado del `code` (`invalid-treatment-share`
  → `experiments[i].treatmentPercent`, `invalid-origin` → `origins[j]`). Los gateways de
  configuración reciben entidades ya construidas (`Merchant[]`, `Experiment[]`), no registros:
  desaparecen `MerchantRecord`/`ExperimentRecord` de los gateways.
- Guarda `NaN` de `occurredAt`/`exposedAt`: en `toDomainEvent` del controller de ingesta y en
  el de exposición, `throw new Error` (error de programación: el contrato validó `date-time`).
