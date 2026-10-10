---
description: "Task list for feature 043 — el testigo de concurrencia"
---

# Tasks: El testigo de concurrencia

**Input**: `specs/043-el-testigo-de-concurrencia/` (spec.md, plan.md, research.md, data-model.md,
contracts/testigo.md, quickstart.md)

**Prerequisites**: plan.md con el Constitution Check pasado (v1.5.1, sin enmiendas); research.md con los
nueve hallazgos; las dos decisiones del dueño del 2026-10-10 (qué protege, y que sea obligatorio).

**Tests**: sí, y preceden a la implementación: la revisión antes de la entidad, la lectura de `If-Match`
antes del borde, el `428` antes de `validationFail`, las de integración de cada escritura antes de su caso de
uso.

**Organization**: por **tramo** del plan. El orden de `contrato.md` manda, con una salvedad que el plan
explica: con `If-Match` requerido, el contrato y el servidor entran en el **mismo** commit. Cada tarea lleva
la historia que sirve: US1 las publicaciones, US2 la identidad, US3 el reintento.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1 · US2 · US3
- Cada tarea nombra su archivo

---

## Phase 1: El dominio (tramo 2 del plan, primero porque se commitea solo)

**Purpose**: la revisión y el testigo del merchant, y el error, sin que nada los use todavía.

- [x] T001 [P] [US2] `tests/unit/domain/merchant/merchant.test.ts`, **antes del código**:
  - `Merchant.of` tiene revisión `1` y testigo `"<merchantId>:1"`;
  - `rotated`, `switched` (también al mismo estado), `deactivated` y `withProfile` suman uno cada uno;
  - un registro sin `revision` rehidrata en `0`;
  - el testigo de dos merchants con la misma revisión difiere.
- [x] T002 [US2] `src/domain/merchant/merchant.ts`:
  - `revision` en `MerchantRecord` (opcional al leer: `revision?: number | undefined`, `0` al rehidratar);
  - `revision` y `witness()` en la entidad;
  - un método privado que arma el siguiente con la revisión más uno, y que usan los cuatro métodos;
  - el archivo sigue debajo de las 300 líneas de los anillos.
- [x] T003 [P] [US1] `src/domain/shared-kernel/errors.ts`: `StaleVersion` (`stale-version`, «The resource
      changed since it was read.», sin `details`), en la unión del kernel
- [x] T004 [P] [US2] `tests/durability/merchant-store.test.ts`: la revisión después de dos escrituras
      sobrevive un reinicio; un documento sin el campo lee `0`
- [x] T005 `npm test`, `npm run test:durability`, `npm run quality`. Commit:
      `feat(043): el merchant tiene revisión, y su testigo cambia en toda escritura`

**Checkpoint**: la revisión existe y se guarda; ninguna operación la mira todavía.

> **Hecho el 2026-10-10.** Desvíos: (1) **Un cambio que no cambia nada no sube la revisión**: desactivar uno
> desactivado y poner el interruptor donde ya está devuelven el mismo merchant, porque el testigo describe el
> recurso y el recurso no cambió (`deactivated()` ya se declaraba idempotente). (2) **T003 pasa a la fase 2**:
> `StaleVersion` exige su entrada en el catálogo del contrato, y una prueba de réplica falla sin ella.

---

## Phase 2: El contrato (tramo 1 del plan; sin commit propio)

**Purpose**: que el contrato diga el testigo antes de que el servidor lo exija.

- [x] T006 [US1] `contracts/problem-types.yaml`: `stale-version` (`412`) y `witness-required` (`428`), según
      `contracts/testigo.md` §1
- [x] T007 [US1] `contracts/components/parameters/If-Match.yaml` (NUEVO, §2) con `x-when-missing`;
      `contracts/components/headers/ETag.yaml` (NUEVO); `contracts/components/responses/StaleVersion.yaml` y
      `WitnessRequired.yaml` (NUEVOS, con ejemplo)
- [x] T008 [US1] [US2] `contracts/paths/`: las cuatro operaciones protegidas ganan el parámetro, `412`, `428`,
      `x-invariants` `stale-version` y la descripción de reemplazo (§3); `ETag` en las respuestas de §4
