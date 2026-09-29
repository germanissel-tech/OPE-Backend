# Investigación — Fase 0

**Feature**: `033-configuracion-durable` | **Fecha**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

Seis preguntas. La segunda decide la forma de la feature y la quinta **cambia su alcance**: una de las cuatro historias no entra, y el motivo es técnico y verificable.

---

## R-01 — Cuánto de esto ya existe

**Hallazgo**: la mitad del trabajo es mecánica y tiene tres precedentes; lo que no es mecánico son dos cosas, y están en R-02 y R-05.

| Ya existe                                                                                | Evidencia                                                                                    |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| El patrón de gateway durable, con su regla escrita                                       | `.claude/rules/gateway-durable.md`, seis puntos                                              |
| El runner de migraciones pendientes, cada una en su transacción                          | feature 031, ADR-039                                                                         |
| El canal de fallo de las escrituras (`StoreUnavailable`) en los puertos que lo necesitan | `MerchantStore.create/update`, `ConfigurationStore.publish`, `AnchorDiagnosticsStore.upsert` |
| `record()` / `rehydrate` en las entidades que se guardan                                 | `Merchant`, `Experiment` (ADR-024)                                                           |
| La suite que cruza reinicios, con un caso por puerto y por garantía                      | `tests/durability/`                                                                          |
| La semilla con la semántica «vacío importa, con datos conserva»                          | `bootstrap.ts`, `importSeed`                                                                 |

**Lo que no existe y hay que construir**: seis gateways durables, su migración, una lectura nueva en el registro de eventos (R-03), y el índice en memoria de R-02.

**Y `importSeed` ya hace lo correcto sin decirlo.** La decisión del dueño —«se aplica sólo si está vacío, y lo dice fuerte»— no cambia la lógica: agrega la línea que hoy falta. Eso es una línea de log y su prueba, no una feature.

---

## R-02 — Cómo no pagar una lectura del almacén en cada petición

**La pregunta central de la feature.** Toda petición del SDK y de la plataforma resuelve el merchant por la huella de su credencial **antes de validar el cuerpo** (`IngestKeyResolver`, `PlatformKeyResolver`), y hoy eso es un recorrido en memoria.

### Las dos alternativas, con lo que cada una cuesta

|                                     | Consultar el almacén en cada petición                        | La memoria como índice de un almacén que es la fuente   |
| ----------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| Contra SQLite local                 | un `SELECT` indexado por petición                            | un `Map.get`                                            |
| **Contra PostgreSQL remoto (D-21)** | **un viaje de red por petición, antes de validar el cuerpo** | un `Map.get`                                            |
| Al arrancar                         | nada                                                         | leer todos los merchants una vez                        |
| Coherencia con dos procesos         | correcta                                                     | **el índice de un proceso no ve la escritura del otro** |
| Memoria                             | nada                                                         | proporcional a la cantidad de merchants, no al tráfico  |

**Decisión: el índice en memoria.** Y el argumento que decide no es el costo hoy sino el de mañana: contra SQLite local las dos son baratas, pero la primera pone **un viaje de red por petición** el día que el almacén sea remoto, y ese día es D-21. Elegir la primera sería elegir rehacerla.

### Por qué es sólido, y exactamente cuándo deja de serlo

Es sólido porque **hay un solo proceso**, que es el alcance declarado desde la feature 030 (**D-21**). Con un proceso, todas las escrituras del merchant pasan por el mismo gateway, así que el índice no puede divergir: se actualiza en la misma llamada que escribe.

Y deja de serlo **exactamente** cuando hay dos procesos: el índice del proceso A no ve el alta que hizo B, y un merchant recién creado autenticaría en un nodo y no en el otro. Eso no es una sorpresa que descubrir después — es lo mismo que D-21 ya dice de las demás garantías, y la feature de PostgreSQL tiene que resolverlo con invalidación o consultando. **Queda escrito en el gateway**, no sólo acá.

### Lo que no es

**No es «escribir dos veces»**, que es lo que la feature 032 rechazó para el estado caliente. Ahí el problema era que el ledger y el estado caliente serían **dos verdades** que pueden discrepar sobre el mismo hecho. Acá hay **una** verdad —el almacén— y el índice es una vista de esa verdad que se mantiene en la misma operación que la cambia. La diferencia se prueba: si el índice y el almacén pudieran discrepar, habría dos caminos de escritura, y no los hay.

### Los otros cinco no tienen este problema

