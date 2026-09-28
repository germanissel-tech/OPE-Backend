# Implementation Plan: Un reinicio deja de reiniciar los topes

**Branch**: `032-estado-caliente-durable` | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/032-estado-caliente-durable/spec.md`

## Summary

Los dos estados calientes —sesión y visitante— dejan de perderse. Cuando el que llega no está en memoria,
se **reconstruye de lo durable** antes de decidir; los topes de intervención vuelven a valer después de un
despliegue, que es lo que hoy no ocurre y nadie mide.

**La feature es más chica de lo que su spec supone, y un requisito no se puede cumplir.** Las dos cosas
salieron de leer el código y las dos cambian el plan:

1. **La mitad ya está construida.** La reconstrucción de la sesión necesita dos lecturas y las dos existen
   y están probadas cruzando un reinicio: `EventLog.bySession` (feature 031) y `DecisionLedger.bySession`
   (feature **030**). Lo único que falta construir es la lectura por visitante (research R-01).
2. **FR-016 —el plazo de «no contestó»— no es implementable hoy**, porque `SqlStore` es síncrono y una
   lectura síncrona no se puede abandonar por tiempo. La mitad que sí existe —una lectura que **falla**—
   es la que FR-012 y FR-013 necesitan. El plazo es de la spec del gateway de PostgreSQL (research R-03).

Y el hallazgo que decide SC-002: reconstruir una sesión **replica los eventos `accepted` y `duplicate` y
descarta los `rejected`**, porque el plano recibe el lote completo pero nunca recibió el rechazado.
Equivocarse en cualquiera de los dos lados devuelve un estado plausible y distinto (research R-02).

## Technical Context

**Language/Version**: TypeScript 7 sobre Node 24 (`.nvmrc`), `strict`, `erasableSyntaxOnly`,
`exactOptionalPropertyTypes`, ESM.

**Primary Dependencies**: **ninguna nueva.**

**Storage**: el mismo `SqlStore` — SQLite en archivo, WAL — con una migración `003` que agrega
`visitor_id` a `decisions`. PostgreSQL sigue pendiente con sus pruebas de concurrencia (**D-21**).

**Testing**: Vitest. Proyecto `fast` para lo unitario y de integración; proyecto `durability` para lo que
sólo se ve cruzando un reinicio — que acá es **la feature entera**, porque el reinicio es el escenario.

**Target Platform**: Node 24 en Linux y Windows.

**Project Type**: servicio HTTP con arquitectura en anillos (ADR-013).

**Performance Goals**: el p95 de una decisión **que tuvo que reconstruir** se mide y se publica (SC-005).
No hay presupuesto declarado para ella porque no existe base de comparación; lo que sí se declara es que
el caso normal —el estado en memoria— **no cambia** (FR-010, SC-004).

**Constraints**: un solo proceso (**D-21**). La decisión **espera** la reconstrucción, que es una
excepción a «sin I/O de red en el plano de decisión» declarada por el dueño y que esta feature no puede
cuantificar. Sin dependencias nuevas.

**Scale/Scope**: 1 migración, 1 lectura nueva en el ledger, 2 puertos que ganan una tercera respuesta,
1 servicio que gana dos dependencias, 1 motivo nuevo de `NO_OP` en el contrato, 1 campo del contrato que
se parte. Tres historias.

## Constitution Check

**Constitución v1.4.4.** Los **once** principios, también los que no aplican.

| Principio                                      | Veredicto                                            | Por qué                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**               | ✅ sin impacto                                       | Ninguna autoridad cambia. `States` sigue siendo el dueño de «qué recuerda el plano» y gana de dónde recuperarlo.                                                                                                                                                                                                                                     |
| **II. Fail-closed: `NO_OP` por defecto**       | ✅ **es la decisión de la spec**                     | Q1: los topes son obligatorios, así que no poder leerlos degrada a `NO_OP` con motivo propio. Las señales son best-effort porque sin ellas el sistema queda en el comportamiento que hoy está en producción.                                                                                                                                         |
| **III. La medición precede y no se contamina** | ✅ mejora                                            | Hoy un despliegue cambia el tratamiento sin que nada lo mida: el cupo vuelve a cero. Después de esta feature, no.                                                                                                                                                                                                                                    |
| **IV. Dos caminos, dos garantías**             | ⚠️ **aplica, y es la excepción que la spec declara** | La decisión **espera** la reconstrucción, que en producción es I/O de red en el plano de decisión. El dueño lo decidió el 2026-09-27; se acota a cuando el estado caliente no tiene el dato, y **su costo no se puede cuantificar hoy** (D-21). Es el mismo trato que ADR-038 le dio a la escritura del ledger, sin el número.                       |
| **V. Aislamiento por merchant**                | ✅ cumple                                            | Toda lectura de la reconstrucción lleva el merchant en el predicado (FR-009), y se prueba **cruzando el reinicio**, que es donde un índice mal puesto lo rompería.                                                                                                                                                                                   |
| **VI. Identidad e idempotencia explícitas**    | ✅ sin impacto                                       | Ninguna identidad nueva. La lectura por visitante usa `visitorId`, que ya existe con su propósito — «estabilidad de la asignación y memoria entre sesiones», que es literalmente esto.                                                                                                                                                               |
| **VII. Comportamiento, no personas**           | ✅ cumple                                            | No se registra nada nuevo: se **lee** lo que ya está. Ningún campo nuevo de evento ni de orden.                                                                                                                                                                                                                                                      |
| **VIII. Cero modelos de lenguaje en runtime**  | ✅ cumple                                            | Ninguna llamada.                                                                                                                                                                                                                                                                                                                                     |
| **IX. Nada entra al reporte sin trazabilidad** | ✅ cumple, **y lo usa**                              | La reconstrucción es posible **porque** el ledger es durable e íntegro: la trazabilidad que IX exige es la fuente de la que se recupera el estado.                                                                                                                                                                                                   |
| **X. Puertos en los dos bordes**               | ✅ cumple                                            | El puerto de plataforma sigue con sus cuatro operaciones. Los dos puertos del estado caliente cambian de forma, y es el punto (FR-012).                                                                                                                                                                                                              |
| **XI. Ninguna política vive en el código**     | ⚠️ **aplica, y corrige a la spec**                   | La **duración de la sesión** es política y se queda en el nivel 1. La **retención caliente** no lo es —es cuánto se guarda antes de desalojar, y desalojar ya no pierde nada—, así que sale del contrato y entra por la composición, como la 031 hizo con la cola. Y **el plazo de FR-016 no entra**: una entrada que nadie lee es peor que ninguna. |

### Gates explícitos del flujo

| Gate                                                   | Respuesta                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ¿Toca una superficie HTTP?                             | **Sí, y es la diferencia con la 031.** Ninguna operación cambia, pero el **contrato sí**: un motivo nuevo de `NO_OP` (FR-014, compatible por ADR-014) y el campo de la sesión que se parte (FR-002). Los dos se diseñan en `specs/032-*/contracts/` **antes** de cualquier tarea de código. |
| ¿Toca persistencia o API?                              | **Las dos.** Migración `003`, y pruebas de aislamiento por merchant en las tres historias y cruzando el reinicio.                                                                                                                                                                           |
| ¿Toca el plano de decisión?                            | **Sí, y es el punto.** Introduce una **espera** que en producción es I/O de red — declarada como excepción, acotada y sin cuantificar. Toda salida sigue pudiendo ser `NO_OP` con motivo, y gana uno.                                                                                       |
| ¿Toca el ledger o la cadena de evidencia?              | **Sí**: el ledger gana una lectura por visitante. Los cinco estados no cambian.                                                                                                                                                                                                             |
| ¿Introduce un campo nuevo de evento u orden?           | No.                                                                                                                                                                                                                                                                                         |
| ¿Introduce una llamada a un modelo en runtime?         | No.                                                                                                                                                                                                                                                                                         |
| ¿Introduce una regla que el esquema no puede expresar? | No una nueva.                                                                                                                                                                                                                                                                               |
| ¿Introduce un sustantivo nuevo en el contrato?         | **Sí, si el motivo de `NO_OP` cuenta como tal**: lleva su entrada en `contracts/no-op-reasons.yaml` con emisor y descripción, que es donde ese catálogo vive (ADR-008 pide nota de dominio para un sustantivo; un motivo del catálogo se declara ahí).                                      |
| ¿Toca `src/`?                                          | **Sí**: dos puertos, un servicio, un gateway, una migración y el cableado. `npm run arch` es el gate; el mapa ya permite `decision → ingestion` y `decision → ledger`.                                                                                                                      |

### La decisión que este plan toma sobre un requisito que no se puede cumplir

**FR-016 se reescribe, no se borra.** Pide un plazo para «no contestó»; con un almacén síncrono eso no
existe, y agregar el valor de configuración sería una entrada que nadie lee. Lo que el plan implementa es
la mitad que sí ocurre —una lectura que **falla**— y lo que declara es que el plazo pertenece a la spec
del gateway de PostgreSQL, donde la lectura por fin puede tardar.

**Lo que eso deja cubierto y lo que no**: FR-012 (distinguir «no lo recuerdo» de «no se pudo determinar»)
y FR-013 (degradar con motivo propio) quedan **completos**, porque una falla es observable hoy. Lo que
queda afuera es sólo el caso de la lentitud, que hoy no puede ocurrir.

### Lo que este plan no puede prometer

- **Ningún número sobre el costo de la espera.** Medirlo contra SQLite local no dice nada del caso que
  importa, porque no hay red (**D-21**). SC-005 se cumple publicando lo que se puede medir y diciendo qué
  no dice.
- **Nada sobre el arranque en frío con mucho tráfico**, que la spec lista como caso borde. Con lecturas
  síncronas y un proceso, las reconstrucciones se serializan; qué significa eso bajo carga no se puede
  medir honestamente hoy.

## Project Structure

### Documentation (this feature)

```text
specs/032-estado-caliente-durable/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/          # el motivo nuevo de NO_OP y el campo de la sesión que se parte
└── checklists/
```

### Source Code (repository root)

```text
migrations/
└── 003-*.sql                                     # visitor_id en decisions, con su índice y su relleno

