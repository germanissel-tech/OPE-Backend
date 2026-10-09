---
description: "Task list for feature 041 — el merchant con identidad"
---

# Tasks: El merchant con identidad

**Input**: `specs/041-el-merchant-con-identidad/` (spec.md, plan.md, research.md, data-model.md,
contracts/merchant-identity.md, quickstart.md)

**Prerequisites**: plan.md con el Constitution Check pasado (v1.5.0 → 1.5.1 en el tramo 4);
research.md con los diez hallazgos; ADR-045 en `propuesta`; los dos puntos a ratificar por el dueño
(R-08, R-09) acordados con el plan.

**Tests**: sí, y preceden a la implementación donde hay una regla: las fixtures de `ope-no-pii` antes
de tocar la regla, las pruebas de dominio antes del valor, las de integración antes del caso de uso, la
de durabilidad antes de dar por guardado.

**Organization**: por **tramo** del plan, porque el orden de `contrato.md` manda (el contrato antes que
el servidor; lo emitido después). Cada tarea lleva la historia que sirve: US1 nombre y URL, US2 edición,
US3 contacto.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1 · US2 · US3
- Cada tarea nombra su archivo

---

## Phase 1: El contrato (tramo 1)

**Purpose**: que el contrato diga todo lo nuevo antes de que el servidor lo haga, con sus reglas y sus
fixtures, y que `contract:diff` diga lo que cambia.

- [x] T001 [US2] `contracts/api-map.yaml` — `updateMerchantProfile` (`method: put`,
      `path: /v1/admin/merchants/{merchantId}/profile`, `consumer: admin`, `tag: admin`,
      `capabilities: [merchants:write]`, `feature: "041"`, `status: built`,
      `source: specs/041-el-merchant-con-identidad/spec.md`), después de `setKillSwitch` (orden 0 de
      `contrato.md`)
- [x] T002 [P] [US3] `tests/contract-rules/gen-fixtures.mjs` — **antes de tocar la regla**:
      `ope-no-pii.contact-elsewhere.yaml` (`email` en el esquema de una orden → falla),
      `ope-no-pii.list-without-reason.yaml` (`x-personal-datum` como lista con una entrada sin `reason`
      → falla), `ope-no-pii.list-empty.yaml` (lista vacía → falla); `valid-admin-path.yaml` gana un
      esquema `MerchantContact` con `name` y `email` excusados en una lista, que pasa; regenerar y
      agregar las tres a `tests/contract-rules/rules.test.ts`
- [x] T003 [US3] `contracts/rules/functions/noPii.js` — `exceptionOf` acepta un objeto o una lista de
      `{ property, reason }` y devuelve el conjunto excusado; cada entrada con `property` declarada en
      ese esquema y `reason` no vacía; lista vacía es un problema (R-05); `contracts/rules/pii-denylist.json`
      `_doc` dice que admite una lista
- [x] T004 [P] [US3] `contracts/components/schemas/MerchantContact.yaml` (NUEVO) según
      `contracts/merchant-identity.md` §1: `required: [name, email]`, `name` 1..120, `email`
      `format: email` 3..254, `phone` 1..32, `role` 1..80, `additionalProperties: false`,
      `x-personal-datum` con las tres entradas y sus razones completas
- [x] T005 [P] [US2] `contracts/components/schemas/MerchantProfileInput.yaml` (NUEVO):
      `required: [displayName]`, `displayName` 1..120, `storeUrl` `pattern: "^https?://"` 1..255,
      `contact` `$ref: ./MerchantContact.yaml`, `notes` 1..2000, `x-personal-datum` para `displayName`
      (razón: nombre de la tienda, no de una persona), `x-invariants` con `invalid-merchant-profile`
      (`status: 422`, `pointer: displayName`, `rule` y `description` de `merchant-identity.md`)
- [x] T006 [P] [US1] `contracts/components/schemas/MerchantCreate.yaml` — `displayName` en `required`
      (`[origins, signature, displayName]`), `storeUrl`, `contact`, `notes` con las mismas formas, la
      marca para `displayName`, y el invariante `invalid-merchant-profile` junto a los dos existentes;
      `contracts/components/schemas/Merchant.yaml` — los cuatro opcionales con las mismas formas y la
      marca; `required` sin cambio
- [x] T007 [P] [US2] `contracts/paths/admin-merchant-profile.yaml` (NUEVO) con `updateMerchantProfile`
      (`put`, `adminToken`, `x-required-capabilities: [merchants:write]`, parámetro
      `../components/parameters/merchantId.yaml`, cuerpo `MerchantProfileInput` con ejemplo, `200`
      `Merchant`, `400 BadRequest`, `401 OperatorUnauthorized`, `403 MerchantForbidden`,
      `404 MerchantNotFound`, `422 MerchantProfileUnprocessable`, `503 ServiceUnavailable`,
      `500 InternalServerError`); `contracts/openapi.yaml` lo referencia como
      `/v1/admin/merchants/{merchantId}/profile` y pasa a `info.version: 1.13.0`
