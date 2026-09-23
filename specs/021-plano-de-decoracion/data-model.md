# Data model — Plano de decoración (021)

No hay entidades de dominio nuevas. Lo que sigue es el modelo de **lo que un módulo declara** y de
**lo que la plataforma deriva**, más el único cambio que toca el dominio (un error que declara cómo
se registra).

## 1. Operación servida

Lo que el contrato declara y el servidor rutea por `operationId`.

| Parte         | De dónde sale                                                             | Quién la usa                                 |
| ------------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| `operationId` | la clave con que el módulo la declara, verificada contra el tipo generado | el servidor, el log, la entrada del registro |
| consumidor    | el tag, según el mapa del contrato                                        | la derivación                                |
| capacidades   | `x-required-capabilities`                                                 | la derivación                                |
| caso de uso   | lo declara el módulo                                                      | lo que se envuelve                           |
| controller    | lo declara el módulo                                                      | traduce DTO ↔ dominio                        |

**Invariantes**

- Una operación se sirve **una vez**: dos módulos que reclamen la misma es un error de cableado que
  ya se detecta al construir el servidor.
- Un handler resuelve **exactamente un** caso de uso. Medido en los 29 (research R-02); no hay
  escotilla para otra cosa, y si algún día hace falta, hace falta una decisión, no un parámetro.

## 2. Decoración derivada

Qué preocupación transversal le corresponde a una operación. **No se declara: se deriva.**

| Condición                                                                | Qué se aplica                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------ |
| consumidor de administración **y** alguna capacidad que no es de lectura | registro de administración **y** log operacional |
| cualquier otro caso                                                      | log operacional                                  |

**Invariantes**

- La regla es **una** y vive en un solo lugar: el generador que la deriva del contrato.
- El autor de un módulo **no puede** elegir, ni acertando ni equivocándose: no hay parámetro donde
  expresar la elección.
- Cambiar qué se audita es cambiar el contrato —agregar una capacidad de escritura a una operación,
  o mover una operación de consumidor—, nunca editar un módulo.
- Hoy la regla clasifica **10 de 29** como auditadas, y reproduce exactamente la elección que
  estaba escrita a mano (research: 29 de 29).

## 3. Vocabulario generado

La lista de operaciones que el contrato manda auditar, derivada del bundle.

| Campo        | Qué es                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------- |
| origen       | el bundle del contrato: el tag de cada operación, el consumidor que ese tag fija y sus capacidades |
| forma        | un tipo: la unión de los `operationId` que se auditan                                              |
| dónde        | `generated/`, junto a lo que ya se deriva del contrato                                             |
| quién lo lee | el borde HTTP lo reexporta y la biblioteca del grafo lo consume por ahí                            |

**Invariantes**

- **Nunca se edita a mano** (como todo lo de `generated/`).
- Desactualizado falla el build: lo cubre el chequeo de drift que ya existe.
- No es una réplica: no hay una segunda copia que pueda divergir. Si el contrato cambia, el tipo
  cambia, y lo que dejó de compilar lo dice el compilador.

## 4. Declaración de lo que un módulo sirve

Un handler declara tres cosas y ninguna es la preocupación transversal:

| Parte                    | Qué es                                                          | Obligatoria                       |
| ------------------------ | --------------------------------------------------------------- | --------------------------------- |
| lo que necesita          | los componentes del grafo, por nombre                           | sí                                |
| el caso de uso           | una función de lo que necesita; lo construye o lo toma resuelto | sí                                |
| el controller            | traduce; recibe el caso de uso **ya envuelto**                  | sí                                |
| el nombre del log        | el nombre del **caso de uso**                                   | sí (research R-08)                |
| lecturas de la auditoría | qué toma la entrada del request y de la respuesta               | sólo si la operación las necesita |

**Invariantes**

