# Research — El catálogo de mensajes (027)

Todo lo de acá se midió en la rama `027-catalogo-de-mensajes`, que sale de `main` (`7556820`).
Cada decisión cita su evidencia y qué se descartó.

---

## R-01 — Dónde vive el corpus, y la palabra que el principio X había perdido

**Decisión**: el corpus de prosa es un **activo del release** (archivo del repositorio, leído por un
puerto); lo que se publica **por merchant** es sólo lo que varía: la versión que se le sirve, la voz
elegida, sus idiomas y la correspondencia de sus etiquetas. La operación planeada
`publishMessageCatalog` se **retira del mapa** antes de construirse.

**Esto no es una interpretación: es lo que la fuente ya decía.** `01 §14.2` declara la tabla de
banderas configurables por merchant, y la fila dice:

| Bandera              | Parámetros  |
| -------------------- | ----------- |
| Catálogo de mensajes | **versión** |

`03 §191` lo repite con las mismas palabras: «versión del catálogo de mensajes». **Lo que varía por
merchant es la versión, no el contenido.**

**El principio X había perdido esa palabra al parafrasear** y decía «catálogo de mensajes» a secas,
lo que se leía como que el contenido de los textos varía por merchant. Se restauró por enmienda
**PATCH** (constitución 1.4.3, 2026-09-24), agregando además qué elige el merchant para que la
lectura equivocada no vuelva.

**Por qué la enmienda no necesitó tocar los documentos del MVP**, que es lo que la cláusula de
Governance habría exigido: no cambia una decisión de la fuente, **la restaura**. Si el reparto
hubiera contradicho a `01`, la enmienda no habría sido legítima desde una feature.

Bajo este reparto, todo lo que varía por merchant —versión, voz, idiomas, correspondencia de
valores— **es** configuración versionada, publicada por el camino que ya existe
(`publishMerchantConfiguration`) y estampada en cada decisión junto con las otras dos versiones. Lo
que no varía no es configuración de nadie: es contenido de OPE.

**Y el principio VIII lo respalda**: «los mensajes son curados y versionados; el runtime los lee de
un almacén. Los usos offline (**redacción del catálogo de mensajes**, …) corren fuera del plano de
decisión y sus salidas **se revisan y versionan antes de servirse**». Un archivo del repositorio es
exactamente eso: la revisión previa a servirse es la revisión del cambio, que es la única forma de
garantizar 03 §4.4 sin construir un flujo de aprobación nuevo.

**Descartado: conservar `publishMessageCatalog`.** Un operador publicaría por API un texto que nadie
revisó — justo lo que la decisión «los escribe OPE» busca evitar—, y el mismo corpus quedaría
duplicado en cada merchant. Está **planeada y no construida**: retirarla ahora no cuesta nada y
después cuesta una versión mayor (ADR-019).

**Descartado: dejar el principio X como estaba y acomodar el diseño a su letra.** Habría puesto a
cada merchant a publicar el mismo corpus, contra lo que `01 §14.2` decide. Cuando la paráfrasis y
la fuente no coinciden, se corrige la paráfrasis.

---

## R-02 — `message-unavailable` es un motivo de `NO_OP`, y ya hay precedente exacto

**Decisión**: `message-unavailable` entra al catálogo `contracts/no-op-reasons.yaml` como un motivo
más. No hace falta un tercer resultado ni un canal nuevo.

**Evidencia**: lo nombra la fuente. `01 §322` dice que el resultado es «`NO_OP` con motivo
(`message-unavailable`)», así que el nombre y su naturaleza están decididos; lo que había que
resolver es si hacía falta un resultado nuevo, y no hace falta.

**Quién lo emite**: la **selección**, que es donde vive el filtro (R-03). Se emite cuando ningún
candidato de la barrera dominante queda en pie **por falta de texto**, y se distingue de
`no-acceptable-candidate`, que es cuando ninguno queda en pie porque sus claims no tienen evidencia.
Dos causas distintas de la misma forma, dos motivos distintos: es para eso que el catálogo de
motivos existe, y es lo que `FR-016` y `FR-017` piden.

**Consecuencia que sale gratis**: el presupuesto por sesión y la fatiga por visitante **no se
consumen**, porque nunca se emitió una intervención que descontar. El orquestador ya consume los
contadores sólo cuando hubo intervención (`decision.isIntervention()`), así que no hay que escribir
ni razonar nada.

---

## R-03 — Sin texto, la familia no es candidata: el filtro vive en la selección

**Decisión**: la disponibilidad de texto es un **filtro de viabilidad del candidato**, dentro de la
autoridad de selección, junto al quality gate. **No** es un paso posterior al veredicto comercial.

**La fuente lo decide, y con estas palabras** (`01 §322`):

