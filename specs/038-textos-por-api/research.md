# Investigación — Los textos se editan por API

Fase 0 del plan. Siete preguntas, todas respondidas leyendo el código del repo al 2026-10-04 y las
decisiones que ya están escritas. Cinco cambian algo del diseño que la spec traía derivado.

## R-01 — Qué es «completa» para la base, y la spec lo tenía mal

La spec decía «un texto por cada familia y, para las que lo llevan, por cada valor de atributo». El
arranque de hoy (`src/composition/corpus-config.ts`) aplica otra regla, y es la correcta: exige texto en
el idioma por defecto **sólo para las familias que no dependen del producto**. Una familia que habla de un
atributo —hoy una, la de incertidumbre de talle por material— es decible exactamente cuando el valor del
producto tiene prosa; exigirle un texto incondicional obligaría a escribir sobre materiales que nadie
estudió, y un producto cuyo valor no tiene texto simplemente no dice nada de él (01 §322).

Hay nueve familias en el vocabulario de candidatos, ocho incondicionales. La semilla trae texto para esas
ocho en español, más tres entradas por valor de atributo para la novena. **Completa** quiere decir: las
ocho incondicionales, en cada idioma que algún nivel soporte o nombre como reserva.

**Decisión**: la regla es la que ya existe; se muda de la composición al dominio de `messages` como regla
con nombre (`completeness.ts`) y la spec se corrigió (FR-017 y su supuesto).

## R-02 — De quién son los casos de uso: `messages`, con tres arcos nuevos

`messages` es el dueño del corpus y de sus reglas, y hoy no sirve ninguna operación. Sus casos de uso
nuevos necesitan tres cosas de otros módulos: el **actor** y su alcance (`operator`), el **merchant** de la
ruta (`merchant`, por `ScopedMerchants`) y los **experimentos** activos para el alcance y el reinicio
(`experiment`). En el mapa de contextos `messages` depende hoy de `shared-kernel`, `selection` y
`decision`.

Las dos alternativas y por qué no:

- **Ponerlos en `admin`**, que ya depende de `messages`, `experiment`, `merchant` y `operator`. Separa la
  regla —qué es un texto válido, qué es completo, qué alcanza— de su dueño. `admin` sería el módulo que
  escribe en el almacén de otro.
- **Ponerlos en `configuration`**, que también depende de `messages`. Es el molde de la 036, pero los textos
  no son niveles de configuración: son el corpus, y mezclarlos pone la resolución de textos a depender de
  la de políticas.

**No hay ciclo**: `operator`, `merchant` y `experiment` no dependen de `messages` ni lo harán;
`configuration` y `admin` siguen dependiendo de `messages` como hoy.

**Decisión**: tres arcos nuevos en `CONTEXT_MAP` para `messages`, y los casos de uso ahí.

## R-03 — «Alcanzado» para un texto es otra pregunta con la misma forma

`ReachedExperiments` (036) decide por hoja: un merchant está fuera de alcance cuando declara todas las
hojas que cambian. Para un texto la fuente de «fuera de alcance» es el **almacén de textos**: un merchant
queda fuera cuando tiene texto propio vigente en esa clave e idioma. Y para un texto de merchant la
pregunta ni se hace: los alcanzados son los experimentos activos de ese merchant.

El servicio de la 036 recibe `ChangedLeaves` y está en `configuration`, de la que `messages` no puede
depender. Lo que las dos preguntas comparten no es el cálculo del alcance sino **el reinicio** (R-04).

**Decisión**: un servicio propio en `messages`, `ReachedByText`, con los merchants, el directorio de
experimentos y el almacén de textos; el reinicio lo pide a `experiment`.

## R-04 — El reinicio de ventanas se extrae a `experiment`, y el registro gana una causa

Dos cosas del reinicio no llegan:

- **Está en `configuration`**, dentro de `ReachedExperiments.restart`, y `messages` necesita lo mismo. Copiarlo
  sería la clase de duplicación que D-34 tolera con una condición de cierre; acá la condición ya se cumple:
  son dos usuarios. Y el dueño natural es `experiment`: es su entidad la que se reinicia.
- **El registro de un reinicio sabe de niveles y no de textos.** `WindowRestart` lleva `level` (platform,
  defaults o merchant) y `configurationVersion`, porque la 036 encontró que «versión 3» sin nivel no
  identifica nada. Un texto tiene clave y capa, no nivel. La entidad está guardada como documento, así que
  los registros existentes no se reescriben.

