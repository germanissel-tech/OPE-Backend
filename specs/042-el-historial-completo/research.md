# Research — fase 0 (042, el historial completo)

Lo que había que mirar antes de planificar: por qué el historial pierde las mediciones reiniciadas,
dónde está ya ese dato, y qué le falta a la configuración del merchant para leerse por número. Cada
hallazgo termina en una decisión, con lo que se descartó.

## R-01 — El dato existe: cada experimento registra qué versión lo reinició

**Lo que hay.** Una correctiva reinicia la ventana de cada experimento que alcanza, y el experimento
lo registra en `windowRestarts`: cuándo, por qué, el **nivel** y el **número** de la versión que lo
causó (feature 036), y la **clave y la capa** del texto cuando fue un texto (feature 038). Lo escribe
`WindowRestarts.restart`, el mismo para configuración y textos. La versión publicada, en cambio, no
guarda nada de eso: `PublishLevelUseCase` devuelve `windowsRestarted` en memoria, el presentador lo
pone en la respuesta de publicar, y las lecturas lo arman con `windowsRestarted: []`
(`interface-adapters/configuration/presenters.ts`, `interface-adapters/messages/presenters.ts`).

**Decisión.** Las lecturas **derivan** la lista de los reinicios que los experimentos registraron. Una
versión reinició a un experimento si y sólo si ese experimento tiene un reinicio cuya causa es esa
versión. No se escribe nada nuevo y no hay migración.

**Por qué derivar y no guardar.**

- **Es el hecho, no una afirmación sobre él.** La versión se escribe **antes** de reiniciar
  (`publish-level.use-case.ts`: primero `levels.publish`, después `refresh`, después `restart`). Una
  lista guardada en la versión diría lo que se iba a reiniciar, no lo que se reinició; si el reinicio
  falla a mitad de camino, mentiría.
- **Cubre lo publicado desde la 036 y la 038.** Esas versiones no tienen nada guardado, pero sus
  experimentos sí registraron el reinicio. Guardando, se leerían sin el dato para siempre.
- **No toca el esquema** de `configuration_levels`, `merchant_configurations` ni el de textos.

**Lo que se descartó.** Una columna o un campo del documento de la versión con los identificadores: es
la opción obvia y tiene los dos defectos de arriba. Calcularlo al publicar y guardarlo después del
reinicio: dos escrituras para un dato que ya está escrito una vez.

## R-02 — La pregunta es del experimento, y se contesta en memoria

**Lo que hay.** `sqliteExperimentStore` responde sus lecturas desde un índice en memoria con **todo
experimento de todo merchant** (ADR-041), llenado al arrancar y mantenido por las escrituras. La
causa de un reinicio es dato plano (`RestartSource`, `TextRestartCause`), y el módulo de experimentos
no depende de `configuration` ni de `messages` (`CONTEXT_MAP`). Los dos dependen de él.

**Decisión.**

- **La regla vive con su dueño.** `Experiment.restartedBy(source)` dice si alguno de sus reinicios
  tuvo esa causa: mismo nivel y mismo número, y, si la causa es un texto, la misma familia, el mismo
  valor de atributo, el mismo idioma y la misma capa.
- **El puerto gana una lectura**, `ExperimentStore.all()`: todo experimento de todo merchant, el más
  viejo primero. El gateway en memoria la tiene; el durable la responde desde el índice, como sus
  otras lecturas.
- **El servicio que ya reinicia también contesta**: `WindowRestartsService.restartedBy(source)`
  devuelve los experimentos cuyo reinicio tuvo esa causa, en el orden del almacén. Configuración y
  textos lo usan igual, como ya usan `restart`.

**Lo que no cuesta.** La lectura es administración, no decisión: recorrer el índice en memoria por
cada versión de una página (hasta 100) es trabajo en proceso, sin E/S. Si un día el índice no
alcanza (D-21, más de un proceso), la pregunta se vuelve una consulta del almacén con el mismo
puerto.

**Lo que se descartó.** Un índice inverso «causa → experimentos» mantenido por las escrituras: es la
optimización de un recorrido que no se midió lento, y una estructura más que mantener coherente.
Ponerlo en `ActiveExperimentsService`: ése camina sólo los activos, y una versión vieja reinició a
experimentos que hoy pueden estar cerrados (borde de la spec).

