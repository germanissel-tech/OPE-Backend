# Modelo — las formas que esta feature agrega, y la que no toca

**Feature**: `034-auditoria-atomica` | **Fecha**: 2026-09-29

## Lo primero: no hay migración, y no es un olvido

Esta feature **no agrega ni cambia ninguna tabla**. Lo que agrega es una garantía sobre escrituras que ya
existen, así que el esquema queda en la versión 4 y `migrations/` no recibe nada. Es la primera feature
del hito que toca durabilidad sin tocar el esquema, y decirlo evita que alguien busque la migración que
falta.

## La unidad de trabajo, que es lo único nuevo del vocabulario

### El puerto (kernel de aplicación)

```
UnitOfWork
  scope<T>(work: (abort: () => void) => Promise<T>): Promise<Result<T, StoreUnavailable>>
```

Tres cosas de esa firma, y cada una responde a algo:

- **`work` recibe `abort`** en vez de lanzar. Es lo que permite revertir desde
  `application/shared-kernel/`, donde un `try/catch` está prohibido (ADR-023) y una excepción que saliera
  sería un `500` en vez del `503` declarado. Research R-02.
- **La unidad responde un `Result`**, así que el fallo es un valor y el llamador lo devuelve como
  respuesta de la operación — exactamente lo que hoy hace la consulta previa que se va.
- **`StoreUnavailable` y no un error nuevo**: para el operador es el mismo hecho («el almacén no pudo»), y
  el catálogo de problemas ya lo declara con su `503`. Un slug nuevo sería contrato nuevo por nada.

### Quién la implementa

| Implementación | Qué hace                                                                                                            | Por qué                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Durable**    | abre la transacción, ejecuta el trabajo asincrónico, la cierra; `abort()` la revierte y la unidad responde el fallo | es la garantía de la feature                                                                     |
| **En memoria** | ejecuta el trabajo y responde `ok`; `abort()` no revierte nada                                                      | sin almacén no hay nada que componer, y ese despliegue nunca prometió atomicidad (research R-05) |

## El almacén: tres miembros nuevos y uno que no se toca

`SqlStore` es el vocabulario que un gateway recibe. Gana tres cosas y **conserva `transaction` tal como
está**, porque la orden sigue decidiendo primero / repetido / conflicto ahí adentro y eso ya funciona.

| Miembro       | Forma                     | Para qué                                                                                                |
| ------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `scope`       | asincrónico, con `abort`  | lo que la unidad de trabajo usa                                                                         |
| `enter`       | `Promise<void>`           | el turno: resuelve ya, salvo que haya una unidad abierta que no sea la propia, y entonces cuando cierra |
| `busy`        | **sincrónico**, `boolean` | la pregunta que la cola del registro necesita, porque no puede esperar a nadie (research R-04)          |
| `transaction` | sin cambios               | la decisión de idempotencia de cada tabla                                                               |

**Por qué `busy` es sincrónico y no un `enter` más**: `queuedEventLog.flush()` es síncrono y `record`
devuelve `void` a propósito, para que nadie pueda esperar la escritura del registro (ADR-039). Un `await`
ahí sería una regresión del principio IV disfrazada de prolijidad.

## Dónde espera cada quien su turno

| Quién escribe o lee                                                            | Cómo espera                                                       | Cuántos lugares                                                  |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Toda escritura de todo gateway durable**                                     | dentro de `tried`, que es donde desembocan `stored` y `attempted` | **uno**                                                          |
| **Cada lectura de un gateway durable**                                         | un envoltorio simétrico al de escritura                           | uno por sitio de lectura                                         |
| **La cola del registro de eventos**                                            | no espera: pregunta `busy` y reintenta en el próximo intervalo    | uno                                                              |
| **Las lecturas del arranque** (índices en memoria de merchants y experimentos) | no esperan                                                        | dos, con su motivo escrito: en el arranque no hay unidad posible |

## El guardia, que es lo que hace que un olvido no sea silencioso

Con `AsyncLocalStorage`, el almacén sabe si quien lo llama está **dentro de su propia unidad**. Sobre eso:

- `run` y `all` **lanzan** si hay una unidad abierta y el llamador no es su dueño;
- fuera de toda unidad no cuesta nada y no cambia nada.

**Es un error de programación y por eso lanza** (ADR-023: `throw` es para lo que no debería pasar). A un
gateway al que le falte el turno le falla la primera prueba, en vez de escribir dentro de la transacción
de otro y hacer que la atomicidad de un módulo ajeno deje de valer.

## Lo que cambia en el decorador de auditoría

```
antes:  writable() → si no acepta, 503 y no se ejecuta nada
        ejecutar
        registrar        ← si falla acá, la acción queda hecha y sin firmar

después: scope(abort => { ejecutar; registrar; si el registro falló → abort() })
         si la unidad abortó → su fallo es la respuesta
```

Y el detalle que decide la corrección: **un rechazo de negocio no aborta**. La acción no cambió nada, su
entrada se escribe y la unidad cierra — auditar un rechazo es parte de la regla (ADR-034), no una
excepción a ella. Lo único que aborta es que **el registro** no haya podido escribir.

## Lo que desaparece

`AuditTrail.writable()`. La transacción subsume lo que preguntaba, y dos mecanismos para la misma promesa
son dos lugares donde puede fallar. Se va del puerto, de sus dos implementaciones, de los dobles de prueba
(`tests/helpers/unavailable-ledgers.ts`) y de las dos suites que hoy lo afirman.

**Lo que no desaparece es la garantía que daba**: un almacén que no acepta escrituras desde el arranque
sigue impidiendo arrancar, porque la semilla es una acción administrativa y ahora también corre dentro de
una unidad.
