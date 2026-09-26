# Research — El ledger sobrevive a un reinicio (030)

La decisión difícil de esta feature no es la tecnología: es **dónde cae la escritura**. El resto son
elecciones acotadas.

## R-01 — La escritura durable cae en el camino crítico, y `01` tiene algo que decir

**Lo que dice la fuente.** `01 §P9`: «Dos caminos separados. Decisión: **síncrono, acotado, sin I/O de
red**. Medición: **asíncrono, durable**, auditable. No se mezclan, no comparten garantías y no
comparten presupuesto de latencia.» Y la constitución lo recoge como principio **IV**.

**Lo que pasa hoy.** `DecisionService` **espera** al registro: `await recorder.record(facts, outcome)`.
Con el ledger en memoria eso no cuesta nada y nadie lo nota. Volverlo durable pone una escritura a
disco donde antes había una asignación a un `Map`.

**Y no se puede desacoplar sin romper otra cosa.** El registro no es un efecto colateral: si el ledger
no acepta, la decisión **degrada a `NO_OP` con motivo `ledger-unavailable`** (ADR-021), porque nada
entra al reporte sin trazabilidad (constitución IX). Un «escribí y seguí» permitiría intervenir sin
haber registrado, que es exactamente lo que ese principio prohíbe.

**Decisión**: la escritura durable se hace **en el camino crítico, y se mide**. Los argumentos, en
orden:

- **No es I/O de red.** Lo que P9 prohíbe en el camino de decisión es la red; un append local a un
  archivo con WAL es del orden de decenas de microsegundos.
- **El presupuesto es de 150 ms** (`01 §4.6`) y está marcado **PROPUESTO como objetivo de diseño, no
  como SLA**. Hay margen de sobra para medir antes de rediseñar.
- **Ya existe la prueba que lo vigila**: `tests/integration/ingest-latency.test.ts` mide p50 y p95 del
  lote de ingesta contra un presupuesto. Esta feature la corre con el almacén durable, y ese número es
  el que decide si hace falta lo siguiente.

**Lo que esto deja pendiente, y hay que decirlo**: «record acceptance decoupled from ledger latency»
sigue siendo parte del hito y no de esta feature. El disparador para hacerlo deja de ser una intuición
y pasa a ser un número: **si el p95 con almacén durable se acerca al presupuesto, esa feature sube de
prioridad**.

**Alternativa descartada**: desacoplar ahora con una cola. Es una feature entera —hay que decidir qué
significa «aceptado» sin estar escrito, y cómo se reconcilia— y hacerla dentro de ésta mezclaría dos
cambios cuya cadena de gates no podría distinguir.

## R-02 — Qué driver de SQLite

**Lo medido**: el repositorio corre **Node 22** (`.nvmrc`, `engines: >=22`). `node:sqlite` **existe en
22** —`DatabaseSync`, `StatementSync`— pero emite `ExperimentalWarning` en cada arranque.

**Decisión**: **`node:sqlite`**, sin dependencia nueva.

**Motivo**: es la biblioteca estándar. Una dependencia nativa (`better-sqlite3`) agrega compilación en
cada instalación y en CI, y un paquete más que mantener al día — y la política del repositorio sobre
dependencias es explícita: última versión, parchear antes que degradar, y el inventario de `patches/`
existe para lo que no se puede evitar.

**El costo, y cómo se paga**: la advertencia experimental. **No se silencia con un flag global**
—apagar advertencias del proceso esconde las próximas, que es peor que ésta—; se decide en el plan si
se tolera en el arranque o si el repositorio pasa a **Node 24**, donde `node:sqlite` es estable. Subir
de LTS es consistente con la política de versiones y no contradice la constitución, que pide «Node.js
LTS» sin fijar el número. **Queda como la única pregunta abierta del plan**, porque cambiar la versión
de Node toca CI y no sólo esta feature.

**Alternativa descartada**: `better-sqlite3`. Más maduro y sin advertencia, pero cambia el perfil de
instalación del repositorio entero por una feature.

## R-03 — Síncrono adentro de un puerto asíncrono

