---
numero: 040
titulo: La decisión espera para no olvidar un tope, y lo que esa espera arrastró
estado: aceptada
fecha: 2026-09-28
fuente: feature 032 (research R-03, R-05), medición del 2026-09-28
---

# ADR-040 — La decisión espera para no olvidar un tope, y lo que esa espera arrastró

La feature 032 hace que un reinicio deje de reiniciar los topes. Tres decisiones de esta feature son
transversales —alcanzan a más de un módulo o cambian una regla del repositorio— y van juntas porque
salen del mismo razonamiento: **para no olvidar un tope hay que leer algo durable en el camino de
decisión**, y ponerlo ahí obligó a lo demás.

## Contexto

El estado caliente no es fuente de verdad (constitución **IV**): vive en memoria, acotado y con
expiración. Eso estaba bien mientras lo único que se perdía al olvidarlo fueran señales. Pero ese mismo
estado guarda **cuántas intervenciones ya recibieron una sesión y un visitante**, y ahí un olvido no es
una pérdida de calidad: es un tope que deja de aplicarse. En cada despliegue, todo visitante activo
recuperaba su cupo entero.

`01 §P9` separa dos caminos: «Decisión: **síncrono, acotado, sin I/O de red**. Medición: **asíncrono,
durable**, auditable.» La reconstrucción cae del lado de la decisión, y es I/O. De ahí sale todo lo que
sigue.

## Decisión 1 — La decisión espera I/O local, y esa excepción se declara sin cuantificar

**El estado caliente no se hizo durable: se hizo recuperable.** Sigue en memoria y sigue sin ser fuente
de verdad; lo que cambia es que cuando la memoria no lo tiene, se reconstruye desde el ledger de
decisiones y el registro de eventos. Un `load` que antes era un `Map.get` ahora puede ser dos consultas
a SQLite, **en el camino crítico**.

Eso es una excepción al principio IV, y se declara como tal. El trato es el de ADR-038 —la escritura
durable que también se quedó en el camino crítico— **menos el número**: ADR-038 pudo nombrar un
disparador porque la escritura ya estaba medida contra una base. Acá no hay base.

### Por qué no se desacopla

Porque el desacople no existe para esto. Las tres alternativas se descartan por el mismo motivo:

| Alternativa                                        | Por qué no                                                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Reconstruir en segundo plano y decidir sin esperar | es exactamente el estado de hoy: se decide sin saber el cupo, que es el daño que la feature vino a impedir |
| Precargar el estado activo al arrancar             | no se sabe cuál está activo hasta que llega un evento, y precargarlo todo es el histórico entero           |
| Hacer durable la escritura del estado caliente     | crea una segunda verdad que puede discrepar del ledger, y pone una **escritura** en el camino, que es peor |

### Lo medido, y hasta dónde vale

Cuatro corridas en una máquina, el 2026-09-28 (`tests/durability/rebuild-latency.test.ts`): el p50 de
una decisión que reconstruye quedó **entre +0,03 y +0,78 ms** sobre una que no, y la diferencia de p95
osciló entre −7,9 y +2,1 ms. O sea: **menos de un milisegundo donde se ve, e indistinguible del ruido en
p95**.

Y eso vale poco, dicho de frente: es SQLite local, sin red, en una laptop — **no el caso que importa**
(**D-21**). Lo que la medición sí descarta es que la reconstrucción cambie el orden de magnitud de la
petición. Lo que no puede decir es cuánto costará contra un Postgres remoto, que es donde la pregunta
se vuelve interesante.

La medición también tuvo que corregirse, y el error vale la pena porque se repite: la primera versión
comparaba una pasada recién reiniciada contra la siguiente, y daba **negativa** —la reconstrucción
parecía más rápida—. No era un resultado: en la segunda pasada cada sesión arrastraba un lote más de
señales acumuladas, así que hacía estrictamente más trabajo en la parte que no tiene nada que ver con el
almacenamiento. Dos grupos de sesiones con la misma historia, medidos intercalados, es lo que hace
comparable la diferencia.

## Decisión 2 — Los puertos de lectura ganan canal de fallo, en tres de muchos

Hasta esta feature toda lectura durable **lanzaba**, y sólo las escrituras devolvían `Result`
(ADR-021). Eso no alcanza en cuanto una lectura alimenta un tope:

- `SessionStateStore.load` y `VisitorStateStore.load` devolvían `State | undefined`, y `undefined`
  significaba «no lo recuerdo». Leyendo de un almacén durable significaría **también** «no contestó», y
  el sistema trataría una falla como visitante nuevo, devolviéndole el cupo entero. Es el daño de la
  feature entrando por la puerta de atrás.