`ConfigurationStore`, `ExperimentStore`, `AdminLog`, `AnchorDiagnosticsStore` y `UnmappedValueLog` se leen en operaciones de administración y en la resolución de configuración, no en cada petición. Van al almacén directo, como los seis gateways de la 030. **No se les pone índice porque no lo necesitan**, y ponerlo por simetría sería memoria y complejidad a cambio de nada.

---

## R-03 — La reconstrucción de la ventana de deduplicación

**Decisión del dueño**: recuperable, no durable. El `claim` se sigue respondiendo en memoria; la ventana se reconstruye de lo durable la primera vez que un merchant aparece tras un reinicio.

**Hallazgo bueno**: el índice que hace falta **ya existe**. `received_events_volume (merchant_id, received_at, type)` sirve por su prefijo `(merchant_id, received_at)`, que es exactamente el rango de la reconstrucción.

**Hallazgo a construir**: el registro de eventos **no tiene** una lectura que devuelva los identificadores de evento de un merchant dentro de una ventana. Tiene `bySession`, `byDecision`, `byEvent` y `volume` —que devuelve conteos por tipo, no ids—. Hace falta una lectura nueva, acotada por la ventana y por el tope de la ventana.

**Dónde está el gancho**: `EventDedup.claim(merchantId, eventIds)` es el único método del puerto, y es el punto donde «este merchant apareció por primera vez desde el arranque» se puede observar sin que nadie más lo sepa. La reconstrucción va ahí, una vez por merchant y por arranque.

**El tope importa y no es cosmético**: la ventana guarda hasta `maxIds` por merchant, los más recientes. La reconstrucción tiene que respetar el mismo tope, porque una ventana reconstruida más grande que la que el sistema promete sería una promesa distinta.

**Y su límite queda declarado**: la reconstrucción vale lo que vale el registro. Si al registro le falta un tramo (feature 031, FR-018), un evento de ese tramo puede volver a contar como nuevo. Es la misma asimetría de ADR-040 —lo que protege un tope es exacto, lo que mejora una medición es best-effort— y la deduplicación cae del lado de la medición: un duplicado contado dos veces ensucia una cifra, no gasta un cupo.

---

## R-04 — El esquema

**Seis tablas nuevas**, y la migración **no reconstruye ninguna**: ninguno de estos almacenes estuvo nunca persistido, así que es la primera migración de esta serie que sólo crea.

Lo que cada una necesita más allá de la forma habitual —clave propia, `created_at`, `updated_at`, el merchant, y el resto en el documento (`migrations/README.md`)—:

| Tabla                     | Lo propio                                                                                                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `merchants`               | índice único por identificador; **índice por huella de credencial** para la resolución; el estado como columna sólo si algo busca por él                                                                       |
| `merchant_origins`        | **una fila por origen**, con índice **único global** sobre el origen: un origen pertenece a un solo merchant, desactivados incluidos. No va en el documento porque la unicidad es lo que hay que hacer cumplir |
| `merchant_configurations` | único por `(merchant, version)`; la efectiva es la de versión máxima                                                                                                                                           |
| `experiments`             | único por `(merchant, experiment)`                                                                                                                                                                             |
| `admin_entries`           | append-only, sin clave de negocio; índices por instante y por `(merchant, instante)`                                                                                                                           |
| `anchor_diagnostics`      | único por `(merchant, anclaje, superficie)`, porque `upsert` acumula un conteo sobre esa clave                                                                                                                 |
| `unmapped_values`         | por merchant; `replace` reemplaza el conjunto del merchant                                                                                                                                                     |

**Los orígenes en su propia tabla es la única decisión de forma que se sale de la convención**, y el motivo es que la convención existe para lo que nadie busca. Acá el origen **es** la clave por la que se busca (`ownerOfOrigin`, en el borde de CORS) y además tiene que ser única entre todos los merchants; dentro de un documento no hay índice que lo garantice, y garantizarlo leyendo antes de escribir es la carrera que `01 §6` prohíbe.

**Las huellas de credencial**: un merchant tiene tres clases y, tras una rotación, la anterior con su instante de expiración. Van en el documento **salvo la huella que se busca**, que necesita índice. Lo mismo que `decisions` hizo con `visitor_id` en la 032.

---

## R-05 — La auditoría atómica no entra, y el motivo es que la transacción es síncrona

**Esta es la historia 4 de la spec, y no entra.** La spec autorizó este resultado —«si el plan encuentra que no entra, partirlo es un resultado legítimo y se dice»—, así que acá está el análisis.

