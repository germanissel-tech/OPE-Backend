# Verificación documental · Magento 2 y VTEX contra el puerto de plataforma

**Fecha**: 2026-10-10 · **Para qué**: es la tarea previa a la feature del puerto de plataforma (hito
`platform-port` de `contracts/api-map.yaml`; `02-integracion-ecommerce.md` §4.13 y §6). Revisa, **sólo contra la
documentación oficial**, que las cuatro operaciones del puerto tengan contraparte real en cada plataforma y en
cada modo, y en especial que se pueda adjuntar y recuperar el identificador de OPE en la orden.

**Qué no es**: no prueba nada contra una tienda. Lo que dice la documentación puede no ser lo que corre en un
merchant concreto; eso lo responden V3 y V4 (`02` §9), con el merchant. Cada afirmación lleva su fuente; las que
son razonamiento propio, sin fuente, dicen **inferido**. Lo que no se pudo leer está en «Lo que no se verificó».

## Contra qué se compara

Lo que hoy entra por `push`, el modo construido, es la vara:

| Operación del puerto | Hoy, por `push`                                                                                   | Lo que necesita                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `fetchCatalog`       | `PUT /v1/catalog`: snapshot completo, productos con variantes, `available` y `price` por variante | La variante exacta (talle + color), sus atributos                                           |
| `fetchStockAndPrice` | Sólo dentro del snapshot                                                                          | Stock real y precio vigente por variante; idealmente refresco parcial con instante por ítem |
| `onOrderConfirmed`   | `POST /v1/orders`: `orderId`, `total`, ítems por `sku`, `confirmedAt`, `sessionId`, incentivo     | La orden confirmada, con el identificador de OPE adjuntado al crearla                       |
| `onReturnRegistered` | `POST /v1/returns`: `orderId`, `returnedAt`, ítems                                                | La devolución vinculada a su orden                                                          |

## Resumen

|                           | Magento 2 (Open Source)                                                                                           | VTEX                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Catálogo                  | `pull`, con filtro «cambiado desde» en el producto                                                                | `pull` por barrido completo; `subscribe` por la notificación al afiliado                                         |
| Stock y precio            | `pull` por SKU, **sin** «cambiado desde» ni instante por ítem; el precio REST **no** es necesariamente el cobrado | `pull` por SKU; refresco parcial por la notificación al afiliado, con su instante, y precio final por simulación |
| Orden confirmada          | `pull` por `updated_at`; sin eventos nativos                                                                      | `subscribe` nativo: Feed v3 o Hook, que avisan y obligan a leer el detalle                                       |
| Devolución                | Nota de crédito (un reembolso, no una devolución física); RMA sólo en Adobe Commerce                              | Factura de entrada (`Input`) en la orden; la app de devoluciones, sólo por `pull`                                |
| Identificador en la orden | **Siempre un módulo** en la tienda del merchant                                                                   | `marketingTags` sin configuración, o `customData` con configuración y código                                     |
| `subscribe`               | No existe en Open Source; Adobe Commerce 2.4.4+ tiene eventos y webhooks                                          | Órdenes sí; catálogo, precio y stock por afiliado; devoluciones no                                               |

**Lo que confirma**: el perfil por defecto de `02` §6 se sostiene. Magento 2 es `pull`, y VTEX es `pull` con
`subscribe` donde publica. Las cuatro operaciones tienen contraparte en las dos plataformas.

**Lo que cambia o agrega al diseño del puerto** (cada punto, **PROPUESTO** para la spec de la feature):

1. **El refresco parcial de stock no se puede pedir «desde T»** en ninguna de las dos por `pull`. En Magento se
   consulta por conjunto de SKUs; en VTEX, por SKU o por la notificación al afiliado. El planificador tiene que
   barrer por lotes, a una cadencia que dependa del tamaño del catálogo.
2. **El instante por ítem no siempre lo da la plataforma.** VTEX lo da (`DateModified` en la notificación);
   Magento no lo da para el stock. Cuando falta, el instante es **el de la observación de OPE**, y el perfil de
   datos se mide con él.
3. **La notificación de orden es un aviso, no la orden.** El Hook de VTEX trae el id y el estado, y el detalle se
   lee aparte. El adaptador de `onOrderConfirmed` es «aviso + lectura» en `subscribe`, y sólo lectura en `pull`.