- [x] T009 [P] `contracts/README.md`: la fila de `x-when-missing` en la tabla de extensiones; si el lint de
      Spectral la verifica, su regla y su fixture en `tests/contract-rules/fixtures/` (un parámetro no
      requerido con la extensión, un slug inexistente)
- [x] T010 `contracts/openapi.yaml` `info.version: 1.15.0`; `npm run contract:bundle`, `contract:types`,
      `contract:check`: el reporte de `contract:diff` dice incompatible y aceptado por `building`; se copia al
      quickstart

**Checkpoint**: el contrato pasa `contract:check`; `npm test` **falla** en toda prueba que publica sin
`If-Match`, que es lo esperado hasta el tramo siguiente.

---

## Phase 3: El borde y los casos de uso (tramo 3 del plan; un commit con la fase 2)

**Purpose**: US1, US2 y US3 de punta a punta.

- [x] T011 [P] [US1] `tests/unit/interface-adapters/http/`: la lectura de `If-Match` —un testigo fuerte y
      único devuelve su valor; `*`, dos testigos, `W/"…"` y sin comillas devuelven algo que no coincide—, y
      `etagOf` pone las comillas
- [x] T012 [US1] `src/interface-adapters/http/boundary.ts`: `witnessOf(header)` y `etagOf(witness)`
- [x] T013 [P] [US1] `tests/integration/server.test.ts` (o el que prueba `validationFail`), **antes del
      código**:
  - una publicación sin `If-Match` responde `428 witness-required` sin `ETag`;
  - sin `If-Match` y con el cuerpo mal formado, `400`, porque no es el único error.
- [x] T014 [US1] `src/infrastructure/http/dispatch.ts`: `validationFail` responde el problema que declara
      `x-when-missing` cuando el único error es la ausencia de ese parámetro; lee la extensión del contrato
      cargado, sin lista propia
- [x] T015 [P] [US1] [US3] `tests/integration/levels.test.ts` y `platform-level.test.ts`, **antes del
      código**:
  - leer da el `ETag`; publicar con él da `201` y el nuevo;
  - con el viejo, `412 stale-version` y nada escrito (`[invariant:stale-version]`);
  - un cuerpo idéntico a lo que rige con el testigo viejo da `200`;
  - el testigo de plataforma no vale para defaults;
  - las publicaciones que ya existen en estas pruebas ganan su `If-Match`.
- [x] T016 [US1] `src/application/configuration/use-cases/publish-level.use-case.ts`: `witness` en el
      request, comparado contra el nombre de la versión que rige, en el orden de R-05; los controllers de las
      dos publicaciones leen `If-Match` y devuelven `ETag`; los de las dos lecturas, `ETag`
- [x] T017 [P] [US1] [US3] `tests/integration/admin-configuration.test.ts`, **antes del código**:
  - lo mismo de T015 para la configuración de un merchant, también uno sin versión propia;
  - con un experimento activo y el testigo viejo, `412` y no `409`;
  - las publicaciones existentes ganan su `If-Match`.
- [x] T018 [US1] `src/application/configuration/services/`: `merchantConfigurationWitness`, del merchant y el número de la versión que rige; `publish-merchant-configuration.use-case.ts` con `witness` en el orden de R-05; el
      controller de la publicación lee `If-Match` y devuelve `ETag`; `getMerchantConfiguration` devuelve
      `ETag`
- [x] T019 [P] [US2] [US3] `tests/integration/admin-merchants.test.ts`, **antes del código**:
  - `getMerchant` da el `ETag`; editar la identidad con él da `200` y el nuevo;
  - después de `setKillSwitch`, de una rotación y de `deactivateMerchant`, el testigo viejo da `412`, y cada
    una de esas respuestas trae su `ETag`;
  - repetir la misma identidad con el testigo viejo da `200` sin subir la revisión;
  - las ediciones existentes ganan su `If-Match`.
- [x] T020 [US2] `src/application/merchant/use-cases/update-merchant-profile.use-case.ts`: `witness`;
      idéntico no escribe; el orden de R-05. Controllers de `getMerchant`, `updateMerchantProfile`,
      `createMerchant`, `setKillSwitch`, `deactivateMerchant` y las tres rotaciones: `ETag` del merchant que
      devuelven
