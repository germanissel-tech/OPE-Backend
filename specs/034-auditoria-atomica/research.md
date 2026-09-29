# Investigación — Fase 0

**Feature**: `034-auditoria-atomica` | **Fecha**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

El diseño de esta feature ya venía derivado (D-28, research R-05 de la 033 y su enmienda). Lo que esta
investigación agrega es lo que ese diseño **no resolvía** y aparece al mirar el código de hoy: cuatro
preguntas, y dos de ellas cambian piezas del diseño.

---

## R-01 — Qué existe hoy, medido sobre el código

| Pieza                                             | Estado                                         | Dónde                                                                                                                      |
| ------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| La transacción síncrona del almacén               | existe y **se conserva**                       | `infrastructure/sqlite/open-store.ts`, `inTransaction`                                                                     |
| El decorador de auditoría, con su consulta previa | existe                                         | `application/shared-kernel/decorators/audited-use-case.ts`                                                                 |
| El registro de administración durable             | existe (feature 033)                           | `interface-adapters/admin/gateways/sqlite-admin-log.ts`                                                                    |
| Los envoltorios de escritura compartidos          | existen                                        | `interface-adapters/shared-kernel/durable-store.ts` (`tried`, `stored`) y `ledger/gateways/durable-write.ts` (`attempted`) |
| `AsyncLocalStorage`                               | **no se usa en ninguna parte del repositorio** | —                                                                                                                          |

**Cuántos gateways tocan el almacén**: 13 archivos, 54 llamadas a `all`, `run` o `transaction`. Ese número
es lo que decide R-03, porque «una línea por gateway» sobre 54 sitios no es una línea por gateway.

**Las diez operaciones auditadas** (`generated/audited-operations.js` las deriva del contrato) son
`createMerchant`, `deactivateMerchant`, las tres rotaciones, `setKillSwitch`,
`publishMerchantConfiguration`, `createExperiment`, `activateExperiment` y `closeExperiment`.
**Las diez declaran `503`**, verificado contra `contracts/paths/`: la suposición de la spec queda
confirmada y el contrato no cambia.

---

## R-02 — Cómo se revierte sin un `catch` en `application/`

**La pregunta que el diseño derivado no había visto.** D-28 dice: «si el registro no acepta, **lanza** y el
scope revierte la acción». Pero el decorador vive en `application/shared-kernel/decorators/`, y ahí:

- `ope/no-generic-catch-in-application` prohíbe `try/catch` (ADR-023: los puertos devuelven `Result`);
- y aunque se pudiera, una excepción que saliera del decorador sería un `500`, cuando la respuesta
  correcta es la que hoy devuelve la consulta previa: `503 store-unavailable`.

O sea: **hace falta revertir sin lanzar y sin atrapar**, y el que lanza tiene que ser el adaptador.

### Lo que se descartó

| Alternativa                                                     | Por qué no                                                                                                                                                           |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El decorador atrapa el fallo del registro                       | prohibido en `application/`, y convierte un `503` declarado en un `500`                                                                                              |
| `scope` revierte cuando el trabajo devuelve un `Result` fallido | **incorrecto**: un rechazo de negocio también es un `Result` fallido y su entrada **tiene que quedar** (escenario 3 de US1). Revertiría justo lo que hay que auditar |
| Dos scopes, uno para la acción y otro para la entrada           | son dos unidades: es exactamente la ventana que la feature viene a cerrar                                                                                            |

### Decisión: el trabajo recibe cómo abortar, y la unidad responde un `Result`

```
scope<T>(work: (abort: () => void) => Promise<T>): Promise<Result<T, StoreUnavailable>>
```

El decorador llama `abort()` cuando el registro no aceptó, y devuelve lo que la unidad responda: si
abortó, el `fail(StoreUnavailable)` **es** la respuesta de la operación, igual que hoy lo es el resultado
de la consulta previa. Sin `catch`, sin excepción cruzando el anillo, y con el `throw` que revierte
encerrado en el adaptador, que es su lugar.

**Y un rechazo de negocio no aborta nada**: el decorador sólo aborta si falló _el registro_. Un rechazo
sigue su camino, su entrada se escribe y la unidad cierra.

