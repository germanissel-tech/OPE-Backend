# Research — 045, las decisiones que el puerto dejó abiertas

Las cuatro decisiones vienen cerradas con el dueño (ADR-047, enmienda del 2026-10-13). Lo que queda es **cómo**:
dónde vive cada regla, qué cambia en los registros y qué se descartó.

## R-01 — El origen del instante vive en la orden y en la devolución

**Lo que hay.** `Order.sameContentAs` y `Return.sameContentAs` comparan una clave de texto que incluye el instante
(`confirmedAt`, `returnedAt`). El libro de órdenes decide primero, repetido o conflicto con esa comparación, dentro
de su transacción. El planificador y el lector de avisos completan el instante que la plataforma no dio con el de
la observación (`now`) antes de llamar al caso de uso, y desde ahí nadie sabe que fue completado.

**Decisión.** El origen del instante es un **hecho de la orden** (y de la devolución), y la comparación es una
regla de la orden, así que viven en `src/domain/outcomes/`:

- `OrderFacts` gana `confirmedAtObserved?: true` y `ReturnRecord` gana `returnedAtObserved?: true`. **Presente
  sólo cuando el instante lo puso OPE**; ausente es «lo dio la plataforma», que es lo cierto de todo lo que llegó
  por `push` y lo que lee un registro anterior a esta feature (FR-005) sin migración.
- `sameContentAs` compara la clave **sin el instante** y, sólo si ninguna de las dos lecturas lo tiene observado,
  compara además los instantes. Basta con que una lo tenga observado para que no cuente (spec, caso borde de la
  orden anterior).
- `NotifyOrderRequest` gana `confirmedAtObserved?: true | undefined` y `NotifyReturnRequest`,
  `returnedAtObserved?: true | undefined`; el caso de uso los pasa a la fábrica. El `push` nunca los manda.
- Quien completa el instante —el planificador y el lector de avisos— lo marca observado en el mismo lugar en que lo
  completa (`?? now`), y en ningún otro.

**Descartado.**

- **Un `confirmedAtOrigin: "platform" | "observed"` obligatorio**: obligaría a reescribir todo registro guardado o
  a tratar su ausencia de todos modos; un opcional que sólo existe cuando hay algo que decir es la misma regla con
  un caso menos.
- **Que el adaptador consulte el libro antes de depositar**: ya descartado por el dueño (un conflicto real pasaría
  en silencio).

**El contrato no cambia**: el origen no se expone en ninguna respuesta (spec, supuestos) y el `push` no lo declara.

## R-02 — La devolución huérfana se reintenta por la cola de avisos, en los dos modos

**Lo que hay.** En una corrida de `pull` de devoluciones, `notifyReturn` responde `order-unknown` a una devolución
de una orden que OPE no tiene; el planificador lo loguea como rechazo y el cursor la deja atrás. **Y el lector de
avisos hace lo mismo** con un aviso de devolución cuya orden no está: el núcleo lo rechaza, el lector lo trata como
un rechazo y da el aviso por terminado. La spec suponía que por `subscribe` ya se reintentaba; no es así, y la
decisión del dueño («la devolución de una orden que todavía no está se reintenta») alcanza a los dos.

**Decisión.**

- **En el lector de avisos**, `order-unknown` de una devolución deja de ser un rechazo: es una lectura que no pudo
  completarse todavía, y sigue el camino del reintento (`noticeRetry`, rastro al agotar). Es el mismo camino que ya
  sigue «la plataforma no tiene la referencia».
- **En el planificador**, una devolución de `pull` con `order-unknown` se encola como un aviso de devolución con
  `nextAt` en la primera espera de reintento y el cursor sigue. Releerla en el tick siguiente no tendría sentido:
  la orden no llegó en treinta segundos.
- **El aviso recuerda por qué modo entró**: `Notice` gana `via?: "pull"` (ausente = un aviso de `subscribe`), y el
  lector deposita por el caso de uso envuelto en la compuerta del modo de ese aviso. Así una devolución de `pull`
  reintentada pasa por la compuerta de `pull` y un cambio a `push` en el medio la descarta con rastro (spec, caso
  borde), igual que un aviso.

**Descartado.**

- **Una cola de reintentos propia del planificador**: sería la cola de avisos otra vez, con su tabla, su durabilidad
  y su rastro.
- **Reintentar cualquier rechazo**: ya descartado por el dueño (un cambio que nunca va a entrar trabaría el flujo).
- **Dejar que la compuerta acepte `pull` y `subscribe` para la devolución reintentada**: aceptaría una devolución
  por un modo que el merchant ya no tiene.

## R-03 — El reintento de una corrida fallida se calcula de lo guardado

**Lo que hay.** El planificador corre un flujo cuando `now - lastRunAt >= cadence.intervalOf(flow)`.

**Decisión.** La espera depende del último resultado, que ya está guardado en `platform_sync`:

- `lastOutcome.status === "failed"` → espera `min(cadence.intervalOf(flow), retry.afterMs)`.
- cualquier otro (incluido nunca haber corrido) → espera la cadencia, como hoy.

No hay contador ni tope: cada reintento espera lo mismo (FR-009). Como sale de lo guardado, sobrevive un reinicio
sin nada nuevo (FR-010). La regla de cuánto esperar es de la cadencia del flujo y del reintento, que viven en
`src/domain/platform/`; pero combina dos valores de dos dueños distintos para una decisión del planificador, así que
vive en el planificador como una función con nombre, y la prueba la fija.

**Descartado.** Un valor de configuración propio (`syncCadence.retryMs`): ya descartado por el dueño.

## R-04 — El temporizador no cambia

Se confirma lo construido (ADR-047, enmienda, punto 4): ni código ni prueba nueva. La prueba del temporizador de la
044 ya fija que no corre hasta `start()` y que cada tick relee el valor.

## R-05 — Qué prueba qué

- **Unidad, dominio**: `sameContentAs` de la orden y de la devolución con los cuatro casos (los dos de la
  plataforma con el mismo instante, con distinto; una observada; las dos observadas) y con un total distinto.
- **Unidad, planificador y lector**: el instante completado se marca observado; la devolución huérfana se encola
  con su modo; el lector la reintenta y la deposita por la compuerta de su modo; la espera de reintento y la de
  cadencia.
- **Integración**: la orden leída dos veces por `subscribe` y por `pull` queda una y cuenta; la devolución que
  adelanta a su orden entra cuando la orden llega; un catálogo caído se reintenta al minuto; aislamiento.
- **Durabilidad**: la marca del instante sobrevive en el documento de la orden; una devolución huérfana encolada
  sobrevive un reinicio; el reintento de una corrida fallida se calcula después de un reinicio.
