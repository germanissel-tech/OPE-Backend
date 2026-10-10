# Research — fase 0 (044, el puerto de plataforma)

Lo que había que mirar antes de planificar: qué es «el puerto» en el código que ya existe, dónde vive el
planificador sin romper la regla de que un caso de uso no invoca a otro, cómo entra un dato por variante en un
catálogo que hoy sólo conoce la foto entera, con qué se autentica un aviso, y cómo se impide configurar un modo que
nada ejecuta. Cada hallazgo termina en una decisión, con lo que se descartó.

## R-01 — El puerto ya existe del lado de adentro: son los cuatro casos de uso

**Lo que hay.** Lo que el `push` deposita entra por tres casos de uso —`UpsertCatalogSnapshotUseCase`,
`NotifyOrderUseCase`, `NotifyReturnUseCase`— y ninguno sabe que lo llamó HTTP: reciben un pedido con el merchant y
los datos, y devuelven un `Result`. ADR-025 ya lo dice así («los tres llegan al mismo puerto: `CatalogStore.replace`,
`OrderLedger.record`, `recordReturn`»). Falta el cuarto: el refresco parcial de stock y precio.

**Decisión.** Las cuatro operaciones de la constitución X son **cuatro casos de uso** del núcleo:

| Operación del puerto | Caso de uso                                                 |
| -------------------- | ----------------------------------------------------------- |
| `fetchCatalog`       | `UpsertCatalogSnapshotUseCase` (existe)                     |
| `fetchStockAndPrice` | `RefreshStockAndPriceUseCase` (**nuevo**, módulo `catalog`) |
| `onOrderConfirmed`   | `NotifyOrderUseCase` (existe)                               |
| `onReturnRegistered` | `NotifyReturnUseCase` (existe)                              |

Un adaptador es **lo que llama** a esos cuatro: el genérico son los controllers HTTP del `push` (sin cambios); el
de `pull` y el de `subscribe` son el planificador y el procesador de avisos, que traen los datos de una **fuente**
y llaman a los mismos casos de uso. El núcleo no ve ni la fuente ni el modo.

**Lo que se descartó.** Una interfaz `PlatformPort` con los cuatro métodos, implementada por cada plataforma y
consumida por el núcleo: invierte la dirección. El núcleo no **pide** datos a la plataforma (eso sería I/O en el
dominio); los **recibe**. Lo que cada plataforma implementa es la fuente (R-02), del lado de afuera.

## R-02 — La fuente de una plataforma, y por qué su forma no es la del puerto

**Lo que hay.** La verificación documental mostró que ninguna plataforma entrega «lo que entra» en una sola
llamada: Magento pide los hijos de cada configurable aparte, el stock no se puede pedir «desde T», el aviso de
VTEX obliga a leer la orden.

**Decisión.** Cada plataforma implementa una **fuente** (`PlatformSource`, en `interface-adapters/platform/`), con
las lecturas que el `pull` y el `subscribe` necesitan:

- `catalog()` → la foto completa, con su instante;
- `stockAndPrice(variantIds)` → stock y precio de un lote, con el instante por ítem si la plataforma lo da;
- `orderChanges(cursor)` y `returnChanges(cursor)` → lo que cambió desde el cursor, y el cursor siguiente;
- `order(reference)` y `returns(reference)` → el detalle que sigue a un aviso.

Cada orden de la fuente trae su **estado en el idioma de la plataforma**; la regla de confirmación (R-07) decide.
Una fuente declara **qué modos soporta por flujo** (R-08). Esta feature trae una sola fuente, la de prueba (R-09).

## R-03 — El planificador es un adaptador que conduce, no un caso de uso

**Lo que hay.** Un caso de uso nunca invoca a otro (ADR-023, `lint`). El único trabajo periódico del servidor es la
cola del registro de eventos (`queuedEventLog`): un `setInterval` con `unref()`, cuyo `close()` lo para y vacía, y
que el grafo junta como `Closable` para el apagado ordenado (`bootstrap.ts`).

