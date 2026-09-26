# Research — El vocabulario deja de nombrar una prenda (028)

Cada decisión con lo medido al lado. Lo que no se midió se dice que no se midió.

## R-00 — Lo que hay que renombrar, contado

Antes de decidir nombres, cuánto es. `grep -rE 'size_selector|size_guide'`, sin `contracts/dist/`
ni lo generado:

| Área            | Archivos | Ocurrencias |
| --------------- | -------- | ----------- |
| `contracts/`    | 12       | 36          |
| `config/`       | 2        | 15          |
| `src/`          | 5        | 9           |
| `tests/`        | 27       | 103         |
| `docs/dominio/` | 2        | 3           |

**El código es lo más chico y las pruebas lo más grande**, que es lo que uno espera de un renombre
bien encapsulado: cinco archivos de `src/` tocan el vocabulario y el resto lo consume por tipos.
`specs/` anteriores y `docs/auditoria/` quedan **afuera a propósito**: son históricos y fechados, y
reescribirlos falsificaría lo que cada feature decidió en su momento.

## R-01 — Cómo se llama el punto de anclaje

**Decisión**: `variant_selector`.

**Motivo**: es lo que la fuente dice desde la enmienda del 2026-09-25 —«dónde están el selector de
variante, el bloque de precio, el CTA y el bloque de políticas»— y `variant` ya es vocabulario del
sistema: `variantId`, `variant_selected`, `CatalogVariant`, la nota `docs/dominio/variante.md`. No
entra ningún sustantivo nuevo al glosario, que es lo que ADR-008 pediría verificar.

**Alternativas descartadas**: `options_selector` y `variant_picker` — las dos introducen un
sustantivo que el glosario no tiene, para nombrar algo que ya tiene nombre.

**Lo que se cierra de paso**: `01` listaba **cinco** puntos de anclaje (selector de talle, selector de
color, precio, CTA, políticas) y el contrato publica **cuatro**. Un solo `variant_selector` cubre los
dos selectores, así que la cuenta cierra sin agregar un anclaje. La deuda no se paga: **desaparece**.

## R-02 — Cómo se llama el evento, y por qué no se fusiona con `variant_selected`

**Decisión**: `variant_selector_interacted`, y **los dos eventos se quedan**.

**Motivo**: son dos hechos distintos y las reglas de la política los usan con umbrales distintos.
`config/treatment-defaults.json` tiene una regla que dispara con dos interacciones con el selector
(`fit.size-selector-twice`) y otra que dispara con dos variantes efectivamente elegidas
(`fit.variants-compared`). Tocar el selector es **intención**; elegir una variante es un **hecho** que
resuelve contra el catálogo por `selectedVariantId`. Fusionarlos borraría una regla de producto para
ahorrar un miembro de un enum.

**Alternativa descartada**: un solo evento con un campo que distinga los dos casos. Mueve la
distinción del tipo al dato, que es justo lo contrario de un vocabulario cerrado: el `switch` del
extractor de señales deja de ser exhaustivo y el compilador deja de ayudar.

## R-03 — El campo que transporta la etiqueta del talle

**Decisión**: **se elimina**. El evento queda sin campos propios, como `product_viewed`.

**Lo medido**: `src/domain/barrier/signals.ts` extrae el subtipo de cada evento con un `switch`
exhaustivo, y para este tipo **devuelve `undefined`**. Ninguna autoridad lee el valor: lo que el
sistema usa es que el evento ocurrió y cuántas veces. El campo viaja, se valida, se registra y no lo
mira nadie.

**Y es más que un campo muerto**: es texto libre del merchant sin normalizar —la etiqueta del talle
«como la muestra la tienda»—, exactamente la clase de dato que la 027 decidió no publicar nunca
(ADR-036). Un dato del mundo del merchant que entra al vocabulario cerrado y no se usa es la deuda de
esta feature en miniatura.

