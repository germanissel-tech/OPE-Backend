# Feature Specification: Outcomes — órdenes, devoluciones y corroboración desde el navegador

**Feature Branch**: `013-outcomes-ordenes-y-devoluciones`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "Outcomes: órdenes, devoluciones y corroboración desde el
navegador. Completar el plano de medición: la plataforma confirma órdenes servidor a servidor
(mecanismo A, autoritativo) y devoluciones; el SDK corrobora desde la página de confirmación
(mecanismo B, evidencia); el ledger gana `VERIFIED_ORDER`, `ATTRIBUTED_ORDER`,
`PENDING_CORRELATION` y `RETURNED`; idempotencia por `orderId`; redención del incentivo;
firma HMAC del cuerpo para la credencial de plataforma; glosario; ADR-028."

## Contexto

Hasta la 012 OPE decide y registra por qué decidió, y el SDK confirma qué se vio (`ASSIGNED`,
`EXPOSED`). Falta lo que hace **medible** al MVP (01 §5, 03 §10 criterio 6): que una compra
real entre al ledger como venta verificada y, cuando existe un vínculo verificable con una
sesión de OPE, como venta atribuida a un grupo. Sin eso no hay contribución incremental que
reportar (016) ni cifra económica que sostener.

Tres ideas ordenan esta feature. Primera: **la cadena de evidencia tiene estados explícitos y
ninguno se infiere del anterior** (01 §5). Una orden confirmada por la plataforma es
`VERIFIED_ORDER`: la compra existió, sin afirmar que OPE haya participado. Pasa a
`ATTRIBUTED_ORDER` sólo con correlación verificable: la orden trae el identificador de sesión
de OPE que el storefront le adjuntó al crearla, y esa sesión existe en el ledger del mismo
merchant. Mientras no lo trae, queda `PENDING_CORRELATION`, visible como tal; OPE **nunca**
completa ese hueco por inferencia (mecanismo C, 02 §5.1, queda fuera). El resultado causal no
es un estado de la cadena: surge del análisis entre grupos (016).

Segunda: **hay una sola fuente autoritativa y una sola evidencia corroborante** (02 §5.2,
DECIDIDO). La plataforma, servidor a servidor, es la autoridad (mecanismo A). El SDK, desde la
página de confirmación de compra, corrobora (mecanismo B): sirve como disparador temprano,
como control cruzado y para medir que la pérdida de confirmaciones sea equivalente en CONTROL
y TREATMENT, pero nunca crea una orden ni la atribuye. Un merchant que sólo puede ofrecer B
hace un piloto degradado, y esta feature deja el dato para decirlo.

Tercera: **la orden llega acotada por diseño** (01 §10.3, 03 §4.11). De una compra OPE
necesita el identificador de orden, monto y moneda, ítems con SKU y cantidad, el instante de
confirmación y nuestro identificador de sesión. No pide ni acepta nombre, email, domicilio ni
datos de pago: un objeto de orden completo de la plataforma se rechaza en el borde, no se
limpia en silencio. Y como la plataforma habla con OPE con una credencial secreta, esta
feature trae lo que quedó decidido para ella (ADR-020 §1, ADR-025 §5, stakeholder
2026-09-18): la firma del cuerpo con secreto por merchant y ventana temporal, para que una
notificación no pueda falsificarse ni repetirse fuera de tiempo.

Fuera de esta feature: el análisis por intención de tratar, la contribución incremental y el
portal (016); persistencia durable (017); el mecanismo C; identidad entre dispositivos (01 §6,
ABIERTO); plazos de retención (D5, ADR-010); la emisión y configuración del cupón en la
plataforma (014); devoluciones parciales sucesivas sobre la misma orden; el histórico de
devoluciones por cliente (D-C); el adaptador real de Magento o VTEX (03 §4.13: verificación
documental del puerto durante el diseño).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - La plataforma confirma una orden y OPE la registra como venta verificada, atribuida o pendiente (Priority: P1)

Cuando el merchant confirma una compra, su plataforma se lo notifica a OPE servidor a servidor
con la credencial de plataforma. OPE registra la orden como venta verificada con lo que 01
§10.3 admite. Si la notificación trae el identificador de sesión de OPE que el storefront
adjuntó a la orden al crearla, y esa sesión existe en el ledger del mismo merchant, la orden
queda **atribuida**: hereda el brazo y el experimento de la asignación de esa sesión. Si no lo
trae, o la sesión no existe para ese merchant, queda **pendiente de correlación**, visible
como tal. La respuesta dice cuál de las dos cosas pasó; nunca dice el brazo.

