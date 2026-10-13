# Quickstart — cómo se verifica (046, los topes de intervención, atómicos)

## Las pruebas

| qué                      | dónde                                                     | qué afirma                                                                                                |
| ------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| el turno                 | `tests/unit/application/decision/visitor-turns.test.ts`   | un visitante de a una, en orden de llegada; otro no espera; un lote que lanza libera; el mapa queda vacío |
| la carrera de la sesión  | `tests/integration/commercial-policy.test.ts`             | dos lotes de la misma sesión a la vez, tope uno: una intervención y un `NO_OP` por tope                   |
| la carrera del visitante | `tests/integration/commercial-policy.test.ts`             | dos sesiones del mismo visitante a la vez, tope diario uno: una intervención                              |
| el aislamiento           | `tests/integration/isolation.test.ts`                     | el mismo `visitorId` en dos merchants no se espera                                                        |
| la latencia              | las mediciones del camino de decisión del proyecto `fast` | siguen en verde con sus techos                                                                            |

## A mano, contra `npm run dev`

1. `dev-merchant` con `interventionsPerSession: 1`.
2. Mandar dos lotes de la misma sesión al mismo tiempo, los dos con señales que justifican intervenir: una
   intervención y un `NO_OP` por tope.

## Lo corrido (2026-10-13)

Contra `npm run dev`, con `dev-merchant` en su política por defecto (`interventionsPerSession: 1`). Un lote que no
interviene calienta la sesión, y dos lotes con señales de precio se mandan a la vez por HTTP: **una intervención
(`price`) y un `NO_OP` `session-budget-exhausted`**. La primera vez los dos dieron `evidence-stale`: el archivo de
la plataforma no trae refresco de la variante de la página; se le agregó uno mientras duró la corrida y se restauró
después.

**Lo que esta corrida no distingue**: con los almacenes de hoy el resultado es el mismo sin el arreglo, porque la
carrera es latente (research R-04, `tasks.md`). Lo que la distingue es la prueba de `commercial-policy.test.ts`
con el almacén que tarda, que fallaba con dos intervenciones y pasa con el turno.

## Romperle algo a cada comprobación

Una vez cada una: no tomar el turno; soltarlo sólo si el lote sale bien; no borrar la llave.
