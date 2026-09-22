# Quickstart — cómo se valida la feature 020

Guía de validación, no de implementación. Cada paso dice qué correr y qué tiene que dar. El criterio
que ordena todo: **el comportamiento observable no cambia** y la suite existente es el juez
(FR-026, SC-007).

## Prerrequisitos

```bash
npm ci
npm run contract:bundle     # varias pruebas leen contracts/dist/openapi.yaml
npm run build               # test:contract levanta el servidor construido
```

## 1. La garantía central: lo que no compila

Los cuatro casos viven en `tests/typecheck/fixtures/` y los corre `npm test`
(`tests/typecheck/typecheck.test.ts`), que compila cada fixture con un tsconfig temporal y afirma el
código y el texto del error.

| Fixture                       | Tiene que fallar con                                  |
| ----------------------------- | ----------------------------------------------------- |
| `graph-missing-provider.ts`   | `TS2345` … `Missing<"clock">`                         |
| `graph-technology-partial.ts` | `TS2345` … `Unserved<"merchant.directory">`           |
| `graph-derive-foreign.ts`     | `TS2379` (el tipo de la fuente no satisface la vista) |
| `graph-operation-unwired.ts`  | `TS2345` … `Unwired<"…">`                             |

Y el positivo, sobre el código real:

```bash
npm run typecheck        # el despliegue completo compila
```

## 2. El grafo en ejecución

```bash
npm test -- tests/unit/composition
```

Tiene que probar, como mínimo:

- un componente que dos consumidores comparten es **la misma instancia**, construida una sola vez;
- una vista derivada devuelve **el objeto** de su fuente;
- un ciclo falla al arrancar con `Cycle in the composition graph: a -> b -> a.`;
- el orden de la lista del despliegue no cambia el resultado;
- `close()` cierra en orden inverso al de creación (la prueba de hoy, sin tocar).

## 3. Los gates nuevos

```bash
npm run check:ports-bound              # verde sobre src/
npm run check:ports-bound -- --src tests/audit/fixtures/unbound-port/src   # rojo, nombrando el puerto
npm test -- tests/architecture         # la regla de forma nueva: verde en src/, roja en su fixture
npm run arch                           # mapa de contextos, ahora también en composition/modules/
```

## 4. Que no cambió nada

```bash
npm run contract:check     # incluye contract:diff y check:api-map: cero diff del contrato y del mapa
npm test                   # proyecto fast, entero
npm run test:scoped        # agrega tools (cambian scripts/ y tests/audit/)
npm run test:contract      # Schemathesis contra el servidor construido
npm run release-check
```

Señales de que algo se movió de lugar y no debía:

- cualquier diff en `contracts/` o en `contracts/api-map.yaml`;
- cualquier aserción de comportamiento modificada en `tests/` (lo único que puede reescribirse son
  las pruebas **del mecanismo reemplazado**: `tests/unit/composition/wiring.test.ts`,
  `profile.test.ts`, el fixture `ports-incomplete.ts` y la prueba del adaptador del interruptor, que
  se muda a `configuration`);
- una entrada del registro de administración con un campo distinto;
- una excepción nueva de lint, idioma, arquitectura, duplicación o código muerto.

## 5. La cadena completa

```bash
npm run format:check && npm run quality && npm run typecheck && npm test && npm run test:mutation
```

`quality` tiene que listar **siete** gates (los seis de hoy más `check:ports-bound`) y terminar en
verde. `test:mutation` corre sobre las líneas cambiadas contra `origin/main`; ante un sobreviviente,
`npm run test:mutation -- --files <archivo>` y el procedimiento de ADR-016 (describir el daño,
clasificar, recién después tocar).

## 6. La prueba del algodón: agregar un módulo

La medida de SC-001. Con la feature terminada, agregar un módulo tiene que tocar **tres** archivos:

1. `src/composition/modules/<módulo>.ts` — sus puertos, su tabla por tecnología, lo que expone y lo
   que sirve;
2. `src/composition/deployments/local.ts` — una línea;
3. `.dependency-cruiser.cjs` — una entrada en `CONTEXT_MAP`.

Y olvidarse de cualquiera de los tres tiene que fallar **antes de ejecutar**:

| Olvido                           | Quién lo atrapa                                   |
| -------------------------------- | ------------------------------------------------- |
| La línea del despliegue          | `typecheck` (`Missing<…>` o `Unwired<…>`)         |
| Un puerto sin enlace             | `typecheck` (`Unserved<…>`) o `check:ports-bound` |
| La entrada del mapa de contextos | `npm run arch`                                    |

### La prueba del algodón, corrida (2026-09-22)

Con un módulo de juguete y un puerto de aplicación de juguete, omitiendo cada paso por turno:

| Lo que se omitió                                    | Qué falló, y cómo                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| Enlazar un puerto en la tabla de su tecnología      | `typecheck`: `Unserved<"toy.thing">`                                |
| La línea del despliegue de un módulo que sirve algo | `typecheck`: `Unwired<"getHealth">`                                 |
| Enlazar en el grafo un puerto de `application/`     | `check:ports-bound`: lo nombra con su archivo y su línea            |
| La entrada del mapa de contextos                    | `npm test` (arquitectura): el módulo aparece sin entrada en el mapa |

El cuarto caso era un hueco y la prueba lo descubrió: un módulo sin entrada en el mapa no tenía
ninguna regla, y una regla que no existe no prohíbe nada. Lo cierra una prueba nueva en
`tests/architecture/architecture.test.ts`: el conjunto de los módulos de los anillos y de la
composición está contenido en las claves de `CONTEXT_MAP`.
