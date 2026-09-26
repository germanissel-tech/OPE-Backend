# Feature Specification: La variante deja de exigir dos atributos de indumentaria

**Feature Branch**: `029-variante-generica`

**Created**: 2026-09-25

**Status**: Draft

**Input**: Cierra **D-16**. Sale de `main` limpio (`95294f5`, con la 028 mergeada y el CI de `main`
verificado).

## Contexto: la pregunta que la bloqueaba no existía

La feature 028 dejó la variante afuera **a propósito** y escribió el motivo: parecía necesitar una
decisión de diseño previa —cómo sabría el claim de calce cuál de los atributos de una variante es el
que se recomienda— y eso la hacía distinta de un renombre.

**Al medirla, esa pregunta no existe.** Nada del camino de decisión lee los dos atributos de
indumentaria que el catálogo exige hoy. Los únicos dos lugares que los tocan son la huella de
contenido del snapshot, que los serializa para comparar catálogos, y el controller que los copia de
la petición al dominio. El claim de calce no los mira: la variante se identifica por su identificador
y el quality gate sólo exige que **haya** una variante en foco.

Son dos campos obligatorios que viajan, se validan, se guardan y no los lee ninguna autoridad —
**exactamente el caso del campo del evento que la 028 eliminó**, y la regla que esa feature escribió
es la que aplica: un campo que ninguna autoridad lee no sigue en el contrato, y si se conserva hay
que decir quién lo lee.

**La decisión del dueño (2026-09-25) es conservarlos, generalizados**, no eliminarlos. Eliminarlos
sería más barato, pero dejaría la variante como un identificador opaco mientras la fuente —enmendada
ese mismo día— la define como «la combinación exacta de **atributos** que define un artículo
vendible». El documento describiría algo que el contrato ya no representa.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Una tienda que no vende ropa puede publicar su catálogo (Priority: P1)

Una plataforma integra un comercio de electrodomésticos. Para publicar su catálogo tiene que enviar,
por cada variante, un talle y un color: campos obligatorios que su mundo no tiene. Hoy la única salida
es inventarlos —mandar cadenas vacías o repetir el nombre del producto— y eso ensucia el dato de
todos los merchants para siempre, porque lo que entra al catálogo se guarda tal cual.

Después de esta historia, cada variante declara **los atributos que la definen**, con las mismas
claves libres que el producto ya admite: una heladera manda capacidad y terminación, una prenda manda
talle y color, y el sistema no necesita saber cuál es cuál.

**Why this priority**: es la historia entera. La feature tiene una sola.

**Independent Test**: publicar un catálogo cuyas variantes declaran atributos que no son de
indumentaria y verlo aceptado; publicar uno con los campos viejos y verlo rechazado nombrando el
campo; y comprobar que una decisión sobre ese catálogo es idéntica a la de antes.

**Acceptance Scenarios**:

1. **Given** una plataforma que publica un catálogo cuyas variantes declaran atributos de cualquier
   clase, **When** lo envía, **Then** se acepta y la verdad de producto queda legible como antes.
2. **Given** un catálogo cuyas variantes traen los dos campos de indumentaria que el contrato exigía,
   **When** se envía, **Then** se rechaza nombrando el campo: el vocabulario es cerrado y no hay
   período de convivencia.
3. **Given** dos publicaciones del mismo catálogo con el mismo instante de captura, **When** la
   segunda repite exactamente el contenido, **Then** se responde como repetición y no como conflicto,
   igual que antes del cambio.
4. **Given** dos publicaciones con el mismo instante cuyas variantes difieren **sólo** en un atributo,
   **When** llega la segunda, **Then** se responde conflicto de idempotencia: un atributo distinto es
   contenido distinto.
5. **Given** una secuencia de señales que antes producía una intervención, **When** el catálogo se
   publica con la forma nueva, **Then** la decisión es idéntica: misma barrera, misma confianza, mismo
   escalón, mismo anclaje y mismo texto.

---

### Edge Cases

- **Una variante sin ningún atributo** → se acepta. Lo que define una variante es su identificador;
  los atributos dicen qué la distingue de sus hermanas, y una variante única puede no necesitar
  ninguno. El producto ya admite una lista vacía de atributos.
- **Dos variantes del mismo producto con los mismos atributos** → se acepta, como hoy: lo que tiene
  que ser único en la instantánea es el identificador de la variante, y eso no cambia.
