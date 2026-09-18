# Feature Specification: Catálogo y stock

**Feature Branch**: `010-catalogo-y-stock`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Catálogo y stock (feature 010 del mapa). Primera fuente de verdad
de producto de OPE: la verdad a nivel de la variante exacta (talle + color + disponibilidad +
precio vigente), que el plano de decisión consultará desde caché caliente, nunca desde la
plataforma del merchant en el camino crítico. Módulo `catalog` con snapshot por merchant,
frescura fail-closed, perfil de datos observado, operación `upsertCatalogSnapshot` del
consumidor `platform` (primera: se decide `platformKey` y las capacidades), puerto de verdad de
producto para el plano de decisión, aislamiento, glosario y ADR."

## Contexto

OPE decide qué decir a partir de dos cosas: lo que el visitante hizo (ingesta, 004) y lo que es
verdad del producto (01-arquitectura-mvp.md §4.3, §8). Hoy existe lo primero y no lo segundo:
el plano de decisión (011) no tiene de dónde leer si una variante existe, si está disponible ni
cuánto vale, y sin eso toda intervención sería un claim sin evidencia, que la constitución
prohíbe. Esta feature construye esa fuente: el catálogo del merchant como snapshot en caché
caliente, con la verdad a nivel de **variante** (talle + color), su **disponibilidad como
guardia** y su **precio vigente**, con la edad de cada dato a la vista para que quien consulte
falle cerrado cuando la verdad es vieja.

Es además la primera operación de un consumidor nuevo, la **plataforma del merchant**
(02-integracion-ecommerce.md §6): el adaptador genérico —"cualquier ecommerce capaz de hacer un
POST"— empuja el catálogo completo. Eso obliga a decidir la credencial servidor a servidor que
ADR-020 dejó propuesta y a verificar capacidades por consumidor, cosas que las 13 y 016 (órdenes,
portal) reutilizan.

Tres decisiones del MVP gobiernan el alcance y no se reabren: **el stock es guardia, no claim**
(01 §4.3, DECIDIDO: OPE no afirma disponibilidad ni cantidades; la escasez numérica queda
fuera); **el perfil de datos se mide, no se declara** (01 §14.1, DECIDIDO); y **nunca se
consulta a la plataforma del merchant en el camino crítico** (01 §4.6, 02 §4).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - La plataforma del merchant entrega su catálogo y OPE lo acepta o lo rechaza con motivo (Priority: P1)

El adaptador de la plataforma del merchant (genérico: un proceso del lado del merchant que
puede hacer un PUT) envía el catálogo completo: productos con sus atributos y sus variantes,
cada variante con talle, color, si está disponible y su precio vigente, más el instante en que
la plataforma tomó la foto. OPE lo autentica con la credencial de plataforma del merchant,
valida las reglas que el formato no expresa, lo reemplaza como **el** snapshot vigente del
merchant y responde con un resumen: cuántos productos y variantes, cuándo lo recibió y qué
nivel de sincronización observa. Enviarlo dos veces deja el mismo estado.

**Why this priority**: sin snapshot no hay verdad de producto; todo lo demás de la feature
consume lo que esta historia guarda.

**Independent Test**: con la credencial de plataforma de un merchant, un snapshot válido se
acepta y su resumen coincide con lo enviado; uno que viola una regla se rechaza con el tipo de
problema de esa regla y no reemplaza al vigente; sin credencial o con la de ingesta, se rechaza
antes de validar el cuerpo.

**Acceptance Scenarios**:

1. **Given** un merchant con credencial de plataforma, **When** su adaptador envía un snapshot
   de N productos y M variantes válido, **Then** OPE responde éxito con `products: N`,
   `variants: M`, el instante de recepción y el nivel observado, y una consulta posterior de
   cualquiera de esas variantes devuelve lo enviado.
2. **Given** un snapshot vigente, **When** llega otro con menos productos, **Then** el vigente
   es el nuevo: los productos que ya no vienen dejan de existir para OPE (reemplazo completo,
   no fusión).