**Decisión.** El planificador vive en `interface-adapters/platform/scheduler/` y es, para el núcleo, lo mismo que un
controller: traduce lo que trae la fuente a un pedido y llama al caso de uso. Su forma:

- `runDue(now)`: recorre los merchants activos con el interruptor encendido, y para cada flujo en `pull` cuya
  cadencia venció, corre una vez. Las pruebas lo llaman directo con el reloj que quieren.
- Un temporizador con `unref()` llama a `runDue` cada `tickMs` (nivel de plataforma), y su `close()` espera la
  corrida en curso. Es la misma forma que la cola del registro de eventos.
- **Nunca dos corridas del mismo merchant y flujo a la vez**: una corrida en curso se marca en memoria y la
  siguiente se omite. Es de instancia única, como todo el MVP (constitución IV).
- Fuera del camino de decisión: corre en su propio tick, y lo que deposita lo deposita por los mismos casos de uso
  que el `push`. La decisión sigue leyendo lo guardado (SC-005 se prueba midiendo una decisión con una fuente que no
  responde nunca).

**Lo que se descartó.** Un `RunPullUseCase`: tendría que llamar a los cuatro casos de uso o duplicar su lógica. Y
un proceso aparte: es una decisión de despliegue que el MVP no necesita (supuesto de la spec).

## R-04 — El refresco parcial: una capa sobre la foto, no una foto nueva

**Lo que hay.** El catálogo es una sola fila JSON por merchant (`catalog_snapshots`), reemplazada entera, con
`capturedAt` como clave de idempotencia y como única medida de frescura (`ageAt(now)`). Ninguna variante tiene
instante propio. `ProductTruthService` decide `fresh` o `stale` de stock y precio con la edad de la foto.

**Decisión.** El refresco se guarda **aparte de la foto**, en una tabla por variante
(`stock_and_price(merchant_id, variant_id, observed_at, document)`), y la verdad de una variante es **la más nueva
de las dos**: la de la foto (con `capturedAt`) o la del refresco (con su `observedAt`). Así:

- La foto conserva su idempotencia y su orden (`catalog-out-of-order`) sin cambios.
- La frescura de stock y precio pasa a ser **por variante**: la edad de su dato más nuevo. Una variante que el lote
  todavía no alcanzó envejece y se calla sola; las demás siguen habilitadas (FR-006).
- Un refresco con un instante más viejo que el que la variante ya tiene no la toca (FR-007), y se informa como
  `superseded`. Uno con el mismo instante y el mismo contenido es una repetición.
- Una variante que la foto vigente no tiene se informa como `unknown` y no se guarda (ADR-025 ya lo había previsto:
  «una variante desconocida se ignora con motivo»).
- Una foto nueva con `capturedAt` posterior a un refresco lo deja sin efecto por la regla de «la más nueva»; los
  refrescos más viejos que la foto vigente se borran al reemplazarla, para que la tabla no crezca.

**El instante** lo da la plataforma o, si no lo da, es el de la observación de OPE (punto 2 de la verificación). La
captura en el futuro se rechaza con la misma tolerancia que la foto.

**Lo que se descartó.** Reescribir la foto con el refresco aplicado: mezcla dos instantes en una fila que se mide
por uno, rompe la idempotencia por `capturedAt` y obliga a reserializar el catálogo entero por cada lote.

## R-05 — El nivel de sincronización con refrescos parciales

**Lo que hay.** El nivel observado (ADR-025, `SyncLevelRules.observe`) se deriva de las **recepciones** de fotos.

**Decisión.** Cada refresco aceptado (un lote del `pull`, un pedido del `push`) cuenta como recepción, igual que una
foto. **Por qué alcanza**: el nivel habilita familias de mensaje para el merchant entero, pero la guarda que impide
afirmar algo viejo es la frescura **por variante** de R-04, que calla cada variante que el ciclo todavía no alcanzó.
Un merchant que refresca pocas variantes muy seguido llega al nivel 2 y sólo esas variantes hablan de stock y precio.

