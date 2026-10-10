# Quickstart — cómo se verifica (042, el historial completo)

## Las pruebas

| qué                  | dónde                                                                      | qué afirma                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| la regla             | `tests/unit/domain/experiment/`                                            | `restartedBy`: mismo nivel y número; un texto no responde por una configuración del mismo número; la clave y la capa del texto cuentan                                   |
| el servicio          | `tests/unit/application/experiment/`                                       | `restartedBy` con y sin merchant; encuentra experimentos cerrados después                                                                                                |
| los niveles globales | `tests/integration/levels-history.test.ts`                                 | correctiva de plataforma y de defaults con un experimento activo: la lista en publicar, en repetir, en el historial y en la versión por número; una normal, sin el campo |
| el merchant          | `tests/integration/admin-configuration.test.ts`                            | la correctiva del merchant trae la lista al publicar y en el historial; la versión por número (existe, no existe, `0` da `400`)                                          |
| los textos           | `tests/integration/messages/base-text.test.ts`, `merchant-text.test.ts`    | lo mismo para textos de la plataforma y de un merchant; un texto y una configuración con el mismo número no se mezclan                                                   |
| el aislamiento       | `tests/integration/isolation.test.ts`                                      | la versión por número de un merchant fuera de alcance da `403`; la versión 1 de un merchant nunca trae el experimento del otro                                           |
| la durabilidad       | `tests/durability/experiment-store.test.ts`, `configuration-store.test.ts` | la lista sobrevive un reinicio; `versionOf` del merchant lee del almacén                                                                                                 |
| el contrato          | `npm run contract:check`, `npm run test:contract`                          | `1.14.0`, compatible; la operación nueva servida y en el mapa                                                                                                            |

## A mano, contra `npm run dev`

Con el token del operador de desarrollo (`README.md`) y `Idempotency-Key` en cada escritura:

1. Sobre un merchant, abrir y activar un experimento: `POST /v1/admin/merchants/{id}/experiments` y
   `POST …/experiments/{exp}/activate`.
2. Publicar una correctiva de plataforma que cambie `sessionDurationMs`. La respuesta trae
   `windowsRestarted: ["{exp}"]`.
3. `GET /v1/admin/platform-configuration/versions` y `…/versions/{n}`: las dos traen la misma lista.
   Repetir el mismo cuerpo: `200`, con la misma lista.
4. Publicar una correctiva del merchant con un valor declarado distinto: la respuesta, el historial
   del merchant y `GET /v1/admin/merchants/{id}/configuration/versions/{n}` traen el experimento.
5. Parar y volver a levantar el servidor: los tres `GET` responden lo mismo.
6. `GET …/configuration/versions/999`: `404 configuration-version-not-found`.
7. Cerrar el experimento: la lista de las versiones no cambia.

## Romperle algo a cada comprobación

| se rompe                                          | lo agarra                                            |
| ------------------------------------------------- | ---------------------------------------------------- |
| `restartedBy` sin comparar la capa del texto      | la prueba de la regla, y la de textos de un merchant |
| la pregunta del merchant sin filtrar por merchant | la prueba de aislamiento                             |
| el presentador vuelve a `windowsRestarted: []`    | la prueba de historial de cada nivel                 |
| la repetición sin preguntar                       | la prueba de repetir en `levels-history`             |
| `versionOf` del merchant que ignora el merchant   | la prueba de aislamiento de la versión por número    |

## Lo corrido

_(se completa al implementar, con fecha, tramo por tramo)_
