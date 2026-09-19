# Research — Feature 013: outcomes (órdenes, devoluciones y corroboración)

Evidencia y decisiones de diseño. Cada R cita lo verificado en el código o en los documentos.

## R-01 Qué hay hoy y dónde entra la 013 (verificado en el código)

- **Contrato**: `contracts/api-map.yaml` ya declara las tres operaciones como `planned` con
  consumidor, tag, capacidades y fuente (`corroborateOrder` → `sdk`/`ingest`/
  `orders:corroborate`, 02 §5.1; `notifyOrder` → `platform`/`outcomes`/`orders:write`, 02
  §5.2; `notifyReturn` → `platform`/`outcomes`/`returns:write`, 02 §5.4). `CONSUMER_CAPABILITIES`
  (`http/security/capabilities.ts`) ya las replica. `platformKey` está en la raíz desde la 010.
- **Forma de una operación de outcomes**: `contracts/paths/catalog.yaml`: `x-idempotency
{ key, first: "201", repeat: "200" }`, `409` por `Conflict.yaml`, `x-invariants` con tipo
  propio y `422` con respuesta propia (`CatalogUnprocessable.yaml`). La regla
  `ope-outcomes-idempotency` exige la clave como propiedad requerida del body y dos 2xx
  distintos. `exposures.yaml` declara `503` por `ServiceUnavailable.yaml` (`Retry-After`).
- **Idempotencia del catálogo**: `UpsertCatalogSnapshotUseCase` compara con
  `CatalogSnapshot.sameContentAs` (texto canónico del contenido del dominio, no del JSON) y
  devuelve `IdempotencyConflict` del kernel; el controller mapea `outcome: created | repeated`
  a `201 | 200`. El store del catálogo no degrada (no es ledger): la 013 sí usa ledgers con
  `Result<…, LedgerUnavailable>` (ADR-021) y responde `503` como la exposición.
- **Seguridad**: `makePlatformKeySecurity(resolver)` recibe `SecurityRequest { headers }`;
  openapi-backend invoca los security handlers antes de validar el body (`registerSecurity`
  en `infrastructure/http/build-server.ts`), y les pasa además el `FastifyRequest`
  (`handleRequest(…, request, reply)`), del que se puede leer el cuerpo crudo si el parser lo
  conserva. Fastify parsea JSON antes de despachar (`request.body`); hoy no se conserva el
  crudo.
- **Merchant**: `Merchant.of` valida `platformKeys` (≤ 2, no vacías, distintas de las de
  ingesta; `PlatformKeyCollision`); `config.ts` parsea `merchants[i].platformKeys`. No hay
  secretos de firma.
- **Ledger**: `DecisionLedger { record, find(merchantId, decisionId) }` en memoria con clave
  `merchant/decision`; **no hay consulta por sesión**. Cada `Decision` lleva `sessionId`,
  `visitorId`, `experiment? { experimentId, arm }` e `intervention? { incentive? }`: la
  sesión conocida y su asignación se derivan de las decisiones, sin pasar por
  `AssignmentLedger` (que es por visitante y experimento). `ExposureLedger` idem por decisión.
- **Dinero**: `Money` (kernel) con `of`/`rehydrate`, `amount` decimal en texto y `currency`
  ISO 4217; `contracts/components/schemas/Money.yaml`.
- **Degradación probada**: `tests/helpers/unavailable-ledgers.ts` (`unavailable*Ledger`,
  `flakyLedger`); la 013 agrega los suyos.
- **Marcadores**: `Incentive.yaml` lleva el PROPUESTO de la redención; `platformKey.yaml`
  dice "PROPOSED" (en inglés, no lo cuenta `check:markers`) sobre la firma HMAC: se cierra.

## R-02 Módulo `outcomes` y dependencias

**Decisión**: un módulo nuevo `outcomes` en dominio y aplicación, `CONTEXT_MAP`:
`outcomes: [shared-kernel, ledger]`. Dominio: `ids.ts` (`OrderId`), `order.ts` (`Order`,
`OrderItem`), `return.ts` (`Return`), `corroboration.ts` (tipo), `correlation.ts`
(`Correlation`, `IncentiveRedemption`), `errors.ts`. Aplicación: casos de uso `NotifyOrder`,
`CorroborateOrder`, `NotifyReturn`; puertos `OrderLedger`, `CorroborationLedger`.