**Why this priority**: es lo que separa un experimento con cifra económica auditable de uno
sin ella (03 §7 V4, §10 criterio 6, §11); sin órdenes verificadas la 016 no tiene qué analizar.

**Independent Test**: un visitante con asignación registrada y una sesión con decisiones en el
ledger compra; la plataforma notifica la orden con ese `sessionId` → `ATTRIBUTED_ORDER` con la
asignación adjunta en el ledger; la misma notificación sin `sessionId` → `PENDING_CORRELATION`;
con un `sessionId` que sólo existe en otro merchant → `PENDING_CORRELATION`.

**Acceptance Scenarios**:

1. **Given** una orden con `orderId`, monto, moneda, ítems, instante y el `sessionId` de una
   sesión conocida del merchant, **When** la plataforma la notifica, **Then** la respuesta es
   de creación con estado `ATTRIBUTED_ORDER` y el ledger guarda la orden, la correlación y la
   asignación (experimento y brazo) de esa sesión.
2. **Given** la misma orden sin `sessionId`, **When** se notifica, **Then** creación con
   `PENDING_CORRELATION`; el ledger guarda la orden como venta verificada sin correlación.
3. **Given** un `sessionId` que OPE no conoce para ese merchant (nunca llegó un lote, o es de
   otro merchant), **When** se notifica, **Then** `PENDING_CORRELATION`; nada se infiere.
4. **Given** una sesión conocida cuyo visitante no tenía experimento activo, **When** se
   notifica la orden con ese `sessionId`, **Then** `ATTRIBUTED_ORDER` sin brazo ni experimento
   (correlación verificable con la sesión; el análisis la excluye por no tener grupo).
5. **Given** una notificación con cualquier campo fuera del contrato (nombre, email,
   dirección, medio de pago, o el objeto de orden completo), **When** llega, **Then** se
   rechaza en el borde como cuerpo inválido y no se registra nada.
6. **Given** el ledger no disponible, **When** llega la orden, **Then** la respuesta es
   `503` con `Retry-After` y nada queda a medias; la plataforma reintenta.

---

### User Story 2 - Reintentos y repeticiones no duplican ni sobrescriben una orden (Priority: P1)

Las plataformas reintentan. La misma orden puede llegar dos, tres veces, por timeout, por
redeploy, por replay. `orderId` es la única identidad de compra (01 §6): la primera recepción
crea; una repetición con el mismo contenido responde que ya estaba, con el mismo registro; la
misma orden con contenido distinto es un conflicto que se rechaza, nunca una sobreescritura.
El chequeo y el registro ocurren sin paso asíncrono entre medio, para no abrir una carrera
entre verificar y escribir.

**Why this priority**: sin idempotencia la cifra económica se infla con cada reintento y
deja de ser auditable (01 §9).

**Independent Test**: notificar la misma orden tres veces → `201`, `200`, `200` con el mismo
registro; notificarla una cuarta vez con otro monto → `409 idempotency-conflict` y el
registro original intacto.

**Acceptance Scenarios**:

1. **Given** una orden ya registrada, **When** llega de nuevo con el mismo contenido (aunque
   cambie el orden de las claves o el formato de los espacios), **Then** `200` con el mismo
   registro y sin efecto en el ledger.
2. **Given** una orden ya registrada, **When** llega con el mismo `orderId` y otro monto,
   otros ítems u otro `sessionId`, **Then** `409 idempotency-conflict` y el registro original
   no cambia.
3. **Given** el mismo `orderId` en dos merchants distintos, **When** cada plataforma notifica
   la suya, **Then** son dos órdenes independientes (la identidad de orden es por merchant).
4. **Given** una orden que quedó `PENDING_CORRELATION` porque no traía `sessionId`, **When**
   la plataforma la reenvía **con** `sessionId`, **Then** es un conflicto (`409`): la
   corrección de una orden no es un reintento (02 §5.2: el vínculo lo establece la plataforma
   al crear la orden, no después).

---

### User Story 3 - El SDK corrobora la compra desde la página de confirmación (Priority: P2)

