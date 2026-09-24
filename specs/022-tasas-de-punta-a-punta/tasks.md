---
description: "Task list for feature 022 — El backend habla en tasas, adentro y afuera"
---

# Tasks: El backend habla en tasas, adentro y afuera

**Input**: Design documents from `/specs/022-tasas-de-punta-a-punta/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/rates.md](./contracts/rates.md)

**Tests**: incluidos y obligatorios. Acá las pruebas existentes cambian de unidad; la regla es que
cambie **la unidad y nada más**, y que ninguna aserción se ajuste para que pase.

**Organización**: por historia, pero el orden real lo manda el contrato: **nada compila hasta que
los tipos estén regenerados**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencias entre sí)
- **[Story]**: US1 … US4

---

## Phase 1: Setup

- [x] T001 Confirmar la base: `git log --oneline main..HEAD` incluye las tres ramas encadenadas
      (020, 021, 022). Si alguna se mergeó, rebasear antes de tocar nada.
- [x] T002 **Confirmar que la ventana sigue abierta**: `grep -n "x-stability" contracts/openapi.yaml`
      tiene que decir `building`. Si ya no está, **parar**: sin la marca este cambio exige versión
      mayor y prefijo nuevo, y eso es otra feature.

---

## Phase 2: El contrato (Blocking Prerequisites)

**Purpose**: los ocho campos cambian de unidad y de nombre. **Bloquea todo lo demás**: sin los tipos
regenerados no compila nada.

- [x] T003 [US1] `contracts/components/schemas/Experiment.yaml` — `treatmentPercent` →
      `treatmentShare` (`number`, 0..1) y `cuts` a `number` con `exclusiveMinimum: 0`. La
      descripción del reparto declara **a qué granularidad resuelve el sistema** (FR-008).
- [x] T004 [P] [US1] `contracts/components/schemas/ExperimentCreate.yaml` — los mismos dos campos.
- [x] T005 [P] [US1] `contracts/components/schemas/CommercialPolicy.yaml` y
      `CommercialPolicyDeclared.yaml` — `maxIncentivePercent` → `maxIncentiveShare`,
      `incentiveLadderPercent` → `incentiveLadderShare`, `marginPercent` → `marginShare`. Se cae la
      frase "Percentages at the edge; the domain works with rates": ya no hay borde distinto.
- [x] T006 [P] [US1] `contracts/components/schemas/EffectiveConfiguration.yaml`,
      `TreatmentDefaults.yaml` y `MerchantConfigurationDeclared.yaml` — `holdoutPercent` →
      `holdoutShare`.
- [x] T007 [US1] `contracts/components/schemas/Incentive.yaml` — `value` a `number` con
      `exclusiveMinimum: 0` y `maximum: 1`. **La trampa**: hoy dice `minimum: 1` y eso significa
      "1 %"; escribir `minimum: 1` sería cometer en el contrato el error que la feature elimina.
      `kind` **no cambia**; sí su descripción, para que `kind: percent` con `value: 0.15` no se lea
      como "0,15 %".
- [x] T008 [US1] Los **ejemplos** de las operaciones afectadas, que hoy muestran enteros.
- [x] T009 [US1] `contracts/openapi.yaml` — `info.version` de `1.4.0` a `1.5.0`. El prefijo `/v1/`
      **no se toca** (ADR-003).
- [x] T010 [US1] `npm run contract:check` y revisar el diff **campo por campo**: tiene que reportar
      incompatibles —es lo esperado— y **sólo** los ocho. Cualquier otro es alcance escapado.
- [x] T011 [US1] `npm run contract:types` y confirmar que `generated/` y los esquemas de
      configuración quedan al día. El cliente tipado se deriva de ahí: **no se toca a mano**.

**Checkpoint**: el contrato habla en tasas. A partir de acá el repositorio no compila, y eso es el
mapa de todo lo que falta.

---

## Phase 3: User Story 2 - No queda ninguna conversión (Priority: P1)

**Goal**: borrar las cuatro constantes, las tres lecturas y todas las conversiones.

**Independent Test**: buscar el factor en el repositorio y no encontrarlo salvo la granularidad del
reparto, con su nombre nuevo.

- [x] T012 [US2] `src/domain/configuration/policy-inputs.ts` — se van `isPercent`, `PERCENT`,
      `PERCENT_PROBLEM` y las tres divisiones. **También se va `FIELD_BY_SHARE`**: existía sólo para
      traducir el nombre de una tasa al de su campo de porcentaje, y ahora se llaman igual.
- [x] T013 [US2] `src/domain/configuration/treatment-values.ts` — se va la copia en línea del
      juicio (el mismo mensaje literal que el de arriba) y la división del holdout.
- [x] T014 [US2] `src/domain/commercial/commercial-policy.ts` — se va `PERCENT_PER_UNIT` y la
      conversión de salida del incentivo.
- [x] T015 [US2] `src/application/configuration/input/` — los lectores dejan de nombrar campos de
      porcentaje; los nombres son los del contrato, que ahora son los del dominio.
- [x] T016 [US2] `src/composition/experiments-config.ts` — se va su `PERCENT` y la división; el
      juicio del reparto queda en la fábrica de la entidad.
- [x] T017 [US2] `src/interface-adapters/experiment/controllers/create-experiment.ts` y
      `presenters.ts` — dejan de convertir: lo que entra y lo que sale ya es una tasa.
- [x] T018 [US2] Verificar: `grep -rn "/ 100\|\* 100\|PERCENT\|isPercent" src/ --include=*.ts` sólo
      encuentra la granularidad del reparto, y con su nombre nuevo.

---

## Phase 4: La granularidad del reparto (Priority: P1) ⚠️ el paso delicado

**Goal**: separar lo que era conversión de lo que es resolución del reparto, sin mover el
algoritmo.

**Depende de**: fase 2. Independiente de la fase 3.

- [x] T019 [US2] `src/domain/experiment/experiment.ts` — renombrar `PERCENT_BUCKETS` a un nombre
      que diga lo que es (la resolución del reparto), con su motivo escrito al lado: **vale cien
      por coincidencia y no es un factor de conversión**.
- [x] T020 [US2] Reescribir en tasas la comparación del reparto contra el holdout, que hoy pasa por
      enteros (`bucketsOf`). **Tiene que dar exactamente el mismo veredicto**, incluidos los bordes:
      reparto igual al holdout disponible, y reparto un centésimo por encima.
- [x] T021 [US2] Revisar `isCut`, que compara contra esa misma constante: los cortes son tasas y su
      regla propia —estrictamente crecientes por encima de cero— se queda en `offendingCut`.
- [x] T022 [US2] **Correr acá, no al final**:
      `npx vitest run --project fast tests/unit/domain/experiment`. La prueba de regresión de la
      feature 007 tiene que dar **los mismos brazos para los mismos visitantes**. Si cambia, se
      para y se revisa; **no se ajusta la prueba**.

**Checkpoint**: el reparto asigna igual que antes, con una unidad menos en el sistema.

---

## Phase 5: Los datos versionados (Priority: P1)

**Goal**: que lo que el repositorio arranca no quede en la unidad vieja.

**⚠️ El paso que más fácil se olvida, y el que el juez de tasas no cubre del todo**: atrapa lo que
supera 1, pero **no atrapa el 1**.

- [x] T023 [P] [US1] `config/treatment-defaults.json` — `holdoutPercent: 5` → `holdoutShare: 0.05`,
      `maxIncentivePercent: 10` → `maxIncentiveShare: 0.1`, `incentiveLadderPercent: [5, 10]` →
      `incentiveLadderShare: [0.05, 0.1]`.
- [x] T024 [P] [US1] `config/dev-merchants.json` — `treatmentPercent: 100` → `treatmentShare: 1`,
      `marginPercent: 40` → `marginShare: 0.4`, `holdoutPercent: 0` → `holdoutShare: 0`.
      **Mirar dos veces el 100 → 1**: es el valor donde un error de migración es indistinguible de
      un acierto.
- [x] T025 [US1] Verificar valor por valor: `grep -rn "Percent" config/` da cero, y cada número es
      el centésimo del que era.
- [x] T026 [US1] `tests/helpers/test-app.ts` y los fixtures de los 16 archivos de prueba que
      declaran porcentajes. **No tocar** `tests/audit/fixtures/`: son fixtures de la skill de
      auditoría y su contenido es deliberado.

---

## Phase 6: Las pruebas (Priority: P1)

**Goal**: que la suite pase con las aserciones cambiadas **sólo** de unidad.

- [x] T027 [US1] Recorrer los 16 archivos de prueba que nombran un porcentaje y cambiar la unidad
      del valor y el nombre del campo. **La regla**: si una aserción necesita cambiar algo más que
      eso, hay un cambio de comportamiento que no estaba previsto — parar y revisar.
- [x] T028 [US1] Agregar el caso que da sentido a todo: un reparto declarado como `0.01` reparte el
      uno por ciento, y **no** el cien por ciento.
- [x] T029 [US1] `npm test` y `npm run test:tools` en verde.
- [x] T030 [US1] `npm run test:contract` — Schemathesis contra los esquemas nuevos.

---

## Phase 7: User Story 3 - El vocabulario de estados (Priority: P2)

**Independiente de todo lo anterior.**

- [x] T031 [US3] `src/domain/experiment/experiment.ts` — declarar la lista de estados y derivar el
      tipo de ella, como el kernel hace con las barreras, los anclajes y los motivos de `NO_OP`.
- [x] T032 [US3] `src/composition/experiments-config.ts` — importar la lista en vez de volver a
      escribirla; el predicado local se va con ella.
- [x] T033 [US3] Verificar que el mensaje que rechaza un estado desconocido lista los estados que
      existen **en ese momento**, derivados de la lista.

---

## Phase 8: User Story 4 - La forma del identificador (Priority: P3)

**Independiente.**

- [x] T034 [US4] Escribir en `src/composition/experiments-config.ts`, junto al patrón, **por qué**
      la semilla admite más que lo que el acuñador produce. Si al escribirlo no aparece un motivo,
      unificar con la forma del acuñador y borrar el patrón.
- [x] T035 [US4] Si el motivo existe, dejar en `asExperimentId` una referencia a dónde vive la
      regla, para que quien lo lea no crea que la identidad no tiene ninguna.

---

## Phase 9: Cierre y documentación

- [x] T036 Decidir y escribir la decisión: ADR nuevo o enmienda de ADR-024 (convención de tasas).
      Tiene que quedar registrado el recorrido —value object, una sola representación adentro, y
      finalmente una sola unidad— y por qué las dos primeras se descartaron.
- [x] T037 [P] `CLAUDE.md` — la convención "porcentajes 0–100 sólo en el borde; adentro, tasas 0–1"
      **deja de existir** porque no hay porcentajes. La reemplaza una línea que diga que el sistema
      habla en tasas y no convierte formatos.
- [x] T038 [P] `contracts/README.md` si la superficie descrita cambia.
- [x] T039 Correr el quickstart entero y dejar su tabla de estado fechada.
- [x] T040 Cadena completa como CI: `format:check`, `quality`, `typecheck`, `test`, `test:tools`,
      `contract:check`, `test:contract`, `release-check` (**avisa por la marca de construcción: es
      lo esperado**).
- [X] T041 `npm run test:mutation` en verde sobre las líneas cambiadas.

---

## Dependencies & Execution Order

### Entre fases

- **Setup (F1)**: T002 es una **condición de arranque**, no un trámite: sin la marca de
  construcción la feature se replantea.
- **Contrato (F2)**: **bloquea todo**. Hasta que los tipos se regeneren nada compila.
- **F3 (las conversiones)** y **F4 (la granularidad)**: independientes entre sí, las dos después de F2.
- **F5 (los datos)** y **F6 (las pruebas)**: después de F3 y F4.
- **F7 (estados)** y **F8 (identificador)**: independientes de todo; pueden ir en cualquier momento.
- **F9**: al final. T036 necesita el diseño ya implementado.

### Paralelismo real

- T004, T005, T006: archivos de esquema distintos.
- T023 y T024: dos archivos de configuración.
- T037 y T038: dos documentos.
- F7 y F8 completas, contra el resto.

---

## Implementation Strategy

No hay entrega parcial posible: **el contrato es el corte**. Una vez cambiado, el repositorio no
compila hasta que F3, F4, F5 y F6 estén. Por eso las cuatro son P1 y van juntas.

F7 y F8 sí son entregables aparte, antes o después.

### Commits

Uno por fase, en español. El del contrato y el de los datos van separados a propósito: son los dos
lugares donde un error se ve distinto, y mezclarlos hace ilegible el diff.

---

## Notes

- **El juez de "no cambió nada" es la prueba de regresión de la asignación** (T022). Es el único
  lugar donde esta feature puede cambiar comportamiento sin que nadie lo note.
- **`contract:diff` va a reportar cambios incompatibles y eso es lo esperado.** Lo que se revisa es
  _cuáles_: ocho campos, ni uno más.
- **El 1 es el valor peligroso** en los datos migrados: `holdoutShare: 1` es un holdout del cien por
  ciento y pasa toda la validación. Revisar valor por valor, no con una regla.
- No tocar `tests/audit/fixtures/`: son entradas deliberadas de la skill de auditoría.