- El controller **nunca** ve el caso de uso sin envolver: recibe lo que la plataforma construyó.
- El `operationId` viaja **una vez**, en la clave.
- El nombre del log es el del caso de uso y **no** se deriva del `operationId`: en dos operaciones
  no coinciden, y derivarlo cambiaría comportamiento observable.
- Las lecturas de la auditoría son **opcionales** y son dato de la operación, no marcador de que se
  audita: el marcador es el contrato (research R-04; cinco de las diez auditadas no las necesitan).

## 5. Lo que el compilador rechaza

| Situación                                                                                              | Cuándo se ve    | Qué dice                      |
| ------------------------------------------------------------------------------------------------------ | --------------- | ----------------------------- |
| Una operación que el contrato manda auditar, servida por un caso de uso cuyo request no lleva operador | **compilación** | nombra la operación           |
| Un `operationId` que el contrato no declara                                                            | **compilación** | ya lo hace hoy                |
| Una operación del contrato que ningún módulo sirve                                                     | **compilación** | ya lo hace hoy (`Unwired<…>`) |
| Un componente que nadie provee                                                                         | **compilación** | ya lo hace hoy (`Missing<…>`) |

La primera fila es lo único nuevo, y es la forma de equivocarse que queda en pie una vez que la
elección se deriva (research R-03).

## 6. Entrada del registro de administración

**Sin cambios de forma**: actor, operación, merchant, resultado (`accepted`, `rejected`, `denied`),
código y motivo. El vocabulario de resultados no se amplía ni se reduce (FR-013).

Lo único que cambia es **quién decide el resultado**:

| Antes                                                                    | Ahora                                                                               |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| el kernel comparaba el código del error contra un literal escrito a mano | el error que deniega lo declara; el kernel usa `rejected` cuando nadie declara nada |

**Invariantes**

- El kernel no conoce ningún código de error por su texto.
- Un error que deniega lo dice en su propia clase, donde vive su regla.
- El resultado por defecto es `rejected`: un error nuevo que no declare nada se registra como
  rechazo, que es el caso conservador.

## 7. Disponibilidad del registro

**Nuevo.** Antes de ejecutar una acción administrativa se verifica que el registro acepte
escrituras.

| Situación                                | Qué pasa                                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| el registro acepta escrituras            | la acción se ejecuta y se registra, como hoy                                                 |
| el registro **no** acepta escrituras     | la acción **no se ejecuta** y la operación responde con el rechazo por almacén no disponible |
| el registro se cae **durante** la acción | la acción ocurre y no queda constancia — **la ventana que esta feature no cierra**           |

**Invariantes**

- La verificación es **antes**: fallar después de actuar le diría al operador que no pasó algo que
  sí pasó, y en una rotación dejaría una credencial que nadie conoce.
- Sólo afecta a las acciones administrativas. Ingesta, decisión, catálogo y outcomes no se tocan.
- La ventana abierta está documentada y su cierre es requisito del hito de persistencia, donde
  habrá transacción.

## 8. La semilla del arranque

Tres casos de uso se auditan sin loguearse y **no son operaciones del contrato**: no tienen
consumidor ni capacidades.

**Invariantes**

- Se declaran explícitamente; no se derivan. Inventarles un consumidor o una capacidad para que
  entren por el mismo camino sería mentirle al contrato por simetría.
- Siguen auditándose como el operador del sistema y siguen **sin** emitir log de caso de uso: es lo
  que hacen hoy y cambiarlo sería comportamiento observable.

## 9. Lo que desaparece

| Qué                                                                  | Por qué                                                                                                                                  |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| El componente que expone las tres maneras de envolver un caso de uso | Nadie elige una manera: la plataforma la aplica. Era además un tipo declarado en el composition root, del que dependían los 29 handlers. |
| Su puerto                                                            | Sin consumidores.                                                                                                                        |
| La dependencia correspondiente en los 29 handlers                    | Liberaba un cupo de los seis y era el nombre más repetido de la composición.                                                             |
| La comparación por texto en el kernel                                | La reemplaza la declaración del error.                                                                                                   |