Cuando el navegador llega a la página de confirmación de compra, el SDK reporta el
`orderId` que ve junto con su `sessionId` y `visitorId`. OPE lo registra como corroboración:
evidencia de que esa sesión terminó en compra, disponible antes de que la plataforma
notifique y útil para cruzar con la notificación cuando llegue. Una corroboración nunca crea
la orden ni la atribuye; si la orden nunca llega por el mecanismo A, la corroboración queda
como lo que es. Repetirla no cuesta nada: es evidencia, no autoridad.

**Why this priority**: es el control cruzado del mecanismo A y la única medición posible en
un merchant que no puede propagar nuestro identificador (02 §5.2, medición degradada): para
compararla entre grupos hace falta saber que la pérdida de confirmaciones es equivalente en
CONTROL y TREATMENT, y eso se calcula con estas corroboraciones.

**Independent Test**: el SDK corrobora `orderId` X con la sesión S antes de que la plataforma
notifique → `202`, sin orden en el ledger; llega la orden X sin `sessionId` → sigue
`PENDING_CORRELATION`, pero el ledger vincula la corroboración a la orden y lo dice; repetir
la corroboración → `202` sin cambios.

**Acceptance Scenarios**:

1. **Given** una sesión con lotes ingeridos, **When** el SDK corrobora un `orderId`, **Then**
   `202` y el ledger registra la corroboración con sesión, visitante e instante, sin crear la
   orden.
2. **Given** una corroboración registrada, **When** llega la orden por la plataforma con ese
   `orderId`, **Then** la orden se registra según la historia 1 (su estado lo decide sólo el
   mecanismo A) y el ledger vincula la corroboración a la orden.
3. **Given** una orden registrada, **When** llega después una corroboración con su
   `orderId`, **Then** se vincula igual; el estado de la orden no cambia.
4. **Given** una corroboración repetida (mismo `orderId`, misma sesión), **When** llega,
   **Then** `202` y un solo registro.
5. **Given** una corroboración con un `sessionId` de otro merchant, **When** llega con la
   credencial de este merchant, **Then** se registra bajo este merchant y no se vincula a
   nada del otro.
6. **Given** el ledger no disponible, **When** llega la corroboración, **Then** `503` con
   `Retry-After`; la pérdida de corroboraciones es esperable y se cuantifica, no se compensa.

---

### User Story 4 - La plataforma notifica una devolución sobre una orden registrada (Priority: P2)

Días después, la plataforma avisa que la orden volvió. OPE la vincula al `orderId` que ya
tiene, marca la orden como devuelta conservando su atribución y guarda qué ítems volvieron si
la plataforma lo dice. Una devolución de una orden que OPE no conoce se rechaza con un
motivo propio, para que la plataforma la reintente después de notificar la orden. Como la
orden, la devolución es idempotente por `orderId`.

**Why this priority**: es la tercera tesis del producto —calidad de compra— (02 §5.4); sin
devoluciones un incentivo que acelera compras que vuelven se vería como éxito.

**Independent Test**: notificar la devolución de una orden atribuida → `201` con `RETURNED`;
el ledger conserva la atribución y agrega la devolución; repetir → `200`; devolución de un
`orderId` desconocido → `422 order-unknown`.

**Acceptance Scenarios**:

1. **Given** una orden registrada (atribuida o pendiente), **When** la plataforma notifica su
   devolución con `orderId`, instante e ítems opcionales, **Then** `201` con estado
   `RETURNED` y el ledger conserva la correlación y la asignación que la orden tenía.
2. **Given** una devolución ya registrada, **When** llega de nuevo igual, **Then** `200`; con
   contenido distinto (otros ítems, otro instante), **Then** `409 idempotency-conflict`.
3. **Given** un `orderId` que OPE no registró para ese merchant, **When** llega la
   devolución, **Then** `422 order-unknown` y nada se registra.
4. **Given** una devolución cuyo `orderId` existe sólo en otro merchant, **When** llega con
   la credencial de este, **Then** `422 order-unknown`.
5. **Given** ítems devueltos con un SKU que la orden no tenía, **When** llega, **Then** se
   rechaza con invariante propia (`return-items-not-in-order`, `422`).

---

### User Story 5 - La orden dice si el incentivo se aplicó, y OPE lo cruza con lo que concedió (Priority: P3)

