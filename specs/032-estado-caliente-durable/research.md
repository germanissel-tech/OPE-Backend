# Investigación — Fase 0: Un reinicio deja de reiniciar los topes

**Feature**: `032-estado-caliente-durable` | **Fecha**: 2026-09-28 | **Plan**: [plan.md](./plan.md)

La spec cerró sus dos preguntas con el dueño (Q1, qué pasa si la reconstrucción falla; Q2, si la ventana
es por merchant) y aquellas decisiones no se rediscuten. Lo que sigue es lo que hubo que **leer del
código** para planificar — y el orden en que está importa: **la mitad de esta feature ya existe**, y uno
de sus requisitos **no se puede cumplir hoy**.

---

## R-01 — La mitad de la reconstrucción ya está construida

La spec supone que la 031 entrega los eventos. Entrega más que eso.

| Lo que la reconstrucción necesita    | De dónde                     | ¿Existe?                                                      |
| ------------------------------------ | ---------------------------- | ------------------------------------------------------------- |
| Las señales de la sesión             | `EventLog.bySession`         | **sí**, feature 031, probado cruzando un reinicio             |
| Las intervenciones **de la sesión**  | `DecisionLedger.bySession`   | **sí, y desde la 030** — con su índice `decisions_by_session` |
| Las intervenciones **del visitante** | no hay lectura por visitante | **no**, y es FR-007                                           |

Así que la mitad que la spec llamó «la que más muerde» —el presupuesto por sesión— se reconstruye con
**dos lecturas que ya están escritas y probadas**. Lo único que falta construir es la del visitante.

Eso cambia el tamaño de la feature y conviene que el plan no lo redescubra a mitad de camino.

---

## R-02 — Reconstruir una sesión: qué se reproduce, y **qué no se replica**

`SessionState` tiene cuatro cosas y cada una sale de un lado distinto:

| Campo                | De dónde                                                                   |
| -------------------- | -------------------------------------------------------------------------- |
| `signals`            | `Signals.of(eventos)` sobre los eventos registrados de la sesión, en orden |
| `interventions`      | cuántas decisiones `INTERVENE` tiene la sesión en el ledger                |
| `lastInterventionAt` | el `decidedAt` de la última de ésas — es de donde cuenta el cooldown       |
| `updatedAt`          | el instante del último evento registrado                                   |

**Y acá está el hallazgo que decide SC-002** («una sesión que vuelve produce la misma decisión»): el
registro guarda **tres** disposiciones, y sólo dos se replican.

- **`accepted`**: se absorbieron. Se replican.
- **`duplicate`**: **también se replican.** El plano de decisión recibe el **lote completo**, duplicados
  incluidos —la spec de la 031 lo dejó medido y explícitamente no juzgado—, así que esos eventos **sí**
  entraron en las señales de la sesión. Omitirlos reconstruiría un estado que el sistema nunca tuvo.
- **`rejected`**: **no se replican.** Ese lote nunca llegó al plano, así que sus eventos nunca fueron
  absorbidos. Replicarlos inventaría señales.

O sea: **`disposition` es el discriminador de la reproducción**, y equivocarse en cualquiera de los dos
lados rompe SC-002 de una forma que ninguna prueba de gateway vería — la reconstrucción devolvería un
estado plausible y distinto.

**Consecuencia para el diseño**: el filtro no puede vivir en el llamador, porque quien reconstruye no
tiene por qué saber que la disposición existe. Lo natural es que el registro conteste ya filtrado, o que
el servicio de reconstrucción lo haga en un solo lugar con este comentario al lado.

---

## R-03 — FR-016 **no se puede cumplir hoy**, y hay que decir cuál mitad sí

FR-016 pide un plazo para «no contestó». `SqlStore` es **síncrono**: `all()` devuelve
`readonly SqlRow[]`, no una promesa, porque el SQLite de la biblioteca estándar lo es (la 030 lo decidió
así en su research R-03, y la regla del gateway durable lo repite).

**Una lectura síncrona no se puede abandonar por tiempo.** No hay turno del event loop en el que un plazo
pueda dispararse: la lectura devuelve o lanza. Un `setTimeout` no existe para el llamador porque el
llamador no vuelve al loop hasta que la lectura terminó.

Así que «no contestó» se parte en dos, y sólo una mitad es de esta feature:

|                                                                    | ¿Hoy?                                                                                  |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **Falló** — el almacén lanza (disco, permisos, esquema que derivó) | **sí**, y es lo que FR-012 y FR-013 necesitan: el gateway lo atrapa y lo traduce       |
| **Tardó demasiado** — la lectura no vuelve a tiempo                | **no**. Requiere que la lectura sea de red, que es el gateway de PostgreSQL (**D-21**) |