---

## R-03 — Dónde va el «esperar su turno»: no es una línea por gateway

El diseño decía «una línea por gateway, sin cambiar ninguna forma». Con 13 gateways y 54 sitios eso no
es exacto, y conviene separar dos casos que el diseño trataba como uno:

**Las escrituras ya están centralizadas.** Las tres envolturas (`tried`, `stored`, `attempted`) desembocan
en una sola función, así que el `await enter()` de **todas** las escrituras de todos los gateways es
**una línea en `durable-store.ts`**. Es el pago del trabajo que la 033 hizo al mudar esos envoltorios al
kernel del anillo.

**Las lecturas no.** Cada gateway llama `deps.store.all(...)` directo y devuelve una `Promise`, y una
lectura dentro de la transacción de otro **ve lo que esa transacción todavía no commiteó** — una
decisión podría leer un merchant que va a desaparecer. Así que las lecturas también esperan turno, y
para eso hace falta un envoltorio simétrico al de escritura. Queda una edición mecánica por sitio de
lectura, no por gateway.

**Excepción declarada: las lecturas del arranque.** Los gateways de merchants y de experimentos llenan su
índice en memoria al construirse (ADR-041) y ahí **no hay scope posible**: el arranque es secuencial y
nada más corre. Esas lecturas se quedan como están, con el motivo escrito donde están.

---

## R-04 — El borde filoso: la cola del registro de eventos no puede esperar

`queuedEventLog.flush()` es **síncrono** y `record` devuelve `void` a propósito (feature 031, ADR-039):
que nadie pueda esperar la escritura del registro es lo que lo mantiene fuera del camino crítico. Un
`await enter()` ahí sería una regresión del principio IV metida por la puerta de al lado.

**Lo que falta y el diseño no nombraba**: `enter()` es asincrónico, así que la cola necesita **una
pregunta sincrónica** — si hay una unidad abierta ahora mismo. Con eso, el `flush` que encuentra el
almacén ocupado **no escribe y no pierde**: devuelve las llegadas a la cola y el próximo intervalo las
toma. La cola ya sabe hacerlo; lo único nuevo es la pregunta.

**El riesgo de esta parte, dicho**: un `flush` que devuelve lo pendiente y vuelve a intentar puede
crecer si las unidades fueran continuas. No lo son —una acción de administración dura una escritura
local— y el tope de la cola ya existe y ya avisa cuando se llena (feature 031). Lo que la feature agrega
es que ese tope ahora también se puede alcanzar por esta causa, y eso es lo que SC-003 mide.

---

## R-05 — Qué ve el despliegue en memoria

No hay nada que componer: sin almacén no hay transacción. La unidad de trabajo del despliegue local
**ejecuta el trabajo y responde `ok`**, y el `abort()` no revierte nada porque no hay nada escrito en
común. Eso no es una mentira que tape un caso: es la garantía que ese despliegue nunca tuvo —no sobrevive
un reinicio, tampoco promete atomicidad— y queda declarada en el inventario de SC-011 de la feature 033,
que ya distingue las dos.

Lo que sí tiene que ser cierto: **las pruebas de comportamiento no cambian de expectativa en ninguno de
los dos** (SC-006 y SC-008), y la garantía nueva se prueba donde vive, en la suite que cruza reinicios.

---

## Lo que esta investigación deja anotado

- **El diseño derivado se corrigió en dos puntos**, y los dos salieron de mirar el código y no de
  re-pensarlo: cómo se revierte sin `catch` (R-02) y que «una línea por gateway» son dos casos distintos
  con dos respuestas (R-03).
- **`AsyncLocalStorage` entra por primera vez al repositorio.** Es de `node:async_hooks`, así que va en
  `infrastructure/`, que es el único anillo que hospeda tecnología (ADR-013).
- **La consulta previa desaparece del puerto**, así que `AuditTrail.writable()` se borra y con él sus
  pruebas y sus dobles. Eso toca `tests/helpers/unavailable-ledgers.ts` y dos suites que hoy la
  afirman; el plan lo lista como trabajo, no como daño colateral.
