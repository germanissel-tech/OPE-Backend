# Modelo de datos — Fase 1: el estado caliente que se recupera

**Feature**: `032-estado-caliente-durable` | **Fecha**: 2026-09-28 | **Plan**: [plan.md](./plan.md)

Esta feature **no crea ninguna entidad**. Las dos que le importan —`SessionState` y `VisitorState`— ya
existen, y lo que cambia es de dónde salen cuando la memoria no las tiene. Lo que sí cambia de forma son
**los puertos** y **una tabla**.

---

## Los dos puertos ganan una tercera respuesta

Hoy los dos dicen lo mismo con el mismo tipo:

```ts
load(merchantId: MerchantId, sessionId: SessionId): Promise<SessionState | undefined>;
```

`undefined` significa **«no lo recuerdo»**, y es el caso normal: el primer evento de una visita. Cuando ese
`load` empiece a leer del durable, **una falla y un visitante nuevo darían el mismo valor** — y el sistema
trataría la falla como visitante nuevo, devolviéndole el cupo entero. Es el daño de esta feature
reapareciendo por la puerta de atrás (FR-012).

**La forma nueva usa el idioma que el repositorio ya tiene**, `Result<T, E>`, y con eso las tres respuestas
son tres valores distintos:

```ts
load(merchantId: MerchantId, sessionId: SessionId): Promise<Result<SessionState | undefined, StateUnavailable>>;
```

| Respuesta                | Qué significa             | Qué hace el plano                                                    |
| ------------------------ | ------------------------- | -------------------------------------------------------------------- |
| `ok(state)`              | lo recuerdo               | decide con él                                                        |
| `ok(undefined)`          | no lo recuerdo            | reconstruye; si el durable tampoco tiene nada, es un visitante nuevo |
| `fail(StateUnavailable)` | **no se pudo determinar** | degrada a `NO_OP state-unavailable` (FR-013)                         |

**Esto es un adelanto de un punto del hito, no un invento de esta feature.** «Puertos de lectura con canal
de fallo» está declarado como trabajo de `persistence-and-resilience` —lo dice
`interface-adapters/ledger/gateways/durable-write.ts`— y esta feature lo hace **en los dos puertos que lo
necesitan ahora**, no en todos. Los demás siguen lanzando, y eso queda dicho para que el día que se haga el
resto no parezca que estos dos son la excepción.

### `StateUnavailable`

Un `DomainError` del módulo `decision`, con su entrada en `contracts/problem-types.yaml` como todos
(aunque ningún endpoint lo emita, que es la regla que `entidad.md` fija para los errores de configuración).
Su `code` es `state-unavailable`, el mismo slug que el motivo de `NO_OP` — porque nombran la misma cosa
desde los dos lados.

---

## La reconstrucción: de dónde sale cada campo

No es una entidad nueva: es cómo se llenan las dos que existen. **Está acá porque equivocarse en una fila
devuelve un estado plausible y distinto**, que es el peor modo de fallar.

### `SessionState`

| Campo                | Fuente                                                                            | Cuidado                                                            |
| -------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `signals`            | `Signals.of(...)` sobre los eventos registrados de la sesión, en orden de llegada | **sólo `accepted` y `duplicate`** — ver abajo                      |
| `interventions`      | cuántas decisiones de la sesión tienen veredicto `INTERVENE`                      | `DecisionLedger.bySession`, que existe desde la 030                |
| `lastInterventionAt` | el `decidedAt` de la última de ésas                                               | es de donde cuenta el cooldown; ausente si no hubo ninguna         |
| `updatedAt`          | el `receivedAt` del último evento registrado                                      | no el instante actual: es cuándo la sesión se movió por última vez |

**El filtro de `disposition` es la parte que decide SC-002**, y las tres razones son distintas:

- **`accepted`** se absorbieron. Se replican.
- **`duplicate`** **también se replican.** El plano recibe el **lote completo**, duplicados incluidos —la
  spec de la 031 lo dejó medido y explícitamente no juzgado—, así que esos eventos **sí** entraron en las
  señales. Omitirlos reconstruiría un estado que el sistema nunca tuvo.
- **`rejected`** **no se replican.** Ese lote nunca llegó al plano. Replicarlos inventaría señales.

El filtro va **en un solo lugar**, con ese razonamiento al lado: quien reconstruye no tiene por qué saber
que la disposición existe, y repartir la decisión entre dos llamadores es cómo se desincronizan.

### `VisitorState`

| Campo                           | Fuente                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `interventions` (los instantes) | el `decidedAt` de cada decisión `INTERVENE` **del visitante** dentro de su ventana de 24 h |

Esa lectura **no existe** y es FR-007: el ledger se indexa por decisión y por sesión, no por visitante.

---

## La tabla: migración `003`

```sql
-- decisions gana visitor_id, que hoy vive dentro del documento donde ningún índice lo alcanza.
CREATE TABLE decisions_migrated (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  visitor_id  TEXT NOT NULL,
  document    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO decisions_migrated (merchant_id, decision_id, session_id, visitor_id, document, created_at, updated_at)
SELECT merchant_id, decision_id, session_id,
       json_extract(document, '$.visitorId'),
       document, created_at, updated_at
FROM decisions ORDER BY id;

DROP TABLE decisions;
ALTER TABLE decisions_migrated RENAME TO decisions;
CREATE UNIQUE INDEX decisions_key       ON decisions (merchant_id, decision_id);
CREATE INDEX        decisions_by_session ON decisions (merchant_id, session_id);
CREATE INDEX        decisions_by_visitor ON decisions (merchant_id, visitor_id);

PRAGMA user_version = 3;
```

### Por qué reconstruye la tabla para agregar una columna

`ALTER TABLE ADD COLUMN` alcanzaría, y **no se usa a propósito**: SQLite no admite agregar una columna
`NOT NULL` sin un default constante, y después de rellenarla tampoco se puede volver `NOT NULL` sin
reconstruir igual. Quedaría **nullable para siempre**.

Y nullable acá tiene un costo concreto: el día que un gateway olvide poner el visitante, escribiría `NULL`
en silencio y **la lectura por visitante dejaría de encontrar esas decisiones** — un tope que deja de
aplicarse sin que nada falle. `NOT NULL` lo convierte en un error en el momento de escribir.

El procedimiento y su transacción ya están probados: es el mismo que la `002` usó para las siete tablas, y
el runner que aplica las pendientes llegó con la 031 (ADR-039). Los `created_at` **se copian**, no se
regeneran: esta migración no es cuándo la fila apareció.

### Lo que esta migración conserva

`created_at` y `updated_at` con sus valores, el orden de `id` (por el `ORDER BY`), y las dos garantías que
los índices daban. La única diferencia observable es que ahora hay por dónde buscar un visitante.

---

## Lo que este modelo NO cambia

- **`SessionState` y `VisitorState` no cambian de forma.** Siguen siendo lo que eran; lo que cambia es que
  se pueden reconstruir. Ninguna de las dos gana un campo.
- **No hay tabla de estado caliente.** Sigue siendo memoria, y **sigue sin ser fuente de verdad**
  (constitución IV). Lo durable es de donde se recupera, no donde vive.
- **El registro de eventos no cambia.** La 031 lo dejó con las lecturas que esta feature necesita; se usa,
  no se amplía.
