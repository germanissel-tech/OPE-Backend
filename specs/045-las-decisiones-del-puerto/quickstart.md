# Quickstart — cómo se verifica (045, las decisiones que el puerto dejó abiertas)

## Las pruebas

| qué                                 | dónde                                                                 | qué afirma                                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| la misma orden, la misma devolución | `tests/unit/domain/outcomes/`                                         | el instante cuenta sólo si los dos lo dio la plataforma; un total o unos ítems distintos, conflicto                         |
| el instante observado               | `tests/unit/interface-adapters/platform/`                             | el planificador y el lector marcan observado sólo el instante que completan                                                 |
| la devolución huérfana              | `tests/unit/interface-adapters/platform/`                             | `pull` la encola con su modo y sigue; el lector la reintenta, la deposita por la compuerta de su modo y la agota con rastro |
| el reintento de una corrida         | `tests/unit/interface-adapters/platform/scheduler.test.ts`            | fallida espera `min(cadencia, noticeRetry.afterMs)`; bien, la cadencia; sin tope                                            |
| la orden releída                    | `tests/integration/platform-pull.test.ts`, `platform-notices.test.ts` | una orden sin instante leída dos veces queda una, la segunda cuenta y nada se loguea como rechazo                           |
| la devolución que adelanta          | `tests/integration/platform-pull.test.ts`                             | entra cuando su orden llega; un cambio de modo en el medio la descarta con rastro                                           |
| el aislamiento                      | `tests/integration/isolation.test.ts`                                 | la devolución huérfana de A nunca se vincula a una orden de B                                                               |
| la durabilidad                      | `tests/durability/platform.test.ts`, `outcomes.test.ts`               | la marca del instante, la devolución encolada y el reintento de una corrida fallida sobreviven un reinicio                  |

## A mano, contra `npm run dev`

1. `dev-merchant` con catálogo en `pull`, órdenes en `subscribe` y devoluciones en `pull`; la fuente de prueba.
2. En el archivo de la plataforma, una orden `invoiced` **sin** `confirmedAt`; avisarla dos veces: queda una, y
   `platform-sync` dice `count: 1` las dos veces, sin rechazos en el log.
3. Agregar una devolución de una orden que todavía no está en el archivo: al tick, `pendingNotices` de devoluciones
   sube a 1. Agregar la orden y avisarla: al vencer el reintento, la orden queda `RETURNED`.
4. Romper el catálogo (`"failing": true`): el reintento llega al minuto, no al día; sacar la falla: la corrida sale
   bien y la siguiente espera un día.

## Lo corrido (2026-10-13)

Los cuatro pasos, a mano, contra `npm run dev` (el despliegue durable sobre un almacén limpio, el de antes
respaldado en `data/ope.db.2026-10-13.bak`), con `dev-merchant` en `platformSource: test`. Dos ajustes de cadencia,
publicados como versiones correctivas, para no esperar los valores por defecto: `returnsMs: 30000` en el paso 3 (la
corrida de devoluciones ya había pasado y la siguiente era a los 15 minutos) y `catalogMs: 300000` en el paso 4 (si
no, la próxima foto era al día siguiente). Al terminar, el archivo de la plataforma se restauró y la configuración
volvió a la de antes.

| paso | resultado                                                                                                                                                                                                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `201`; catálogo y stock por `pull`, órdenes por `subscribe`, devoluciones por `pull`                                                                                                                                                                 |
| 2    | `dev-order-2`, `invoiced` y sin instante, avisada dos veces: la primera lectura y la segunda (30 s después) cuentan 1 cada una; ningún `idempotency-conflict` ni rechazo en el log; la orden guarda su instante como observado                       |
| 3    | la devolución de `dev-order-3` antes que su orden: `pendingNotices: 1` en devoluciones, la corrida cuenta 0 y no loguea rechazo; con la orden agregada y avisada, al vencer el reintento la orden quedó `RETURNED` y no quedó ningún aviso pendiente |
| 4    | con la plataforma caída, el catálogo falló a las 14:28:45 y se reintentó a las 14:29:45, al minuto y no a los 5 de su cadencia; sin la falla salió bien a las 14:30:45 y no volvió a correr en los 95 s siguientes                                   |

## Romperle algo a cada comprobación

Una vez cada una: comparar el instante aunque uno sea observado; descartar la devolución huérfana en vez de
encolarla; reintentar una corrida fallida a su cadencia.
