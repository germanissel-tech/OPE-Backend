# Data model — 045, las decisiones que el puerto dejó abiertas

Ninguna tabla nueva ni migración: los tres cambios viajan en el documento de lo que ya se guarda, y un documento
anterior a la feature se lee igual.

## Orden (`outcomes`, existe)

| campo nuevo           | qué es                                                   | regla                                                                |
| --------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| `confirmedAtObserved` | presente (`true`) sólo si OPE puso el instante al leerla | ausente = lo dio la plataforma: todo `push` y todo registro anterior |

**La misma orden**: mismo identificador, total, ítems, sesión e incentivo declarado; y el mismo `confirmedAt`
**sólo si ninguna de las dos lecturas lo tiene observado**. Distinto en cualquiera de las otras cosas: conflicto,
como hoy.

## Devolución (`outcomes`, existe)

| campo nuevo          | qué es                                                   | regla                          |
| -------------------- | -------------------------------------------------------- | ------------------------------ |
| `returnedAtObserved` | presente (`true`) sólo si OPE puso el instante al leerla | ausente = lo dio la plataforma |

**La misma devolución**: mismos ítems; y el mismo `returnedAt` sólo si ninguna de las dos lo tiene observado.

## Aviso (`platform`, existe)

| campo nuevo | qué es                                                              | regla                                                                        |
| ----------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `via`       | `"pull"` cuando es una devolución huérfana de una corrida de `pull` | ausente = un aviso de `subscribe`; decide la compuerta del modo al depositar |

Una devolución huérfana encolada: `flow: "returns"`, `reference` = el `orderId`, `attempts: 1`, `nextAt` = la primera
espera de reintento, sin `state`. Única por merchant, flujo y referencia mientras está pendiente, como cualquier
aviso: la misma devolución leída otra vez no agrega otra.

## Estado de un flujo (`platform`, existe)

Sin campos nuevos. **La próxima corrida** de un flujo en `pull` vence a `lastRunAt` más:

- su cadencia, si la última salió bien o nunca corrió;
- `min(cadencia, noticeRetry.afterMs)`, si la última falló.
