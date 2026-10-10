# Contrato — lo que cambia (044, el puerto de plataforma)

`info.version` `1.16.0`. Todo compatible salvo los campos requeridos nuevos del contenido de los niveles, que
entran por la marca `building` (ADR-003; research R-12). Cada operación está antes en `api-map.yaml` como
`planned`, con `roadmap: platform-port`.

## Operaciones nuevas

### `refreshStockAndPrice` — `POST /v1/catalog/stock-and-price`

- Consumidor `platform`, tag nuevo `refresh` (research R-12); `platformKey` + firma como el resto del `push`;
  capacidad `catalog:write`.
- Cuerpo: `{ items: StockAndPriceItem[] }`, 1 a 1000, `additionalProperties: false`;
  `StockAndPriceItem = { variantId, available, price, observedAt }`.
- `200`: `{ applied, repeated, superseded, unknown }`, cada uno la lista de `variantId`. Siempre `200`: el resultado
  por ítem ya dice qué pasó, y repetir el pedido da `repeated` donde antes dio `applied`.
- `x-invariants`: `stock-and-price-duplicate-variant-id` (422), `stock-captured-in-future` (422).
- `409 sync-mode-not-configured` si el flujo `stockAndPrice` del merchant no está en `push`.
- Errores: los del `push` (`400`, `401`, `403`, `422`, `503`).

### `notifyPlatformChange` — `POST /v1/platform-notices`

- Consumidor nuevo `notifier`, tag `notices`, esquema `noticeKey` (`X-OPE-Notice-Key`), sin firma; capacidad
  `notices:write` (research R-06).
- Cuerpo: `{ flow: "orders" | "returns", reference, state? }`, `additionalProperties: false`. `reference` con el
  patrón de `OrderId`; `state` texto corto (≤ 64), sólo se registra.
- `202`: `{ flow, reference, receivedAt }`. La descripción dice que lo que se registra sale de la lectura, nunca del
  aviso, y que un aviso repetido mientras está pendiente es uno.
- `409 sync-mode-not-configured` si el flujo no está en `subscribe`.
- `401` sin clave o con una que no es de aviso; el merchant con el interruptor apagado o desactivado, lo mismo que
  hoy el `push`.

### `rotateNoticeKey` — `POST /v1/admin/merchants/{merchantId}/notice-keys`

Igual que `rotatePlatformKey`: `credentials:rotate`, auditada, la clave en claro sólo en la respuesta, dos vigentes.

### `getMerchantPlatformSync` — `GET /v1/admin/merchants/{merchantId}/platform-sync`

- `merchants:read`; respeta el alcance del operador (`403` sin revelar si existe).
- `200`: `{ platform, flows: { catalog, stockAndPrice, orders, returns } }`; cada flujo
  `{ mode, lastRunAt?, lastOkAt?, lastOutcome?, pendingNotices? }`. Lo ausente es «nunca corrió», no `null`.

## Lo que cambia en lo que existe

- **`upsertCatalogSnapshot`, `notifyOrder`, `notifyReturn`**: ganan la respuesta `409 sync-mode-not-configured`
  (el `409` ya existe; se agrega el tipo a su descripción y un ejemplo). Agregar un tipo de problema es compatible.
- **`SyncMode`**: la descripción dice qué ejecuta cada modo y que `subscribe` existe sólo para órdenes y
  devoluciones.
- **`TreatmentDefaultsContent`** y **`MerchantConfigurationDeclared`**: `platform`, `orderConfirmation`, `pull`,
  `notices` (data-model). Requeridos en el contenido de los defaults; opcionales en lo declarado por el merchant.
- **El contenido de plataforma**: `platformSync.tickMs`, requerido.
- **`CatalogSummary`** no cambia: la foto sigue respondiendo lo mismo.

## Catálogos

- `problem-types.yaml`: `sync-mode-not-configured` (409), `stock-captured-in-future` (422),
  `stock-and-price-duplicate-variant-id` (422).
- `api-map.yaml`: las cuatro operaciones; el consumidor `notifier` (`noticeKey`, tag `notices`,
  `[notices:write]`); el consumidor `platform` gana el tag `refresh`. `CONSUMER_CAPABILITIES` replica los dos.
- `docs/dominio/`: **aviso** (`notice`), **fuente de plataforma** (`platform source`), **regla de confirmación**
  (`order confirmation`), **refresco de stock y precio** (`stock and price refresh`), antes de escribirlos en el
  contrato (ADR-008). `estrategia-de-sincronizacion.md` deja de decir que `pull` y `subscribe` no cambian nada.

## Lo que el servidor hace con cada una

Las cuatro del `push` (foto, refresco, orden, devolución) pasan por el decorador del modo (R-08) antes del caso
de uso. El aviso pasa por el mismo chequeo con el modo `subscribe`, entra a la cola y lo procesa el planificador
(R-06). Las dos de `admin` son como las demás de su consumidor.