3. **Given** el mismo snapshot enviado dos veces, **When** se consulta la verdad, **Then** es
   idéntica y el resumen de la segunda respuesta es igual al de la primera salvo el instante de
   recepción.
4. **Given** una variante que referencia un producto que no está en el snapshot, dos variantes
   con el mismo identificador, un instante de captura en el futuro más allá de la tolerancia o
   una moneda que no es ISO 4217, **When** se envía, **Then** OPE responde 422 con el tipo de
   problema de esa invariante y el snapshot vigente no cambia.
5. **Given** un request sin credencial de plataforma o con la credencial de ingesta, **When**
   se envía, **Then** OPE responde 401 (o 403 si la credencial es válida pero no tiene la
   capacidad `catalog:write`) sin leer el cuerpo.
6. **Given** un snapshot vacío (cero productos), **When** se envía, **Then** se acepta: es la
   forma de decir "no tengo catálogo" y OPE deja de tener verdad de producto para ese merchant.

---

### User Story 2 - Quien decide lee la verdad de la variante o recibe "sin verdad" con motivo (Priority: P1)

El plano de decisión (y hoy sus pruebas) pregunta por un merchant, un producto y una variante y
obtiene la variante con sus atributos, su disponibilidad y su precio, cada dato acompañado de
si es lo bastante fresco para sostener un claim de su clase; o bien "sin verdad" con motivo:
no hay snapshot, el producto o la variante no existen, o el snapshot es más viejo que el
presupuesto de frescura. Con "sin verdad", el consumidor se calla (P3).

**Why this priority**: es el uso de la feature; sin esta lectura el snapshot es un archivo.

**Independent Test**: con un snapshot reciente, la consulta devuelve la variante con
disponibilidad y precio marcados frescos; con el reloj adelantado más allá del presupuesto de
stock, los mismos datos vuelven con disponibilidad y precio marcados viejos y la variante
sigue existiendo; más allá del presupuesto de catálogo, "sin verdad: vieja"; sin snapshot,
"sin verdad: ausente"; producto desconocido, "sin verdad: producto desconocido".

**Acceptance Scenarios**:

1. **Given** un snapshot recibido hace 5 minutos, **When** se consulta una de sus variantes,
   **Then** vuelve con talle, color, disponibilidad, precio y atributos del producto, y tanto
   el catálogo como el stock/precio se reportan frescos.
2. **Given** el mismo snapshot recibido hace 2 horas, **When** se consulta, **Then** la
   variante vuelve con el catálogo fresco y el stock/precio **viejos**: quien decide puede
   hablar de calce y atributos, no de disponibilidad ni precio (01 §8, §14.1).
3. **Given** un snapshot recibido hace 3 días, **When** se consulta, **Then** "sin verdad"
   con motivo "vieja".
4. **Given** un merchant sin snapshot, **When** se consulta, **Then** "sin verdad" con motivo
   "ausente".
5. **Given** un producto o variante que no está en el snapshot, **When** se consulta, **Then**
   "sin verdad" con motivo "producto desconocido" / "variante desconocida".
6. **Given** una variante marcada no disponible, **When** se consulta, **Then** vuelve con
   `available: false`: la guardia dice "no recomendar", nunca "quedan pocas".

---

### User Story 3 - El nivel de sincronización se observa, no se declara (Priority: P2)

A partir de cuándo llegan los snapshots y de la edad del vigente, OPE deriva el nivel de
sincronización **observado** del merchant: 0 sin datos, 1 volcado diario, 2 actualización en
minutos, 3 notificación por cambio. Sube cuando la cadencia lo sostiene y baja sola cuando se
rompe. Se informa en la respuesta del upsert y se puede consultar; lo que cada nivel habilita
llega con la configuración (014).

**Why this priority**: es la mitad medible de "el perfil se mide, no se declara"; sin ella la
014 no tiene contra qué tomar el mínimo.

**Independent Test**: con snapshots cada 5 minutos el nivel observado es 2; si pasan 6 horas
sin snapshot baja a 1; a las 48 horas es 0; un merchant que nunca envió está en 0; ningún
merchant alcanza 3 sólo con snapshots completos (3 requiere notificación por cambio, fuera
del alcance).

