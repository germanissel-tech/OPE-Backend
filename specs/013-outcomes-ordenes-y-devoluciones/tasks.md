# Tasks: Outcomes — órdenes, devoluciones y corroboración desde el navegador

**Input**: Design documents from `specs/013-outcomes-ordenes-y-devoluciones/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: la spec exige tablas exactas (SC-001), idempotencia bajo repetición y concurrencia
(SC-002), rechazo de todo campo fuera del contrato y de PII (SC-003), respuestas y logs sin
brazo ni secreto (SC-004), firma obligatoria por merchant y compatibilidad de la 010 (SC-005),
latencia (SC-006), aislamiento y gates (SC-007); las tareas de prueba están incluidas y van
antes o junto con lo que prueban (invariantes con `[invariant:<slug>]`).

**Organization**: por historia. La fase fundacional deja el contrato construido, el módulo
`outcomes` vacío de comportamiento y la consulta por sesión del ledger (commit 1); US1 + US2
son la orden (commit 2); US3 la corroboración y US4 la devolución (commit 3); US5 la redención
(commit 4); US6 la firma (commit 5); polish (commit 6).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable · **[Story]**: US1 orden verificada/atribuida/pendiente · US2
  idempotencia · US3 corroboración · US4 devolución · US5 redención · US6 firma

## Path Conventions

Proyecto único (ADR-013). Módulo nuevo `src/domain/outcomes/` + `src/application/outcomes/`;
gateways en `src/interface-adapters/gateways/outcomes/`; controllers en
`src/interface-adapters/http/controllers/outcomes/`; composición en
`src/composition/modules/outcomes.ts`. La firma en `merchant` (dominio, aplicación, gateway) y
en `src/infrastructure/http/build-server.ts`.

---

## Phase 1: Setup

- [ ] T001 Verificar el punto de partida (`npm run contract:check && npm run quality && npm test`
      en verde) y anotar la cantidad de pruebas en la sección histórica de
      `specs/013-outcomes-ordenes-y-devoluciones/quickstart.md`

---

## Phase 2: Foundational — contrato construido y módulo cableado sin comportamiento

- [ ] T002 [P] Contrato, esquemas: `contracts/components/schemas/{OrderId,OrderItem,Order,
OrderStatus,OrderResult,OrderCorroboration,CorroborationResult,Return,ReturnResult}.yaml` según
      `contracts/schemas.yaml` del plan (`Order` con `x-invariants` `duplicate-order-item` y
      `order-confirmed-in-future`; `Order.incentive` por `$ref` a `Incentive.yaml`; todo
      `additionalProperties: false`); `contracts/components/responses/{OrderUnprocessable,
ReturnUnprocessable}.yaml` con un ejemplo por invariante (`duplicate-order-item`,
      `order-confirmed-in-future`; `order-unknown`, `return-items-not-in-order`)
- [ ] T003 [P] Contrato, operaciones: `contracts/paths/{orders,order-corroborations,returns}.yaml`
      según los borradores del plan (sin los parámetros de firma todavía: llegan en US6),
      `contracts/examples/{order-attributed,order-pending,order-corroboration,order-return}.yaml`,
      raíz `contracts/openapi.yaml` (`info.version: 1.2.0`, tres paths), `contracts/api-map.yaml`
      (`notifyOrder`, `corroborateOrder`, `notifyReturn` → `built`), `contracts/problem-types.yaml`
      (+`duplicate-order-item`, `order-confirmed-in-future`, `order-unknown`,
      `return-items-not-in-order`; los de firma en US6) y su réplica `PROBLEM_TYPES` en
      `src/interface-adapters/http/problem-details.ts`; `contracts/components/schemas/Incentive.yaml`:
      cerrar el PROPUESTO (la redención se declara en `Order.incentive`; la emisión del cupón es
      de la 014)
- [ ] T004 Glosario para `check:glossary`: `docs/dominio/{orden-verificada,orden-atribuida,
correlacion-pendiente,corroboracion,devolucion,mecanismo-de-correlacion}.md` con fuente (01
      §5, §5.2, §6; 02 §5.1–5.4); `npm run contract:check && npm run contract:types` en verde
      (tipos regenerados en `src/interface-adapters/http/generated/api.d.ts`); el arranque falla
      hasta T009 porque el contrato declara operaciones sin módulo: aceptable dentro de la fase
- [ ] T005 [P] `src/application/ledger/ports/decision-ledger.ts`: `bySession(merchantId,
sessionId): Promise<readonly Decision[]>` (orden de registro);
      `src/interface-adapters/gateways/ledger/memory-decision-ledger.ts`: índice
      `merchant/session`; `tests/helpers/unavailable-ledgers.ts`: `bySession: () => []`;
      `tests/unit/gateways/memory-decision-ledger.test.ts` (nuevo o ampliado: por sesión, orden,
      otra sesión vacía, otro merchant vacío)
- [ ] T006 [P] Dominio `outcomes`, vacío de reglas de negocio: `src/domain/outcomes/ids.ts`
      (`OrderId`, `asOrderId`), `corroboration.ts` (tipo `Corroboration`), `errors.ts`
      (`DuplicateOrderItem`, `OrderConfirmedInFuture`, `OrderUnknown`, `ReturnItemsNotInOrder`,
      `OutcomesError`; `MODULE = "outcomes"`), `index.ts`; `.dependency-cruiser.cjs`:
      `outcomes: ["shared-kernel", "ledger"]`; fixture en `tests/architecture/fixtures/` si la
      prueba de mapa lo exige
- [ ] T007 [P] Puertos: `src/application/outcomes/ports/order-ledger.ts` (`OrderRecording`,
      `ReturnRecording`, `OrderLedger { record, recordReturn, find }`) y
      `corroboration-ledger.ts` (`CorroborationLedger { record, find }`) según data-model.md;
      `src/application/outcomes/index.ts`; `tests/helpers/unavailable-ledgers.ts`:
      `unavailableOrderLedger`, `unavailableCorroborationLedger`
- [ ] T008 Composición: `src/composition/modules/outcomes.ts` (`OutcomesPorts { clock, logger,
orders, corroborations, decisions }`, `memoryOutcomesPorts`, `outcomesModule` con los tres
      handlers), `modules/index.ts` (`MODULES`), `ports.ts`, `profiles/local.ts`; controllers
      `src/interface-adapters/http/controllers/outcomes/{notify-order,corroborate-order,
notify-return}.ts` tipados con `OperationHandler<…>` que aún responden el caso de uso de
      T011/T015/T018 (escribir controllers y casos de uso mínimos que compilen; el
      comportamiento llega por historia)
- [ ] T009 `npm run typecheck && npm run quality && npm test && npm run contract:check` en verde
      (el servidor arranca: toda operación tiene módulo); `npm run test:mutation`; commit
      `feat(outcomes): contrato de órdenes, corroboraciones y devoluciones construido; módulo