- [x] T008 [P] [US2] `contracts/components/responses/MerchantProfileUnprocessable.yaml` (NUEVO) con el
      ejemplo `invalid-merchant-profile` y `errors: [{ pointer: /body/storeUrl, message }]`;
      `contracts/components/responses/MerchantUnprocessable.yaml` gana el ejemplo con
      `/body/displayName`; `contracts/problem-types.yaml` gana `invalid-merchant-profile` (`422`, título
      de `merchant-identity.md`)
- [x] T009 [US2] `contracts/README.md` — la fila de `x-personal-datum` dice que admite un objeto o una
      lista; `tests/integration/bootstrap.test.ts` afirma `1.13.0`
- [x] T010 `npm run contract:check` con el diff **reportando** `displayName` required en `MerchantCreate`
      como incompatible y aceptándolo por `building` (anotar el texto exacto en el quickstart, §1);
      lint con las fixtures nuevas; `contract:types` regenera `api.d.ts` con `updateMerchantProfile` y
      los esquemas; `api-map` con la operación `built`; `invariant-tests` falla hasta que exista la prueba
      del tramo 2 (es la señal de que el tramo 1 y 2 van en un commit)

**Checkpoint**: el contrato dice todo lo nuevo; sin handler, el arranque se niega: **no se commitea hasta
cerrar el tramo 2**.

---

## Phase 2: El servidor (tramo 2)

**Purpose**: que el servidor haga lo que el contrato dice, con las pruebas antes del código.

- [x] T011 [P] [US1] `tests/unit/domain/merchant/profile.test.ts` (NUEVO) — **antes del valor**:
      `MerchantProfile.of` acepta los cuatro campos y ninguno; rechaza `displayName` vacío, con espacios
      en los bordes; `storeUrl` que no parsea (`https://`, `http://a b`) y acepta una con camino;
      `contact.name` con espacios; `contact.email` con espacios; `notes` vacío; cada rechazo con
      `code: invalid-merchant-profile`, `module: merchant` y `details.pointer` al campo
      (`contact.email`); `rehydrate` no re-juzga; `record()` devuelve lo mismo sin los ausentes;
      `Merchant.withProfile` reemplaza entero, no falla, y lo admite un merchant desactivado;
      `Merchant.rehydrate` de un record con `profile` devuelve una clase (`instanceof MerchantProfile`)
      y de uno sin `profile` queda `undefined`
- [x] T012 [US1] `src/domain/merchant/profile.ts` (NUEVO) — `MerchantContactRecord`,
      `MerchantProfileRecord`, clase `MerchantProfile` con `private constructor`, `of` (`Result`,
      reglas de `data-model.md` en orden), `rehydrate`, `record()`; `src/domain/merchant/errors.ts` —
      `InvalidMerchantProfile(field)` con `details: { pointer: field }`; `src/domain/merchant/merchant.ts`
      — `profile?: MerchantProfileRecord` en `MerchantRecord`, `profile?: MerchantProfile` en
      `MerchantInput`, el constructor rehidrata la clase anidada, `withProfile(profile): Merchant`,
      `record()` lo incluye sólo si lo hay; `src/domain/merchant/index.ts` exporta
- [x] T013 [P] [US2] `tests/integration/admin-merchants.test.ts` — **antes del caso de uso**: alta con
      `displayName` y `storeUrl` → `201` con los dos en `merchant` y en el `GET` y la lista; alta sin
      `displayName` → `400` con puntero (del validador); `[invariant:invalid-merchant-profile]` alta con
      `displayName: " Tienda "` → `422` con `errors: [{ pointer: "/body/displayName" }]` y ningún
      merchant creado (la lista no crece); edición completa → `200` con los cuatro y orígenes, estado y
      credenciales intactos; edición sin `storeUrl` deja el campo ausente; edición de un merchant de la
      semilla de pruebas (sin identidad) → desde entonces con nombre; edición con `storeUrl: "https://"`
      → `422` con `/body/storeUrl`; edición con `origins` en el cuerpo → `400`; edición de un merchant
      desactivado → `200`; el registro de administración del merchant tiene la entrada
      `updateMerchantProfile` con `operatorId` y `outcome: accepted` y `res.body` del log no contiene
      el nombre del contacto ni el email
