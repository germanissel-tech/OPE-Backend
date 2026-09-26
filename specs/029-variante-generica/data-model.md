# Data model — La variante deja de exigir dos atributos de indumentaria (029)

Una entidad cambia de forma y un concepto que ya existía pasa a tener nombre propio en el contrato.
Nada se agrega al modelo: el atributo ya estaba, escrito dos veces a medias.

## 1 · Atributo del catálogo

Un par clave/valor **tal como la plataforma lo expone, sin normalización**. Existe desde la feature
010 en el producto, definido en línea.

| Antes                                     | Después                                                 |
| ----------------------------------------- | ------------------------------------------------------- |
| objeto anónimo dentro de `CatalogProduct` | componente propio, referenciado por producto y variante |

**Los límites no cambian**: clave hasta 64, valor hasta 512, los dos requeridos, `additionalProperties: false`,
la lista hasta 64 entradas. Lo que cambia es que están escritos **una vez**.

**Por qué importa**: hoy la pregunta «¿cuánto mide un valor de atributo?» tendría dos respuestas en
cuanto la variante lo definiera por su cuenta, y la próxima vez que alguien ajustara un límite
ajustaría una sola. En el dominio ya era así: la interfaz `Attribute` se reusa tal cual (research R-06).

## 2 · Variante del catálogo

La combinación exacta de atributos que define un artículo vendible; el único nivel donde vive la
verdad de stock (`01 §0.1`, enmendado el 2026-09-25).

| Campo        | Antes                   | Después                          |
| ------------ | ----------------------- | -------------------------------- |
| `variantId`  | requerido               | **sin cambio**                   |
| `size`       | **requerido**, hasta 32 | **no existe**                    |
| `color`      | **requerido**, hasta 64 | **no existe**                    |
| `attributes` | —                       | **opcional**, lista de atributos |
| `available`  | requerido, guardia      | **sin cambio**                   |
| `price`      | requerido               | **sin cambio**                   |

**Opcional y no requerido** (research R-01): es lo que el producto hace, y una variante sin nada que
declarar es legítima — lo que la identifica es su identificador.

**Dónde vive**: el esquema del contrato, la interfaz del dominio en `catalog-snapshot.ts` y el
controller que copia el DTO. La variante **no aparece en ninguna respuesta**, así que el cambio no
llega al SDK ni a la administración.

## 3 · La huella de contenido de una instantánea

Lo que decide si dos publicaciones del mismo instante son «la misma» o un conflicto de idempotencia.

| Antes                                                                     | Después                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| por variante: identificador, **talle**, **color**, disponibilidad, precio | por variante: identificador, **sus atributos**, disponibilidad, precio |

**Es la única parte de esta feature que cambia comportamiento**, y hacia mejor: hasta hoy dos
catálogos del mismo instante que diferían en un eje que no fuera talle o color se consideraban
idénticos. Ahora se distinguen.

El producto ya serializa sus atributos en el orden recibido una línea más arriba, y la variante copia
ese precedente: reordenarlos es contenido distinto (research R-03).

## Invariantes que esta feature NO cambia

- El identificador de variante es único en la instantánea, y el de producto también.
- El stock es guardia y nunca un claim (`01 §4.3`, `DECIDIDO`).
- La verdad vive en la variante exacta y no en el producto.
- Los valores llegan **como la plataforma los expone**; nada se normaliza, y un valor crudo del
  merchant nunca se publica como texto (ADR-036).
- Un atributo repetido y dos variantes con los mismos atributos se aceptan, igual que en el producto:
  esta feature no inventa una invariante que el precedente no tiene.