outcomes y consulta por sesión del ledger`

---

## Phase 3: US1 + US2 — La orden entra verificada, se atribuye sólo por A y es idempotente (Priority: P1)

**Goal**: `Order` con invariantes, correlación pura, registro atómico first/repeat/conflict,
`notifyOrder` de punta a punta.

**Independent Test**: sesión con decisiones → `201 ATTRIBUTED_ORDER` con asignación en el
ledger; sin `sessionId` / sesión de otro merchant → `PENDING_CORRELATION`; tres envíos →
`201`, `200`, `200`; otro monto → `409`; dos merchants, mismo `orderId` → dos órdenes.

- [ ] T010 [P] [US1] `src/domain/outcomes/order.ts`: `OrderItem`, `OrderStatus`, `class Order`
      (`of` con `duplicate-order-item` y `order-confirmed-in-future` con tolerancia de 5 min
      sobre `receivedAt`; `rehydrate`; `status()`; `sameContentAs` canónico sobre lo enviado
      con ítems ordenados por SKU; `withReturn`; `contains`); `correlation.ts`:
      `class Correlation { static of({ sessionId, decisions }) }` y `class IncentiveRedemption
{ static of({ declared?, correlated, granted }) }` (US5 la usa; la tabla completa se prueba
      allí); `tests/unit/domain/outcomes/order.test.ts` (SKU repetido, futuro > 5 min, futuro ≤ 5
      min aceptado, `sameContentAs`: ítems reordenados iguales, `receivedAt` ignorado,
      `sessionId`/`incentive`/`total` distintos ⇒ distinto) y
      `tests/unit/domain/outcomes/correlation.test.ts` (sin decisiones ⇒ `undefined`; con
      decisiones sin experimento ⇒ sin `experiment`; con experimento ⇒ el de la última que lo
      tiene; `visitorId` de la primera)
- [ ] T011 [US1] `src/application/outcomes/use-cases/notify-order.use-case.ts`
      (`NotifyOrderUseCase`, deps `{ clock, orders, decisions, corroborations, logger }`):
      `Order.of` → `bySession` si hay `sessionId` → `Correlation.of` → `IncentiveRedemption.of`
      → `orders.record` → `created | repeated | IdempotencyConflict | LedgerUnavailable`; log
      `merchantId, orderId, status, redemption?, corroborated` (sin brazo);
      `tests/unit/application/outcomes/notify-order.test.ts` con dobles (atribuida con
      experimento; sin `sessionId`; sesión sin decisiones; `repeated` devuelve el registro
      original aunque la sesión ya sea conocida; `conflict` ⇒ `IdempotencyConflict`; ledger
      caído ⇒ `LedgerUnavailable` sin registrar; `Order.of` falla ⇒ no consulta el ledger)
- [ ] T012 [P] [US2] `src/interface-adapters/gateways/outcomes/memory-order-ledger.ts`:
      `record` decide en sección síncrona con `sameContentAs` (clave `merchant/orderId`),
      `recordReturn` (`unknown | recorded | repeated | conflict`), `find`;
      `memory-corroboration-ledger.ts` (clave `merchant/orderId/sessionId`; `find` por orden);
      `tests/unit/gateways/memory-order-ledger.test.ts` (dos `record` concurrentes con
      `Promise.all` ⇒ un registro y `recorded` + `repeated`; conflicto no sobrescribe; otro
      merchant no ve la orden) y `memory-corroboration-ledger.test.ts`
- [ ] T013 [US1] Controller `src/interface-adapters/http/controllers/outcomes/notify-order.ts`:
      DTO → `Money.rehydrate`, `asOrderId`, `asSessionId`, `instantOf`; `created → 201`,
      `repeated → 200`, errores por `toProblem` (`409`, `422`, `503` con `Retry-After` como la
      exposición: verificar que `to-problem.ts` ya lo hace para `ledger-unavailable`); cuerpo de
      respuesta `OrderResult` sin nada más; `tests/integration/orders.test.ts` historias 1 y 2:
      `[invariant:duplicate-order-item]`, `[invariant:order-confirmed-in-future]`; atribuida con
      asignación en el ledger (`ports.orders.find`); sin `sessionId`; sesión sólo de B con la
      credencial de A ⇒ `PENDING_CORRELATION`; sesión sin experimento ⇒ atribuida sin
      `experiment`; campo extra (`email`) ⇒ `400`; `201/200/200`; otro monto ⇒ `409` y registro
      intacto; mismo `orderId` en A y B; reenvío con `sessionId` ⇒ `409`; ledger caído ⇒ `503`
      con `Retry-After` y nada registrado; `JSON.stringify(body)` sin `arm|experiment|visitor`
- [ ] T014 [US2] `tests/integration/isolation.test.ts` (+): orden de A con `sessionId` de B no se
      atribuye; `find` de B no ve la orden de A. `tests/integration/outcomes-latency.test.ts`
      (p95 ≤ 50 ms, informativa; excluida en `vitest.mutation.config.ts`). `npm run quality &&
