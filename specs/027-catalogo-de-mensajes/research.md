# Research — El catálogo de mensajes (027)

Todo lo de acá se midió en la rama `027-catalogo-de-mensajes`, que sale de `main` (`7556820`).
Cada decisión cita su evidencia y qué se descartó.

---

## R-01 — Dónde vive el corpus, y la tensión con el principio X

**Decisión**: el corpus de prosa es un **activo del release** (archivo del repositorio, leído por un
puerto); lo que se publica **por merchant** es sólo lo que varía: la voz elegida, la cadena de
idiomas y la correspondencia de sus etiquetas. La operación planeada `publishMessageCatalog` se
**retira del mapa** antes de construirse.

**La tensión, dicha entera.** El principio X de la constitución enumera, entre lo que varía por
merchant como configuración versionada, el «catálogo de mensajes». Leído al pie de la letra, eso
manda a la operación planeada. Pero la decisión del dueño del 2026-09-24 —**los textos los escribe
OPE**— le saca el sujeto: si la prosa es de OPE y se reusa entre merchants, no es algo que varíe
por merchant.

**Por qué el reparto propuesto respeta el principio y no lo esquiva.** Lo que el principio X exige
es que **nada que varíe por merchant esté en el código**. Bajo este reparto, todo lo que varía por
merchant —voz, idiomas, correspondencia de valores— **es** configuración versionada, publicada por
el camino que ya existe (`publishMerchantConfiguration`) y estampada en cada decisión junto con las
otras dos versiones. Lo que no varía no es configuración de nadie: es contenido de OPE.

**Y el principio VIII lo respalda**: «los mensajes son curados y versionados; el runtime los lee de
un almacén. Los usos offline (**redacción del catálogo de mensajes**, …) corren fuera del plano de
decisión y sus salidas **se revisan y versionan antes de servirse**». Un archivo del repositorio es
exactamente eso: la revisión previa a servirse es la revisión del cambio, que es la única forma de
garantizar 03 §4.4 sin construir un flujo de aprobación nuevo.

**Descartado: conservar `publishMessageCatalog`.** Un operador publicaría por API un texto que nadie
revisó — justo lo que la decisión «los escribe OPE» busca evitar—, y el mismo corpus quedaría
duplicado en cada merchant. Está **planeada y no construida**: retirarla ahora no cuesta nada y
después cuesta una versión mayor (ADR-019).

**Para el dueño**: si esta lectura del principio X no lo convence, la alternativa no es el reparto
sino una enmienda de la constitución. Queda anotado en el ADR, no resuelto por decreto.

---

## R-02 — `message-unavailable` es un motivo de `NO_OP`, y ya hay precedente exacto

**Decisión**: `message-unavailable` entra al catálogo `contracts/no-op-reasons.yaml` como un motivo
más. No hace falta un tercer resultado ni un canal nuevo.

**Evidencia**: `ledger-unavailable` ya es exactamente esto — una **falla de entrega**, no una
decisión de callarse — y su descripción lo dice: «the intervention is suppressed rather than left
unmeasured». La `FR-016` de la spec («no debe presentarlo como una decisión de no intervenir») se
cumple porque **el motivo es lo que distingue**: el catálogo de motivos existe justamente para que
`control-arm`, `barrier-unclear` y `ledger-unavailable` no se confundan entre sí.

**Consecuencia que sale gratis**: el presupuesto por sesión y la fatiga por visitante **no se
consumen**. El orquestador ya lo resuelve con `decision.isIntervention()`, así que degradar a `NO_OP`
antes de registrar deja los contadores intactos sin escribir una línea. Es la misma regla que ya
rige: una intervención cuenta contra los presupuestos sólo si llegó a ocurrir.

---

## R-03 — Quién viste el mensaje: ni el orquestador, ni el borde

**Decisión**: una autoridad propia, **después del veredicto comercial y antes del ledger**, en un
módulo nuevo `messages`.

**Evidencia, y es la más restrictiva de todas.** El principio I dice, literalmente: «El orquestador
MUST limitarse a armar el contexto e invocar las autoridades en orden. MUST NOT inferir barreras,
rankear candidatos **ni elegir mensajes**». No hay margen de interpretación.

Las dos alternativas obvias fallan:

| Dónde                        | Por qué no                                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Dentro del orquestador       | Lo prohíbe el principio I por su nombre. Y `decision.service.ts` ya está en 267 de las 300 líneas que la regla de forma permite                 |
| En el borde HTTP (presenter) | El ledger no registraría qué texto se mostró, contra `FR-018` y contra el principio IX, que exige que toda cifra se reconstruya hasta su origen |

**El precedente que fija la forma**: `DecisionRecorder` ya es un paso posterior al veredicto que
puede convertir un `INTERVENE` en un `NO_OP` (`ledger-unavailable`). El vestido del mensaje es
igual: **no decide si intervenir** —eso lo emitió la política comercial, única autoridad del
veredicto— sino que **informa si puede entregar**. Y va **antes** del ledger porque el registro
tiene que llevar la versión del texto.

La cadena queda: asignación → inferencia → evidencia → selección + gate → política comercial →
**vestido del mensaje** → ledger.

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

## R-06 — La cadena de idiomas reemplaza al salto único

**Decisión**: `Locales.fallback` (un solo tag) pasa a ser una **cadena ordenada**. Es un cambio
incompatible del esquema, aceptado bajo `info.x-stability: building` (ADR-003).

**Evidencia**: hoy el esquema declara `fallback` como «The language to use when the page's is not
supported; one of `supported`». Con un solo tag, `es-AR` sin texto propio salta directo al final en
vez de probar `es-419` y después `es`. Tener variantes regionales en el corpus no sirve de nada sin
la cadena.

**El orden de resolución, y por qué el idioma va primero**: un texto en el idioma equivocado está
**roto**; uno en la voz equivocada está fuera de marca pero se entiende. Entonces: se resuelve
idioma recorriendo la cadena, y dentro del idioma resuelto se intenta la voz del merchant y luego la
voz por defecto. Agotado todo, `message-unavailable` — **nunca** un texto en otro idioma.

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

**Decisión**: **un ADR nuevo**, con el número que le toque al escribirse, por tres motivos
transversales que ninguna feature
posterior debería tener que re-deducir: dónde vive el corpus y por qué eso no contradice el
principio X (R-01), que el vestido del mensaje es una autoridad posterior al veredicto y no trabajo
del orquestador (R-03), y que el vocabulario de valores es cerrado y de OPE mientras la
correspondencia es del merchant (R-04).

**Sin enmienda de la constitución.** El reparto de R-01 satisface el principio X en su intención
—nada que varíe por merchant vive en el código— y el ADR deja escrita la lectura para que el dueño
la confirme o la discuta. Enmendar la constitución para una feature sería invertir el orden: la
constitución prevalece, y acá no hace falta cambiarla.

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