**Rationale**: los outcomes son una autoridad de entrada distinta del ledger de decisiones
(constitución I: un módulo por autoridad); necesitan del `ledger` sólo la consulta de sesión
(`DecisionLedger.bySession`) y `LedgerUnavailable`. No dependen de `experiment`: la
asignación viaja en la decisión (`DecisionFacts.experiment`). El módulo `ledger` conserva
decisiones y exposiciones; los puertos de órdenes los define quien los usa, como
`AssignmentLedger` vive en `experiment`.

**Alternativas**: (a) meter `Order` en `domain/ledger`: mezcla la autoridad de entrada de la
plataforma con la de decisiones y hace crecer `ledger` sin límite; (b) depender de
`experiment` para la asignación: innecesario, la decisión ya la registra.

## R-03 Correlación (mecanismo A) y sesión conocida

**Decisión**: `DecisionLedger` gana `bySession(merchantId, sessionId): Promise<readonly
Decision[]>` (memoria: índice secundario `merchant/session`). Una sesión es **conocida** si
tiene al menos una decisión (cualquier `outcome`, incluidos `NO_OP`). `Correlation.of({
sessionId, decisions })` (dominio `outcomes`, pura) devuelve `undefined` sin decisiones o `{
sessionId, visitorId, experiment? }` tomando `experiment` de la última decisión que lo tenga.
La orden se construye **con** la correlación antes de registrarse y es inmutable: una
repetición no la reevalúa (`repeat` devuelve el registro original).

**Rationale**: 02 §5.2 y 01 §5: sólo la plataforma establece el vínculo, y el ledger sólo lo
verifica contra lo que ya sabe. La sesión "conocida" es exactamente "OPE la vio decidir".
Inmutabilidad: 01 §6 (una orden ya procesada no se reprocesa) y FR-004.

**Alternativas**: `AssignmentLedger.find` por visitante: exige conocer el `visitorId`, que
no viaja en la orden; reconsiderar la correlación en repeticiones: viola FR-004 y abre una
ventana de inconsistencia (mismo `orderId`, dos estados).

## R-04 Idempotencia atómica y comparación canónica

**Decisión**: `OrderLedger.record(order)` devuelve `Result<OrderRecording, LedgerUnavailable>`
con `OrderRecording = { outcome: "recorded" | "repeated" | "conflict"; order }` (la
existente en `repeated`/`conflict`); la comparación es `Order.sameContentAs(other)` sobre
**lo que la plataforma envió** (`orderId`, total, ítems ordenados por SKU, `confirmedAt`,
`sessionId`, incentivo declarado), no sobre lo derivado (correlación, redención,
`receivedAt`). El gateway en memoria decide dentro de una sección síncrona: dos
notificaciones simultáneas producen un registro. Igual para `recordReturn`.

**Rationale**: 01 §6 ("sin operación asíncrona intermedia entre el chequeo y el registro") se
cumple poniendo la decisión en el puerto, que es donde vivirá la transacción cuando llegue
Postgres (017: `INSERT … ON CONFLICT`). Comparar el dominio y no el JSON hace la igualdad
independiente del orden de claves y del formato (FR-021), como el catálogo.

**Alternativas**: chequeo `find` + `record` en el caso de uso, como el catálogo: dos `await`
entre chequeo y escritura; canonicalizar el JSON crudo: acopla al transporte y no distingue
`"5.00"` de `"5.0"` como lo hace `Money` (patrón), ni ítems reordenados.

## R-05 Corroboración (mecanismo B)

**Decisión**: `Corroboration` es un tipo sin reglas (ADR-024): `merchantId`, `orderId`,
`sessionId`, `visitorId`, `confirmedAt` (navegador), `receivedAt`. `CorroborationLedger.record`
es idempotente por `merchant/orderId/sessionId` (la primera gana, devuelve `recorded |
repeated`); `find(merchantId, orderId)`. El vínculo con la orden es **por identidad**
(`merchantId`, `orderId`): no se copia estado entre ledgers; quien lee (016) une por clave, y
`NotifyOrderUseCase` registra en el log si al recibir la orden ya existía corroboración.
Respuesta `202` siempre; `503` con `Retry-After` si el ledger no está.

**Rationale**: 02 §5.1: B es corroborante y disparador, nunca autoridad; no debe poder cambiar
una orden. Un vínculo materializado obligaría a mutar la orden (inmutable) o la corroboración
según el orden de llegada.

## R-06 Devoluciones