Cuando la política comercial concedió un incentivo (012), el SDK lo mostró y la plataforma lo
redimió en su checkout. La notificación de la orden puede declarar el incentivo efectivamente
aplicado. OPE lo cruza con la decisión de esa sesión que lo concedió: coincide, no coincide o
no había nada que cruzar. Ninguna de las tres es un error: la orden se registra igual y la
discrepancia queda visible en el ledger para la 016 (un incentivo concedido y no aplicado, o
aplicado sin concesión, es un dato de integración, no una venta menos).

**Why this priority**: cierra el PROPUESTO que la 012 dejó en el contrato sobre la redención;
la cifra económica necesita saber cuánto margen se gastó de verdad. La emisión del cupón y su
configuración siguen siendo de la plataforma y de la 014.

**Independent Test**: sesión con `INTERVENE` e `incentive { percent: 5 }` → orden atribuida
que declara 5 % aplicado → el ledger marca la redención como coincidente; la misma orden
declarando 10 % → discrepancia registrada, orden igual de válida; sin declarar → sin
redención, orden válida.

**Acceptance Scenarios**:

1. **Given** una sesión cuya decisión concedió `incentive { percent: 5 }`, **When** la orden
   atribuida declara ese incentivo, **Then** el ledger registra la redención como coincidente
   con la decisión que lo concedió.
2. **Given** la misma sesión, **When** la orden declara otro valor o no declara nada, **Then**
   la orden se registra con la discrepancia (o la ausencia) visible; la respuesta no cambia.
3. **Given** una orden `PENDING_CORRELATION` que declara un incentivo, **When** se registra,
   **Then** la redención queda sin decisión con la que cruzarse, visible como tal.

---

### User Story 6 - La plataforma firma lo que envía y OPE rechaza lo que no puede verificar (Priority: P2)

La credencial de plataforma es secreta y viaja por HTTPS, pero una clave filtrada o un cuerpo
capturado permitirían fabricar o repetir órdenes: la cifra económica depende de que eso no
pase. Cada merchant tiene un secreto de firma; su plataforma firma el cuerpo de cada
notificación con ese secreto y un instante, y OPE verifica la firma y que el instante esté
dentro de una ventana antes de mirar el cuerpo. Un merchant sin secreto configurado sigue
autenticando sólo con la clave (transición sin romper el catálogo de la 010); en cuanto
configura el secreto, la firma es obligatoria para todas sus operaciones de plataforma:
órdenes, devoluciones y catálogo.

**Why this priority**: quedó decidido para "el primer adaptador real o la 013" (ADR-025 §5);
las órdenes son el primer dato que alguien tendría interés en falsificar.

**Independent Test**: merchant con secreto: orden bien firmada → `201`; sin firma → `401`;
firmada con otro secreto o con el cuerpo alterado → `401`; con instante fuera de la ventana →
`401`; merchant sin secreto: la misma orden sin firma → `201`.

**Acceptance Scenarios**:

1. **Given** un merchant con secreto de firma, **When** llega una notificación firmada con ese
   secreto sobre el cuerpo exacto y un instante dentro de la ventana, **Then** se acepta.
2. **Given** el mismo merchant, **When** falta la firma, o el instante, o la firma no
   coincide, o el instante está fuera de la ventana, **Then** `401` con motivo propio y el
   cuerpo no se valida ni se registra.
3. **Given** un merchant con dos secretos (rotación), **When** la firma coincide con
   cualquiera de los dos, **Then** se acepta.
4. **Given** un merchant sin secreto configurado, **When** llega una notificación sin firma,
   **Then** se acepta sólo con la clave de plataforma (comportamiento de la 010).
5. **Given** el catálogo (`PUT /v1/catalog`) de un merchant con secreto, **When** llega sin
   firma, **Then** `401`: la firma es de la credencial, no de la operación.

---

### Edge Cases

- Una orden con `sessionId` conocido cuya sesión pertenece a un visitante con asignación en
  un experimento **ya cerrado**: se atribuye con esa asignación (la asignación es del
  visitante; el análisis decide qué tramo cuenta).
- Una orden que llega **antes** que el primer lote de su sesión (carrera entre el SDK y la
  plataforma): `PENDING_CORRELATION`; OPE no reconsidera la correlación después (la orden es
  inmutable). La corroboración posterior queda vinculada y visible.
- Devolución antes de la orden: `422 order-unknown`; la plataforma reintenta después.
- Orden con monto cero o sin ítems: se rechaza por contrato (una compra real tiene al menos
  un ítem y monto ≥ 0 con moneda válida; monto cero con ítems es válido: cupón del 100 %,
  fuera del alcance del incentivo de OPE pero posible en la plataforma).