**Acceptance Scenarios**:

1. **Given** un merchant sin snapshots, **When** se pregunta el nivel, **Then** 0.
2. **Given** snapshots cada 5 minutos durante una hora, **When** se pregunta, **Then** 2.
3. **Given** un snapshot diario durante tres días, **When** se pregunta, **Then** 1.
4. **Given** nivel 2 y 6 horas sin snapshot, **When** se pregunta, **Then** 1; a las 48 horas,
   0 (degrada solo).
5. **Given** cualquier serie de snapshots completos, **When** se pregunta, **Then** nunca 3.

---

### User Story 4 - Una credencial de plataforma por merchant, distinta de la de ingesta (Priority: P1)

El operador de OPE configura, junto a las claves de ingesta, una o dos claves de plataforma por
merchant (dos durante una rotación). Van en un header propio, sólo servidor a servidor, nunca en
el tag ni en el navegador. Identifican al merchant y habilitan las capacidades del consumidor
`platform`; una clave de ingesta no sirve para operar como plataforma ni al revés. La primera
operación de un consumidor también trae la verificación general: toda operación autenticada
declara capacidades y el servidor las exige.

**Why this priority**: sin ella la historia 1 no se puede autenticar, y órdenes y devoluciones
(013) la reutilizan tal cual.

**Independent Test**: la clave de plataforma de A autentica el upsert de A; la de ingesta de A
no; la de plataforma de A no puede ingerir eventos; la de plataforma de B no ve ni toca el
catálogo de A; un merchant configurado sin clave de plataforma no puede recibir catálogo y
todo lo demás sigue funcionando.

**Acceptance Scenarios**:

1. **Given** la clave de plataforma de A, **When** hace el upsert, **Then** se acepta y el
   snapshot queda bajo A.
2. **Given** la clave de ingesta de A en el header de plataforma, o la de plataforma en el
   de ingesta, **When** se intenta, **Then** 401.
3. **Given** una operación con `x-required-capabilities` que la credencial no cubre, **When**
   se intenta, **Then** 403 con un tipo de problema propio y sin leer el cuerpo.
4. **Given** un merchant sin claves de plataforma, **When** arranca el servidor, **Then**
   arranca; ese merchant simplemente no puede recibir catálogo.
5. **Given** los logs de un upsert, **When** se leen, **Then** no contienen la clave.

---

### Edge Cases

- Un snapshot con un producto sin variantes es válido (el producto existe; sin variante no hay
  verdad de disponibilidad ni precio).
- `capturedAt` anterior a `receivedAt` en horas: se acepta (la plataforma pudo tardar); la
  edad para frescura se mide desde `capturedAt`, la cadencia desde `receivedAt`.
- `capturedAt` en el futuro más allá de la tolerancia: 422 (reloj mal configurado del lado del
  merchant; aceptarlo daría frescura falsa).
- Un snapshot más viejo (por `capturedAt`) que el vigente: se rechaza como fuera de orden con su
  tipo de problema; el vigente no cambia (una réplica retrasada no puede pisar verdad más nueva).
- Precios: importe como texto decimal (sin redondeo binario, ADR-014), moneda ISO 4217 de tres
  letras; una variante puede tener precio y otra del mismo producto otro.
- Atributos del producto: pares nombre/valor de texto tal como los expone la plataforma; sin
  normalización (la normalización por LLM es 01 §8, fuera de alcance).
- El tamaño del snapshot: un catálogo de indumentaria de piloto tiene miles de productos y
  decenas de miles de variantes; el reemplazo completo tiene que aceptarse en una sola
  operación dentro de un tiempo razonable (SC-004).
- Un merchant con dos claves de plataforma durante una rotación: ambas autentican hasta que se
  retire una.

## Requirements _(mandatory)_

### Functional Requirements

**Snapshot y verdad de producto**

- **FR-001**: El sistema MUST aceptar por merchant un snapshot completo del catálogo con
  productos (identificador, nombre, atributos nombre/valor) y variantes (identificador,
  producto, talle, color, disponibilidad booleana, precio con importe decimal y moneda ISO
  4217), más el instante de captura declarado por la plataforma, y MUST registrar el instante
  de recepción.