**Lo que se descartó.** Contar sólo los ciclos completos del lote: el `push` parcial no tiene ciclo, y el nivel
quedaría en 1 para un merchant que refresca en minutos lo que cambia. **DECIDIDO** con el dueño el 2026-10-10, sabiendo que cambia
lo que el nivel significa para un merchant con `push` parcial.

## R-06 — El aviso tiene su propia credencial, y entra a una cola durable

**Lo que hay.** La clave de plataforma (`X-OPE-Platform-Key`) autentica el `push`, y la firma HMAC (ADR-029) se exige
cuando el merchant tiene secreto. Las credenciales viven en el agregado `Merchant` (`kind: ingest | platform |
signing`, dos por clase para rotar). El Hook de VTEX no firma: sólo manda encabezados fijos.

**Decisión.**

- **Una clase de credencial nueva, `notice`**, con su encabezado (`X-OPE-Notice-Key`), su esquema de seguridad
  (`noticeKey`) y su rotación por el consumidor `admin` (`rotateNoticeKey`), como las otras dos. Su handler concede
  **sólo** `notices:write`.
- **Un consumidor nuevo, `notifier`**, con el tag `notices`. El mapa ata cada consumidor a **un** esquema de
  seguridad y `ope-consumer-security` lo exige; meter el aviso bajo `platform` obligaría a romper esa regla. Es la
  plataforma del merchant con otra credencial, igual que `sdk` y `platform` son el mismo merchant con dos. ADR-020
  gana su fila en ADR-047. **Por qué no la clave de plataforma**: el aviso se configura en la plataforma de un
  tercero (el panel de VTEX), donde la clave queda más expuesta; si se filtra, sólo dispara lecturas, nunca deposita
  una orden ni un catálogo.
- **El aviso no lleva datos que entren**: `{ flow, reference }` (y el estado, si la plataforma lo manda, que sólo se
  registra). Lo que se registra sale de la lectura (FR-010).
- **Entra a una cola durable** (`platform_notices`) y responde `202`. El planificador la procesa en su tick: lee por
  la fuente, aplica la regla de confirmación y llama al caso de uso. Si la fuente falla, reintenta con espera hasta
  un máximo de intentos (configuración); agotados, el aviso se descarta con rastro. Un reinicio no lo pierde
  (FR-011). Dos avisos pendientes del mismo merchant, flujo y referencia son uno.
- **`subscribe` sólo en órdenes y devoluciones** (decidido con el dueño el 2026-10-10).

**Lo que se descartó.** Procesar el aviso dentro del pedido HTTP: ata la respuesta a la latencia de la plataforma y
pierde el aviso si la lectura falla. Y la firma HMAC: el Hook de VTEX no puede producirla.

## R-07 — «Confirmada» es configuración, y la aplica el adaptador

**Lo que hay.** El `push` registra toda orden que llega: la plataforma decide qué empuja. Con `pull` y `subscribe`,
OPE ve órdenes en cualquier estado.

**Decisión.** Un valor nuevo de configuración del merchant, `orderConfirmation.states`: la lista de estados de la
plataforma que cuentan como confirmada. El default de tratamiento es la lista vacía, y **publicar una versión con
órdenes en `pull` o `subscribe` y la lista vacía se rechaza**: si no, ninguna orden entraría y nada lo diría. La
regla la aplica el adaptador antes de llamar a `NotifyOrderUseCase`, porque traducir el estado de una plataforma es
trabajo del borde; la regla en sí es un objeto de valor del dominio de configuración.

`confirmedAt` de una orden traída es el instante en que la plataforma la pasó a ese estado si lo da, y si no, el
de la observación de OPE.

## R-08 — Un modo que nada ejecuta no se puede publicar

**Lo que hay.** `judgeStrategy` sólo verifica que el modo esté en el vocabulario.

**Decisión.** La configuración del merchant gana `platform`: qué fuente usa (`generic` por defecto; `test` en esta
feature; `magento2` en la siguiente). Al publicar, el servicio de configuración pregunta por un puerto
(`PlatformSources`) **qué fuentes están instaladas en este despliegue y qué modos soporta cada una por flujo**, y
rechaza:

- un `pull` o `subscribe` en un flujo que la fuente del merchant no soporta (`generic` no soporta ninguno);
- `subscribe` en catálogo o en stock y precio, porque ninguna fuente lo soporta (decidido con el dueño);
- una fuente que no está instalada.

`push` siempre se admite: el genérico es universal.

**Y al revés: la entrada por un modo que no rige se rechaza.** Un `push` a un flujo configurado en `pull` responde
`409 sync-mode-not-configured`, y un aviso a un flujo que no está en `subscribe` también. El chequeo es un
**decorador del caso de uso** (`ModeGatedUseCase`, como `AuditedUseCase`) que la composición pone delante de cada
caso de uso según quién lo llame: el núcleo no sabe el modo.

## R-09 — El adaptador de prueba, y cómo no llega a producción

**Lo que hay.** No hay noción de entorno: `main.ts` siempre usa el despliegue durable, también en `npm run dev`; el
despliegue local es sólo de las pruebas.

**Decisión.** La fuente de prueba se **instala** sólo si se pide: en el despliegue local siempre (guionable desde la
prueba), y en el durable sólo con `OPE_TEST_PLATFORM=<archivo>`, que `npm run dev` fija. Lee el archivo JSON en cada
consulta (catálogo, stock y precio con o sin instante, órdenes con estado, devoluciones), así que a mano se agrega
una orden editando el archivo. Sin la variable, la fuente no existe y R-08 rechaza configurarla: un servidor de
producción no la tiene.

## R-10 — El estado de cada flujo, durable y visible

**Decisión.** Una tabla `platform_sync(merchant_id, flow, document)` con el cursor (la posición del lote, el cursor
de cambios de la fuente), la última corrida, su resultado y el último fallo, sin datos personales (FR-016). Una
lectura nueva del consumidor `admin`, `getMerchantPlatformSync`, la expone por flujo junto al modo que rige, para que
la consola la muestre después. Los fallos se loguean además con merchant y flujo.

## R-11 — La corrida de punta a punta

**Lo que hay.** Ninguna prueba recorre el circuito entero por HTTP: `orders.test.ts` va de evento a orden atribuida
sin exposición, y `evidence-chain.test.ts` va de decisión a corroboración por los puertos.

**Decisión.** `tests/integration/end-to-end.test.ts`: un merchant con la fuente de prueba; catálogo y stock y precio
por `pull` (`runDue`); un evento y su decisión por el SDK; la exposición confirmada; la orden por `subscribe` con el
`sessionId` de la decisión; y la orden `ATTRIBUTED_ORDER`. La misma prueba, con el catálogo empujado y la orden
consultada, da lo mismo (US5).

## R-12 — El contrato: lo que cambia y cómo entra

Cambio menor, `1.16.0`. Compatible, salvo los campos nuevos que el contenido de los defaults exige (`platform`,
`orderConfirmation`, `pull`, `notices`): `TreatmentDefaultsContent` los declara requeridos, y publicar los defaults
sin ellos deja de aceptarse. Entra por la marca `building` (ADR-003), como el `displayName` de la 041, con el reporte
de `contract:diff` citado. En la configuración del merchant son opcionales.

Lo nuevo: `refreshStockAndPrice`, `notifyPlatformChange`, `rotateNoticeKey`, `getMerchantPlatformSync`; el
consumidor `notifier` con el esquema `noticeKey` y la capacidad `notices:write`; el tag `refresh` del consumidor
`platform`, porque una operación `outcomes` exige idempotencia **por pedido** (`x-idempotency` con una clave del
cuerpo y dos respuestas `2xx`) y el refresco es idempotente **por ítem**, por su instante (R-04): forzarle una
clave de pedido obligaría a guardar cada lote para detectar el conflicto, sin ganar nada; los tipos `sync-mode-not-configured` (409) y
`stock-captured-in-future` (422); la descripción de `SyncMode` deja de decir «no cambia nada». Detalle en
[`contracts/puerto.md`](contracts/puerto.md).