- Corroboración de un `orderId` que nunca llega por A: queda como evidencia sin orden; la 016
  la usa para medir la pérdida de confirmaciones.
- Reloj de la plataforma desfasado: la ventana de la firma admite un desfase razonable
  (minutos); fuera de ella `401` con motivo que lo nombra, para que el equipo del merchant lo
  detecte al integrar.
- Ledger no disponible en la mitad de una notificación de orden con corroboración previa:
  nada se escribe; la respuesta es `503` y el reintento hace todo.

## Requirements _(mandatory)_

### Functional Requirements

**Cadena de evidencia**

- **FR-001**: El ledger MUST distinguir, por orden y por merchant, los estados
  `VERIFIED_ORDER` (compra confirmada por la plataforma), `ATTRIBUTED_ORDER` (verificada y con
  correlación verificable con una sesión de OPE), `PENDING_CORRELATION` (verificada sin
  correlación) y `RETURNED` (devuelta, conservando su correlación); ninguno MUST inferirse
  de otro.
- **FR-002**: La correlación MUST establecerse únicamente por el mecanismo A: `sessionId` en
  la notificación de la plataforma que existe en el ledger del mismo merchant (una sesión con
  al menos una decisión registrada). Ninguna heurística (ventana temporal, visitante, monto)
  MUST completar una correlación ausente.
- **FR-003**: Una orden atribuida MUST guardar la asignación de la sesión (experimento y
  brazo) cuando existe; sin asignación queda atribuida a la sesión sin grupo, visible como
  tal.
- **FR-004**: El estado de una orden MUST ser inmutable salvo por la devolución: una orden no
  pasa de pendiente a atribuida después de registrada.
- **FR-005**: El resultado causal MUST NOT ser un estado del ledger ni una respuesta de esta
  feature.

**Notificación de orden (mecanismo A)**

- **FR-010**: La plataforma MUST poder notificar una orden confirmada servidor a servidor con
  la credencial de plataforma y la capacidad `orders:write`.
- **FR-011**: La notificación MUST llevar exactamente: `orderId`, monto y moneda, ítems (SKU y
  cantidad ≥ 1, al menos uno), instante de confirmación, y opcionalmente `sessionId` (el de
  OPE, adjuntado por el storefront al crear la orden) y el incentivo aplicado (FR-040). Todo
  campo adicional MUST rechazarse en el borde.
- **FR-012**: Ningún esquema de esta feature MUST admitir datos del comprador (nombre, email,
  teléfono, dirección, documento, pago) ni ningún campo de la lista de datos personales
  prohibidos.
- **FR-013**: La respuesta MUST decir el estado (`ATTRIBUTED_ORDER` o `PENDING_CORRELATION`)
  y el identificador de la orden; MUST NOT llevar brazo, experimento, visitante ni nada del
  ledger más allá del estado.
- **FR-014**: `orderId` MUST ser único por merchant, no global; dos merchants pueden usar el
  mismo `orderId`.

**Idempotencia (ADR-020 §4)**

- **FR-020**: Órdenes y devoluciones MUST ser idempotentes por `orderId`: primera recepción
  `201`, repetición con el mismo contenido canónico `200` con el mismo registro, misma clave
  con contenido distinto `409 idempotency-conflict` sin sobrescribir.
- **FR-021**: La igualdad de contenido MUST ser canónica: independiente del orden de claves y
  del formato del documento; sensible a cualquier valor.
- **FR-022**: El chequeo de existencia y el registro MUST ocurrir sin operación asíncrona
  intermedia (01 §6): dos notificaciones simultáneas de la misma orden producen un registro y
  las respuestas `201`/`200` (o `409` si difieren), nunca dos registros.

**Corroboración (mecanismo B)**

- **FR-030**: El SDK MUST poder corroborar una compra con la credencial de ingesta y la
  capacidad `orders:corroborate`, con `orderId`, `sessionId`, `visitorId` e instante.
- **FR-031**: Una corroboración MUST registrarse como evidencia bajo el merchant de la
  credencial; MUST NOT crear una orden ni cambiar el estado de ninguna.
- **FR-032**: Cuando existen la orden y la corroboración del mismo `orderId` y merchant, en
  cualquier orden de llegada, el ledger MUST vincularlas.
