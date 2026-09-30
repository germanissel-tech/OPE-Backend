# Research — Los niveles 1 y 2 se configuran por API (036)

Seis preguntas, leyendo el código. **Cuatro de las respuestas cambian lo que la spec suponía**, y ninguna
en contra de la feature: dos la abaratan y dos nombran trabajo que no estaba a la vista.

---

## R-01 — ¿Se sabe de qué nivel vino cada valor? No, pero se puede saber — y la unidad no es el campo

La spec asumió que la resolución retiene la procedencia. **No la retiene**: `TreatmentValues.merged` produce
un registro de valores y nada dice cuál vino de dónde; `EffectiveConfiguration.resolve` guarda sólo la terna
de versiones.

Pero **la procedencia es derivable**, y de algo que ya es durable: lo que un merchant declara
(`version.declared`). Un merchant sobrescribe un valor si y sólo si lo declara.

**Y acá está el hallazgo que importa**: seis de los diez campos de tratamiento se mezclan **una hoja a la
vez**. `PolicyInput.merge` copia clave por clave del objeto declarado sobre el default, y
`decisionPolicy.evidence` merge un nivel más adentro todavía. O sea que un merchant puede declarar
`decisionPolicy.threshold` y **no** `decisionPolicy.priority`: para el primero gana él, para el segundo gana
el default.

**Decisión**: «alcanzado» se calcula **por hoja y no por campo**. Se comparan la versión saliente y la
entrante del nivel, se obtiene el conjunto de **hojas** que cambiaron, y un merchant queda **no alcanzado**
sólo si declara **todas** ellas. Cualquier otra lectura produce falsos negativos —el caso peor, porque deja
una ventana de medición corriendo sobre un tratamiento que cambió— o falsos positivos que reinician
ventanas de quien no fue tocado.

**Alternativa descartada**: retener la procedencia dentro de `EffectiveConfiguration`. Es más información
en la estructura que el camino de decisión lee en cada pedido, para responder una pregunta que se hace sólo
al publicar un nivel. La respuesta se calcula cuando se necesita, con lo que ya está guardado.

---

## R-02 — El nivel de plataforma está horneado en el grafo: **ocho** sitios, y ése es el trabajo

El nivel de defaults se lee por un puerto y la resolución lo pide cuando lo necesita. **El de plataforma
también, para la resolución** — pero sus otros consumidores reciben el **valor** cuando el servidor se
construye:

| Dónde                                          | Qué recibe hoy                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `composition/modules/ingestion.ts` (dos binds) | `platform.dedupWindow`                                                           |
| `composition/modules/access.ts`                | `platform.signatureWindowMs`, `platform.rotationGraceMaxMs`                      |
| `composition/modules/decision.ts`              | `platform.visitorWindowMs`, `platform.sessionDurationMs`, el tope de identidades |
| `composition/modules/admin.ts` (cuatro binds)  | `platform.anchorDiagnosticsKept`, `platform.unmappedValuesKept`                  |
| `composition/modules/shared-kernel.ts`         | `platform.clockSkewToleranceMs`, `platform.eventPastToleranceMs`                 |
| `composition/bootstrap.ts`                     | `platform.retryAfterSeconds`, pasado al servidor HTTP                            |

**Decisión**: esos componentes pasan a recibir **un lector** en vez de un valor —una función que devuelve el
nivel vigente— y consultan en el momento de usar. Es una llamada en memoria, sin I/O, así que el camino de
decisión no paga nada (FR-015). El enlace deja de resolver el valor y pasa a pasar el lector, que es un
cambio mecánico y localizado en `composition/modules/`.

**Alternativa descartada**: reconstruir el grafo al publicar. Tira y recrea componentes que tienen estado
—los almacenes en memoria de sesión, de visitante y la ventana de deduplicación—, así que un cambio de
`retryAfterSeconds` vaciaría el estado caliente de todos los visitantes. Un cambio de configuración no
puede costar eso.

**Y lo que esto ordena**: la historia del nivel de plataforma es más grande que la del nivel de defaults, y
por eso va después. Pero no es riesgosa: son trece valores en once sitios y el compilador encuentra cada
uno.

---

## R-03 — Invalidar alcanza, y el costo de un cambio de nivel ya existe hoy

`Configurations` guarda dos cosas: la configuración efectiva **por merchant** (`Map`) y los dos niveles
(memoizados una vez con `??=`). Un `publish` de merchant recalcula el de ese merchant y nada más.

**Decisión**: una publicación de nivel **invalida** las dos cosas y no recalcula nada. La resolución por
merchant ya es perezosa: el primer pedido de cada merchant después de la invalidación la recalcula, y eso
es exactamente lo que ya pasa **después de cada arranque**. El costo de un cambio de nivel es el de un
arranque en frío, que el sistema ya acepta y ya está medido.