contracts/
├── no-op-reasons.yaml                            # el motivo nuevo (FR-014)
└── components/schemas/PlatformConfiguration.yaml # la duración de la sesión, con su valor y su sentido

src/
├── application/decision/
│   ├── ports/session-state-store.ts              # la tercera respuesta (FR-012)
│   ├── ports/visitor-state-store.ts              # idem
│   └── services/state.service.ts                 # la reconstrucción: dos dependencias más
├── application/ledger/ports/decision-ledger.ts   # la lectura por visitante (FR-007)
├── interface-adapters/ledger/gateways/sqlite-decision-ledger.ts
├── domain/shared-kernel/no-op-reasons.ts         # réplica del catálogo
└── composition/                                  # la retención caliente entra como entorno
```

**Structure Decision**: sin anillos ni módulos nuevos. La reconstrucción vive en `States`, que ya es el
dueño de qué recuerda el plano; poner un servicio aparte sumaría una indirección para algo con un solo
llamador.

## Re-evaluación del Constitution Check después del diseño

Hecha con `contracts/`, `data-model.md` y `quickstart.md` escritos. **Ningún veredicto cambia**, y el diseño
agregó cuatro cosas que no se veían antes de escribirlo:

- **El canal de fallo de las lecturas es un adelanto del hito, no un invento de esta feature.** «Puertos de
  lectura con canal de fallo» ya estaba declarado como trabajo de `persistence-and-resilience` —lo dice
  `durable-write.ts`— y esta feature lo hace **en los dos puertos que lo necesitan ahora**. Los demás siguen
  lanzando, y eso queda dicho para que después no parezca que estos dos son la excepción.
- **El error y el motivo de `NO_OP` comparten el slug** (`state-unavailable`), porque nombran la misma cosa
  desde los dos lados: el `DomainError` que el gateway devuelve y el motivo que el ledger registra.
- **La migración `003` reconstruye la tabla para agregar una columna**, y no por consistencia con la `002`:
  `ADD COLUMN` dejaría `visitor_id` **nullable para siempre**, y una fila con el visitante en `NULL` es un
  tope que deja de aplicarse sin que nada falle. El `NOT NULL` lo convierte en un error al escribir.
- **El renombre del campo publicado no es cosmético.** `sessionWindowMs` es el nombre que produjo la
  ambigüedad que FR-002 viene a partir; dejarlo significando «duración» mientras existe una retención aparte
  invita a la misma confusión otra vez. Cuesta cero porque ningún merchant consume el contrato.

Lo que el diseño **no** resolvió y el plan ya declaraba: ningún número sobre el costo de la espera, y nada
sobre el arranque en frío bajo carga.

## Complexity Tracking

| Violación                                 | Por qué hace falta                                                                                                           | Alternativa más simple, y por qué se rechaza                                                                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **La decisión espera I/O** (principio IV) | sin esperar, la decisión se toma con estado vacío y el visitante recibe de más, que es el daño que la feature vino a impedir | **Reconstruir en segundo plano y decidir con lo que haya**: la primera decisión de cada sesión reconstruida sería la equivocada, y son justo las que siguen a un despliegue |
| **Dos puertos cambian de forma**          | «no lo recuerdo» y «falló» son hoy el mismo `undefined`, y eso convierte una falla en un visitante nuevo (FR-012)            | **Atrapar la falla en el gateway y devolver `undefined`**: es exactamente el bug, escrito a propósito                                                                       |
| **Un motivo nuevo de `NO_OP`**            | reusar `barrier-unclear` convertiría una falla de infraestructura en «no había evidencia», y el piloto contaría lo segundo   | **No degradar y decidir igual**: contradice Q1 y el principio II                                                                                                            |
| **Migración `003` para una columna**      | el `visitorId` vive en el documento, donde ningún índice lo alcanza                                                          | **Extraer el JSON en la consulta**: sin índice, es un recorrido completo de las decisiones en el camino de decisión                                                         |