### Qué se quería

Que la acción administrativa y su entrada en el registro queden **las dos o ninguna**, cerrando la ventana en que el registro se cae **durante** la acción (ADR-034, enmienda del 2026-09-23).

### Por qué la forma obvia no existe

`AuditedUseCase` envuelve al caso de uso: ejecuta, lee el resultado y escribe la entrada. Para que las dos cosas fueran una transacción, el decorador tendría que abrirla. Y no puede, por dos razones que se suman:

1. **El decorador vive en el kernel de aplicación y no conoce ningún almacén**, a propósito (ADR-023: una preocupación transversal no la elige nadie). Darle un almacén sería romper justo lo que lo hace transversal.
2. **Y sobre todo: `SqlStore.transaction` es síncrona** — `transaction<T>(work: () => T): T`. No se puede `await` adentro. Su propio comentario dice para qué es así: «es lo que permite decidir primero/repetido/conflicto **sin un paso asincrónico entre la comprobación y la escritura**».

El caso de uso es `async` y escribe por puertos que devuelven `Promise`. Envolver un `await` en una transacción síncrona no es incómodo: **es inseguro**. Un `await` cede al bucle de eventos, y otra petición podría escribir **dentro** de la transacción abierta, que es exactamente el peligro contra el que el comentario advierte.

### Las alternativas, y por qué ninguna es un ajuste

| Alternativa                                                                    | Por qué no acá                                                                                                                                            |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Que cada gateway de escritura reciba la entrada y la escriba en su transacción | la auditoría deja de ser transversal y pasa a elegirla cada gateway, que es lo que ADR-023 y ADR-034 construyeron para evitar; y es viral: siete gateways |
| Un puerto «unidad de trabajo» con `run(work)` que el decorador use             | el `work` tendría que ser síncrono para envolver la transacción, y el caso de uso no lo es                                                                |
| Reordenar: escribir la entrada antes de ejecutar                               | una acción que falla dejaría constancia de algo que no ocurrió, que es peor que la ventana                                                                |
| Partir cada caso de uso en «decidir» (async) y «escribir» (un bloque síncrono) | **es la que funciona**, y es un cambio de forma de todos los casos de uso de administración más el decorador. Es una feature, no una tarea                |

### Qué se hace entonces

**La historia 4 sale de esta feature y se registra**, con el mismo trato que la feature 032 le dio al plazo de FR-016: la mitad que sí ocurre ya está cubierta —una acción que no se puede auditar **no empieza**, porque el decorador pregunta antes— y lo que queda abierto es la caída **durante** la acción.

Lo que esta feature sí aporta a eso: al volverse durable el registro, la ventana pasa de «se pierde todo al reiniciar» a «una entrada puede faltar». Es estrictamente mejor, y no es lo que la historia pedía.

**Y la decisión del alcance del hito se conserva**: `persistence-and-resilience` sigue nombrando esta pieza, junto con la atomicidad del presupuesto por sesión, y las dos comparten la misma causa raíz — **no hay forma de componer una transacción sobre puertos asincrónicos con este almacén**. Eso las vuelve una feature, no dos, y es un hallazgo de esta investigación.

---

## R-06 — Qué tiene que decir el arranque

**Hallazgo**: hoy el arranque dice `merchant seed imported` con cuántos importó, y **cuando no importa nada no dice nada** (`if (imported > 0)`). El silencio es el problema: es lo que convierte «edité el archivo y no pasó nada» en un descubrimiento.

**Lo que hace falta** es la otra rama, y con la información que la vuelve útil: que no se aplicó, cuántos merchants ya había, y que la vía es la API. Una línea, en el nivel que un operador mira.

**Y no cambia la lógica**: `importSeed` ya conserva lo que hay. Lo que se agrega es que lo diga.

---

## Lo que esta investigación deja anotado

- **El índice en memoria deja de ser correcto con dos procesos** (R-02). Es lo mismo que D-21 dice de todo lo demás, y va escrito en el gateway además de acá.
- **La auditoría atómica y la atomicidad del presupuesto por sesión tienen la misma causa** (R-05): no se puede componer una transacción sobre puertos asincrónicos con un almacén cuya transacción es síncrona. Es una feature del hito y comparten el análisis.
- **La reconstrucción de la dedup vale lo que vale el registro de eventos** (R-03), y del lado de la medición eso es aceptable: un duplicado contado dos veces ensucia una cifra, no gasta un cupo.
