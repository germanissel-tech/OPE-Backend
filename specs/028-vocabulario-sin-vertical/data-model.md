# Data model — El vocabulario deja de nombrar una prenda (028)

No hay entidades nuevas. Lo que cambia son **cuatro vocabularios cerrados** y un campo que
desaparece. Acá está cada uno antes y después, con quién lo declara y quién lo verifica.

## 1 · Puntos de anclaje

Dónde el SDK inserta una intervención. Vocabulario cerrado de OPE; el merchant lo traduce a su sitio
con su mapa de anclajes (patrón «vocabulario cerrado y mapa del merchant», ADR-036).

| Antes           | Después            |
| --------------- | ------------------ |
| `size_selector` | `variant_selector` |
| `price`         | `price`            |
| `cta`           | `cta`              |
| `policies`      | `policies`         |

**Dónde vive**: el enum `Anchor` del contrato y su réplica `ANCHORS` en
`src/domain/shared-kernel/intervention.ts`, que una prueba verifica contra el contrato. Las claves del
`AnchorMap` que un merchant publica son estos mismos nombres.

**Por qué cuatro y no cinco**: `01 §3` enumera cinco lugares —selector de talle, selector de color,
precio, CTA, políticas— y el contrato publicaba cuatro. Un `variant_selector` cubre los dos
selectores, porque son el mismo control conceptual: el que elige variante.

## 2 · Tipos de evento

| Antes                      | Después                       | Qué reporta                                     |
| -------------------------- | ----------------------------- | ----------------------------------------------- |
| `size_selector_interacted` | `variant_selector_interacted` | el visitante **tocó** el control (intención)    |
| `variant_selected`         | `variant_selected`            | el visitante **eligió** una variante (un hecho) |

Los demás tipos no cambian. **Los dos se quedan**: las reglas de la política los usan con umbrales
distintos, y uno resuelve contra el catálogo mientras el otro no (R-02).

**El campo que desaparece**: el evento del selector llevaba la etiqueta del talle «como la muestra la
tienda». Ninguna autoridad la lee —el extractor de señales devuelve `undefined` para ese tipo— y es
texto libre del merchant sin normalizar. El evento queda **sin campos propios**, como
`product_viewed`.

**Dónde vive**: el `oneOf` + `discriminator` de `Event` en el contrato, el archivo del esquema del
evento (que se renombra), `EVENT_TYPES` y la interfaz del evento en `src/domain/ingestion/event.ts`, y
el `switch` exhaustivo de `src/domain/barrier/signals.ts`, que **no compila** si falta un caso.

## 3 · Bloques de la ficha

Dónde el visitante permanece. Vocabulario cerrado de OPE **porque la inferencia lo lee**: permanecer
en uno es evidencia. Por eso no puede ser un nombre que cada tienda elija (R-04).

| Antes         | Después          |
| ------------- | ---------------- |
| `description` | `description`    |
| `size_guide`  | `specifications` |
| `reviews`     | `reviews`        |
| `policies`    | `policies`       |
| `price`       | `price`          |
| `gallery`     | `gallery`        |
| `cta`         | `cta`            |

**Dónde vive**: el enum `block` de `BlockDwelled` en el contrato y `BLOCKS` en
`src/domain/ingestion/event.ts`.

## 4 · Barreras declarables por un merchant

| Antes                                                        | Después                                       |
| ------------------------------------------------------------ | --------------------------------------------- |
| `minItems: 1`, `maxItems: 3`, `uniqueItems: true`, enum de 3 | `minItems: 1`, `uniqueItems: true`, enum de 3 |

**El tope no se reemplaza: se borra.** Con `uniqueItems: true` sobre un enum de tres miembros, una
lista de más de tres no puede existir — el esquema ya lo prohibía por otro camino. El número decía
«un merchant elige hasta tres» cuando lo que quería decir era «existen tres», y esas dos cosas dejan
de coincidir el día que exista una cuarta barrera.

Las **barreras** en sí (`fit`, `price`, `returns`) **no cambian**: son tres por decisión de producto
`DECIDIDO` (`01 §4.2`), y el código ya las nombraba con la mitad genérica del término que la fuente
usaba.

## 5 · Identificadores de reglas de la política de decisión

Configuración, no código. Viajan al ledger como el motivo por el que se infirió una barrera.

| Antes                             | Después                              |
| --------------------------------- | ------------------------------------ |
| `fit.size-selector-twice`         | `fit.variant-selector-twice`         |
| `fit.size-guide-read`             | `fit.specifications-read`            |
| `returns.size-doubt-and-policies` | `returns.variant-doubt-and-policies` |

## 6 · Familias del corpus de mensajes

Una familia es `<barrera>.<anclaje>.<escalón>`, así que renombrar el anclaje renombra tres familias.

| Antes                           | Después                            |
| ------------------------------- | ---------------------------------- |
| `fit.size_selector.information` | `fit.variant_selector.information` |
| `fit.size_selector.uncertainty` | `fit.variant_selector.uncertainty` |
| `fit.size_selector.evidence`    | `fit.variant_selector.evidence`    |

**Cada texto afectado se sirve con una versión nueva.** El texto no cambia; la versión sí, porque una
versión es inmutable (ADR-036) y porque el identificador lleva la familia adentro: conservarlo dejaría
un identificador nombrando una familia que no existe, que es D-13 otra vez.

Se unifica de paso el formato del identificador, que hoy convive en dos estilos dentro del mismo
archivo.

## Invariantes que esta feature NO cambia

- La verdad vive en la variante exacta, nunca en el producto (`01 §4.3`).
- El stock es guardia, no claim (`01 §4.3`, `DECIDIDO`).
- Existen tres barreras y agregar una es cambio de alcance (constitución, `Contrato de datos e
identidad`).
- Una versión de texto es inmutable y el ledger registra el identificador, nunca el texto (ADR-036).
- El vocabulario de claims del quality gate (ADR-027): no se toca ninguno.