## R-03 — El merchant numera sus versiones: la causa necesita al merchant

**Lo que hay.** Los niveles globales numeran una sola secuencia por nivel: `platform` versión 3 es una.
La configuración del merchant numera **por merchant**: la versión 3 de Tienda Norte y la de Tienda Sur
son dos, y el reinicio registra `level: "merchant"` y el número, sin el merchant. Los textos de un
merchant llevan el merchant en la capa (`layer`). Los de la plataforma llevan `base`.

**Decisión.** Para el nivel `merchant`, la pregunta se hace además sobre el merchant: sólo experimentos
de **ese** merchant. No hace falta cambiar lo que se registra: una correctiva del merchant sólo
reinicia el experimento de ese merchant (D-G), así que «experimento del merchant con un reinicio
`merchant`/N» identifica la versión N de ese merchant y de ningún otro. Es la prueba de aislamiento de
FR-009.

**Lo que se descartó.** Agregar `merchantId` a `RestartSource`: redundante, porque el experimento ya
es de un merchant, y obligaría a interpretar los registros viejos sin él.

## R-04 — La respuesta de publicar sale de la misma pregunta cuando repite

**Lo que hay.** Las tres publicaciones son idempotentes por contenido (`x-idempotency: key: content`):
un cuerpo igual al que rige devuelve `200` con esa versión. El caso de uso devuelve entonces
`windowsRestarted: []`, así que el reintento de una correctiva que sí reinició dice que no reinició
nada. Es el borde «reintento idempotente» de la spec.

**Decisión.** Una publicación **creada** responde con lo que acaba de reiniciar, como hoy. Una
**repetida** responde con lo que esa versión reinició cuando se publicó: la misma pregunta que las
lecturas. Así las tres respuestas sobre una versión —publicar, repetir, leer— dicen lo mismo.

## R-05 — La configuración del merchant declara lo que reinició, como las globales

**Lo que hay.** `MerchantConfigurationVersion` no tiene `windowsRestarted`. El caso de uso de
publicar sabe si reinició (`windowRestarted: boolean`, que la composición usa para el registro de
administración) y cuál es el experimento activo que reinició.

**Decisión.** El esquema gana `windowsRestarted`, opcional y con la misma definición que en los
globales: compatible. La publicación del merchant devuelve el experimento reiniciado. El booleano que
lee el registro de administración se conserva tal cual: el registro dice **si** hubo reinicio, no
cuál.

## R-06 — La versión por número del merchant es la de los niveles, con alcance

**Lo que hay.** `GetLevelVersionUseCase` lee `LevelStore.versionOf(level, n)` y falla con
`ConfigurationVersionNotFound` (`404 configuration-version-not-found`). `ListConfigurationVersionsUseCase`
pasa primero por `ScopedMerchantService.find` (fuera de alcance: `403 merchant-out-of-scope` sin
revelar existencia). `ConfigurationStore` no tiene `versionOf`; sus dos gateways guardan por
`(merchant_id, version)`.

**Decisión.** `ConfigurationStore.versionOf(merchantId, n)`, con su consulta en el gateway durable y
su búsqueda en el de memoria. `GetMerchantConfigurationVersionUseCase`: alcance primero, después la
versión, y si no está, `ConfigurationVersionNotFound("merchant", n)`. Ruta
`GET /v1/admin/merchants/{merchantId}/configuration/versions/{version}`, `version` entero desde 1 (el
esquema rechaza lo demás con `400`, como en los globales).

## R-07 — Qué cambia en el contrato, y que es compatible

**Decisión.** Contrato `1.13.0 → 1.14.0` (menor): un campo opcional en `MerchantConfigurationVersion`,
una operación nueva (`getMerchantConfigurationVersion`, `planned` en `api-map.yaml` antes de escribirla,
`built` con la `feature: "042"` al terminar), y la descripción de `windowsRestarted` en los tres
esquemas que ya lo tenían, que pasa a decir que **toda** lectura lo trae. `contract:diff` no marca nada
incompatible.

## R-08 — Sin ADR nuevo

**Decisión.** No hay decisión transversal nueva. Las lecturas cumplen lo que ADR-031 (enmendada por la 036) y la 038 ya prometen; derivar de los reinicios es diseño de esta feature, y queda acá. El índice
en memoria es ADR-041.