npm test && npm run contract:check` en verde; `npm run test:mutation`; commit `feat(outcomes):
la orden entra como venta verificada, se atribuye sólo por la plataforma y es idempotente por
orderId (ADR-028)`

---

## Phase 4: US3 + US4 — Corroboración desde el navegador y devoluciones (Priority: P2)

**Goal**: evidencia del SDK que nunca atribuye; `RETURNED` conservando la correlación.

**Independent Test**: corroboración antes de la orden → `202`, sin orden; llega la orden →
su estado lo decide A; repetida → un registro; devolución → `201 RETURNED`; repetida `200`;
distinta `409`; desconocida `422 order-unknown`; ítems fuera de la orden `422`.

- [ ] T015 [P] [US3] `src/application/outcomes/use-cases/corroborate-order.use-case.ts`
      (`CorroborateOrderUseCase`, deps `{ clock, corroborations }`; `record` ⇒ `{ receivedAt }`
      o `LedgerUnavailable`); controller `corroborate-order.ts` (`202`; `503`);
      `tests/unit/application/outcomes/corroborate-order.test.ts`;
      `tests/integration/order-corroborations.test.ts`: antes de la orden (`202`, `orders.find`
      vacío, `corroborations.find` con una); después de la orden (estado de la orden intacto);
      repetida (`202`, una); `sessionId` de otro merchant se registra bajo el propio; Origin no
      registrado ⇒ `403`; ledger caído ⇒ `503` con `Retry-After`; `NotifyOrder` loguea
      `corroborated: true` cuando ya existía (usar `recordingLogger`)
- [ ] T016 [P] [US4] `src/domain/outcomes/return.ts`: `class Return { static of({ order,
returnedAt, items?, receivedAt }) }` (`return-items-not-in-order`: SKU ausente o cantidad
      mayor; SKUs repetidos también), `sameContentAs`; `tests/unit/domain/outcomes/return.test.ts`
- [ ] T017 [US4] `src/application/outcomes/use-cases/notify-return.use-case.ts`
      (`NotifyReturnUseCase`, deps `{ clock, orders }`): `orders.find` ⇒ `OrderUnknown` |
      `Return.of` ⇒ `orders.recordReturn` ⇒ `created | repeated | IdempotencyConflict |