**Decisión**: `Return.of({ order, returnedAt, items? })` valida ítems ⊆ ítems de la orden por
SKU y cantidad ≤ la comprada (`return-items-not-in-order`); `OrderLedger.recordReturn(merchantId,
orderId, ret)` → `recorded | repeated | conflict | unknown` atómico. La orden devuelta conserva
`correlation` y `redemption`; `status()` sigue diciendo atribuida/pendiente y `returned`
lleva la devolución. Una sola devolución por orden (FR-038); ítems informativos: la orden
entera es `RETURNED` (03 §4.7 mide calidad de compra por orden).

**Alternativas**: devoluciones parciales acumulativas con `returnId`: fuera del MVP (spec);
`RETURNED` como estado que reemplaza a la correlación: perdería el brazo para la 016.

## R-07 Redención del incentivo

**Decisión**: la orden puede declarar `incentive { kind: "percent", value }` (mismo esquema
`Incentive.yaml`). `IncentiveRedemption.of({ declared?, granted })` con `granted` = los
incentivos de las decisiones `INTERVENE` de la sesión correlacionada: `matched` (declarado =
concedido), `mismatched` (distintos), `not-applied` (concedido, no declarado), `not-granted`
(declarado, sin concesión en la sesión), `unverifiable` (declarado, orden sin correlación);
sin declarado ni concedido no hay redención. Nunca cambia la respuesta ni rechaza.
`Incentive.yaml` cierra su PROPUESTO: la emisión del cupón y su configuración son de la 014.

**Rationale**: FR-040–042; la cifra económica (016) necesita saber cuánto margen se gastó, y
una discrepancia es un dato de integración, no una venta menos.

## R-08 Firma HMAC de la plataforma

**Decisión** (ADR-029): headers `X-OPE-Timestamp` (segundos Unix, entero) y `X-OPE-Signature`
(`v1=<hex>`), `hex = HMAC-SHA256(secret, "<timestamp>.<cuerpo crudo en bytes>")`; ventana
±300 s (`application/merchant/policies/signature-window.ts`); uno o dos secretos por merchant
(`merchants[i].platformSecrets`, rotación), distintos de las claves; comparación en tiempo
constante. Con secreto configurado la firma es obligatoria en **toda** operación de
`platformKey` (órdenes, devoluciones, catálogo); sin secreto, sólo la clave (compatibilidad
con la 010). Errores `signature-missing` (falta header), `signature-invalid` (no coincide con
ningún secreto o formato inválido), `signature-expired` (fuera de ventana), todos `401`.

**Dónde**: dominio `merchant`: `Merchant.platformSecrets`, `requiresSignature()`,
`PlatformSignature` (valor: parsea `v1=<hex>`, compara en tiempo constante, juzga la ventana)
y errores; aplicación `merchant`: puerto `MessageAuthenticator { hmacSha256Hex(secret, message:
Uint8Array): Promise<string> }` y servicio `PlatformSignatureVerifier.verify({ merchant,
timestamp?, signature?, body, now })`; gateway `node-message-authenticator.ts` con
`node:crypto` (permitido en `interface-adapters`, como `randomUUID`); el security handler
`platformKey` verifica después de resolver la clave y antes de que openapi-backend valide el
body. Infraestructura: content-type parser de JSON con `parseAs: "buffer"` que conserva los
bytes en un `WeakMap<FastifyRequest, Buffer>` y delega el parseo a
`app.getDefaultJsonParser` (mismos errores `FST_ERR_CTP_*`); `SecurityRequest` gana
`rawBody?: Uint8Array` y `registerSecurity` lo toma del `FastifyRequest` que openapi-backend
le pasa. Contrato: dos parámetros de header reutilizables (`contracts/components/parameters/`)
referenciados por las tres operaciones de plataforma y una regla Spectral
`ope-platform-signature-headers` (toda operación con `platformKey` los declara) con su
fixture; `platformKey.yaml` describe el esquema de firma. Un JSON sintácticamente inválido
falla `400` antes que la firma (Fastify parsea antes de despachar): no filtra nada y no
cambia el resultado para un remitente legítimo.

**Rationale**: ADR-020 §1 y ADR-025 §5 dejaron decidido que entra aquí; firmar
`timestamp.cuerpo` liga la ventana a la firma (un replay fuera de ventana no puede
"refrescar" el timestamp sin volver a firmar); bytes crudos y no una forma canónica para que
el merchant firme exactamente lo que envía (Stripe, GitHub, Shopify hacen lo mismo).

