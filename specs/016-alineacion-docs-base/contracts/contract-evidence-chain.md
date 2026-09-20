# Contrato: cadena de evidencia y `locale` (R-04, R-05)

## `info.version`, marca y rutas

- `contracts/openapi.yaml`: `info.version: 1.3.0` e `info.x-stability: building`; las rutas siguen en `/v1/` (decisión del dueño, 2026-09-20).
- `contract:diff` contra `main` (1.2.0): reporta las rupturas de oasdiff y termina con "Incompatible change accepted: the contract is building (info.x-stability: building, 1.3.0); remove the mark before the first pilot.", exit 0. Sin la marca: "incompatible changes without a major version bump", exit 1.
- `release-check`: "warning: the contract is marked building (info.x-stability) …", exit 0.

## Esquemas

`contracts/components/schemas/OrderStatus.yaml`:

```yaml
type: string
description: |
  Where the order stands in the evidence chain (01 §5): confirmed by the platform
  (`VERIFIED_ORDER`), confirmed and verifiably correlated with an OPE session
  (`ATTRIBUTED_ORDER`), or returned (`RETURNED`). Never an arm nor an experiment.
enum: [VERIFIED_ORDER, ATTRIBUTED_ORDER, RETURNED]
```

`contracts/components/schemas/Correlation.yaml` (nuevo):

```yaml
type: string
description: |
  Whether OPE could link the order to one of its sessions (mechanism A, 02 §5.2):
  `ATTRIBUTED`, or `PENDING_CORRELATION`, an explicit state of not knowing (01 §5.2) that
  is never completed by inference.
enum: [PENDING_CORRELATION, ATTRIBUTED]
```

`OrderResult.yaml`: `required: [orderId, status, correlation, receivedAt]`, `correlation: { $ref: ./Correlation.yaml }`.
`ReturnResult.yaml`: `required: [orderId, status, correlation, receivedAt]`; `status.enum: [RETURNED]`; `orderStatus` desaparece.

Ejemplos de `paths/orders.yaml` y `paths/returns.yaml` con el vocabulario nuevo (201 `VERIFIED_ORDER` + `PENDING_CORRELATION`; 201 `ATTRIBUTED_ORDER` + `ATTRIBUTED`; devolución `RETURNED` + la correlación).

`PageContext.yaml`:

```yaml
locale:
  type: string
  description: |
    Language of the page as the SDK reads it (`<html lang>`, the platform's store view), a
    BCP 47 tag such as `es-AR` or `en`. Context of the interaction, not personal data (01 §10.2);
    the message catalogue will use it to pick the text. Optional: without it the merchant's
    default applies once configured.
  pattern: "^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$"
  maxLength: 35
```

## Glosario

Notas nuevas: `docs/dominio/estrategia-de-sincronizacion.md` (fuente `mvp:02-integracion-ecommerce.md#6` + evaluación), `docs/dominio/locale.md` (fuente `mvp:01-arquitectura-mvp.md#3.1.1`). Notas que cambian: `orden-verificada.md`, `orden-atribuida.md`, `correlacion-pendiente.md` (dos ejes: `status` y `correlation`), `orden.md` si cita `orderStatus`.

## Código

- `src/domain/outcomes/order.ts`: `OrderStatus`, `CorrelationStatus`, `status()`, `correlationStatus()`.
- Controllers `notify-order.ts`, `notify-return.ts`: `status` + `correlation`.
- `src/domain/ingestion/event.ts`: `PageContext.locale?`; `event-batch.ts` `ProductFocus.locale?`; `src/domain/ledger/decision.ts` `DecisionRecord.locale?`; `decision.service.ts` lo copia del foco.
- Tipos generados: `npm run contract:bundle && npm run contract:types`.