- [x] T021 [P] `tests/integration/isolation.test.ts`:
  - el testigo de A en una escritura de B da `412`;
  - un operador con alcance A que escribe en B con cualquier testigo recibe `403`, nunca `412`.
- [x] T022 Las demás pruebas que publican o editan sin `If-Match` (`grep` sobre `tests/` de las cuatro
      rutas) ganan el testigo de una lectura previa; `npm test` entero en verde. Commit con la fase 2:
      `feat(043): las cuatro escrituras que reemplazan lo que leyeron exigen su testigo`

**Checkpoint**: las tres historias de punta a punta; el servidor arranca con el contrato `1.15.0`.

> **Hecho el 2026-10-10.** Desvíos: (1) **Las pruebas existentes no se tocaron una por una**: el helper
> `admin()` se porta como un panel correcto y, ante una escritura protegida sin `ifMatch`, lee el recurso y
> manda su `ETag`; las pruebas del testigo lo pasan explícito, y `null` lo omite. (2) **La ausencia del testigo
> se responde antes del alcance**: es forma del pedido, como un cuerpo mal formado, y `428` no dice nada del
> recurso; el **valor** del testigo se juzga después del alcance. Dos pruebas de alcance ganaron un testigo
> para seguir siendo sobre el alcance. (3) **Un nivel sin versión acepta cualquier testigo**: no hay nada que
> pisar. (4) **`If-Match` se lee sin mirar mayúsculas** (`witnessIn`): el tipo generado lo nombra como el
> contrato y HTTP lo entrega en minúsculas. (5) **ADR-046 y la nota «testigo» se adelantaron** (T023, T024):
> el contrato cita la ADR y `check:adrs` falla sin ella. (6) **El testigo de la configuración de un merchant**
> se calcula en `application/configuration/services/witness.ts`, que usan la lectura, la publicación y la
> respuesta.

---

## Phase 4: El cierre (tramo 4 del plan)

- [x] T023 [P] `docs/adr/046-el-testigo-de-concurrencia.md` (NUEVO, aceptada): las cuatro exigencias de
      `TAN-10`, `x-when-missing`, el formato del testigo, el orden de R-05, lo que el despliegue en memoria
      no serializa (R-01), CORS para `admin` el día que exista (R-07), y el reporte de `contract:diff`;
      `docs/adr/README.md` con su fila
- [x] T024 [P] `docs/dominio/testigo.md` (NUEVO, con la forma de `contacto.md`), y lo que el inventario de
      `docs/dominio/` pida
- [x] T025 La cadena: `npm run format:check`, `npm run quality`, `npm run typecheck`, `npm test`,
      `npm run test:durability`, `npm run build`, `npm run test:contract`, `npm run release-check`, y
      `npm run test:mutation` a un archivo (sin mutantes vivos en lo nuevo, ADR-016)
- [x] T026 El quickstart a mano contra `npm run dev` (los siete pasos), con «Lo corrido» fechado; romper a
      propósito lo de la tabla «Romperle algo»
- [x] T027 `spec.md`: **Status**: Construida. Commit: `docs(043): cierre — ADR-046, lo corrido y el estado`.
      Push y PR, con la base en `main` después de que entre la 042

---

## Dependencies

```text
Fase 1 (dominio, commit) ──► Fase 2 (contrato) ─┐
                                                 ├─► un commit ──► Fase 4 (cierre)
                             Fase 3 (servidor) ──┘
```

- T001 antes de T002; T002 y T003 antes de la fase 3.
- T006 a T010 antes de T013; T011 antes de T012; T013 antes de T014.
- T015 antes de T016; T017 antes de T018; T019 antes de T020; T021 después de T018 y T020.
- T022 cierra el commit de las fases 2 y 3.

## Lo que no se hace, y conviene recordarlo al implementar

- **No se guarda ningún testigo** (research R-03): se calcula del estado actual.
- **No hay escritura condicional en los almacenes** (research R-01): la unidad de trabajo ya serializa.
- **El `412` no devuelve el testigo actual**, y el `428` tampoco.
- **Las otras escrituras del merchant no exigen testigo**: lo cambian y lo declaran, nada más.