OrderUnknown (unknown) | LedgerUnavailable`; controller `notify-return.ts` (`201`/`200`/`409`/
      `422`/`503`, `ReturnResult` con `orderStatus`);
      `tests/unit/application/outcomes/notify-return.test.ts`;
      `tests/integration/returns.test.ts`: `[invariant:order-unknown]`,
      `[invariant:return-items-not-in-order]`, atribuida devuelta conserva `correlation`
      (`orders.find`), pendiente devuelta, repetida `200`, distinta `409`, `orderId` de otro
      merchant ⇒ `422`, ledger caído ⇒ `503`
- [ ] T018 [US3] [US4] `npm run quality && npm test && npm run contract:check` en verde; `npm run
test:mutation`; commit `feat(outcomes): corroboración desde el navegador como evidencia y
devoluciones sobre órdenes registradas`

---

## Phase 5: US5 — La orden declara el incentivo aplicado y OPE lo cruza (Priority: P3)

**Goal**: `IncentiveRedemption` con sus cinco veredictos, visible en el ledger, nunca error.

**Independent Test**: sesión con `INTERVENE` + `incentive 5` → orden con 5 ⇒ `matched`; con
10 ⇒ `mismatched`; sin incentivo ⇒ `not-applied`; orden pendiente con incentivo ⇒
`unverifiable`; sesión sin concesión con incentivo ⇒ `not-granted`.

- [ ] T019 [US5] `tests/unit/domain/outcomes/correlation.test.ts` (+): tabla completa de
      `IncentiveRedemption.of` (data-model.md), última decisión `INTERVENE` con incentivo,
      `NO_OP` ignorados, sin declarado ni concedido ⇒ `undefined`;
      `tests/unit/application/outcomes/notify-order.test.ts` (+): `redemption` en el registro y
      en el log; `tests/integration/orders.test.ts` (+): los cinco casos con la 012 real
      (merchant con `marginPercent` y señales de `price` para conceder el incentivo), respuesta
      idéntica en todos
- [ ] T020 [US5] `npm run quality && npm test` en verde; `npm run test:mutation`; commit
      `feat(outcomes): redención del incentivo cruzada con la decisión que lo concedió`

---

## Phase 6: US6 — La plataforma firma lo que envía (Priority: P2)

**Goal**: firma HMAC-SHA256 con secreto por merchant y ventana, verificada antes del cuerpo,
obligatoria por merchant, también para el catálogo (ADR-029).

**Independent Test**: merchant con secreto: firmada `201`; sin firma / con otro secreto /
cuerpo alterado / fuera de ventana `401` con el `type` exacto; segundo secreto acepta;
merchant sin secreto: sin firma `201`; catálogo del merchant con secreto sin firma `401`.

- [ ] T021 [P] [US6] Dominio `merchant`: `MerchantInput.platformSecrets?`, `Merchant.platformSecrets`,
      `requiresSignature()`, invariante en `of` (1–2, no vacíos, ≠ `ingestKeys` y ≠
      `platformKeys`) con `InvalidPlatformSecret(index)` en `errors.ts`;
      `src/domain/merchant/platform-signature.ts` (`class PlatformSignature { static parse(header)
}` para `v1=<64 hex>`, `matches(expectedHex)` en tiempo constante sin Node, `static
inWindow(timestamp, now, windowMs)`) y errores `SignatureMissing`, `SignatureInvalid`,
      `SignatureExpired`; `contracts/problem-types.yaml` + `PROBLEM_TYPES` (+`signature-missing`,
      `signature-invalid`, `signature-expired` 401; `invalid-platform-secret` 500);
      `tests/unit/domain/merchant/platform-signature.test.ts` y `merchant.test.ts` (+)
- [ ] T022 [P] [US6] Aplicación `merchant`: `ports/message-authenticator.ts`
      (`MessageAuthenticator { hmacSha256Hex(secret, message: Uint8Array) }`),
      `policies/signature-window.ts` (`SIGNATURE_WINDOW_MS = 5 min`),
      `services/platform-signature.service.ts` (`PlatformSignatureVerifier`,
      `DefaultPlatformSignatureVerifier` deps `{ authenticator }`: sin secreto ⇒ `ok`; falta
      header ⇒ `SignatureMissing`; timestamp no entero o fuera de ventana ⇒ `SignatureExpired`
      (no entero ⇒ `SignatureInvalid`); ninguno de los secretos coincide ⇒ `SignatureInvalid`);
      gateway `src/interface-adapters/gateways/merchant/node-message-authenticator.ts`
      (`node:crypto` `createHmac`); `tests/unit/application/merchant/platform-signature.service.test.ts`
      con un autenticador falso y `tests/unit/gateways/node-message-authenticator.test.ts` (vector
      conocido de HMAC-SHA256)
- [ ] T023 [US6] Infraestructura y security handler: `src/interface-adapters/http/typed.ts`
      `SecurityRequest.rawBody?: Uint8Array`; `src/infrastructure/http/build-server.ts`: parser
      de `application/json` con `parseAs: "buffer"` que guarda los bytes en un
      `WeakMap<FastifyRequest, Buffer>` y delega a `app.getDefaultJsonParser(...)` (mismos
      errores `FST_ERR_CTP_*` ⇒ `400 validation-failed`); `registerSecurity` entrega `rawBody`
      desde el `FastifyRequest`; `src/interface-adapters/http/security/platform-key.ts`:
      `makePlatformKeySecurity(resolver, signatures, clock)`: resolver clave → si
      `requiresSignature()` verificar `{ timestamp: header("x-ope-timestamp"), signature:
header("x-ope-signature"), body: rawBody ?? empty, now }` ⇒ `SecurityError(code)`;
      constantes `PLATFORM_TIMESTAMP_HEADER`, `PLATFORM_SIGNATURE_HEADER`;
      `src/composition/modules/merchant.ts` cablea el verificador con el autenticador de Node;
      `src/composition/config.ts` parsea `platformSecrets` (`ConfigError
