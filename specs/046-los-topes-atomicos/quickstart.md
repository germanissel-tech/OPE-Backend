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

## Romperle algo a cada comprobación

Una vez cada una: no tomar el turno; soltarlo sólo si el lote sale bien; no borrar la llave.