**Si mañana hace falta la variante concreta**, ya está: `variant_selected` lleva `selectedVariantId`,
que resuelve contra el catálogo y tiene verdad detrás. La etiqueta libre nunca la iba a tener.

**Consecuencia en el contrato**: el esquema deja de requerir el campo y, con
`additionalProperties: false`, un cliente que lo mande recibe `400`. Bajo `info.x-stability: building`
eso entra con bump MINOR y `contract:diff` lo reporta (ADR-003).

## R-04 — Cómo se llama el bloque de la ficha

**Decisión**: `specifications`.

**Motivo**: el vocabulario de bloques nombra **lugares de la página**, no lo que se infiere de ellos.
El bloque que hoy se llama por una prenda es, en cualquier rubro, el lugar donde la ficha explica si
el producto le va a servir al comprador: la tabla de talles en ropa, la de medidas y consumo en una
heladera. `specifications` nombra ese lugar en los dos casos y no se pisa con `description`, que es
prosa y no tabla.

**Alternativa descartada**: `fit_guidance`. Nombra **la barrera que se infiere** del bloque, no el
bloque. Mezclar el lugar con lo que se deduce de él es el error que la 027 enseñó a evitar: el
vocabulario de lugares y el de barreras tienen dueños distintos y cambian por motivos distintos.

**Alternativa descartada**: que el merchant declare sus bloques, como declara sus anclajes. Acá el
criterio de ADR-036 dice que no: **el bloque no sólo identifica un lugar, tiene semántica que la
inferencia lee** —permanecer ahí es evidencia de duda de calce—, así que si cada tienda lo nombra como
quiere, la inferencia no puede leer nada. Es la línea entre el mapa de anclajes (dirección, del
merchant) y el vocabulario de bloques (significado, de OPE).

## R-05 — Los identificadores de las reglas

**Decisión**: siguen el vocabulario. `fit.size-selector-twice` → `fit.variant-selector-twice`;
`fit.size-guide-read` → `fit.specifications-read`; `returns.size-doubt-and-policies` →
`returns.variant-doubt-and-policies`.

**Motivo**: un identificador que nombra una prenda es la misma deuda con otra ropa, y estos viajan al
ledger como el motivo por el que se infirió una barrera. Son valores de configuración, así que
cambiarlos es editar `config/treatment-defaults.json` y nada más. Nada persistido los referencia
(decisión del dueño, 2026-09-25).

## R-06 — El corpus, cuyas familias llevan el nombre del anclaje

**Decisión**: renombrar la familia **acuña versiones nuevas**; ninguna versión existente se edita.

**Motivo**: una familia es `<barrera>.<anclaje>.<escalón>`, así que el renombre del anclaje toca tres
familias del corpus. ADR-036 fija que una versión de texto es inmutable. Y hay un motivo más fuerte
que la regla: el identificador de versión **lleva la familia adentro**, así que conservarlo dejaría un
identificador nombrando una familia que ya no existe — un fixture que sobrevive a su sujeto, que es
exactamente D-13. El texto no cambia; la versión sí.

**Se aprovecha para unificar el formato**, que hoy tiene dos estilos en el mismo archivo:
`mv_fit_size_selector_information_es_neutral_2` y
`mv_fit.size_selector.uncertainty_combed-cotton_es_neutral_1`. Como todas las versiones de estas tres
familias se acuñan de nuevo, unificar no cuesta nada extra.

## R-07 — El tope de barreras declarables

**Decisión**: **se borra `maxItems`**. No se reemplaza por otro número.

**Lo medido**: el campo es `minItems: 1`, `maxItems: 3`, `uniqueItems: true`, con `items` apuntando al
enum de barreras, que tiene tres miembros. Con `uniqueItems: true` sobre un enum de tres, **una lista
de más de tres no puede existir**: el esquema ya lo prohíbe. El `maxItems: 3` no limita nada hoy y
limitaría mal mañana, porque estaría diciendo «un merchant elige hasta tres» cuando lo que quiso decir
es «existen tres».