> «El idioma es una dimensión del catálogo de mensajes, no un tratamiento distinto: el texto se
> elige por familia, anclaje, escalón y el `locale` que trae el contexto de página; **si no hay
> texto para ese idioma, la familia no es candidata** y el resultado es `NO_OP` con motivo
> (`message-unavailable`), salvo que el merchant declare un idioma de reserva.»

**Corrección**: la primera versión de este research proponía una autoridad nueva después del
veredicto comercial, con la forma de `DecisionRecorder`, que degradaba un `INTERVENE` a `NO_OP`. Es
lo que el principio I permite, pero **no es lo que la fuente decide**, y la de la fuente es mejor
por tres motivos medibles:

1. **Un merchant con corpus parcial sigue interviniendo.** Si la familia más alta no tiene texto, la
   escalera cae al escalón de abajo y se muestra algo que sí se puede sostener. Con la degradación
   posterior, ese mismo merchant se callaba entero.
2. **No hace falta una autoridad nueva.** La selección ya rechaza candidatos que no puede sostener;
   «no hay texto» tiene exactamente esa forma. Una autoridad menos en la cadena.
3. **La pregunta del presupuesto desaparece.** Si nunca se emitió una intervención, no hay nada que
   descontar: no hay que razonar sobre contadores que no se tocan.

**Qué se conserva del análisis anterior, porque sigue valiendo**: el principio I prohíbe al
orquestador elegir mensajes («MUST NOT inferir barreras, rankear candidatos **ni elegir
mensajes**»), y el borde HTTP tampoco puede, porque el ledger tiene que registrar la versión
mostrada (`FR-018`, principio IX). Las dos alternativas obvias siguen descartadas; lo que cambia es
dónde queda la tercera.

**Y el quality gate sigue siendo puro** (constitución II), que era el riesgo de meter el filtro
ahí: el corpus se resuelve **antes**, desde memoria, y la disponibilidad de texto por familia llega
como una clase más de evidencia — igual que llegan hoy los atributos del producto. El gate no
consulta nada; juzga lo que recibe.

La cadena queda como estaba: asignación → inferencia → evidencia → **selección + gate (claims y
texto)** → política comercial → ledger.

---

## R-04 — El vocabulario de valores y la correspondencia del merchant

**Decisión**: OPE declara un vocabulario cerrado de valores de atributo; el merchant declara qué
etiquetas suyas corresponden a cada uno. Varias etiquetas del merchant pueden caer en el mismo
valor; una etiqueta cae en uno solo.

**Evidencia**: es el patrón que `AnchorMap` ya usa y que el merchant ya tuvo que entender —OPE fija
`size_selector`, `price`, `cta`, `policies` y cada tienda declara sus selectores—. No hay concepto
nuevo que enseñar y el mecanismo está probado.

**Por qué el vocabulario es cerrado y de OPE**: porque **la prosa la escribe OPE**. Un valor sobre
el que nadie escribió una frase no existe a efectos del mensaje; admitir valores abiertos sería
admitir mensajes sin texto, que es la contradicción que la feature viene a cerrar.

**Y por qué el valor crudo no se muestra nunca**: `CatalogProduct.attributes` es texto libre de
hasta 512 caracteres y el esquema declara «as the platform exposes them; **no normalisation**». El
quality gate comprueba `attributes.has(key)` y la autorización de la **clave**, y **no mira el
valor**. Mostrarlo metería copy sin revisar por el único hueco del mecanismo construido para frenar
afirmaciones sin respaldo (constitución II: «un solo claim inventado invalida el mensaje entero»).

---

## R-05 — El texto viaja en la respuesta de la decisión

**Decisión**: la respuesta lleva el texto. Cambia la descripción de `Intervention` en el contrato.

**Evidencia de la contradicción**: hoy `contracts/components/schemas/Intervention.yaml` dice que
`messageVersionId` es «Version of the curated message to render. The text is served by the message
catalogue, **not by this contract**» — es decir, supone que el SDK lo busca aparte.

**Por qué se cambia y no al revés**: una consulta adicional antes de renderizar agrega una ida y
vuelta de red entre la decisión y lo que la persona ve, en el momento exacto en que la fricción
está ocurriendo. Y servirle el corpus entero al SDK es peor: el corpus crece con valores × idiomas
× voces, mientras que **una decisión necesita un texto**.

**Lo que se conserva**: `messageVersionId` **no desaparece**. Es lo que el ledger registra
(`DecisionRecord.intervention` ya lo lleva) y lo que permite atribuir un resultado a lo que la
persona leyó. El texto se **agrega** para renderizar; la versión queda para medir.

**Y la invariante que `FR-019` obliga**: una versión es **inmutable**. Corregir un texto acuña una
versión nueva, nunca edita la existente. Sin eso, un cambio del corpus reescribiría el pasado del
ledger.

---

## R-06 — El idioma de reserva se queda como está: uno, opcional