- [x] T014 [P] [US2] `tests/integration/isolation.test.ts` — `ops-a` edita el perfil de `m_b` → `403
merchant-out-of-scope`, mismo cuerpo (sin `instance` ni `requestId`) que para `mrc_nobody`, y el
      perfil de `m_b` no cambió; `ops-a` edita `m_a` → `200`
- [x] T015 [P] [US3] `tests/integration/logging-privacy.test.ts` — una edición con `contact`
      (`name`, `email`, `phone`) deja en el registro del servidor (logger capturado) `incoming request` y
      `request completed` sin el nombre, el email ni el teléfono; y `GET /v1/sdk-config` (o la lectura
      `sdk` que exista) del mismo merchant no trae `displayName`, `contact` ni `notes`
- [x] T016 [P] [US1] `tests/durability/merchant-store.test.ts` — un merchant creado con identidad
      sobrevive un reinicio con `profile` como clase (`instanceof MerchantProfile`) y el contacto
      entero; un documento escrito **sin** `profile` (insertado a mano con `toDocument` de un record sin
      el campo) rehidrata un merchant con `profile === undefined` y sigue autenticando
- [x] T017 [P] [US1] `tests/unit/application/merchant/merchant-admin.use-cases.test.ts` —
      `CreateMerchantUseCase` con `profile` inválido devuelve `invalid-merchant-profile` **sin** llamar a
      `ownerOfOrigin` ni al acuñador (contar llamadas); con `profile` válido crea con él;
      `UpdateMerchantProfileUseCase`: fuera del alcance → `merchant-out-of-scope` sin tocar el store;
      inválido → `invalid-merchant-profile` sin `update`; válido → `update` con el merchant reemplazado y
      la respuesta es ese merchant; `tests/unit/composition/config.test.ts` — la semilla con los cuatro
      campos y sin ninguno; una semilla con `displayName: " "` falla al arrancar nombrando
      `merchants[0].displayName`
- [x] T018 [US2] `src/application/merchant/use-cases/update-merchant-profile.use-case.ts` (NUEVO) —
      `UpdateMerchantProfileRequest { actor, merchantId, profile: MerchantProfileRecord }`,
      `UpdateMerchantProfileDependencies { scoped, merchants }`, `execute`: `find` → `MerchantProfile.of`
      → `withProfile` → `update`, cada error devuelto (ADR-023); `create-merchant.use-case.ts` —
      `profile: MerchantProfileRecord` en el request, juzgado **antes** de `ownerOfOrigin`;
      `import-merchants.use-case.ts` — `MerchantSeed` con los cuatro opcionales, `MerchantProfile.of`
      cuando trae alguno; `src/application/merchant/index.ts` exporta
- [x] T019 [US2] `src/interface-adapters/merchant/presenters.ts` — `merchantDto` gana los cuatro
      campos cuando el merchant los tiene (`contact` entero, sin inventar `undefined`s en el JSON);
      `profileOf(body)` convierte el cuerpo tipado (`MerchantProfileInput` o la parte de
      `MerchantCreate`) en `MerchantProfileRecord`; `controllers/update-merchant-profile.ts` (NUEVO)
      tipado `OperationHandler<"updateMerchantProfile">` con `merchantIdOf(req.path)` y `profileOf`,
      `200` con `merchantDto`; `controllers/create-merchant.ts` pasa `profile`;
      `src/interface-adapters/merchant/index.ts` exporta
- [x] T020 [US2] `src/composition/modules/merchant.ts` — `updateMerchantProfile: served({ scoped:
ScopedMerchantPort, merchants: MerchantStorePort }, { name, build }, controller)` sin lectores
      (R-06); `src/composition/merchants-config.ts` y `src/composition/seed-errors.ts` — la semilla lee
      los cuatro y nombra `merchants[N].<campo>` en un `ConfigError`;
      `config/schemas/merchants-seed.schema.json` los admite con los largos del contrato;
      `config/dev-merchants.json` gana `displayName: "Tienda de desarrollo"` y
      `storeUrl: "http://localhost:3000"`; `npm run arch` en verde
- [x] T021 `npm run format:check && npm run quality && npm run typecheck && npm test &&
npm run test:durability` en verde; `npm run test:contract`; `npm run test:mutation` sin
      sobrevivientes en lo nuevo (`profile.ts`, `merchant.ts`, los dos casos de uso, el controller, el
      presentador, `noPii.js` no entra: es de `contracts/`); contra `npm run dev`, el quickstart §2 entero
      (incluido el reinicio). Anotar lo visto en `quickstart.md`

**Checkpoint**: la ficha dice quién es el merchant y la edición lo cambia. Commit (tramos 1 y 2):
`feat(041): el merchant tiene nombre, URL, contacto y notas, y una operación que los reemplaza`.

---

## Phase 3: Los artefactos (tramo 3)