Eso abarata la feature respecto de lo que la spec suponía («recalcular para todos los merchants»): no hace
falta recorrer merchants ni saber cuáles hay.

**El borde que deja, dicho**: entre la invalidación y el primer pedido de un merchant, su configuración
efectiva se relee del almacén — una lectura por merchant, como en el arranque. SC-006 lo mide.

---

## R-04 — El molde del nivel merchant sirve, y tiene dos costuras que no llegan

`PublishMerchantConfigurationUseCase` es el molde y hace, en orden: alcance del operador → borrador (que
garantiza el motivo de una versión correctiva) → ¿idéntica a la vigente? → ¿hay experimento **activo**? →
juzgar → publicar → aplicar → reiniciar la ventana. Un experimento en calibración no congela nada.

Dos cosas no escalan solas:

1. **`WindowRestart` guarda `configurationVersion` como un número suelto.** Con tres niveles publicando,
   «versión 3» deja de identificar nada: puede ser la 3 del merchant, la 3 de los defaults o la 3 de
   plataforma. **Decisión**: el registro de reinicio dice **de qué nivel** es la versión que lo causó. Es un
   campo nuevo en una entidad que el contrato publica (`Experiment.yaml`), y el contrato está marcado en
   construcción (ADR-003): se acepta y se reporta.
2. **El límite de seis dependencias por caso de uso** (ADR-023) ya está **exactamente** alcanzado por el
   molde: alcance, almacén, servicio de configuración, directorio de experimentos, almacén de experimentos
   y reloj. Un caso de uso de nivel necesita además saber **qué merchants declaran qué** para calcular lo
   alcanzado. **Decisión**: un servicio de aplicación se queda con las tres piezas de experimentos
   —encontrar los activos, decidir cuáles alcanza un conjunto de hojas, reiniciar sus ventanas— y el caso
   de uso lo recibe como **una** dependencia. No es un truco para pasar el límite: es la operación que la
   feature agrega, y tiene nombre propio.

---

## R-05 — Un almacén y dos niveles, con la versión acuñada por OPE

El nivel merchant guarda versiones numeradas e inmutables con `MAX(version)+1` **dentro de una
transacción**, que es lo que hace que dos publicaciones simultáneas no compartan número.

**Decisión**: una tabla para los dos niveles, con el nivel como parte de la clave, y el mismo
`MAX(version)+1` por nivel dentro de la transacción. Un gateway, un patrón, y el inventario de
almacenamiento (SC-011 de la 033) gana una fila en vez de dos.

**Y el número de versión deja de declararse.** Hoy cada archivo trae su campo `version` (`platform-2`,
`defaults-1`) y nada obliga a cambiarlo cuando el contenido cambia: una huella en
`tests/unit/configuration/release-levels.test.ts` lo vigila **sólo** para `decisionPolicy` y
`commercialPolicy`. Con la API la versión la acuña OPE y es correlativa, así que esa huella cambia de
trabajo: pasa a fijar el contenido de la **semilla**, que es lo que sigue viniendo del release. La terna
que cada decisión estampa sigue siendo la misma forma; lo que cambia es de dónde sale el número.

**Alternativa descartada**: conservar el `version` declarado como identificador. Deja al operador la
responsabilidad de que dos contenidos distintos no compartan nombre, que es justo lo que hoy no se cumple.

---

## R-06 — Qué superficie HTTP hace falta, y qué ya está

Ya existen las dos lecturas del nivel vigente (`getPlatformConfiguration`, `getTreatmentDefaults`) y no
cambian de forma. Hacen falta **seis** operaciones: publicar cada nivel, listar sus versiones, y leer una
versión concreta.

Lo que el SDK recibe (`EffectiveConfiguration` por `getSdkConfig`) **no cambia de forma**: cambia el valor y
el número de versión que ya viajaba. El esquema tiene `additionalProperties: false`, así que esto es
importante y es fácil de romper sin querer: el plan lo verifica con la prueba de contrato.

**Y el alcance del operador**: un cambio de nivel alcanza a todos los merchants, así que exige un operador
de alcance total. El molde juzga el alcance **contra un merchant**; acá no hay merchant, y la comprobación
es otra —«¿este operador puede sobre todos?»— que el módulo de acceso ya sabe responder porque el alcance es
`*` o una lista.

---

## Lo que esta feature deja como estaba, con su motivo

- **Qué valores existen**: no se agrega ni se quita ningún campo de ningún nivel. Cambia quién los escribe.
- **La resolución valor por valor** y la terna estampada en cada decisión: es lo que hace que el análisis
  pueda separar antes y después de un cambio, y ya funciona.
- **Una instancia** (**D-21**): la configuración efectiva vive en memoria de este proceso. Con dos, un
  cambio no alcanzaría al otro, y eso es lo mismo que el hito ya declara de todo lo demás.