4. **El Hook de VTEX no firma.** Autentica con encabezados fijos que se configuran en el Hook, no con HMAC. El
   modo `subscribe` necesita su propio autenticador: un secreto por merchant en un encabezado. La firma de
   ADR-029 sigue siendo la del `push`.
5. **Qué es «confirmada» cambia por plataforma** y por merchant (pagada, facturada, pasada la ventana de
   cancelación). Es configuración del merchant, no código (constitución XI).
6. **El precio que cobra Magento no sale de un endpoint.** El precio REST no incluye las reglas de precio de
   catálogo, y una afirmación sobre precio o un incentivo calculado sobre él puede estar mal. Es un riesgo para
   las familias de precio en Magento. En VTEX, el precio calculado y la simulación sí dan el precio final.
7. **En Magento, el mecanismo A siempre exige un módulo** instalado por el merchant: ninguna opción es sólo
   configuración. En VTEX puede ser sólo código del storefront (`marketingTags`). Es la diferencia de fricción
   más grande entre las dos, y va a la conversación comercial.

## Magento 2

Edición de referencia: **Magento Open Source 2.4.x**. Donde Adobe Commerce (paga) difiere, se dice.

### `fetchCatalog` en Magento 2

- **`pull`**: `GET /V1/products` con `searchCriteria` (filtros, `pageSize`, `currentPage`), con filtro por
  `updated_at` (`gt`). [Búsquedas](https://developer.adobe.com/commerce/webapi/rest/use-rest/performing-searches/)
- **Las variantes piden llamadas extra**: `GET /V1/configurable-products/:sku/children` (los productos simples,
  cada uno con su SKU) y `GET /V1/configurable-products/:sku/options/all` (los ejes: talle, color).
  [webapi.xml de ConfigurableProduct](https://github.com/magento/magento2/blob/2.4-develop/app/code/Magento/ConfigurableProduct/etc/webapi.xml)
  Inferido: los hijos también se pueden traer directo por `updated_at` y unirse al padre.

### `fetchStockAndPrice` en Magento 2

- **Stock con MSI**: `GET /V1/inventory/source-items` da la cantidad física por fuente, **sin `updated_at`**.
  [Source items](https://developer.adobe.com/commerce/webapi/rest/inventory/manage-source-items/) La cantidad
  vendible (física menos reservas) sale de `get-product-salable-quantity/:sku/:stockId` o, por lotes, de
  `are-products-salable`.
  [Cantidad vendible](https://developer.adobe.com/commerce/webapi/rest/inventory/check-salable-quantity)
- **Stock sin MSI**: `GET /V1/stockItems/:sku` y `GET /V1/stockStatuses/:sku`, de a un SKU.
  [webapi.xml de CatalogInventory](https://github.com/magento/magento2/blob/2.4-develop/app/code/Magento/CatalogInventory/etc/webapi.xml)
- **Precio**: `POST /V1/products/base-prices-information`, `special-price-information` y
  `tier-prices-information`, por lista de SKUs.
  [Precios](https://developer.adobe.com/commerce/webapi/rest/modules/catalog/catalog-pricing) El precio cobrado
  es el mínimo entre base, por cantidad, especial y regla de catálogo.
  [Precio avanzado](https://experienceleague.adobe.com/en/docs/commerce-admin/catalog/products/pricing/pricing-advanced)
  Inferido: ningún endpoint documentado devuelve el precio con la regla de catálogo aplicada.
- **Alcance**: el precio y el stock pueden ser por sitio o por tienda, y la ruta lleva el código de tienda
  (`/rest/<store_code>/V1/...`).
  [Alcance del precio](https://experienceleague.adobe.com/en/docs/commerce-admin/catalog/products/pricing/catalog-price-scope)

### `onOrderConfirmed` en Magento 2

- **`pull`**: `GET /V1/orders` con `searchCriteria` por `updated_at`, `state` o `status`; `GET /V1/orders/:id`;
  `GET /V1/invoices`.
  [webapi.xml de Sales](https://github.com/magento/magento2/blob/2.4-develop/app/code/Magento/Sales/etc/webapi.xml)
- **El incentivo**: la orden trae `discount_amount`, `coupon_code`, `applied_rule_ids` y `discount_description`.
  [OrderInterface](https://github.com/magento/magento2/blob/2.4-develop/app/code/Magento/Sales/Api/Data/OrderInterface.php)
- **Confirmada**: los estados son `new`, `pending_payment`, `processing`, `complete`, `closed`, `canceled`,
  `holded` y `payment_review`; `complete` llega recién con todo enviado.
  [Estados](https://experienceleague.adobe.com/en/docs/commerce-admin/stores-sales/order-management/orders/order-status)
  Los medios de pago que capturan crean la factura solos; los offline la piden a mano.
  [Procesamiento](https://experienceleague.adobe.com/en/docs/commerce-admin/stores-sales/order-management/orders/order-processing)
  Inferido: la señal más segura de «pagada» es que exista la factura, o el estado `processing`.
- **`subscribe`**: no hay; ver «Eventos».

### `onReturnRegistered` en Magento 2

- **Open Source**: sólo notas de crédito. Se leen con `GET /V1/creditmemos` y se vinculan a la orden por
  `order_id`. [Reembolso](https://developer.adobe.com/commerce/webapi/rest/tutorials/orders/order-issue-refund)
  Inferido: una nota de crédito registra un **reembolso**, no una devolución física, y un cambio de talle sin
  reembolso no deja rastro.
- **Adobe Commerce**: RMA (`/V1/returns`, filtrable por orden).
  [RMA](https://experienceleague.adobe.com/en/docs/commerce-admin/stores-sales/order-management/returns/rma-configure)

### El identificador de OPE en la orden, en Magento 2

Ninguna opción es sólo configuración (inferido): **todas piden un módulo** en la tienda del merchant.

| Opción                               | Qué pide                                                                                                                        | Se lee por REST                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `ext_order_id`                       | Código que lo llene al crear la orden; ningún camino documentado del storefront lo hace                                         | Sí, campo nativo de la orden      |
| Atributo de extensión                | Módulo: `extension_attributes.xml`, plugins del repositorio, copia de la cotización a la orden (`fieldset.xml` y un observador) | Sí, bajo `extension_attributes`   |
| Atributos personalizados de la orden | Nativos sólo en Adobe Commerce as a Cloud Service; en el resto, módulos aparte                                                  | Sí                                |
| Comentario de la orden               | Código en el checkout; frágil, sin cambio de esquema                                                                            | Sí, `GET /V1/orders/:id/comments` |

Fuentes: [atributos de extensión](https://developer.adobe.com/commerce/php/development/components/add-attributes),
[copia de fieldsets](https://developer.adobe.com/commerce/php/tutorials/backend/copy-fieldsets),
[atributos personalizados](https://developer.adobe.com/commerce/webapi/rest/modules/custom-attributes). Hay un
defecto conocido: los atributos de extensión no se copian en algunos fieldsets
([issue 28333](https://github.com/magento/magento2/issues/28333)).

Coincide con `02` §6.3 («un módulo mínimo»), y corrige el «o un campo de datos de marketing en la orden»: no hay
un campo así que se llene sin código.

### Eventos (`subscribe`) en Magento 2

- **Adobe I/O Events**: Adobe Commerce 2.4.4 o superior; la documentación dice que Open Source no está
  soportado. [Instalación](https://developer.adobe.com/commerce/extensibility/events/installation)
- **Webhooks de Adobe Commerce**: son **sincrónicos** y para Adobe Commerce 2.4.4+.
  [Webhooks](https://developer.adobe.com/commerce/extensibility/webhooks/)
- **Colas de mensajes** (MySQL o RabbitMQ): la topología se declara en el XML de los módulos, y no hay un tema
  documentado de «orden creada» ni un consumidor externo.
  [Colas](https://developer.adobe.com/commerce/php/development/components/message-queues/configuration)

Inferido: en Open Source, tanto `subscribe` como `push` piden un módulo instalado por el merchant. `pull` es el
único modo sin instalación.

### Autenticación y límites en Magento 2

- **Tokens**: los de integración no vencen. Desde 2.4.4 no sirven como Bearer salvo que el merchant active
  `oauth/consumer/enable_integration_as_bearer`; si no, hay que firmar con OAuth 1.0a.
  [Tokens](https://developer.adobe.com/commerce/webapi/get-started/authentication/gs-authentication-token),
  [notas de 2.4.4](https://experienceleague.adobe.com/en/docs/commerce-operations/release/notes/magento-open-source/2-4-4)
- **Límites de entrada**: apagados por defecto; encendidos, el tamaño máximo de página es 300.
  [Seguridad de la API](https://developer.adobe.com/commerce/webapi/get-started/api-security)
- **Límite de tasa**: el único documentado es la contrapresión al crear órdenes (2.4.7, apagada por defecto). No
  hay una cuota general; el hosting o la CDN pueden poner la suya.
  [Rate limiting](https://developer.adobe.com/commerce/webapi/get-started/rate-limiting)

## VTEX

La referencia se leyó en developers.vtex.com y en los esquemas OpenAPI de los que sale
(`github.com/vtex/openapi-schemas`). De help.vtex.com sólo se obtuvieron fragmentos de búsqueda.

### `fetchCatalog` en VTEX

- **`pull`**: `GET /api/catalog_system/pvt/sku/stockkeepingunitids` (página de hasta 1000);
  `GET /api/catalog_system/pvt/sku/stockkeepingunitbyid/{skuId}` (el SKU con su contexto); las especificaciones
  del SKU (talle, color) en `GET /api/catalog/pvt/stockkeepingunit/{skuId}/specification`.
  [Catalog API](https://developers.vtex.com/docs/api-reference/catalog-api) Inferido: ninguna lista filtra por
  fecha de cambio, así que `pull` es barrido completo por páginas.
- **`subscribe`**: el «Search Endpoint» del afiliado recibe un POST por cada SKU de un producto que cambió, con
  `DateModified`, `StockModified`, `PriceModified` e `isActive`.
  [Notificación al afiliado](https://developers.vtex.com/docs/guides/external-marketplace-integration-price-update)
  El Broadcaster lleva lo mismo, pero sólo como eventos de VTEX IO dentro de la cuenta.
  [Broadcaster](https://developers.vtex.com/docs/guides/vtex-broadcaster)

### `fetchStockAndPrice` en VTEX

- **Stock**: `GET /api/logistics/pvt/inventory/skus/{skuId}`, con `totalQuantity` y `reservedQuantity` por
  depósito. [Logistics API](https://developers.vtex.com/docs/api-reference/logistics-api)
- **Precio**: `GET https://api.vtex.com/{account}/pricing/prices/{itemId}` y el precio calculado por tabla,
  `.../computed/{priceTableId}`. [Pricing API](https://developers.vtex.com/docs/api-reference/pricing-api)
- **Refresco parcial**: la ruta documentada es la notificación al afiliado (`StockModified`, `PriceModified`,
  `DateModified`) seguida de una simulación de fulfillment, que da precio de venta y disponibilidad. Es la única
  fuente de instante por ítem.

### `onOrderConfirmed` en VTEX

- **`subscribe` (Feed v3)**: se configura con `POST /api/orders/feed/config`, filtrando por estados o por una
  expresión JSONata sobre cualquier campo; se lee de a 10 como máximo y se confirma lo leído.
  [Orders Feed](https://developers.vtex.com/docs/guides/orders-feed)
- **`push` (Hook)**: `POST /api/orders/hook/config` con la URL y **encabezados fijos**, que son la autenticación
  (no hay firma). VTEX manda un ping al guardar, espera un 200 en menos de 5000 ms y reintenta con retroceso. El
  aviso trae `OrderId`, `State` y `LastChange`; los ítems se leen con `GET /api/oms/pvt/orders/{orderId}`. Hay
  **un feed o un hook por appKey**.
- **`pull`**: `GET /api/oms/pvt/orders` existe, pero la documentación dice que **no se use para integraciones**:
  tiene retraso de indexación y no trae los ítems.
  [Orders API](https://developers.vtex.com/docs/api-reference/orders-api)
- **Confirmada**: `payment-approved` es el pago aprobado; después vienen `window-to-cancel` (30 minutos por
  defecto) y `ready-for-handling`.
  [Flujo de la orden](https://help.vtex.com/en/docs/tutorials/order-flow-and-status) Inferido: «confirmada» para
  OPE es `payment-approved`, o `ready-for-handling` para no contar las que se cancelan en la ventana.
- **El incentivo**: la orden trae `ratesAndBenefitsData`, las promociones aplicadas.

### `onReturnRegistered` en VTEX

- **En la orden**: una devolución es una factura de entrada, `POST /api/oms/pvt/orders/{orderId}/invoice` con
  `type: "Input"`, vinculada por el `orderId`; se buscan con `f_hasInputInvoice=true`. Inferido: el Feed con una
  expresión JSONata sobre la factura de entrada daría `subscribe`; hay que probarlo.
- **La app de devoluciones** (`vtex.return-app`): los pedidos de devolución llevan su `orderId`, pero no tienen
  webhook ni evento documentado; sólo `pull`. [Return app](https://developers.vtex.com/docs/apps/vtex.return-app)

### El identificador de OPE en la orden, en VTEX

| Opción                        | Qué pide                                                                                                                                                                           | Se lee en la orden             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `marketingData.marketingTags` | Sólo código del storefront: `POST .../orderForm/{id}/attachments/marketingData`; hasta 50 etiquetas                                                                                | Sí, en `marketingData`         |
| `customData`                  | Configuración de la cuenta, una vez (`/api/checkout/pvt/configuration/orderForm`, con un permiso que no trae ningún rol predefinido), y código del storefront que escriba el campo | Sí, en `customData.customApps` |
| `openTextField`               | Existe en la orden; no se encontró un camino de escritura desde el storefront                                                                                                      | Sí                             |

Fuentes: [marketingData](https://developers.vtex.com/docs/guides/add-marketing-data-to-the-cart),
[customData](https://developers.vtex.com/docs/guides/add-and-handle-custom-information-in-the-order). Inferido:
el POST de `marketingData` reemplaza el objeto entero, así que OPE tiene que conservar los `utm` que ya estén.

**El origen del checkout**: después de salir a producción el checkout corre en el dominio final
(`www.tienda.com/checkout`), y la confirmación de compra y «Mi cuenta» van en el subdominio `secure`.
[Go-live de FastStore](https://developers.vtex.com/docs/guides/faststore/go-live-4-integrating-the-vtex-order-placed-and-my-account)
Para el mecanismo B importa: la página de confirmación puede quedar en otro origen. Sigue siendo una pregunta por
merchant (`02` §5.3).

### Autenticación y límites en VTEX

- **Credenciales**: encabezados `X-VTEX-API-AppKey` y `X-VTEX-API-AppToken`, con permisos por roles del License
  Manager. [Autenticación](https://developers.vtex.com/docs/guides/api-authentication-using-api-keys)
- **Límites documentados**: Catalog, 45.000 pedidos por minuto por cuenta y 15.000 por endpoint; leer una orden,
  6000 por minuto; Pricing responde 429 con `Retry-After`. Logistics, Feed y Checkout no los documentan.

## Lo que no se verificó

- **La autenticación y los reintentos de la notificación al afiliado (VTEX)**: no están en las páginas leídas. Es
  el punto que decide si el `subscribe` de catálogo es usable para OPE.
- **help.vtex.com**: no se pudo leer entero. El flujo de estados de la orden y la configuración del dominio de la
  tienda salen de fragmentos de búsqueda, y hay que releerlos a mano.
- **Si `ext_order_id` se copia de la cotización a la orden (Magento)**: el fieldset de la cotización no lo
  incluye; el de conversión no se revisó.
- **Los webhooks de Adobe Commerce en Open Source**: las notas no lo nombran; se toma como sólo Adobe Commerce.

## Lo que sólo el merchant puede responder

Va a la conversación comercial como pregunta informada (`02` §9, V3 y V4).

**Magento 2**

1. Edición y versión exacta: Open Source o Adobe Commerce, y si es 2.4.4 o superior.
2. Si acepta instalar un módulo, y cuál es su proceso de release. Decide el mecanismo A.
3. Stock con MSI o sin él, y qué stock y qué sitio lee OPE.
4. Alcance del precio, reglas de catálogo, precios por cantidad, monedas y vistas de tienda.
5. Si la factura se crea sola al pagar.
6. Cómo registra las devoluciones: RMA, notas de crédito, o fuera del sistema.
7. Bearer u OAuth 1.0a; límites de entrada; firewall o lista de IPs.
8. Si el storefront es headless (PWA o GraphQL): cambia dónde se inyecta el identificador.

**VTEX**

1. Si permite la configuración de `customData` más código del storefront, o sólo `marketingTags`.
2. Qué estado cuenta como confirmada, y cuánto dura su ventana de cancelación.
3. Si crea un afiliado que apunte a OPE, y con qué política comercial.
4. Cómo registra las devoluciones: factura de entrada, la app de devoluciones, o un ERP.
5. Contra qué tabla de precios o política comercial calcula OPE.
6. Si el storefront es FastStore, Store Framework o el CMS anterior, y si el checkout está en su dominio.
7. Si ya usa su feed o su hook para otro integrador: OPE necesita su propia appKey.