**Purpose**: que lo emitido traiga la operación y los esquemas, y que OPE-Web lo copie sin tocar nada.

- [x] T022 [US2] `tests/governance/consumer-artifacts.test.ts` — `OPERATIONS.updateMerchantProfile`
      con `['merchants:write']` e `idempotent: false`; `CONSTRAINTS.MerchantContact.required ===
['name', 'email']` con `email.format === 'email'`; `CONSTRAINTS.MerchantProfileInput.required ===
['displayName']` y `fields.contact` igual a `{ type: 'object', ref: 'MerchantContact' }`;
      `CONSTRAINTS.MerchantCreate.required` contiene `displayName`
- [x] T023 [US2] `npm run contract:types && npm run contract:types:check` en verde con
      `generated/contract/` regenerada y versionada
- [x] T024 [US2] En OPE-Web, contra este backend: `npm run contract:sync` copia los ocho archivos y
      `npx ope-check` pasa sin tocar `conformity` (R-07). Anotar lo visto. Si algo no pasa, es un
      hallazgo del quickstart, no un cambio allá: la consola es su feature siguiente

**Checkpoint**: SC-001 en lo que depende del backend. Commit:
`feat(041): generated/contract/ trae la identidad del merchant`.

---

## Phase 4: Los documentos (tramo 4)

**Purpose**: que lo decidido quede escrito donde se busca, y que la constitución diga lo que el lint y
el código ya hacen.

- [x] T025 [US3] `.specify/memory/constitution.md` — la viñeta de VII pasa a nombrar «las personas
      identificadas de la relación comercial: el operador y el contacto del merchant», servidas sólo a
      `admin`; versión **1.5.1**, `Last Amended` 2026-10-09, Sync Impact Report al tope (PATCH; la fuente
      del MVP no habla del contacto porque no tenía backoffice, 01 §13; plantillas sin cambio)
- [x] T026 [P] `docs/adr/045-el-merchant-con-identidad.md` — `estado: aceptada`, con lo que difirió si
      algo difirió y el texto del reporte de `contract:diff` (R-09); `docs/adr/031-…` gana la nota fechada
      «el merchant tiene identidad (feature 041)»; `scripts/identifiers-allowlist.json` **pierde** las
      tres entradas de la 041
- [x] T027 [P] `docs/dominio/merchant.md` — la identidad: nombre para reconocer, URL para una persona,
      contacto como persona identificada de la relación comercial, notas; que no entra en decisiones,
      SDK, plataforma ni registros; `check:glossary` en verde
- [x] T028 [P] `.claude/rules/contrato.md` — si la viñeta de consumidores o de `x-invariants` nombra
      `x-personal-datum`, que diga que admite una lista; `CLAUDE.md` sin cambio salvo que alguna tabla lo
      nombre
- [x] T029 `specs/041-el-merchant-con-identidad/quickstart.md` — «Lo corrido» con fecha, incluido lo
      que difirió y el texto del diff; `spec.md` con **Status**: construida; en verde
      `npm run release-check`, `npm run contract:check`, `npm run test:durability` y `npm run test:all`

**Checkpoint**: `release-check` en verde con la constitución en 1.5.1. Commit:
`docs(041): cierre — constitución 1.5.1, ADR-045 aceptada, y lo corrido`.

---

## Dependencies

```
Fase 1 (contrato) ──► Fase 2 (servidor) ──► Fase 3 (artefactos) ──► Fase 4 (documentos)
```

- T002 antes de T003 (la fixture falla primero). T004 antes de T005 y T006 (los `$ref`). T005 y T006
  antes de T007 y T008. T001 y T007 antes de T010.
- T011 antes de T012; T013/T014/T015/T016/T017 antes de T018; T012 antes de T018; T018 antes de T019;
  T019 antes de T020; T020 antes de T021.
- T022 antes de T023; T023 antes de T024.
- T025 antes de T029 (`release-check` lee la versión).

**En paralelo dentro de una fase**: T002/T004/T005/T006 (archivos distintos), T007/T008/T009,
T011/T013/T014/T015/T016/T017 (pruebas antes del código), T026/T027/T028.

## Lo que no se hace, y conviene recordarlo al implementar

- **No se abre un agregado ni un store** para la identidad: va en el documento del merchant (R-01, R-02).
- **No se recorta ni se normaliza** un valor: se rechaza o entra como se escribió (R-04).
- **No se copian los largos al dominio**: son del contrato; el dominio juzga forma (XI).
- **No se agregan lectores de auditoría** a `updateMerchantProfile` (R-06).
- **No se toca `conformity` ni ninguna pantalla de OPE-Web**: listar por nombre es su feature siguiente.
- **No se inventa un contacto en la semilla de desarrollo** (R-10).
- **No se toca Tandilia.**