**Decisión**: un servicio `WindowRestarts` en `application/experiment/services/`, que `ReachedExperiments`
(036) y `ReachedByText` (038) usan; `WindowRestart` gana una **causa** discriminada —configuración con su
nivel y número, o texto con su clave, su capa y su número— conservando los campos actuales para que un
registro viejo siga leyéndose. `windowRestarted` recibe la causa.

## R-05 — La comprobación cruzada entra a dos casos de uso que no pueden crecer

Publicar idiomas pasa por dos casos de uso de la 036: `PublishLevelUseCase` (cuatro dependencias) y
`PublishMerchantConfigurationUseCase` (seis, el límite de ADR-023). La pregunta es la misma para los dos:
«de los idiomas que entran como soportados o reserva, ¿en cuáles falta base?».

- **Una dependencia más** en el segundo no compila con el lint del repo.
- **Fusionar dos dependencias existentes** para hacer lugar esconde una regla dentro de otra, que es lo
  que el límite existe para impedir.
- **Un decorador**, como el de auditoría del kernel: envuelve el caso de uso, lee del request los idiomas
  que entran, pregunta a un puerto de `configuration` (`TextCompleteness`, que `messages` implementa) y
  rechaza con `locale-incomplete` nombrando las familias; si todo está, delega. La forma de los dos casos
  de uso no cambia y la composición lo pone alrededor de los dos.

**Decisión**: decorador en `application/configuration/decorators/`, un puerto nuevo en `configuration`,
y el enlace en el módulo de composición de `configuration`. Lo que juzga el decorador es lo que **entra**
(un idioma que ya estaba soportado no se vuelve a juzgar, y quitar uno no pide nada: FR-018).

## R-06 — Qué superficie HTTP hace falta, y qué se retira

Hacen falta **seis** operaciones, tres por capa: publicar (que para la capa del merchant admite quitar),
listar las versiones de una clave y leer una versión. Con el merchant en la ruta para su capa (ADR-020) y
la clave de la operación de publicación en el cuerpo, porque el valor de atributo es opcional y una ruta
con un segmento opcional no existe. Las lecturas llevan familia e idioma en la ruta y el valor de
atributo como parámetro de consulta. El detalle, en [contracts/http.md](./contracts/http.md).

**Lo que se retira**: `Voice.yaml`, que hoy **ninguna operación referencia** (es un componente huérfano
del contrato), el tipo `Voice` del kernel y el campo de voz de la semilla. Los identificadores de versión
de texto dejan de llevarla; su campo en `Intervention` no tiene patrón, sólo un largo máximo, que sube
para dar lugar a la clave entera. Es compatible.

**Capacidades nuevas** del consumidor `admin`: `texts:read` y `texts:write`. Un texto es tratamiento,
pero no es configuración: un operador que puede escribir políticas no necesariamente redacta prosa.

**Auditoría**: se deriva del mapa —toda operación de `admin` que no es sólo lectura— así que las tres de
publicación quedan auditadas por construcción, sin declarar nada.

**Tipos de problema nuevos**, tres: `text-key-unknown` (familia o valor fuera del vocabulario),
`base-text-required` (quitar en la base) y `locale-incomplete` (idioma sin base, nombra las familias). Los
tres errores del texto en sí —vacío, largo, marcador sin resolver— ya están en el catálogo desde la 027.

## R-07 — Lo que el SDK recibe no cambia, y lo que una intervención estampa tampoco de forma

`Intervention` lleva texto y `messageVersionId`; la forma queda. El SDK no recibe la voz hoy (no está en
`SdkConfig` ni en `EffectiveConfiguration`), así que retirarla no toca su contrato. La prueba de contrato
sobre el bundle lo verifica.

## Lo que esta investigación deja anotado

- **La spec se corrigió en un punto** (R-01) y el plan lo declara, en vez de implementar una regla que el
  código ya tenía mejor.
- **La 036 se toca en dos lugares** —el reinicio extraído y el decorador alrededor de sus publicaciones—
  sin cambiar su comportamiento; sus pruebas de integración son la red.
- **Nada de esta feature necesita medir para decidir**; SC-006 confirma lo que el diseño ya da: dos
  consultas en memoria en vez de una.