**Lo que el plan propone**: implementar la mitad que existe —una falla se traduce y degrada— y **no
agregar el valor de configuración del plazo**, porque sería una entrada que nadie lee y que
`check:dead-code` señalaría con razón. El plazo se declara como lo que es: parte de la spec del gateway
de PostgreSQL, donde la lectura por fin puede tardar.

FR-016 se reescribe con eso; no se borra, porque la pregunta sigue siendo válida el día que haya red.

---

## R-04 — FR-007 necesita una migración, porque el visitante vive en el documento

`decisions` tiene columnas para `merchant_id`, `decision_id` y `session_id`. El `visitorId` está **dentro
del `document`** (`DecisionFacts.visitorId`), donde ningún índice lo alcanza.

**Decisión**: migración `003` que agrega `visitor_id` como columna con su índice
`(merchant_id, visitor_id)`, y **rellena las filas existentes** desde el documento con
`json_extract(document, '$.visitorId')`.

Dos cosas que la 031 dejó resueltas y esto aprovecha:

- **El runner ya migra hacia adelante** (ADR-039), así que la `003` es un archivo y no un cambio de
  infraestructura. La primera que convive con anteriores ya se pagó.
- **Agregar una columna sí admite `ALTER TABLE`** — a diferencia de una clave primaria—, y el relleno es
  un `UPDATE`. No hace falta reconstruir la tabla como en la `002`.

Y la tabla ya cumple las dos reglas del dueño desde la `002`, así que FR-011 no pide nada nuevo acá.

---

## R-05 — Dónde entra la reconstrucción, y qué cuesta

`States.recall` (`application/decision/services/state.service.ts`) es el único lugar que carga los dos
estados, y hoy hace esto:

```ts
const [session, visitor] = await Promise.all([
  this.#deps.sessions.load(merchantId, sessionId),
  this.#deps.visitors.load(merchantId, visitorId),
]);
const known = visitor ?? VisitorState.empty();
return { session: session ?? SessionState.empty(now), visitor: known, ... };
```

Los dos `??` son exactamente el daño de FR-012: **«no lo recuerdo» y «falló» son el mismo `undefined`**, y
los dos se vuelven «empezá de cero».

**Qué gana el servicio**: dos dependencias —el registro de eventos y el ledger de decisiones—, con lo que
queda en **cinco**. El mapa de contextos ya lo permite: `decision` puede importar `ingestion` y `ledger`.

**Alternativa descartada**: un servicio nuevo de reconstrucción que `States` invoque. Suma una indirección
para algo que tiene un solo llamador, y `States` ya es el dueño de «qué recuerda el plano».

---

## R-06 — FR-002 parte un campo que el contrato publica

`PlatformConfiguration.sessionWindowMs` está en el contrato, viaja al SDK dentro de
`EffectiveConfiguration`, y hoy vale 86 400 000 (24 h). La spec pide partirlo en dos: la **duración de la
sesión** (regla de negocio, 30 min) y la **retención caliente** (recurso).

Eso toca el contrato, y hay que decirlo con precisión porque la 031 se cuidó de no tocarlo:

- **El campo que el SDK necesita es la duración**, que es la regla que el SDK tiene que obedecer. Puede
  quedarse con el nombre que ya tiene y cambiar de valor —en construcción no se salta versión mayor
  (ADR-003)— o renombrarse a algo que diga qué es.
- **La retención caliente no la necesita el SDK**: es cuánto guardamos antes de desalojar, y desalojar ya
  no pierde nada. Por el mismo argumento que la 031 usó para la cola, ése es un valor del **entorno**.

**Lo que el plan propone**: la duración se queda en el nivel 1 y en el contrato, con su valor corregido y
su descripción diciendo que es la regla del SDK; la retención sale del contrato y entra por la
composición. Así el campo publicado significa una sola cosa.

---

## Lo que esta investigación NO resolvió

- **Cuánto cuesta esperar la reconstrucción.** Medirlo contra SQLite local no dice nada del caso que
  importa —no hay red— y el motor real no está (**D-21**). La spec ya lo declara sin cuantificar.
- **El arranque en frío con mucho tráfico**, que la spec lista como caso borde: todas las sesiones activas
  piden reconstrucción a la vez. Con lecturas síncronas y un proceso, se serializan; qué significa eso
  bajo carga es una medición que hoy no se puede hacer honestamente.