**Decisión**: **`Locales.fallback` no cambia.** La primera versión de este research proponía
reemplazarlo por una cadena ordenada. **Retirado**, por dos motivos independientes, cualquiera de
los cuales alcanza.

**El primero es de gobernanza, y es el que manda.** `01 §14.2` declara la bandera «Idiomas del
merchant» con parámetros «idiomas con texto, **idioma de reserva (opcional)**» y la marca
**DECIDIDO (2026-09-20)**. La constitución dice que un principio derivado de una decisión DECIDIDO
de los documentos del MVP sólo se enmienda si cambia el documento fuente. Cambiar un salto único por
una cadena es cambiar esa decisión, y eso no se hace desde una feature.

**El segundo es que no hace falta.** Con los textos escritos por OPE, **OPE elige la granularidad
del corpus**. Si el corpus se escribe en `es-419` y el merchant declara `es-419` como idioma de
reserva, una página en `es-AR` resuelve en **un salto**. La cadena sólo haría falta si OPE
escribiera `es-AR` y `es-MX` por separado y además quisiera un intermedio entre ellos y el final —
un refinamiento que ningún merchant pidió y que, si alguna vez hace falta, es su propia feature con
su propio cambio en `01`.

**Lo que sí se conserva de aquella redacción**: el orden de resolución. Un texto en el idioma
equivocado está **roto**; uno en la voz equivocada está fuera de marca pero se entiende. Se resuelve
primero el idioma —el de la página, y si no tiene texto, el de reserva— y dentro del idioma
resuelto se intenta la voz del merchant y después la voz por defecto. Sin texto, la familia no es
candidata (R-03); **nunca** un texto en otro idioma.

---

## R-07 — Prosa completa por valor, no plantilla con huecos

**Decisión**: cada texto del corpus es prosa completa. No hay interpolación de valores del catálogo
dentro del texto.

**Evidencia**: una plantilla del tipo «Tela {material}, caída {caida}» rompe la concordancia del
castellano —«tela _fluida_» contra «algodón _peinado_»: género y número— y produce algo que lee a
ficha técnica. 03 §4.4 pide lo contrario: prosa curada, escrita y revisada por una persona. Una
plantilla que hay que revisar valor por valor para comprobar que concuerda no ahorra nada respecto
de escribir la frase entera, y esconde el error hasta que está en producción.

**Descartado: interpolar sólo cifras** (precio, cantidad). No hace falta todavía: ningún candidato
actual afirma una cifra que no esté ya cubierta por su claim. Si aparece, es una decisión propia y
con su evidencia, no un permiso general de plantillas.

---

## R-08 — Dónde se registra la decisión

**Decisión**: **un ADR nuevo**, que al escribirse quedó como **ADR-036** («Vocabulario cerrado y mapa
del merchant»), por tres motivos
transversales que ninguna feature posterior debería tener que re-deducir: que el corpus es un
activo del release y el merchant elige versión, voz e idiomas (R-01); que la disponibilidad de
texto filtra candidatos en la selección y no degrada una intervención decidida (R-03); y que el
vocabulario de valores es cerrado y de OPE mientras la correspondencia es del merchant (R-04).

**Y una enmienda de la constitución, que sí hizo falta** (decisión del dueño, 2026-09-24):
**1.4.3**, PATCH, sobre el principio X. No es enmendar para acomodar una feature —eso sería
invertir el orden, porque la constitución prevalece— sino **restaurar** la palabra que su fuente
tiene y la paráfrasis perdió. La regla que queda es la que el propio caso enseña: cuando una
paráfrasis y su fuente no coinciden, se corrige la paráfrasis; cuando el diseño y la fuente no
coinciden, se corrige el diseño.

---

## Lo que no se investigó y por qué

- **Cómo se redacta y revisa el corpus.** Es trabajo de OPE fuera de esta feature; lo que acá se
  entrega es la estructura, la resolución y el mínimo corpus para probarla.
- **El reporte de valores sin mapear más allá de su forma.** Reusa el mecanismo de los diagnósticos
  de anclajes, que ya está construido y probado; el plan sólo elige dónde cuelga.
- **Un segundo atributo además de la composición del producto.** La spec fija que el vocabulario
  arranca mínimo y crece por demanda; abrir el segundo sin un merchant que lo pida sería adivinar.

**Cuándo se escribe, y por qué no ahora.** Un ADR se escribe cuando los identificadores que nombra
existen: `check:identifiers` verifica que todo lo citado entre comillas de código en `docs/adr/`
exista en el contrato, sus catálogos, `src/` o el tooling. Un ADR escrito antes de la
implementación tendría que hablar en prosa de las cosas que viene a nombrar, que es lo contrario de
para qué sirve. Se escribe al cerrar la feature, como la 022 hizo con ADR-035.
