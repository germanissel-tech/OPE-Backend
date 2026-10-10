# Data model — fase 1 (044, el puerto de plataforma)

## Lo que entra al núcleo

### Refresco de stock y precio (`catalog`, NUEVO)

| campo        | qué es                                                                   | regla                                                  |
| ------------ | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| `variantId`  | la variante, como en la foto                                             | debe existir en la foto vigente; si no, `unknown`      |
| `available`  | guarda, no claim (ADR-025 §2)                                            | booleano; ninguna cantidad                             |
| `price`      | `Money`                                                                  | como en la foto                                        |
| `observedAt` | el instante del dato: el de la plataforma, o el de la observación de OPE | no futuro más allá de la tolerancia de la foto (`422`) |

Un lote es una lista de ítems, con ids únicos. Cada ítem termina en uno de cuatro resultados: `applied`,
`repeated` (mismo instante, mismo contenido), `superseded` (instante más viejo que el guardado, o que la foto
vigente) o `unknown`. Mismo instante con otro contenido: gana el guardado y el ítem es `superseded` —una plataforma
no corrige un dato sin moverle el instante—.

**Verdad de una variante** (`ProductTruthService`): stock y precio salen del dato más nuevo entre la foto
(`capturedAt`) y el refresco (`observedAt`); su frescura es la edad de ese dato contra `freshness.stockAndPriceMs`.
La frescura del catálogo (existencia, atributos) sigue midiéndose con la foto.

**Almacén**: `stock_and_price(id, merchant_id, variant_id, observed_at, document, created_at, updated_at)`, único
por `(merchant_id, variant_id)`. `replace` de la foto borra los refrescos con `observed_at <= capturedAt`.

## Lo que configura el merchant

En `TreatmentValues` (defaults de tratamiento, que el merchant pisa; constitución XI):

| valor                         | qué es                                                             | default   |
| ----------------------------- | ------------------------------------------------------------------ | --------- |
| `platform`                    | qué fuente usa el merchant: `generic`, `test` (`magento2` después) | `generic` |
| `orderConfirmation.states`    | estados de la plataforma que cuentan como confirmada               | `[]`      |
| `pull.catalogEveryMs`         | cada cuánto se trae la foto                                        | 1 día     |
| `pull.stockAndPriceEveryMs`   | cada cuánto corre un lote                                          | 1 min     |
| `pull.stockAndPriceBatchSize` | variantes por lote                                                 | 200       |
| `pull.ordersEveryMs`          | cada cuánto se piden los cambios de órdenes                        | 2 min     |
| `pull.returnsEveryMs`         | ídem devoluciones                                                  | 15 min    |
| `notices.retryAfterMs`        | espera entre intentos de leer lo avisado                           | 1 min     |
| `notices.maxAttempts`         | intentos antes de descartar el aviso con rastro                    | 10        |

Los números de los defaults son los iniciales del archivo y se revisan con el piloto; no son política en el código.

**Al publicar** (además de lo que ya se juzga): `platform` instalada en el despliegue; cada flujo en `pull` o
`subscribe` soportado por esa fuente (`subscribe` nunca en catálogo ni en stock y precio); con órdenes en `pull` o
`subscribe`, `orderConfirmation.states` no vacío; cadencias y tamaño de lote enteros positivos.

En el nivel de plataforma (`config/platform.json`): `platformSync.tickMs`, cada cuánto el planificador mira qué
venció.

## Lo que guarda el adaptador

### Estado de un flujo (`platform_sync`, NUEVO)

Único por `(merchant_id, flow)`.

| campo         | qué es                                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `cursor`      | `catalog`: nada. `stockAndPrice`: el último `variantId` del lote (orden lexicográfico). `orders`/`returns`: el cursor opaco de la fuente |
| `lastRunAt`   | inicio de la última corrida                                                                                                              |
| `lastOutcome` | `ok` con cuántos ítems, o `failed` con el motivo (sin datos personales)                                                                  |
| `lastOkAt`    | la última corrida sin fallo                                                                                                              |

Un ciclo de stock y precio termina cuando el lote vuelve al principio. El cursor sólo avanza después de depositar
el lote: un reinicio en el medio repite el lote, y la idempotencia por instante y por `orderId` lo absorbe.

### Aviso (`platform_notices`, NUEVO)

| campo        | qué es                                                 |
| ------------ | ------------------------------------------------------ |
| `merchantId` | el de la credencial                                    |
| `flow`       | `orders` o `returns`                                   |
| `reference`  | el id de la orden en la plataforma                     |
| `state`      | el que mandó la plataforma, si mandó; sólo se registra |
| `receivedAt` | cuándo llegó                                           |
| `attempts`   | intentos de lectura hechos                             |
| `nextAt`     | cuándo toca el próximo                                 |

Único por `(merchant_id, flow, reference)` mientras está pendiente: un aviso repetido no agrega otro. Se borra al
completarse o al agotar los intentos (con rastro en el log y en `platform_sync`).

## Credencial

`Merchant` gana la clase `notice` (`kind: "notice"`), con huella SHA-256, dos vigentes como máximo, rotación como la
de plataforma. `findByNoticeKey(fingerprint, now)` en el directorio de merchants.

## Errores

| error                       | módulo                   | problema                       |
| --------------------------- | ------------------------ | ------------------------------ |
| `SyncModeNotConfigured`     | `platform`               | `409 sync-mode-not-configured` |
| `StockCapturedInFuture`     | `catalog`                | `422 stock-captured-in-future` |
| `InvalidConfigurationValue` | `configuration` (existe) | `422`, con la ruta del valor   |

## Módulo

`platform` es un módulo nuevo: `application/platform` (el decorador del modo, el caso de uso del aviso, la lectura
del estado, sus puertos) e `interface-adapters/platform` (la fuente de prueba, el planificador, el procesador de
avisos, los gateways). `CONTEXT_MAP`: `platform: ["shared-kernel", "merchant", "catalog", "outcomes"]`; la
configuración llega por puertos propios, como en el resto de los módulos.
