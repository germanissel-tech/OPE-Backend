# Data model — Feature 013: outcomes

Entidades, valores y registros; dónde viven y qué reglas tienen (ADR-024: clase si hay
reglas, tipo si no).

## Dominio `outcomes` (`src/domain/outcomes/`)

### `OrderId` (`ids.ts`, tipo marcado)

`asOrderId(text)`. Único **por merchant** (FR-014): toda clave de ledger es
`merchantId/orderId`.

### `OrderItem` (`order.ts`, tipo)

`{ sku: string; quantity: number }`; el contrato garantiza `sku` no vacío y `quantity` entero ≥ 1.

### `Order` (`order.ts`, clase)

| Campo          | Tipo                   | Origen                                               |
| -------------- | ---------------------- | ---------------------------------------------------- |
| `merchantId`   | `MerchantId`           | credencial                                           |
| `orderId`      | `OrderId`              | plataforma                                           |
| `total`        | `Money`                | plataforma                                           |
| `items`        | `readonly OrderItem[]` | plataforma (≥ 1)                                     |
| `confirmedAt`  | `Date`                 | plataforma                                           |
| `sessionId?`   | `SessionId`            | plataforma (lo que el storefront adjuntó a la orden) |
| `declared?`    | `Incentive`            | plataforma (`incentive` aplicado)                    |
| `receivedAt`   | `Date`                 | reloj de OPE                                         |
| `correlation?` | `Correlation`          | derivado al registrar (R-03); nunca después          |
| `redemption?`  | `IncentiveRedemption`  | derivado al registrar (R-07)                         |
| `returned?`    | `Return`               | `recordReturn` (única mutación del registro)         |

- `static of(input): Result<Order, OutcomesError>` — invariantes que el esquema no expresa:
  SKUs sin repetir (`duplicate-order-item`); `confirmedAt` no más de 5 min en el futuro
  respecto de `receivedAt` (`order-confirmed-in-future`, como el catálogo).
- `static rehydrate(record)`.
- `status(): OrderStatus` = `"ATTRIBUTED_ORDER"` si `correlation` existe, si no
  `"PENDING_CORRELATION"`.
- `sameContentAs(other)`: igualdad canónica de **lo enviado**: `orderId`, `total`, ítems
  ordenados por SKU, `confirmedAt`, `sessionId`, `declared`. Ignora `receivedAt`,
  `correlation`, `redemption`, `returned`.
- `withReturn(ret): Order` — el registro devuelto (misma orden, `returned` puesto).
- `contains(item): boolean` — SKU presente con cantidad ≥ la pedida (para `Return.of`).

### `OrderStatus` (`order.ts`, unión)

`"ATTRIBUTED_ORDER" | "PENDING_CORRELATION"`; réplica del `OrderStatus.yaml` del contrato.

### `Correlation` (`correlation.ts`, clase con fábrica pura)

`{ sessionId; visitorId; experiment?: { experimentId; arm } }`.
`static of({ sessionId, decisions: readonly Decision[] }): Correlation | undefined`: sin
decisiones → `undefined` (sesión desconocida); con decisiones → `visitorId` de la primera y
`experiment` de la última que lo tenga.

### `IncentiveRedemption` (`correlation.ts`, clase con fábrica pura)

`{ verdict: RedemptionVerdict; declared?: Incentive; granted?: Incentive; decisionId? }`.
`RedemptionVerdict = "matched" | "mismatched" | "not-applied" | "not-granted" | "unverifiable"`.
`static of({ declared?, correlated: boolean, granted: readonly { decisionId; incentive }[] }):
IncentiveRedemption | undefined`:

| `declared` | correlada | `granted` | veredicto       |
| ---------- | --------- | --------- | --------------- |
| sí         | sí        | igual     | `matched`       |
| sí         | sí        | distinto  | `mismatched`    |
| no         | sí        | alguno    | `not-applied`   |
| sí         | sí        | ninguno   | `not-granted`   |
| sí         | no        | —         | `unverifiable`  |
| no         | —         | ninguno   | (sin redención) |

`granted` toma la **última** decisión `INTERVENE` con incentivo de la sesión.

### `Return` (`return.ts`, clase)

`{ orderId; returnedAt; items?: readonly OrderItem[]; receivedAt }`.
`static of({ order, returnedAt, items?, receivedAt }): Result<Return, ReturnItemsNotInOrder>`:
cada ítem devuelto debe existir en la orden con cantidad ≤ la comprada; SKUs sin repetir.
`sameContentAs(other)`: `returnedAt` e ítems ordenados por SKU.

### `Corroboration` (`corroboration.ts`, tipo)

`{ merchantId; orderId; sessionId; visitorId; confirmedAt; receivedAt }`. Sin reglas.

### `errors.ts`