**Alternativas**: firma sobre JSON canonicalizado: obliga al merchant a implementar la
canonicalización; un solo header `t=…,v1=…`: equivalente, dos headers son más simples de
declarar en OpenAPI; `Authorization: HMAC …`: choca con `apiKey` en header.

## R-09 Contrato

- Versión `1.1.0 → 1.2.0` (tres operaciones nuevas, compatibles).
- `paths/orders.yaml` (`POST /v1/orders`), `paths/order-corroborations.yaml` (`POST
/v1/orders/corroborations`), `paths/returns.yaml` (`POST /v1/returns`).
- Esquemas: `Order`, `OrderItem`, `OrderId`, `OrderResult` (`orderId`, `status`, `receivedAt`),
  `OrderStatus` (`ATTRIBUTED_ORDER | PENDING_CORRELATION`), `OrderCorroboration`,
  `CorroborationResult` (`orderId`, `receivedAt`), `Return`, `ReturnItem`, `ReturnResult`
  (`orderId`, `status: RETURNED`, `orderStatus`, `receivedAt`). Respuestas `OrderUnprocessable`,
  `ReturnUnprocessable`; parámetros `X-OPE-Timestamp`, `X-OPE-Signature`.
- `x-invariants`: `duplicate-order-item` (schema `Order`), `order-confirmed-in-future`
  (schema), `order-unknown` (operación `notifyReturn`), `return-items-not-in-order`
  (operación); `idempotency-conflict` por `409` (ya en el catálogo).
- Ejemplos: orden atribuida, corroboración, devolución; `422` nombra la invariante.
- Sin `merchantId`, sin PII (`noPii` sobre los esquemas nuevos: `sku`, `quantity`, `total`,
  `orderId` no están en la lista).

## R-10 Configuración

`merchants[i].platformSecrets?: string[]` (1–2, no vacíos, distintos de `ingestKeys` y
`platformKeys`), parseado en `config.ts` y validado por `Merchant.of`
(`invalid-platform-secret`, 500 en el catálogo como los demás errores de configuración).
`config/dev-merchants.json` gana un secreto de desarrollo; `tests/helpers/test-app.ts`: el
merchant B con secreto y A sin él, para probar ambas ramas y el catálogo sin firma.

## R-11 Verificación documental del puerto (03 §4.13)

- **VTEX**: el storefront puede adjuntar información propia al `orderForm` en `customData`
  (apps configuradas con "Update orderForm configuration"; valores con "Set single/multiple
  custom field value"); persiste en la orden y se recupera con `GET
/api/oms/pvt/orders/{orderId}` (`customData`). Las notificaciones de cambio de estado salen
  por **Orders Hook** (`POST /api/orders/hook/config`, filtro por estados; payload con
  `OrderId` y estado) o por **Feed v3** (polling). Conclusión: el mecanismo A es posible en
  VTEX: el adaptador escucha el hook en `invoiced`/`payment-approved`, consulta la orden,
  toma `customData.ope.sessionId` y llama a `notifyOrder`. Fuentes:
  developers.vtex.com "Add and handle custom information in the order", "Orders overview"
  (Feed v3 y Hook), "orderForm fields".
- **Magento 2** (merchant piloto): no hay webhooks de orden nativos en Open Source; el
  adaptador es un módulo con un observer de `sales_order_place_after` /
  `sales_order_save_after` que lee un atributo propio de la orden y llama a `notifyOrder`. El
  identificador se propaga con un `extension_attribute` en el quote copiado a la orden por
  `fieldset.xml` (patrón documentado en la comunidad y por extensiones de atributos de
  orden). Conclusión: posible; requiere la "intervención chica pero real" del merchant que 02
  §5.1 anticipa. Devoluciones: `sales_order_creditmemo_save_after` (nota de crédito) como
  señal de devolución; si el merchant procesa cambios en local sin nota de crédito, no hay
  registro (03 §7, PROPUESTO de la spec).
- El puerto de OPE (`notifyOrder`/`notifyReturn` con `sessionId` opcional y cuerpo acotado)
  tiene contraparte real en ambas plataformas; ninguna exige cambiar su forma.

## R-12 Rendimiento

Órdenes y devoluciones no están en el camino crítico de decisión (constitución IV); una
prueba de latencia informativa (`tests/integration/outcomes-latency.test.ts`, p95 ≤ 50 ms
con `inject`, excluida de la configuración de mutación como las demás de latencia) cubre
SC-006. La verificación HMAC es un `createHmac` por request sobre cuerpos de pocos KB.