- **Un atributo repetido dentro de la misma variante** → se acepta y se conserva tal cual, como en el
  producto. El contrato declara que los valores llegan como la plataforma los expone, sin
  normalización, y esta feature no inventa una regla que el producto no tiene.
- **Un catálogo del tamaño del piloto** → la forma nueva no puede costar más: la prueba de carga que
  ya existe es la que lo dice.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: La variante del catálogo NO DEBE exigir ningún atributo propio de una vertical.
- **FR-002**: La variante DEBE poder declarar los atributos que la definen, con la **misma forma,
  los mismos límites y la misma regla de no-normalización** que los atributos del producto: si las
  dos listas se leen distinto, el contrato tiene dos maneras de decir lo mismo.
- **FR-003**: Una variante sin atributos DEBE aceptarse.
- **FR-004**: Un catálogo que use la forma vieja DEBE rechazarse nombrando el campo, sin período de
  convivencia.
- **FR-005**: La comparación de contenido entre dos instantáneas DEBE considerar los atributos de la
  variante, de modo que dos catálogos que difieren sólo en uno no se confundan con una repetición.
- **FR-006**: El cambio NO DEBE alterar ningún comportamiento observable de la decisión: para la misma
  secuencia de señales, la barrera, la confianza, el escalón, el anclaje y el texto DEBEN ser los
  mismos antes y después.
- **FR-007**: Ningún atributo de la variante DEBE salir del backend hacia el SDK ni hacia la
  administración por efecto de esta feature: la variante no aparece hoy en ninguna respuesta y sigue
  sin aparecer.
- **FR-008**: Al cerrar, la definición de la variante en el contrato y el módulo de catálogo del
  dominio NO DEBEN nombrar ningún concepto de indumentaria.

### Key Entities

- **Variante**: la combinación exacta de atributos que define un artículo vendible; el único nivel
  donde vive la verdad de stock. Tiene identificador, disponibilidad como guardia, precio y **los
  atributos que la distinguen**.
- **Atributo**: un par clave/valor tal como la plataforma lo expone, sin normalización. Ya existe en
  el producto y esta feature lo reusa sin cambiarlo.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Una plataforma de un rubro que no es indumentaria puede publicar un catálogo completo
  sin inventar ningún dato: ningún campo obligatorio le pide algo que su mundo no tiene.
- **SC-002**: Para la misma secuencia de señales, la decisión es idéntica antes y después del cambio.
- **SC-003**: Publicar dos veces el mismo catálogo sigue siendo una repetición, y publicar dos
  catálogos que difieren en un atributo de variante sigue siendo un conflicto.
- **SC-004**: La definición de variante del contrato no contiene ningún concepto de indumentaria,
  verificado por un comando y no por lectura.
- **SC-005**: Un catálogo del tamaño del piloto se acepta en una operación, dentro del mismo
  presupuesto que hoy.

## Assumptions

- **Ningún merchant consume el contrato** (`info.x-stability: building`, ADR-003), así que el cambio
  incompatible entra con bump MINOR: `contract:diff` lo reporta y lo acepta, y `release-check` avisa.
- **Nada persistido que migrar** (decisión del dueño, 2026-09-25): el catálogo vive en memoria.
- **La variante no aparece en ninguna respuesta del contrato**, verificado: sólo la referencia el
  producto, dentro del cuerpo de la publicación del catálogo. Es un cambio de petición solamente.
- **Los atributos del producto son el precedente y no se tocan.** Existen desde la feature 010 con
  claves libres, y esta feature copia su forma en vez de inventar otra.
- **El orden de los atributos importa para la comparación de contenido**, porque ya importa para los
  del producto. No es una decisión de esta feature: es el precedente que se respeta.

## Lo que esta feature NO hace, y por qué

- **Ningún claim lee los atributos de la variante.** Hoy ninguno lo hace y acá no se inventa uno:
  sería un claim nuevo, y el vocabulario de claims es cerrado (ADR-027). Esta feature deja el dato
  disponible; usarlo es una decisión de producto.
- **La recomendación de variante** que el nivel 2 de sincronización habilita sigue en el roadmap:
  necesita el puerto de plataforma.
- **No se normaliza ningún valor.** El contrato dice que llegan como la plataforma los expone y la
  feature 027 decidió que un valor crudo del merchant nunca se publica. Las dos cosas siguen valiendo.
