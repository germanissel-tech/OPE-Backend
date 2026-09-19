# Implementation Plan: Outcomes — órdenes, devoluciones y corroboración desde el navegador

**Branch**: `013-outcomes-ordenes-y-devoluciones` | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/013-outcomes-ordenes-y-devoluciones/spec.md`

## Summary

Completar el plano de medición (01 §5): tres operaciones ya planificadas en el mapa pasan a
construidas. `POST /v1/orders` (plataforma, mecanismo A) registra la orden como venta
verificada, la atribuye **sólo** si trae un `sessionId` que el ledger conoce para ese merchant
(la asignación viaja en las decisiones de la sesión) y, si no, la deja `PENDING_CORRELATION`
sin inferir nada; es idempotente por `orderId` con la decisión first/repeat/conflict tomada
dentro del puerto (01 §6) y comparación canónica sobre el dominio. `POST
/v1/orders/corroborations` (SDK, mecanismo B) guarda evidencia que nunca crea ni atribuye.
`POST /v1/returns` marca `RETURNED` conservando la correlación. La orden puede declarar el
incentivo aplicado y OPE lo cruza con la decisión que lo concedió (cierra el PROPUESTO de la
012). La credencial de plataforma gana la firma HMAC-SHA256 del cuerpo con secreto por merchant
y ventana de 5 minutos (ADR-029), obligatoria por merchant cuando tiene secreto, también para
el catálogo. Módulo nuevo `outcomes` (`[shared-kernel, ledger]`); `DecisionLedger.bySession`;
`Merchant.platformSecrets`; ADR-028 (cadena de evidencia en el ledger) y ADR-029 (firma).

## Technical Context

**Language/Version**: Node.js 22, TypeScript 7 / API 6 (sin cambio)

**Primary Dependencies**: ninguna nueva; `node:crypto` (`createHmac`) en un gateway de
`interface-adapters`, como ya hace `randomUUID`

**Storage**: en memoria: `memoryOrderLedger` (clave `merchant/orderId`, `record` y
`recordReturn` atómicos), `memoryCorroborationLedger` (`merchant/orderId/sessionId`);
`memoryDecisionLedger` gana índice `merchant/sessionId`; secretos de firma desde configuración

**Testing**: Vitest (dominio: `Order`, `Return`, `Correlation`, `IncentiveRedemption`,
`PlatformSignature`, `Merchant` por tabla; aplicación: tres casos de uso y el verificador de
firma con dobles; gateways: atomicidad e índices; integración: historias 1–6 con
`fastify.inject`, aislamiento, latencia informativa; reglas del contrato con fixtures nuevos),
réplicas (tipos de problema, capacidades), `test:mutation`, `test:contract`

**Target Platform**: sin cambio · **Project Type**: web-service contract-first

**Performance Goals**: SC-006 — p95 ≤ 50 ms para `notifyOrder` (fuera del camino crítico)

**Constraints**: cuerpo de la orden acotado por diseño y `additionalProperties: false` (SC-003);
respuestas sin brazo ni experimento (FR-013); la firma se verifica antes de validar el body y
antes de cualquier caso de uso (FR-051); sin `await` entre chequeo de existencia y escritura
(FR-022: la decisión vive en el puerto); contrato compatible (`1.1.0 → 1.2.0`)

**Scale/Scope**: 1 módulo nuevo (dominio + aplicación); 3 operaciones; 10 esquemas, 2
parámetros, 2 respuestas `422`; 8 tipos de problema; 1 regla Spectral nueva
(`ope-platform-signature-headers`); `DecisionLedger` + 1 consulta; `merchant` + secretos, valor
`PlatformSignature`, verificador y puerto; infraestructura: parser JSON que conserva bytes;
7 notas de glosario; ADR-028, ADR-029; script `scripts/sign-platform-request.mjs`

## Constitution Check

| Gate                                                 | ¿Aplica? | Cómo se cumple                                                                                                                                                                                                                                         |
| ---------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Separación de autoridades                         | **Sí**   | `outcomes` es la autoridad de entrada de la plataforma y del SDK sobre compras; el `ledger` sigue siendo el de decisiones y exposiciones; la correlación es una regla pura del dominio (`Correlation.of`), no un servicio con heurísticas (R-02, R-03) |
| II. Fail-closed                                      | **Sí**   | Sin `sessionId` conocido ⇒ `PENDING_CORRELATION` (nunca C); secreto configurado ⇒ sin firma válida nada se lee; ítems fuera de la orden ⇒ `422`; orden desconocida ⇒ `422`                                                                             |
| III. Misma inferencia para ambos brazos              | **Sí**   | La correlación no mira el brazo: CONTROL y TREATMENT se atribuyen igual; el brazo sólo se guarda para la 016                                                                                                                                           |
| IV. Camino crítico sin red                           | **Sí**   | Órdenes, devoluciones y corroboraciones no tocan `ingestEvents`; la única I/O nueva es en memoria; latencia probada (R-12)                                                                                                                             |
| V. Aislamiento por merchant                          | **Sí**   | Toda clave de ledger es `merchantId/…`; `bySession` es por merchant; `orderId` no es global (FR-014); `isolation.test.ts` ampliada (FR-073)                                                                                                            |
| VI. Contrato primero / `merchantId` nunca en request | **Sí**   | Tres operaciones desde el mapa; `merchantId` de la credencial; `contract:check` verde; `1.2.0`                                                                                                                                                         |
| VII. Sin datos personales                            | **Sí**   | `Order` = `orderId`, `total`, `items[sku, quantity]`, `confirmedAt`, `sessionId?`, `incentive?` (01 §10.3); `additionalProperties: false`; `noPii` sobre los esquemas nuevos (SC-003)                                                                  |
| VIII. Cero LLM                                       | **Sí**   | Nada nuevo                                                                                                                                                                                                                                             |
| IX. Trazabilidad                                     | **Sí**   | Cada orden guarda correlación (sesión, visitante, experimento, brazo), redención y devolución; corroboraciones unidas por clave; ADR-028                                                                                                               |
| Mapa del contrato / superficie HTTP                  | **Sí**   | `planned → built` para las tres; capacidades, tags y consumidores como el mapa los fija; `x-idempotency` en las dos de outcomes (`ope-outcomes-idempotency`)                                                                                           |
| Sustantivo nuevo (glosario)                          | **Sí**   | `orden-verificada`, `orden-atribuida`, `correlacion-pendiente`, `corroboracion`, `devolucion`, `mecanismo-de-correlacion`, `firma-de-plataforma`                                                                                                       |
| `x-invariants`                                       | **Sí**   | `duplicate-order-item`, `order-confirmed-in-future` (schema `Order`); `order-unknown`, `return-items-not-in-order` (operación `notifyReturn`); pruebas `[invariant:<slug>]`                                                                            |
| Toca `src/` → dependencias                           | **Sí**   | `outcomes: [shared-kernel, ledger]`; `merchant` sin dependencias nuevas; `node:crypto` sólo en `gateways/merchant/`; `arch` en 0                                                                                                                       |
| ADR-023 / ADR-024                                    | **Sí**   | `Order`, `Return` clases con `of`/`rehydrate`; `Corroboration` tipo; `Correlation`/`IncentiveRedemption` fábricas puras; errores en `errors.ts` y el catálogo; ≤ 6 dependencias por caso de uso; autenticación = servicio, no caso de uso              |
| ADR-020 (idempotencia, consumidores)                 | **Sí**   | Clave `orderId` requerida; `201`/`200`/`409`; `outcomes` ⇒ `platformKey`; `ingest` ⇒ `ingestKey` con Origin                                                                                                                                            |
| ADR-021 (ledger)                                     | **Sí**   | Todo `record` devuelve `Result<…, LedgerUnavailable>`; `503` con `Retry-After`; fakes en `unavailable-ledgers.ts`                                                                                                                                      |

**Resultado pre-Phase 0**: PASA. **Post-Phase 1**: PASA (ver abajo).

## Project Structure

### Documentation (this feature)

```text
specs/013-outcomes-ordenes-y-devoluciones/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── orders.yaml                     # borrador de contracts/paths/orders.yaml
│   ├── order-corroborations.yaml       # borrador de contracts/paths/order-corroborations.yaml
│   ├── returns.yaml                    # borrador de contracts/paths/returns.yaml
│   ├── schemas.yaml                    # borradores de components/schemas y parameters
│   ├── problem-types.additions.yaml
│   ├── platform-signature.md           # lo que implementa el adaptador del merchant
│   └── merchant.config.md              # platformSecrets en OPE_MERCHANTS
└── tasks.md                            # /speckit-tasks
```

### Source Code (repository root)

```text
contracts/
├── openapi.yaml                                   # 1.2.0; paths orders, orders/corroborations, returns
├── api-map.yaml                                   # tres operaciones built
├── paths/{orders,order-corroborations,returns}.yaml
├── components/schemas/{OrderId,OrderItem,Order,OrderStatus,OrderResult,OrderCorroboration,
│                       CorroborationResult,Return,ReturnResult}.yaml
├── components/parameters/{X-OPE-Timestamp,X-OPE-Signature}.yaml
├── components/responses/{OrderUnprocessable,ReturnUnprocessable}.yaml
├── components/securitySchemes/platformKey.yaml    # describe la firma; cierra el "PROPOSED"
├── components/schemas/Incentive.yaml              # cierra el PROPUESTO de la redención
├── examples/{order-attributed,order-pending,order-corroboration,order-return}.yaml
├── problem-types.yaml                             # +8
├── .spectral.yaml + rules/functions/platformSignatureHeaders.js   # ope-platform-signature-headers
src/domain/
├── outcomes/{ids,order,return,corroboration,correlation,errors,index}.ts
├── merchant/{merchant,platform-signature,errors,index}.ts          # platformSecrets, PlatformSignature
src/application/
├── outcomes/ports/{order-ledger,corroboration-ledger}.ts
├── outcomes/use-cases/{notify-order,corroborate-order,notify-return}.use-case.ts
├── outcomes/index.ts
├── ledger/ports/decision-ledger.ts                                  # +bySession
├── merchant/ports/message-authenticator.ts
├── merchant/policies/signature-window.ts
├── merchant/services/platform-signature.service.ts
src/interface-adapters/
├── gateways/outcomes/{memory-order-ledger,memory-corroboration-ledger}.ts
├── gateways/ledger/memory-decision-ledger.ts                        # índice por sesión
├── gateways/merchant/node-message-authenticator.ts                  # node:crypto
├── http/controllers/outcomes/{notify-order,corroborate-order,notify-return}.ts
├── http/security/platform-key.ts                                    # + firma (rawBody)
├── http/typed.ts                                                    # SecurityRequest.rawBody?
├── http/problem-details.ts                                          # +8
src/infrastructure/http/build-server.ts                              # parser JSON que conserva bytes
src/composition/
├── modules/outcomes.ts                                              # OutcomesPorts, memoryOutcomesPorts
├── modules/merchant.ts                                              # verificador de firma en el scheme
├── modules/index.ts, ports.ts, profiles/local.ts, config.ts         # platformSecrets
scripts/sign-platform-request.mjs
config/dev-merchants.json                                            # platformSecrets
docs/adr/{028-cadena-de-evidencia-en-el-ledger,029-firma-de-plataforma}.md
docs/dominio/{orden-verificada,orden-atribuida,correlacion-pendiente,corroboracion,devolucion,
              mecanismo-de-correlacion,firma-de-plataforma}.md
