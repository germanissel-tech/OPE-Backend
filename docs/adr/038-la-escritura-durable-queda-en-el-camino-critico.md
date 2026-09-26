---
numero: 038
titulo: La escritura durable queda en el camino crítico, y se mide
estado: aceptada
fecha: 2026-09-26
fuente: feature 030 (research R-01), medición del 2026-09-26
---

# ADR-038 — La escritura durable queda en el camino crítico, y se mide

La feature 030 volvió durable el ledger. Eso pone una escritura a disco donde antes había una
asignación a un `Map`, y esa escritura está **en el camino de decisión**, que `01 §P9` y el
principio **IV** de la constitución quieren separado del de medición.

Esta decisión dice por qué se queda ahí, y con qué número se revisaría.

## Contexto

`01 §P9`: «Dos caminos separados. Decisión: **síncrono, acotado, sin I/O de red**. Medición:
**asíncrono, durable**, auditable. No se mezclan, no comparten garantías y no comparten presupuesto
de latencia.»

Y sin embargo `DecisionService` **espera** al registro: `await recorder.record(facts, outcome)`. No
es un descuido. Si el ledger no acepta, la decisión **degrada a `NO_OP` con motivo
`ledger-unavailable`** (ADR-021), porque nada entra al reporte sin trazabilidad (constitución **IX**).

Ahí está la tensión, y es real: el principio IV pide desacoplar, el principio IX es lo que lo impide.
Un «escribí y seguí» permitiría **intervenir sin haber registrado**, que es exactamente lo que IX
prohíbe. No es una molestia de implementación: es el orden de dos principios.

## Decisión

**La escritura durable se hace en el camino crítico, y se mide.**

Los argumentos, en orden:

1. **Lo que P9 prohíbe en el camino de decisión es la red**, y un append local con WAL no lo es.
2. **El presupuesto es de 150 ms** (`01 §4.6`), y la fuente lo marca **como objetivo de diseño, no
   como SLA** — el marcador es de ella, no de este ADR, que está decidido.
3. **Se mide, en vez de suponerse.** `tests/durability/ingest-latency.test.ts` mide los dos perfiles
   —memoria y SQLite— **en la misma corrida**, porque una cifra absoluta de una máquina no dice nada
   y la diferencia sólo significa algo con la misma máquina, el mismo JIT y la misma carga.

## Lo medido (2026-09-26, Node 24.21.0, tres corridas)

| Perfil         | p50            | p95              |
| -------------- | -------------- | ---------------- |
| memoria        | 0,66 – 0,68 ms | 0,90 – 1,35 ms   |
| SQLite (WAL)   | 1,33 – 1,40 ms | 1,94 – 2,72 ms   |
| diferencia p95 |                | **1,0 – 1,4 ms** |

**Poco más de un milisegundo: menos del 2 % del presupuesto.**

## Consecuencia

«Desacoplar la aceptación del ledger» sigue en el hito `persistence-and-resilience` y **no sube de
prioridad**. Lo que cambia no es la conclusión sino en qué se apoya: antes era una intuición, ahora
es esa tabla, y el disparador quedó escrito — **si el p95 con almacén durable se acerca al
presupuesto, esa feature sube**.

Y si algún día sube, lo que hay que diseñar no es una cola: es **qué significa «aceptado» sin estar
escrito**, y cómo se reconcilia. Por eso no se hizo dentro de la 030: es una feature entera, y
mezclarla habría dejado a la cadena de gates sin poder distinguir qué rompió qué.

## Lo que este número no dice

- Está medido con `fastify.inject`, que **saltea la pila de red**. Mide el trabajo del servidor, no
  la latencia que ve un navegador.
- Está medido con **un solo proceso** sobre SQLite. La concurrencia entre procesos es de PostgreSQL
  y está en **D-21**; puede cambiar la respuesta, y esta decisión no promete lo contrario.

## Alternativas descartadas

- **Desacoplar ahora con una cola.** Es la feature entera de arriba, y hacerla dentro de la 030
  habría mezclado dos cambios.
- **Envolver la escritura en `setImmediate`** para «no bloquear». No la hace asíncrona: la hace
  impredecible. El orden de los registros deja de estar garantizado y la degradación de ADR-021
  deja de poder observarse — se vería como si el ledger hubiera aceptado.
