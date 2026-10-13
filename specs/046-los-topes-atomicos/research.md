# Research — 046, los topes de intervención, atómicos

## R-01 — Dónde está la carrera

**Lo que hay.** `DecisionService.decide` (`src/application/decision/services/decision.service.ts`) hace, para un
lote, en este orden y con un `await` en cada paso: `policies.policiesFor`, `assignment.assign`, `memory.recall`
(sesión, visitante y sus intervenciones del día), `#judge` —que espera candidatos y la verdad de producto, y es donde
se comparan `interventionsPerSession` e `interventionsPerVisitorPerDay`—, `recorder.record` y `memory.remember` con
el conteo nuevo. Dos lotes del mismo visitante que se solapan pueden hacer los dos `recall` antes de que cualquiera
llegue a `remember`: los dos ven el mismo conteo.

**El lote es de una sola sesión y un solo visitante** (`EventBatch`, invariante `SessionVisitorMismatch`), así que
cada decisión sabe, antes de empezar, a qué visitante pertenece.

## R-02 — La exclusión es un decorador del puerto de decisión

**Decisión.** Un decorador que implementa `DecisionPlane` y envuelve al `DecisionService`: antes de llamar a
`decide`, toma el turno del visitante (`merchantId` y `visitorId` del lote) y lo suelta al terminar, salga como
salga. La composición lo pone delante del servicio en el enlace de `DecisionPlanePort`.

- **Un decorador y no un cambio en `DecisionService`**: el servicio decide y no sabe de concurrencia, como
  `LoggedUseCase` y `ModeGatedUseCase` no hacen que el caso de uso sepa del log o del modo. La regla queda en un solo
  lugar y el servicio no cambia.
- **El turno abarca toda la decisión**, de `policiesFor` a `remember`: es lo que hace que la segunda lea lo que la
  primera ya escribió (FR-001). Tomarlo sólo alrededor de `recall … remember` sería más fino, pero obligaría a
  partir el servicio y no gana nada medible: lo que hay antes son lecturas en memoria.
- **Vive en `src/application/decision/`**, junto al servicio al que envuelve. No depende de nada de Node: es una
  cadena de promesas por llave.

## R-03 — Cómo se ordena: una cadena de promesas por llave

**Decisión.** Un mapa de llave (`merchantId` y `visitorId`, en una clave que no se puede confundir entre
merchants) a la promesa del último lote encolado. Un lote nuevo encadena su trabajo detrás de esa promesa —se
atiende cuando la anterior termina, salga bien o mal— y queda como la última. Cuando termina y nadie se encoló
detrás, la llave se borra del mapa.

- **Orden de llegada** (FR-005): cada lote se encadena detrás del último que llegó.
- **Un lote que falla libera el turno** (FR-004): el siguiente espera a que el anterior _termine_, no a que salga
  bien.
- **Nada queda en memoria** (FR-007, SC-003): la llave se borra cuando el lote que terminó es el último de la fila.
- **Visitantes distintos no se esperan** (FR-002): cada llave tiene su cadena.

**Descartado.**

- **Una transacción del almacén** (D-30): lo que se consume es un conteo en memoria, y una escritura serializada en
  el camino de decisión es lo que el principio IV no admite (ADR-041).
- **Una dependencia de npm de exclusión mutua**: son veinte líneas con la cadena de promesas, y la capa de
  aplicación no importa paquetes.
- **Por sesión**: decidido por el dueño, por visitante (spec).

## R-04 — Cómo se reproduce la carrera

- **Unidad**, determinista: el decorador alrededor de un `DecisionPlane` guionado que se queda esperando una señal
  de la prueba. Se afirma que un segundo `decide` del mismo visitante no entra hasta que el primero suelta, que uno de
  otro visitante entra sin esperar, que un `decide` que lanza libera el turno y que el mapa queda vacío.
- **Integración**, la carrera de la deuda contra el servidor entero: dos lotes de la misma sesión en paralelo con
  `interventionsPerSession` en uno, y dos lotes de dos sesiones del mismo visitante con `interventionsPerVisitorPerDay`
  en uno. **Antes del arreglo tiene que fallar**: es la reproducción que reemplaza a la medición de D-30. Si con el
  servidor entero la carrera no se diera de forma confiable, la prueba de integración se escribe sobre el servicio
  real con un almacén de estado que demora el `recall`, y eso queda dicho en las tareas.

## R-05 — La latencia

El decorador agrega, para un visitante sin lotes en curso, una búsqueda en un mapa y una promesa ya resuelta. Las
mediciones del camino de decisión que hoy son gate (`MEASURED_SUITES` del proyecto `fast`) lo juzgan con sus
mismos techos (SC-002).