**Por qué esto es la respuesta y no un número nuevo**: es el idioma que el repositorio ya usa en el
código —«donde el tipo es una unión de literales, el literal se queda: el compilador es la
constante»— aplicado al esquema. El vocabulario acota la lista, y el día que exista una cuarta barrera
el límite se mueve solo y sigue siendo cierto.

## R-08 — Las dos enmiendas de la constitución

**Decisión**: una enmienda **PATCH** que corrige dos viñetas de `Contrato de datos e identidad`.

**(a) La que esta feature causa.** La constitución glosa `fit` como «(talle y calce)», que es la
paráfrasis de `01 §4.2` antes de la enmienda; ahora la fuente dice «calce». La cláusula de Governance
lo contempla textualmente: «los principios derivados de una decisión DECIDIDO en los documentos del
MVP sólo se enmiendan **si el documento fuente cambia**». Cambió el 2026-09-25, así que corresponde.

**(b) La que esta feature encontró, y no causó.** La viñeta `Escalas` dice que «las superficies
visibles al merchant expresan porcentajes en 0–100» y que «la normalización ocurre una sola vez, en el
borde». **ADR-035 abolió eso en la feature 022**: el sistema habla en tasas 0..1 de punta a punta y no
convierte formatos de porcentaje, y `CLAUDE.md` ya lo refleja. La constitución prevalece sobre todo,
así que la viñeta vieja no es un detalle: alguien que la lea implementaría una conversión en el borde
que el código no hace, y tendría razón según el documento que manda.

Nadie lo notó porque **ningún gate lo puede notar**: `check:instructions` comprueba que lo citado
exista, no que lo escrito sea cierto — el límite que `CLAUDE.md` documenta de sí mismo.

**Es hallazgo, no alcance.** Se propone en el plan y lo confirma el dueño al revisarlo; si prefiere
separarlo, se registra como deuda y esta feature hace sólo (a).

## R-09 — El glosario

**Decisión**: `docs/dominio/anclaje.md` actualiza la lista de valores del contrato, y la nota del
evento **cambia de archivo**: `eventos/interaccion-con-selector-de-talle.md` pasa a nombrar el control
genérico. ADR-008 exige nota con fuente para todo sustantivo del contrato; `variante` ya la tiene
(`docs/dominio/variante.md`), así que no hay sustantivo nuevo que dar de alta — sólo notas que dejan
de nombrar una prenda. `npm run check:glossary` lo verifica en los dos sentidos.

## R-10 — Dónde se registra la enmienda de la fuente

**Decisión**: un ADR nuevo al cerrar la feature, con el precedente de **ADR-030**, que es el que
registra decisiones de producto del dueño que cambian el documento fuente.

**Motivo**: el repositorio cita la fuente por sección (`mvp:01-arquitectura-mvp.md#4.2`) en ADRs,
specs y notas del glosario. Esas citas siguen resolviendo —las secciones no se movieron— pero **el
texto cambió**, y un lector futuro que compare una spec vieja con la fuente tiene que poder saber
cuándo y por qué. Sin ese registro, la enmienda es exactamente el problema que D-17 describe.

Se escribe **al cerrar**, no ahora: un ADR se escribe cuando los identificadores que nombra existen
(`check:identifiers`), como la 027 hizo con ADR-036.

## Lo que no se investigó, y por qué

- **Cómo el SDK decide qué bloque del DOM es cuál.** El evento llega con el nombre del bloque ya
  resuelto y el contrato no publica un mapa de bloques como publica el de anclajes. Es una asimetría
  real y no es de esta feature, que renombra el vocabulario que ya existe.
- **La variante genérica.** D-16, con su pregunta de diseño escrita.
- **Si `fit`, `price` y `returns` son las tres barreras correctas en otro rubro.** `03 §9` dice que el
  piloto no va a poder contestarlo, y D-14 ya midió que es lo único estructuralmente caro.