tests/
├── unit/domain/outcomes/{order,return,correlation}.test.ts
├── unit/domain/merchant/{platform-signature,merchant}.test.ts
├── unit/application/outcomes/{notify-order,corroborate-order,notify-return}.test.ts
├── unit/application/merchant/platform-signature.service.test.ts
├── unit/gateways/{memory-order-ledger,memory-corroboration-ledger,memory-decision-ledger}.test.ts
├── integration/{orders,order-corroborations,returns,platform-signature,outcomes-latency}.test.ts
├── integration/isolation.test.ts (+), helpers/{test-app,unavailable-ledgers,sign}.ts
├── contract-rules/fixtures/ (+ ope-platform-signature-headers), tests/lint fixtures si aplica
└── architecture/fixtures (+ outcomes)
```

**Structure Decision**: anillos y módulos de ADR-013; `outcomes` como módulo nuevo en dominio y
aplicación con sus puertos; la firma en `merchant` (dominio: valor y errores; aplicación:
servicio y puerto; gateway: `node:crypto`; infraestructura: bytes crudos). `MODULES` y
`CONTEXT_MAP` ganan una línea cada uno.

### Comandos npm (cambios)

Ninguno nuevo (`scripts/sign-platform-request.mjs` se invoca con `node`; queda documentado en
`README.md` y en el quickstart).

## Diseño de los puntos no triviales

- **Sesión conocida y atribución** (R-03): `DecisionLedger.bySession` devuelve las decisiones
  de la sesión; `Correlation.of` es pura; la orden nace con su correlación y no la reevalúa.
  Sin experimento en las decisiones ⇒ atribuida sin grupo (spec, historia 1.4).
- **Atomicidad** (R-04): el puerto decide `recorded | repeated | conflict` con
  `Order.sameContentAs`; el caso de uso no hace `find` antes de `record`. `recordReturn`
  igual, más `unknown`.
- **Corroboración** (R-05): registro independiente, unido por `merchantId/orderId`; el caso de
  uso de la orden consulta `corroborations.find` sólo para el log (`corroborated`).
- **Redención** (R-07): `IncentiveRedemption.of` con la última decisión `INTERVENE` con
  incentivo de la sesión; cinco veredictos; nunca cambia la respuesta.
- **Firma** (R-08): `PlatformSignatureVerifier` en el security handler de `platformKey`,
  después de resolver el merchant y sólo si `merchant.requiresSignature()`; el parser JSON de
  Fastify conserva los bytes (`WeakMap<FastifyRequest, Buffer>`) y `registerSecurity` los
  entrega como `rawBody`; mensaje `"<ts>.<bytes>"`; comparación en tiempo constante en el
  dominio; ventana ±300 s; dos secretos. Contrato: parámetros de header opcionales en las tres
  operaciones de plataforma + regla Spectral con fixture.
- **Controllers**: `notifyOrder` mapea `created → 201`, `repeated → 200`, errores por
  `toProblem` (`409`, `422`, `503` con `Retry-After` como la exposición); `corroborateOrder`
  `202`; `notifyReturn` `201`/`200`/`422`/`409`/`503`. Ninguna respuesta lleva brazo,
  experimento ni visitante.
- **Commits sugeridos** (uno por fase): (1) `feat(outcomes)`: contrato + dominio + aplicación +
  gateways + controllers + composición + pruebas de historias 1–5; (2) `feat(merchant)`: firma
  HMAC (contrato, dominio, servicio, gateway, infraestructura, script, historia 6); (3)
  `chore(013)`: ADR-028/029 aceptadas, glosario, `CLAUDE.md`, `README.md`, quickstart de cierre.

## Complexity Tracking

| Elemento                                         | Por qué                                                                           | Alternativa rechazada                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Módulo `outcomes` propio                         | constitución I: autoridad de entrada distinta del ledger de decisiones            | `Order` dentro de `ledger`: mezcla autoridades y agranda el módulo sin límite                     |
| Decisión first/repeat/conflict dentro del puerto | 01 §6: sin operación asíncrona entre chequeo y registro                           | `find` + `record` en el caso de uso (como el catálogo): dos `await`, carrera entre notificaciones |
| Bytes crudos en el parser de Fastify             | la firma cubre el cuerpo exacto que envió la plataforma                           | firmar JSON canonicalizado: obliga al merchant a canonicalizar y no cubre lo que realmente envió  |
| Dos ADRs (028 y 029)                             | dos decisiones transversales distintas: cadena de evidencia y firma de plataforma | una sola: mezcla medición con seguridad y dificulta citar cada una                                |
| Firma también sobre el catálogo                  | la firma es de la credencial, no de la operación (spec, historia 6.5)             | sólo órdenes: dejaría al catálogo falsificable con la misma clave                                 |

## Re-evaluación del Constitution Check (post-Phase 1)

Módulo propio para la autoridad de outcomes; correlación sólo por mecanismo A y pura; estados
explícitos de desconocimiento; idempotencia atómica en el puerto con igualdad canónica del
dominio; corroboración como evidencia sin poder de atribución; redención visible sin rechazar;
firma verificada antes del body con secreto por merchant y compatibilidad con la 010; cuerpo
acotado y sin datos del comprador; respuestas sin brazo; aislamiento probado; contrato
compatible. **PASA.**