- **FR-033**: La corroboración MUST responder `202` tanto la primera vez como repetida
  (un solo registro por `orderId` y sesión); `503` con `Retry-After` si el ledger no está.

**Devoluciones**

- **FR-035**: La plataforma MUST poder notificar la devolución de una orden con la credencial
  de plataforma y la capacidad `returns:write`, con `orderId`, instante e ítems devueltos
  opcionales (SKU y cantidad); sin motivo ni datos del comprador.
- **FR-036**: La devolución de un `orderId` desconocido para ese merchant MUST rechazarse con
  `422 order-unknown` (invariante propia, sin registrar); un SKU devuelto que la orden no tenía
  MUST rechazarse con `422 return-items-not-in-order`.
- **FR-037**: La orden devuelta MUST pasar a `RETURNED` conservando su correlación y
  asignación; la respuesta MUST decir `RETURNED` y si la orden estaba atribuida o pendiente.
- **FR-038**: Una notificación de devolución por orden en el MVP (idempotente por `orderId`,
  FR-020); devoluciones parciales sucesivas quedan fuera y la segunda distinta es `409`.

**Redención del incentivo**

- **FR-040**: La notificación de orden MAY declarar el incentivo aplicado con la misma forma
  que el contrato usa para concederlo (`incentive { kind, value }`).
- **FR-041**: OPE MUST cruzar el incentivo declarado con la decisión de la sesión atribuida
  que lo concedió y registrar el resultado: coincide, no coincide (valores distintos, o
  aplicado sin concesión, o concedido sin aplicar) o sin decisión con la que cruzar (orden
  pendiente). Ninguno MUST rechazar la orden ni cambiar la respuesta.
- **FR-042**: El PROPUESTO de la redención en el contrato MUST cerrarse: la mecánica del cupón
  en la plataforma se marca como de la 014 en la descripción del campo.

**Firma de plataforma**

- **FR-050**: Cada merchant MAY configurar uno o dos secretos de firma junto a sus claves de
  plataforma (rotación). Con secreto configurado, toda operación de plataforma del merchant
  (órdenes, devoluciones, catálogo) MUST llegar con una firma del cuerpo calculada con un
  secreto del merchant y un instante, en headers propios.
- **FR-051**: OPE MUST verificar firma e instante **antes** de validar el cuerpo y antes de
  cualquier caso de uso; fallo ⇒ `401` con un motivo propio que distinga firma ausente,
  firma inválida e instante fuera de ventana. La ventana MUST ser fija y documentada (minutos).
- **FR-052**: Un merchant sin secreto MUST seguir autenticando sólo con la clave de plataforma
  (compatibilidad con la 010); la firma nunca reemplaza a la clave, la acompaña.
- **FR-053**: El secreto MUST NOT aparecer en logs, respuestas ni errores; la firma y el
  instante se redactan como todo header.

**Ledger y degradación (ADR-021, constitución IX)**

- **FR-060**: Órdenes, correlaciones, corroboraciones, devoluciones y redenciones MUST ser
  registros del ledger con `merchantId` en toda frontera, detrás de puertos; en memoria hasta
  la 017.
- **FR-061**: Todo registro MUST devolver disponibilidad o indisponibilidad, nunca lanzar;
  una notificación de plataforma o una corroboración con el ledger caído MUST responder `503`
  con `Retry-After` sin registrar nada parcial.

**Contrato y documentación**

- **FR-070**: `notifyOrder`, `corroborateOrder` y `notifyReturn` MUST pasar de `planned` a
  `built` en el mapa del contrato, con sus capacidades, tags y consumidores tal como el mapa
  ya los fija; la adición MUST ser compatible (versión menor).
- **FR-071**: Las reglas que el esquema no expresa (orden desconocida, ítems fuera de la orden,
  conflicto de idempotencia, firma) MUST ser `x-invariants` con tipo propio en el catálogo de
  problemas y su prueba `[invariant:<slug>]`.
- **FR-072**: Glosario: orden verificada, orden atribuida, correlación pendiente,
  corroboración, devolución, mecanismo de correlación, firma de plataforma. ADR-028: cadena de
  evidencia en el ledger (estados explícitos de desconocimiento; correlación sólo por A; B
  como evidencia; C fuera), igualdad canónica para la idempotencia de outcomes, firma HMAC de
  plataforma.
