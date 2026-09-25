---
numero: 036
titulo: Vocabulario cerrado y mapa del merchant
estado: aceptada
fecha: 2026-09-25
fuente: specs/027-catalogo-de-mensajes/research.md
---

# ADR-036 — Vocabulario cerrado y mapa del merchant

Cuatro decisiones de la feature 027 que ninguna feature posterior debería tener que re-deducir, y
el nombre del patrón que las tres primeras aplican sin haberlo tenido.

## Contexto

Hasta esta feature una intervención devolvía un identificador de texto inventado en el momento y
ningún texto: `src/domain/selection/candidate.ts` acuñaba uno por familia con una versión falsa, y
el SDK no tenía nada que mostrar. La pregunta que abrió el diseño no fue cómo guardar textos, sino
**de quién son**.

Dos decisiones del dueño (2026-09-24) la contestaron: **los textos los escribe OPE**, y **no se
redacta un mensaje por producto**. El stakeholder agregó el caso que las tensiona —dos remeras
blancas que difieren en tipo de algodón, tela y caída— y su límite: «para una primera instancia yo
tomaría la información del catálogo», «si vamos mensaje por prenda y características ahora no
salimos más». Un producto especial **dice algo más** que el común, y ese algo sale de los datos del
catálogo.

Eso obliga a que OPE sepa hablar de un valor de atributo (`combed-cotton`) y a que cada tienda diga
qué significan **sus** etiquetas (`Combed Cotton 24/1`). Nunca se inserta el valor crudo del
merchant: `attributes` es texto libre que el contrato declara «no normalisation», y publicarlo sería
publicar copy sin revisar con claims que OPE no puede sostener (03 §4.4).

## Decisión

### 1. El corpus es un activo del release; el merchant elige versión, voz e idiomas

Los textos viven en un archivo del release (`config/messages.json`), donde la revisión humana es el
code review de la PR —que es exactamente lo que 03 §4.4 pide—, y se leen por un puerto
(`MessageCorpus`). No hay operación de API para publicarlos: por API un operador publicaría texto
que nadie revisó, y la operación que el mapa tenía planeada para eso se retira.

Lo que el merchant declara es **qué se le sirve**: idiomas (`Locales`), voz (`Voice`) y su
correspondencia de etiquetas, todo por `publishMerchantConfiguration`, que ya existía. Es lo que la
constitución X dice, con la palabra que su fuente tiene y una paráfrasis había perdido: «**versión**
del catálogo de mensajes» (01 §14.2). Restaurarla fue la enmienda **1.4.3** de la constitución, y la
regla que enseña es la que se aplica de acá en adelante: cuando una paráfrasis y su fuente no
coinciden, se corrige la paráfrasis; cuando el diseño y la fuente no coinciden, se corrige el diseño.

Una versión de texto es **inmutable**: corregir un texto es publicar una versión nueva. El ledger
registra el identificador, nunca el texto, así que una corrección posterior no reescribe qué se dijo.

### 2. Sin texto la familia no es candidata: se filtra en la selección, no después

`01 §322` lo dice y el diseño lo obedece: «si no hay texto para ese idioma, **la familia no es
candidata**». La disponibilidad de texto entra **antes** del veredicto comercial —`judgeAll` juzga
sólo lo que ya se puede decir (`Sayable`)— y no degrada una intervención ya decidida.

Cuando no queda ninguna familia decible, el resultado es `NO_OP` con motivo `message-unavailable`,
**distinto** de `no-acceptable-candidate`. Confundirlos arruina la medición: «no tengo texto» es un
problema de OPE y «decidí no hablar» es el sistema funcionando.

El idioma no se negocia; la voz sí es una preferencia. Un texto en el idioma equivocado está roto;
en la voz equivocada está fuera de marca pero se entiende.

### 3. El vocabulario es cerrado y de OPE; la correspondencia es del merchant

`AttributeValue` es un enum del contrato que OPE controla y que crece por demanda, con la misma
disciplina que las barreras y los anclajes. `AttributeLabels` es lo que cada tienda declara: varias
etiquetas pueden apuntar a un valor, una etiqueta a uno solo (`duplicate-attribute-label`), y una
etiqueta que nadie mapeó deja a sus productos sin hablar de ese atributo — exactamente lo que ya
pasa cuando el dato no está.

Del lado del merchant se conserva **una lista y no un mapa**, porque un request body lleva
`additionalProperties: false` y una lista puede repetir: así la etiqueta duplicada es una falta que
se puede nombrar en vez de un dato que se pierde en silencio.

Y porque el catálogo se degradaría en silencio, lo que llega sin correspondencia se conserva y se
lee: `listUnmappedAttributeValues` responde qué etiquetas trajo el último catálogo, cuántos productos
las traen y desde cuándo, con el tope de plataforma `unmappedValuesKept`. Lo que el merchant mapea se
excluye **al leer**, así que mapear un valor lo saca del reporte sin republicar el catálogo.

### 4. El criterio que decide de qué lado cae una cosa

Los tres puntos anteriores no se pueden aplicar a algo nuevo sin esto, y por eso queda escrito:

> **Lo que OPE tiene que escribir sigue siendo de OPE; lo que sólo identifica un lugar o un
> comportamiento puede ser del merchant.**

La prosa de una tela no puede vivir en la configuración de una tienda: la escribe OPE, la revisa una
persona de OPE y se reusa entre tiendas. El nombre del bloque donde esa tienda tiene su guía de
talles, sí: no es prosa, es una dirección.

### El patrón, con su nombre

Las tres primeras decisiones aplican un patrón que el repositorio venía usando sin bautizar, y que
de acá en adelante se nombra **vocabulario cerrado y mapa del merchant**:

1. OPE declara un vocabulario **chico y cerrado**, que crece por decisión de producto y nunca por
   configuración.
2. El merchant declara **cómo su mundo se mapea sobre él**, en su configuración versionada.
3. La traducción va **del merchant hacia OPE**, una sola vez y en el borde; adentro sólo circula el
   vocabulario de OPE.

Sus instancias construidas: el **mapa de anclajes** (`AnchorMap`, desde la feature 017), que traduce
selectores del sitio a los anclajes del vocabulario, y la **correspondencia de etiquetas**
(`AttributeLabels`, esta feature). La tercera candidata —el vocabulario de bloques, que hoy nombra
lugares de la página de una tienda de ropa— está registrada como deuda D-14, con el mapa de qué capa
conoce la vertical y qué no.

## Consecuencias

- **Un atributo nuevo del que OPE sepa hablar cuesta prosa, no mecanismo**: una clave, sus valores en
  el enum, sus textos en el corpus. Los merchants que ya mapearon no cambian nada.
- **Un merchant nuevo cuesta su correspondencia y nada más.** El ejemplo trabajado quedó ejecutable
  (doce prendas, siete etiquetas, cuatro frases de OPE, cinco líneas de la tienda, cero textos por
  producto): si alguna vez hace falta un texto por prenda para que pase, el mecanismo volvió a lo que
  el stakeholder descartó.
- **Un mensaje por producto sigue abierto** y este diseño no le cierra la puerta: sería una clave más
  en la del corpus, no un concepto nuevo. No se paga hoy.
- **El corpus no se puede corregir en caliente.** Un texto mal escrito espera un release. Es el precio
  de que la revisión humana sea el code review, y se acepta.
- **Un vocabulario cerrado se vuelve deuda cuando nombra la vertical.** Es lo que D-14 registra: el
  patrón es bueno y el contenido de un vocabulario puede estar mal puesto, y son dos cosas distintas.
