# Quickstart — cómo se verifica (044, el puerto de plataforma)

## Las pruebas

| qué                     | dónde                                             | qué afirma                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| la verdad por variante  | `tests/unit/application/catalog/`                 | stock y precio salen del dato más nuevo entre foto y refresco; la frescura es por variante; un refresco viejo o desconocido no entra; una foto nueva borra lo superado       |
| el refresco             | `tests/integration/stock-and-price.test.ts`       | `applied`, `repeated`, `superseded`, `unknown`; los dos invariantes `[invariant:…]`; el nivel cuenta el refresco como recepción                                              |
| el modo                 | `tests/integration/sync-mode.test.ts`             | cada `push` a un flujo en `pull` da `409 sync-mode-not-configured`; un aviso a un flujo que no está en `subscribe`, también                                                  |
| la configuración        | `tests/integration/admin-configuration.test.ts`   | publicar `pull` con `generic`, `subscribe` en catálogo, una fuente no instalada u órdenes en `pull` sin estados confirmados → `422` con la ruta del valor                    |
| el planificador         | `tests/unit/interface-adapters/platform/`         | `runDue` respeta la cadencia; el lote recorre el catálogo y vuelve al principio; no superpone corridas; un fallo deja rastro y no avanza el cursor; salta merchants apagados |
| las órdenes por `pull`  | `tests/integration/platform-pull.test.ts`         | sólo los estados confirmados entran; una orden vista dos veces se registra una; la devolución se vincula                                                                     |
| el aviso                | `tests/integration/platform-notices.test.ts`      | `202` y la orden registrada con lo leído; sin clave, `401`; repetido, uno; lo que dice el aviso no gana a la lectura; la fuente caída reintenta y agota con rastro           |
| la credencial del aviso | `tests/integration/admin-merchants.test.ts`       | `rotateNoticeKey` como `rotatePlatformKey`; la clave de aviso no sirve para el `push` ni la de plataforma para el aviso                                                      |
| el estado               | `tests/integration/admin-platform-sync.test.ts`   | `getMerchantPlatformSync` por flujo; fuera de alcance, `403`                                                                                                                 |
| el camino de decisión   | `tests/integration/decision-plane.test.ts`        | con una fuente que nunca responde y una corrida en curso, la decisión responde igual y no la llama                                                                           |
| el aislamiento          | `tests/integration/isolation.test.ts`             | la fuente de A nunca deposita en B; el aviso con la clave de A nunca lee B; el refresco de A no toca variantes de B                                                          |
| la durabilidad          | `tests/durability/platform.test.ts`               | el cursor, los refrescos y los avisos pendientes sobreviven un reinicio; el reinicio no duplica órdenes                                                                      |
| el circuito             | `tests/integration/end-to-end.test.ts`            | evento → decisión → exposición → orden por `subscribe` → `ATTRIBUTED_ORDER`; con foto empujada y orden consultada, lo mismo                                                  |
| el contrato             | `npm run contract:check`, `npm run test:contract` | `1.16.0`, incompatible sólo en los contenidos de los niveles y aceptado por `building`                                                                                       |

## A mano, contra `npm run dev`

`npm run dev` fija `OPE_TEST_PLATFORM=config/dev-platform.json`, con un catálogo, stock y precio con y sin instante,
y una orden en estado `invoiced`.

1. Publicar la configuración de un merchant de prueba con `platform: test`, catálogo y stock y precio en `pull`,
   órdenes en `subscribe`, `orderConfirmation.states: ["invoiced"]`.
2. Esperar un tick: `GET …/platform-sync` muestra el catálogo y el primer lote con `ok`.
3. Con el SDK de desarrollo, generar un evento y su decisión; confirmar la exposición.
4. Editar el archivo: una orden `invoiced` con el `sessionId` de la decisión. Rotar la clave de aviso y mandar el
   aviso con ella → `202`.
5. Al tick siguiente, la orden está `ATTRIBUTED_ORDER` en el log del merchant.
6. Mandar el mismo aviso otra vez → `202`, y ninguna orden nueva.
7. Hacer un `PUT /v1/catalog` firmado para ese merchant → `409 sync-mode-not-configured`.
8. Reiniciar el servidor en medio de un ciclo: el cursor sigue donde estaba.

## Romperle algo a cada comprobación

Una vez cada una: comparar la frescura con la foto en vez de con la variante; dejar entrar un refresco viejo; avanzar
el cursor antes de depositar; registrar el estado del aviso en vez del leído; olvidar el decorador del modo en una
operación del `push`.