- Las tres lecturas de la reconstrucción (`PastActivity`) tienen que poder decir que no contestaron,
  porque **la respuesta a una falla no es la misma para las tres** (decisión 3).

«Puertos de lectura con canal de fallo» ya estaba declarado como trabajo del hito
`persistence-and-resilience` —lo dice `interface-adapters/ledger/gateways/durable-write.ts`— y esta
feature lo adelanta **en los que lo necesitan ahora**. Los demás siguen lanzando, y eso está escrito en
los puertos para que el día que se haga el resto no parezca que estos tres eran la excepción.

**Dónde va la traducción, y por qué no en la aplicación.** El registro y el ledger lanzan, y el anillo de
aplicación no puede usar `catch`: `ope/no-generic-catch-in-application` lo prohíbe, y su motivo es el
argumento — ahí un `catch` sólo puede tragarse un error de programación y volverlo una respuesta
silenciosamente equivocada. Así que la traducción de excepción a valor vive en un gateway
(`durablePastActivity`), que es el anillo cuyo trabajo es traducir, y el servicio depende de tres
lecturas que **contestan**.

## Decisión 3 — Los topes son obligatorios y las señales best-effort

Dos semánticas de falla en la misma reconstrucción. No es una inconsistencia: es que las dos mitades no
protegen lo mismo.

| Lectura                                     | Qué protege                         | Si falla                                                       |
| ------------------------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| **Las intervenciones** (sesión y visitante) | la garantía **nueva** de la feature | nada la suple: degrada a `NO_OP state-unavailable`             |
| **Las señales**                             | la **calidad** de la decisión       | se decide con el lote actual y se registra que quedaron cortas |

**El argumento es el único que importa: sin los topes el sistema hace algo que nunca hizo y que no
queremos. Sin las señales hace lo que viene haciendo en producción.** Degradar por señales faltantes no
compra corrección; cuesta intervenciones que hoy sí se emiten.

De ahí salen tres cosas concretas:

- **Un motivo propio**, `state-unavailable`, y **no** `barrier-unclear`. Ése significa «no había
  evidencia suficiente para nombrar una barrera», que es un hallazgo **sobre la visita**. Reusarlo
  convertiría una falla de infraestructura en un dato falso del piloto, y nada después podría
  distinguirlos. Es un cambio compatible del contrato (ADR-014): `Decision.reason` es string con patrón.
- **Un campo del registro de la decisión**, `signalsIncomplete`, con el precedente de `eventsInBatch`:
  del documento durable, no de la respuesta al SDK. Existe para que el análisis distinga una visita
  donde no pasó nada antes de una visita cuyo historial no se pudo leer. Presente sólo la excepción.
- **Nunca un 500.** En este sistema un 500 significa un defecto; una degradación es una decisión con un
  motivo, y se registra (precedente de `ledger-unavailable`, `01 §4.7`, constitución IX).

### El plazo que no existe todavía

FR-016 pedía una definición de «no contestó»: un plazo, entrada de configuración de plataforma y no una
constante (constitución XI, ADR-031). **No entra, y el motivo es técnico y no de prioridad**: `SqlStore`
es **síncrono**, y una lectura síncrona devuelve o lanza. No hay estado intermedio que un temporizador
pueda atrapar, así que la entrada sería configuración que ninguna entrada puede alcanzar — peor que
ninguna, porque se lee como una garantía.

La mitad que sí puede ocurrir —el almacén que falla o rechaza— está cubierta. El plazo es del primer
gateway cuyas lecturas son de verdad remotas, que es el de PostgreSQL (**D-21**, research R-03), y llega
con ese gateway junto con la evidencia para elegir su valor.

## Consecuencias

- La decisión hace I/O local. Está declarado, medido en una máquina que no es la que importa, y su costo
  real es una pregunta abierta del hito de persistencia.
- Tres puertos de lectura tienen canal de fallo y el resto no. Es un adelanto del hito, dicho en los
  puertos, no una asimetría accidental.
- Hay dos semánticas de falla en la reconstrucción, y un campo más en la decisión. Es más código y más
  superficie de prueba que una regla única, y se paga a cambio de no apagar intervenciones por la mitad
  que no protege nada.
- `sessionWindowMs` se partió en dos: `sessionDurationMs` (nivel 1, la regla que el SDK obedece) y
  `OPE_SESSION_RETENTION_MS` (entorno, cuánto la recuerda el backend). Con un solo campo el caso de una
  sesión que sale de memoria **sin haber terminado** no podía existir, y es el caso normal.
- Lo que el arranque en frío bajo carga cuesta —todas las sesiones activas pidiendo reconstrucción a la
  vez— no se puede saber con lo que hay hoy. Queda anotado como deuda, no como medido.