`DuplicateOrderItem(sku)` → `duplicate-order-item` (422); `OrderConfirmedInFuture` →
`order-confirmed-in-future` (422); `OrderUnknown(orderId)` → `order-unknown` (422);
`ReturnItemsNotInOrder(sku)` → `return-items-not-in-order` (422). `OutcomesError` = unión.

## Dominio `merchant` (ampliación)

- `MerchantInput.platformSecrets?: readonly string[]`; `Merchant.platformSecrets`;
  `requiresSignature(): boolean` (tiene ≥ 1 secreto). Invariante en `of`: 1–2, no vacíos,
  distintos de `ingestKeys` y `platformKeys` → `InvalidPlatformSecret(index)` →
  `invalid-platform-secret` (500, configuración).
- `PlatformSignature` (`platform-signature.ts`, clase): `static parse(header): PlatformSignature
| undefined` (`v1=<64 hex>`); `matches(expectedHex): boolean` en tiempo constante;
  `static inWindow(timestamp: number, now: Date, windowMs): boolean`.
- Errores `SignatureMissing`, `SignatureInvalid`, `SignatureExpired` → `signature-missing`,
  `signature-invalid`, `signature-expired` (401).

## Ledger (ampliación)

- `DecisionLedger.bySession(merchantId, sessionId): Promise<readonly Decision[]>` (memoria:
  índice `merchant/session`, orden de registro).

## Puertos de `outcomes` (`src/application/outcomes/ports/`)

```ts
type OrderRecording = { outcome: "recorded" | "repeated" | "conflict"; order: Order };
type ReturnRecording =
  { outcome: "recorded" | "repeated" | "conflict"; order: Order } | { outcome: "unknown" };
interface OrderLedger {
  record(order: Order): Promise<Result<OrderRecording, LedgerUnavailable>>;
  recordReturn(merchantId, orderId, ret: Return): Promise<Result<ReturnRecording, LedgerUnavailable>>;
  find(merchantId, orderId): Promise<Order | undefined>;
}
interface CorroborationLedger {
  record(c: Corroboration): Promise<Result<"recorded" | "repeated", LedgerUnavailable>>;
  find(merchantId, orderId): Promise<readonly Corroboration[]>;
}
```

`record`/`recordReturn` deciden first/repeat/conflict **dentro** del puerto (R-04).

## Casos de uso (`src/application/outcomes/use-cases/`)

| Caso de uso               | Request                                                                  | Response                                                                                                         | Dependencias                                       |
| ------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `NotifyOrderUseCase`      | `merchantId, orderId, total, items, confirmedAt, sessionId?, incentive?` | `Result<{ order; outcome: "created" \| "repeated" }, OutcomesError \| IdempotencyConflict \| LedgerUnavailable>` | `clock, orders, decisions, corroborations, logger` |
| `CorroborateOrderUseCase` | `merchantId, orderId, sessionId, visitorId, confirmedAt`                 | `Result<{ receivedAt }, LedgerUnavailable>`                                                                      | `clock, corroborations`                            |
| `NotifyReturnUseCase`     | `merchantId, orderId, returnedAt, items?`                                | `Result<{ order; outcome: "created" \| "repeated" }, OutcomesError \| IdempotencyConflict \| LedgerUnavailable>` | `clock, orders`                                    |

`NotifyOrder`: `Order.of` (sin correlación) → si `sessionId`, `decisions.bySession` →
`Correlation.of` y `IncentiveRedemption.of` → `Order` completa → `orders.record` →
`created | repeated | IdempotencyConflict`; log con `status`, `redemption`, `corroborated`.
`NotifyReturn`: `orders.find` → `OrderUnknown` | `Return.of` → `orders.recordReturn` →
`created | repeated | conflict | unknown` (carrera: `unknown` también es `OrderUnknown`).

## Servicios de `merchant` (ampliación)

- Puerto `MessageAuthenticator { hmacSha256Hex(secret: string, message: Uint8Array):
Promise<string> }` (gateway con `node:crypto`).
- `PlatformSignatureVerifier.verify({ merchant, timestamp?, signature?, body: Uint8Array, now })
→ Promise<Result<void, SignatureError>>`; política `SIGNATURE_WINDOW_MS = 5 min`.

## Transiciones

```
(notificación)  ──► VERIFIED_ORDER ──┬── sessionId conocido ──► ATTRIBUTED_ORDER ──┐
                                     └── sin sessionId / desconocido ──► PENDING_CORRELATION ──┤
                                                                                                ▼
(devolución sobre orden registrada) ─────────────────────────────────────────────────────► RETURNED
```

`ATTRIBUTED_ORDER` y `PENDING_CORRELATION` son terminales entre sí (FR-004); `RETURNED`
conserva cuál de los dos era. Corroboración: registro independiente unido por
`merchantId/orderId`.