- **FR-002**: Un snapshot MUST cumplir por construcción: toda variante referencia un producto
  del mismo snapshot; identificadores de producto únicos y de variante únicos; `capturedAt`
  no posterior al instante de recepción más la tolerancia publicada; moneda válida. Cada
  regla tiene su tipo de problema en el catálogo y se declara como `x-invariants` (ADR-007).
- **FR-003**: El upsert MUST reemplazar el snapshot vigente del merchant por completo y MUST
  ser idempotente; un snapshot con `capturedAt` anterior al vigente MUST rechazarse sin
  cambiar el vigente.
- **FR-004**: El sistema MUST NOT almacenar ni exponer cantidades de stock: la disponibilidad es
  un booleano por variante (01 §4.3, DECIDIDO).
- **FR-005**: MUST existir una consulta de verdad de producto por merchant, producto y variante
  que devuelva la variante (talle, color, disponibilidad, precio, atributos del producto) con
  la frescura de cada clase de dato —catálogo y stock/precio— evaluada contra su presupuesto,
  o "sin verdad" con motivo: ausente, vieja, producto desconocido, variante desconocida.
- **FR-006**: Los presupuestos de frescura MUST ser políticas de aplicación publicadas y
  distintas por clase: catálogo y variantes en el orden de un día; stock y precio en el orden
  de minutos (01 §8); MUST NOT vivir en un gateway. Pasan a ser configurables por merchant con
  la 014.
- **FR-007**: La consulta de verdad MUST leer de la caché caliente y MUST NOT tocar ninguna
  plataforma externa (constitución: sin I/O de red en el camino crítico).

**Perfil de datos observado**

- **FR-010**: El sistema MUST derivar por merchant el nivel de sincronización observado (0–3)
  a partir de la cadencia de los snapshots recibidos y de la edad del vigente, con umbrales
  publicados; MUST degradar solo al pasar el tiempo sin snapshots; MUST NOT alcanzar 3 con
  snapshots completos (3 requiere notificación por cambio, fuera de alcance).
- **FR-011**: El nivel observado MUST informarse en la respuesta del upsert y MUST poder
  consultarse por merchant desde la aplicación (la salud del merchant lo expone en 018).

**Operación y consumidor**

- **FR-020**: `upsertCatalogSnapshot` (`PUT /v1/catalog`) MUST pasar de `planned` a `built` en
  el mapa, bajo el consumidor `platform`, tag `outcomes`, capacidad `catalog:write`, con el
  esquema de seguridad `platformKey` referenciado desde la raíz del contrato (primera
  operación del consumidor, ADR-019/020).
- **FR-021**: `platformKey` MUST decidirse y construirse: clave por merchant (una o dos,
  rotación) configurada en `OPE_MERCHANTS` junto a las de ingesta, en un header propio, sólo
  servidor a servidor (sin CORS); MUST resolverse con el mismo patrón que la credencial de
  ingesta (servicio del módulo `merchant` + security handler) y MUST NOT ser intercambiable
  con ella. La firma HMAC del cuerpo queda PROPUESTA para el primer adaptador real (ADR-020).
- **FR-022**: El servidor MUST verificar `x-required-capabilities` de toda operación
  autenticada contra las capacidades del consumidor de la credencial, antes de validar el
  cuerpo, respondiendo 403 con un tipo de problema propio.
- **FR-023**: Con el segundo esquema de seguridad, cada esquema MUST declarar su header en el
  cableado, y los headers admitidos por CORS y las rutas redactadas del log MUST derivarse de
  los esquemas registrados (cierra el PROPUESTO de ADR-020).
- **FR-024**: La respuesta del upsert MUST devolver el resumen: productos, variantes, instante
  de recepción y nivel observado; MUST NOT devolver el snapshot.

**Aislamiento y privacidad**

- **FR-030**: El snapshot de un merchant MUST NOT ser visible ni reemplazable desde otro; el
  mismo `productId` en dos merchants MUST ser dos productos distintos; probado en la suite de
  aislamiento.
