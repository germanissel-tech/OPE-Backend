# Quickstart — cómo se verifica (043, el testigo de concurrencia)

## Las pruebas

| qué            | dónde                                                        | qué afirma                                                                                                                                                    |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| la revisión    | `tests/unit/domain/merchant/`                                | `of` empieza en 1; cada uno de los cuatro métodos suma uno; un documento sin revisión rehidrata en 0                                                          |
| el borde       | `tests/unit/interface-adapters/`                             | `If-Match` fuerte y único → su valor; `*`, varios, débil y sin comillas → no coinciden                                                                        |
| la extensión   | `tests/integration/` (el de `dispatch`)                      | sin `If-Match`, `428 witness-required` sin `ETag`; con otro error de forma además, `400`                                                                      |
| los niveles    | `tests/integration/levels.test.ts`, `platform-level.test.ts` | leer → `ETag`; publicar con él → `201` y el nuevo; con el viejo → `412` y nada escrito; idéntico con el viejo → `200`; el de plataforma no vale para defaults |
| el merchant    | `tests/integration/admin-configuration.test.ts`              | lo mismo con la configuración de un merchant, también sin versión propia; el testigo antes que el `409`                                                       |
| la identidad   | `tests/integration/admin-merchants.test.ts`                  | editar con el testigo → `200` y el nuevo; después del interruptor, de una rotación y de una desactivación, el testigo viejo da `412`                          |
| el aislamiento | `tests/integration/isolation.test.ts`                        | el testigo de A no habilita escribir en B; fuera de alcance, `403` antes que `412`                                                                            |
| la durabilidad | `tests/durability/merchant-store.test.ts`                    | la revisión sobrevive un reinicio; un documento viejo lee `0`                                                                                                 |
| el contrato    | `npm run contract:check`, `npm run test:contract`            | `1.15.0`, incompatible y aceptado por `building`; la extensión verificada                                                                                     |

## A mano, contra `npm run dev`

Con el token del operador de desarrollo (`README.md`):

1. `GET /v1/admin/platform-configuration` → `ETag: "platform-N"`.
2. Publicar sin `If-Match` → `428 witness-required`, sin `ETag`.
3. Publicar con `If-Match: "platform-N"` y un cambio → `201`, `ETag: "platform-N+1"`.
4. Publicar otro cambio con `If-Match: "platform-N"` → `412 stale-version`; lo que rige es N+1.
5. Repetir el cuerpo del paso 3 con `If-Match: "platform-N"` → `200`, la N+1.
6. `GET /v1/admin/merchants/{id}` → `ETag`; apagar el interruptor; editar la identidad con el testigo de
   antes → `412`.
7. Lo mismo para la configuración de un merchant.

## Romperle algo a cada comprobación

| se rompe                                       | lo agarra                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| un método del merchant que no suba la revisión | la prueba de la revisión, y la de la identidad después del interruptor |
| el testigo de la configuración sin el merchant | la prueba de aislamiento                                               |
| el testigo mirado antes de la repetición       | la prueba del reintento (`200` con el testigo viejo)                   |
| el testigo mirado antes del alcance            | la prueba de aislamiento (`403` antes que `412`)                       |
| `validationFail` sin la extensión              | la prueba del `428`                                                    |

## Lo corrido

_(se completa al implementar, con fecha, tramo por tramo)_