`node:sqlite` es **síncrono** (`DatabaseSync`) y los puertos devuelven `Promise`. No hay conflicto: un
gateway síncrono se envuelve y el puerto no cambia de forma. Lo que sí importa es que **una llamada
síncrona bloquea el bucle de eventos**, y eso es justamente lo que R-01 decide medir.

**Lo que NO se hace**: envolver la escritura en `setImmediate` o similar para «no bloquear». Eso no la
hace asíncrona, la hace impredecible: el orden deja de estar garantizado y la degradación de ADR-021
deja de poder observarse.

## R-04 — Cómo elige tecnología un despliegue

Ya está construido (ADR-033) y el despliegue local lo documenta: un módulo servido de una sola manera
entra pelado, y uno con dos entra como `ledgerModule.with("sqlite")`. **Omitir la elección no
compila**: el tipo pasa a ser `ChooseATechnology` y la lista del despliegue no lo acepta.

**Decisión**: los módulos que ganan una segunda tecnología la declaran así, y el despliegue local
elige. No se agrega un despliegue nuevo en esta feature: el local pasa a ser durable, que es lo que
`npm run dev` necesita para que un reinicio no borre lo que uno estaba probando.

**Consecuencia que el plan tiene que resolver**: hoy **las pruebas** usan ese mismo despliegue. Ver
R-06.

## R-05 — La forma del esquema y sus migraciones

**Decisión**: una tabla por entidad del ledger, con las columnas que las lecturas necesitan indexar
—merchant, y la clave por la que se busca— y el resto del registro como documento. Las lecturas de los
puertos son pocas y conocidas: por identificador, por sesión, por orden.

**Motivo**: el ledger es **inmutable y append-only**, así que no hay actualizaciones parciales que
justifiquen desarmar cada entidad en columnas. Y desarmarla obligaría a mantener dos formas del mismo
dominio, que es la duplicación que ADR-024 evita en el código.

**Las migraciones se versionan en el repositorio** (FR-007) y el arranque **se niega** si el esquema no
es el que espera (FR-006), con el mismo criterio que ya rige para la configuración: un servidor que
arranca sobre algo que no entiende es peor que uno que no arranca.

**Lo que no se decide acá**: el formato exacto del documento. Es del plan, y la única restricción de
la spec es que lo que se lee sea idéntico a lo que se escribió.

## R-06 — Contra qué corren las pruebas

**Lo medido**: hoy 1372 pruebas del proyecto `fast` corren contra el despliegue local con todo en
memoria, y el lazo completo son minutos.

**Decisión**: **el proyecto `fast` sigue en memoria; la durabilidad tiene su propia suite.**

**Motivo**: las pruebas que ya existen prueban **comportamiento**, y el comportamiento no cambia por
dónde se guarda (FR-009). Hacerlas pasar por disco las haría más lentas sin probar nada nuevo. Lo que
hay que probar de esta feature es lo que sólo se ve **cruzando un reinicio**, y eso no se prueba
repitiendo mil pruebas: se prueba con las pocas que apagan y prenden.

**Y lo que esto deja expuesto, que conviene escribir**: los gateways durables quedan cubiertos **sólo**
por esa suite. Es la decisión correcta y también el riesgo de la feature, así que la suite tiene que
cubrir cada puerto, no una muestra.

## R-07 — Dónde vive el archivo

**Decisión**: una variable de entorno con un valor por defecto para desarrollo, leída por la
composición como las demás (`*-config.ts`), y **no** una constante en el código.

No es un valor de comportamiento sino de entorno —como el puerto o el host—, así que no entra en los
tres niveles de configuración de la constitución XI: `check:behaviour-constants` vigila lo otro.

## Lo que no se investigó, y por qué

- **Concurrencia entre procesos.** Es de PostgreSQL y está en **D-21** con su motivo.
- **Retención y poda del ledger.** El MVP no decidió cuánto se retiene y esta feature no lo inventa.
- **Redis para la sesión caliente**, que la constitución nombra junto a PostgreSQL. El estado de
  sesión y visitante es la feature siguiente del hito; acá no se toca.