- **FR-031**: Las claves de plataforma MUST NOT aparecer en logs ni en respuestas.

**Documentación y verificación**

- **FR-040**: Glosario: `catalogo` (snapshot), `disponibilidad`, `precio`, `frescura`,
  `perfil-de-datos`; notas de `producto` y `variante` actualizadas con su uso en catálogo.
- **FR-041**: Una decisión de arquitectura MUST registrar: `platformKey` y la verificación de
  capacidades; el snapshot completo con reemplazo idempotente y rechazo fuera de orden; los
  presupuestos de frescura por clase; la derivación del nivel observado.
- **FR-042**: El módulo `catalog` MUST seguir ADR-023/024: aggregate `CatalogSnapshot` con
  fábrica y rehidratación, errores en su `errors.ts`, caso de uso `UpsertCatalogSnapshotUseCase`,
  servicio o caso de uso de lectura de verdad, puertos con implementación en memoria.

### Key Entities

- **CatalogSnapshot**: la foto completa del catálogo de un merchant en un instante
  (`capturedAt`) recibida en otro (`receivedAt`); productos y variantes; reemplaza a la anterior.
- **Product**: identificador de la plataforma, nombre, atributos nombre/valor; sus variantes.
- **Variant**: identificador, producto, talle, color, `available` (guardia), `price`.
- **Price**: importe decimal como texto + moneda ISO 4217.
- **ProductTruth**: la respuesta a una consulta: variante con frescura por clase, o "sin
  verdad" con motivo.
- **Freshness budget**: presupuesto por clase de dato (catálogo, stock/precio).
- **Observed sync level**: 0–3 derivado de la cadencia y la edad.
- **Platform key**: credencial servidor a servidor del merchant, consumidor `platform`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Un snapshot válido se refleja en la verdad consultable en la misma operación
  (lectura inmediatamente posterior consistente) en el 100 % de los casos probados.
- **SC-002**: El 100 % de las invariantes del snapshot tiene tipo de problema, `x-invariants`
  y prueba `[invariant:<slug>]`; ninguna regla vive sólo en código.
- **SC-003**: Con el reloj controlado, la frescura y el nivel observado responden exactamente
  según los umbrales publicados en todos los escenarios de las historias 2 y 3.
- **SC-004**: Un snapshot de 5 000 productos y 50 000 variantes se acepta en una sola operación
  en menos de 2 segundos en el perfil local (cifra informativa, no SLA).
- **SC-005**: La suite de aislamiento cubre catálogo y credenciales de plataforma; la de
  latencia de ingesta no cambia (el catálogo no toca la ingesta).
- **SC-006**: `contract:check` en verde con el mapa en 4 built; `quality`, `test:mutation`,
  `test:contract` y `release-check` en verde; `check:markers` sin el PROPUESTO de ADR-020
  sobre headers de seguridad.

## Assumptions

- Formato del snapshot: el que el adaptador genérico puede producir sin conocer OPE:
  productos con variantes anidadas; identificadores con el patrón de ids del contrato.
- Presupuestos de frescura por defecto: catálogo/variantes 36 h; stock/precio 15 min.
  Tolerancia de `capturedAt` en el futuro: 5 min (la misma que los eventos).
- Umbrales del nivel observado: 2 si el intervalo mediano de los últimos snapshots es ≤ 15 min
  y el vigente tiene menos de 1 h; 1 si hay snapshot con menos de 36 h; 0 en otro caso.
- Nombre del header de plataforma: `X-OPE-Platform-Key` (como ya propone el esquema).
- Capacidades del consumidor `platform` en el mapa: `catalog:write` (esta feature),
  `orders:write` y `returns:write` (013); la credencial otorga todas las de su consumidor.
- Sin paginación ni compresión del snapshot en esta feature; si el tamaño lo exige, es una
  operación por lotes posterior (V3).
- El tag `outcomes` del mapa agrupa lo que la plataforma empuja (catálogo, órdenes,
  devoluciones); no se renombra.