merchants[i].platformSecrets`); `config/dev-merchants.json` + `platformSecrets`;
      `tests/helpers/test-app.ts`: `MerchantSpec.platformSecrets?`, B con secreto, A sin;
      `tests/helpers/sign.ts` (firma para las pruebas); `tests/unit/composition/config.test.ts` (+)
- [ ] T024 [US6] Contrato: `contracts/components/parameters/{X-OPE-Timestamp,X-OPE-Signature}.yaml`
      referenciados desde `paths/{catalog,orders,returns}.yaml`;
      `contracts/components/securitySchemes/platformKey.yaml` describe la firma (cierra el
      "PROPOSED"); regla `ope-platform-signature-headers` en `contracts/.spectral.yaml` +
      `contracts/rules/functions/platformSignatureHeaders.js` (toda operación con `platformKey`
      declara ambos parámetros) + fixture `tests/contract-rules/fixtures/
ope-platform-signature-headers.yaml` (+ `.missing-one.yaml`) y su entrada en `rules.test.ts`;
      `npm run contract:check && npm run contract:types`
- [ ] T025 [US6] `tests/integration/platform-signature.test.ts`: firmada (`201`), sin headers
      (`401 signature-missing`), con otro secreto (`signature-invalid`), cuerpo alterado tras
      firmar (`signature-invalid`), timestamp de hace 10 min y de dentro de 10 min
      (`signature-expired`), timestamp no numérico (`signature-invalid`), segundo secreto
      (`201`), merchant A sin secreto y sin firma (`201`), `PUT /v1/catalog` de B sin firma
      (`401`) y firmado (`201`); ninguna respuesta ni log contiene el secreto ni la firma
      (`recordingLogger` + headers redactados); `tests/unit/gateways/redaction` si aplica.
      `scripts/sign-platform-request.mjs` (`node scripts/sign-platform-request.mjs <secret>
