# El contrato de la feature 032, diseñado antes del código

Esta feature **sí toca el contrato**, a diferencia de la 031, y el gate del flujo pide diseñar el cambio
acá antes de escribir una tarea de código. Son **dos cambios** y ninguno agrega ni quita una operación:
el mapa sigue en 30 construidas y 5 planificadas.

Los dos entran bajo la marca `info.x-stability: building` (ADR-003): ningún merchant consume el contrato
todavía, así que un cambio incompatible se acepta y se reporta en vez de forzar una versión mayor. La
marca se quita antes del primer piloto.

---

## 1. Un motivo nuevo de `NO_OP`: `state-unavailable`

**Dónde**: `contracts/no-op-reasons.yaml`, que es la fuente del catálogo — el `NO_OP_REASONS` del dominio
es su réplica y una prueba verifica que coinciden.

```yaml
- slug: state-unavailable
  emitter: orchestrator
  description: The interventions the caps are counted from could not be read — the hot state did not
    have them and the durable store did not answer. The decision degrades rather than intervene without
    knowing what the visitor already received (feature 032, FR-013).
```

**Es un cambio compatible** (ADR-014): el contrato declara `Decision.reason` como un string con patrón, no
como un enum, así que agregar un motivo no rompe a nadie.

### Por qué un motivo propio y no uno que ya existe

Los dos candidatos y por qué ninguno sirve:

- **`barrier-unclear`** significa «no había evidencia suficiente para inferir una barrera». Usarlo acá
  convertiría **una falla de infraestructura en un dato falso del piloto**: al analizar, un montón de
  `barrier-unclear` parece un problema de las señales del SDK o de las reglas, cuando fue el almacén que
  no respondió. Y nadie tendría con qué distinguirlos.
- **`ledger-unavailable`** significa «la escritura no se pudo hacer». Acá el problema es una **lectura**, y
  la consecuencia es distinta: la escritura degradada suprime una intervención que ya se decidió; ésta
  impide decidirla.

La regla que esto sigue está en el propio catálogo: **cada motivo lo emite una autoridad y el ledger lo
registra tal cual** (constitución II). Un motivo que miente sobre su causa rompe lo único que el catálogo
sirve para hacer.

---

## 2. El campo de la sesión se parte, y sólo una mitad se publica

**Dónde**: `contracts/components/schemas/PlatformConfiguration.yaml`.

Hoy hay un campo que significa dos cosas:

```yaml
sessionWindowMs:
  description: Milliseconds a session is remembered since its last batch.
```

Con valor `86400000` en `config/platform.json`. Significa a la vez **cuánto dura una sesión** y **cuánto la
guardamos en memoria**, y hoy coinciden porque el almacén caliente es la única noción de sesión que existe.
Después de esta feature dejan de coincidir: una sesión viva se puede desalojar **sin perderla**.

### Lo que queda en el contrato

```yaml
sessionDurationMs:
  type: integer
  description: Milliseconds of inactivity after which a session is over and the SDK must mint a new
    `sessionId`. It is a rule of the backend that the SDK obeys, not an observation the client makes
    (feature 032, FR-001).
  minimum: 1
  maximum: 31536000000
```

Con valor **1800000** (30 minutos), que es la decisión del dueño.

**Se renombra, y no es cosmético.** `sessionWindowMs` es el nombre que produjo la ambigüedad: «ventana» no
dice si es la de la sesión o la de la memoria. Dejarlo significando «duración» mientras existe una retención
aparte invita exactamente a la misma confusión otra vez. Renombrar cuesta cero —ningún merchant consume el
contrato— y la quita para siempre.

### Lo que sale del contrato

**La retención caliente no se publica.** Es cuánto guardamos antes de desalojar, y desalojar ya no pierde
nada: no cambia ninguna respuesta ni ninguna decisión. Es un valor del **entorno**, como la ruta del
almacén (feature 030) y el afinado de la cola del registro (feature 031), y entra por la composición.

Publicarla obligaría a contarle a cada merchant el tamaño de una memoria nuestra, que es lo mismo que la
031 decidió no hacer con su cola.

### Lo que no cambia

`visitorWindowMs` **se queda como está**: Q2 lo decidió, y su nombre está atado a
`interventionsPerVisitorPerDay` — separar el numerador del denominador permitiría configurar «3» y recibir
una ventana que no se eligió.

---

## Lo que este cambio de contrato NO hace

- **No agrega ni cambia ninguna operación.** `check:api-map` lo confirma.
- **No agrega ningún campo de dato personal.** Se lee lo que ya está.
- **No toca el contrato de ingesta.** El SDK manda lo mismo; lo que cambia es un valor que ya recibía.