- **FR-073**: Aislamiento probado: una orden con `sessionId` de otro merchant no se atribuye;
  corroboraciones y devoluciones no cruzan merchants; el mismo `orderId` en dos merchants son
  dos órdenes.

### Key Entities

- **Order** (venta verificada): `orderId`, `merchantId`, monto (`Money`), ítems
  `[{ sku, quantity }]`, `confirmedAt`, `sessionId?`, `appliedIncentive?`, `receivedAt`,
  estado de correlación, devolución (si la hay).
- **Correlation**: vínculo verificable orden ↔ sesión, con la asignación (experimento, brazo)
  cuando existe. Sólo por mecanismo A.
- **Corroboration** (mecanismo B): `orderId`, `sessionId`, `visitorId`, `confirmedAt` según el
  navegador, `receivedAt`; vinculada a la orden cuando ambas existen.
- **Return**: `orderId`, `returnedAt`, ítems devueltos opcionales; una por orden.
- **IncentiveRedemption**: incentivo declarado por la orden y resultado del cruce con la
  decisión que lo concedió (coincide, no coincide, sin decisión).
- **PlatformSignature**: secreto(s) de firma por merchant; firma del cuerpo con instante y
  ventana.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Los escenarios de las historias 1–5 dan el estado, el código y el registro
  exactos (tabla, 100 %).
- **SC-002**: 100 notificaciones repetidas de la misma orden (secuenciales y simultáneas)
  producen exactamente un registro y ninguna respuesta distinta de `201` la primera y `200`
  las demás.
- **SC-003**: Toda notificación con un campo fuera del contrato o con cualquiera de los datos
  personales prohibidos se rechaza sin registrar nada (verificado por el ruleset y por
  prueba).
- **SC-004**: Ninguna respuesta ni log de esta feature contiene brazo, experimento, visitante,
  secreto ni firma.
- **SC-005**: Con secreto configurado, ninguna notificación sin firma válida y en ventana se
  registra; sin secreto, el catálogo de la 010 y la suite existente pasan sin cambios.
- **SC-006**: Una notificación de orden se responde en menos de 50 ms (p95) con el ledger en
  memoria; no toca el camino crítico de decisión.
- **SC-007**: Aislamiento entre merchants y gates (`quality`, `contract:check`,
  `test:mutation`, `test:contract`, `release-check`) en verde.

## Assumptions

- El identificador que el storefront propaga a la orden es el `sessionId` de OPE (02 §5.1:
  "identificador de sesión"); el `visitorId` no viaja en la orden. Una sesión es conocida
  cuando el ledger tiene al menos una decisión con ese `sessionId` para el merchant.
- La atribución hereda la asignación del visitante de esa sesión aunque el experimento haya
  cerrado; qué tramo cuenta lo decide el análisis (016).
- Una orden es inmutable una vez registrada; corregirla es un conflicto, no un reintento.
- El monto de la orden es el total pagado por el comprador en la moneda de la tienda
  (`Money` del kernel); impuestos y envío no se desglosan en el MVP.
- Los ítems devueltos, cuando vienen, son informativos: la orden entera pasa a `RETURNED`
  (03 §4.7: la tesis de calidad de compra se mide por orden); devoluciones parciales
  sucesivas quedan fuera.
- La ventana de la firma es de 5 minutos de desfase en cualquier dirección; el instante viaja
  como número de segundos desde la época, y la firma cubre instante y cuerpo exacto (bytes),
  no una forma canónica.
- Las corroboraciones se conservan aunque la orden nunca llegue; no expiran en el MVP (la
  retención es D5).
- Los secretos de firma viven en la configuración de merchants junto a las claves de
  plataforma (uno o dos, como las claves), distintos de ellas.
- Preguntas al stakeholder que no bloquean el diseño y determinan qué podrá afirmar el
  piloto en el merchant elegido (02 §5.3, 03 §7 V4): PROPUESTO — el checkout del merchant
  piloto corre en el mismo origen que la ficha de producto (si no, el mecanismo B no sirve y
  A depende enteramente de propagar el `sessionId` del lado del servidor); PROPUESTO — la
  plataforma notifica las devoluciones, o una parte (cambio de talle en local físico) ocurre
  fuera de sistema y sesga la tasa observada hacia abajo (02 §5.4). Ambas se responden
  siguiendo un checkout real y preguntando al merchant, no leyendo documentación.