<archivo>` imprime los dos headers; `checkJs`) y su mención en `README.md`
- [ ] T026 [US6] `npm run format:check && npm run quality && npm run typecheck && npm test && npm run
contract:check && npm run test:contract` en verde; `npm run test:mutation`; commit
      `feat(merchant): firma HMAC del cuerpo para la credencial de plataforma con secreto por
merchant y ventana (ADR-029)`

---

## Phase 7: Polish & documentación

- [ ] T027 [P] `docs/adr/028-cadena-de-evidencia-en-el-ledger.md` y `029-firma-de-plataforma.md`
      → `aceptada`; `docs/adr/020-consumidores-autenticacion-idempotencia-paginacion.md`: la
      firma HMAC deja de ser PROPUESTA (cita ADR-029; los PROPUESTO de `portalSession` y
      `adminToken` siguen); `docs/adr/025-catalogo-y-verdad-de-producto.md` §5: nota de que la
      013 la trajo; `docs/dominio/firma-de-plataforma.md`; `npm run check:adrs && npm run
check:markers`
- [ ] T028 [P] `CLAUDE.md`: módulo `outcomes` en la lista; nota "Outcomes y cadena de evidencia
      (ADR-028, ADR-029)" con correlación sólo por A, idempotencia en el puerto, corroboración
      como evidencia, redención, firma por merchant y `rawBody`; `README.md`: `platformSecrets`
      en `OPE_MERCHANTS`, cómo firmar (script), las tres operaciones en la lista de la
      superficie; `docs/api` regenerado si el flujo lo hace (`contract:docs`,
      `contract:insomnia`)
- [ ] T029 `npm run release-check`; `quickstart.md` con la tabla histórica de cierre y los
      desvíos respecto del plan; commit `chore(013): ADR-028 y ADR-029 aceptadas, guía de agentes
y cierre de la feature`

---

## Dependencies

- Phase 2: T002 ∥ T003 → T004; T005 ∥ T006 ∥ T007 → T008 → T009.
- Phase 3: T010 ∥ T012 → T011 → T013 → T014.
- Phase 4: T015 ∥ (T016 → T017) → T018 (necesita T012 para `recordReturn`).
- Phase 5: T019 → T020 (necesita T011 y la 012 para conceder incentivos).
- Phase 6: T021 ∥ T022 → T023 → T024 → T025 → T026.
- Phase 7: T027 ∥ T028 → T029.

## Parallel Example

```text
# Phase 2, en paralelo:
T002 esquemas del contrato · T003 operaciones y catálogos · T005 bySession · T006 dominio vacío · T007 puertos
# Phase 6, en paralelo:
T021 dominio merchant (secretos, PlatformSignature) · T022 servicio + gateway node:crypto
```

## Implementation Strategy

1. **Fundacional** (commit 1): contrato construido y tipos regenerados; módulo `outcomes`
   cableado con controllers que compilan; el servidor arranca.
2. **MVP = US1 + US2** (commit 2): la orden de punta a punta con correlación, idempotencia
   atómica y aislamiento. Con esto el ledger ya mide.
3. **US3 + US4** (commit 3), **US5** (commit 4): evidencia, devoluciones y redención.
4. **US6** (commit 5): la firma; toca infraestructura y `merchant`, por eso va aparte y
   última entre las historias, con el catálogo probado firmado y sin firma.
5. **Cierre** (commit 6): ADRs aceptadas, guía de agentes, README, quickstart.
