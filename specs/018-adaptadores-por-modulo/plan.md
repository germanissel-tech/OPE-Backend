# Implementation Plan: Adaptadores por módulo

**Branch**: `018-adaptadores-por-modulo` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-adaptadores-por-modulo/spec.md`

## Summary

Refactor de forma, sin cambio de comportamiento: el anillo `interface-adapters/` se corta por
módulo con la entrada y la salida a la vista (`controllers/`, `presenters.ts`, `security/`,
`gateways/`, `index.ts`), el núcleo `http/` queda sin conocimiento de ningún módulo de feature,
la composición importa de cada módulo sólo su `index.ts`, y cuatro reglas de dependency-cruiser
con fixture fijan la forma. Lo derivado del contrato (tipos de la API y catálogo de problemas)
se genera en `generated/` fuera de `src/` y el catálogo deja de replicarse a mano; el cliente
para consumidores sale de `src/`; `Retry-After` pasa al nivel de plataforma; `composition/config.ts`
se parte; las pruebas espejan el árbol; ADR-013 lleva la enmienda con las variantes evaluadas.
Detalle en [research.md](./research.md) (R-01..R-10) y [data-model.md](./data-model.md).

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) para build y typecheck; ESM NodeNext;
Node ≥ 22.

**Primary Dependencies**: sin dependencias nuevas. dependency-cruiser 18 (subpath imports
`#…` reconocidos como `aliased-subpath-import`), openapi-typescript (tipos), `yaml` (ya usado por
los scripts de gobernanza) para el generador del catálogo.

**Storage**: N/A (los gateways en memoria se mueven, no cambian).

**Testing**: Vitest (proyectos `fast` y `tools`), Schemathesis, Stryker en CI. 52 archivos de
prueba cambian rutas de import; cero aserciones cambian.

**Target Platform**: servidor Node (sin cambio).

**Project Type**: refactor estructural de un servicio backend existente.

**Performance Goals**: sin cambio; `test:load` es medida de tendencia, no gate.

**Constraints**: comportamiento observable idéntico (contrato, respuestas, headers, logs);
cero excepciones nuevas de lint, idioma, arquitectura, duplicación, código muerto o mutación;
`generated/` versionado y verificado por drift; commits en español, uno por historia; sin push
hasta la PR; sin merge sin el dueño.

**Scale/Scope**: ~70 archivos del anillo movidos o partidos, 12 directorios de módulo, 4 reglas
nuevas con fixture, 2 artefactos generados, 1 script nuevo (~40 líneas), 4 archivos de
composición a partir de uno, ~52 pruebas con rutas nuevas, 6 herramientas actualizadas.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Evaluados los once principios de la constitución v1.4.2.

| Gate                                       | ¿Aplica? | Cómo se cumple                                                                                                                                                                                                                                                         |
| ------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Separación de autoridades               | **Sí**   | Ninguna autoridad cambia de lugar ni de orden; el corte por módulo hace explícita en el anillo la misma frontera de contextos que ya rige en dominio y aplicación (`context-map:<m>` ampliada).                                                                        |
| II. Fail-closed                            | **Sí**   | Sin cambio de comportamiento: toda respuesta de error, `NO_OP` y 503 se conserva; las pruebas de integración son el juez (FR-008).                                                                                                                                     |
| III. La medición precede y no se contamina | **Sí**   | No se toca dominio ni aplicación; `Experiment.assign`, ledgers y asignación se mueven de carpeta sin cambiar una línea (regresión con fingerprint de la 007 sigue verde).                                                                                              |
| IV. Dos caminos, dos garantías             | **Sí**   | Sin I/O nueva; `Retry-After` pasa de constante del adaptador a valor del nivel 1 aplicado por la infraestructura a toda 503 (R-06), sin tocar el camino crítico.                                                                                                       |
| V. Aislamiento por merchant                | **Sí**   | Nada cambia en credenciales, alcance ni stores; las pruebas de aislamiento existentes corren idénticas.                                                                                                                                                                |
| VI. Identidad explícita / contrato primero | **Sí**   | El contrato y el mapa no cambian (`git diff main -- contracts/` vacío); los tipos y el catálogo se **derivan** del contrato con más fuerza que hoy (una fuente, cero réplica manual, drift verificado).                                                                |
| VII. Comportamiento, no personas           | **Sí**   | Ningún esquema ni log cambia.                                                                                                                                                                                                                                          |
| VIII. Cero LLM                             | **Sí**   | Nada nuevo.                                                                                                                                                                                                                                                            |
| IX. Trazabilidad                           | **Sí**   | Sin cambio en lo que se registra; ADR-013 enmendado con las variantes evaluadas y su motivo (trazabilidad de la decisión de forma).                                                                                                                                    |
| X. Puertos en los dos bordes               | **Sí**   | Los puertos siguen en `application/<m>/ports/`; sus implementaciones ganan un lugar único por módulo (`gateways/`) y la regla de que un driver entra sólo por `infrastructure/` deja preparado el puerto de plataforma (019) y la persistencia.                        |
| XI. Ninguna política vive en el código     | **Sí**   | `Retry-After` (5 s) era una constante de comportamiento no inventariada: pasa a `config/platform.json` y `check:behaviour-constants` la vigila. No se agrega ninguna constante nueva.                                                                                  |
| Mapa del contrato / superficie HTTP        | **Sí**   | Sin cambio; `check:api-map` en verde.                                                                                                                                                                                                                                  |
| Sustantivo nuevo (glosario, ADR-008)       | No       | Ningún sustantivo nuevo en el contrato.                                                                                                                                                                                                                                |
| `x-invariants` (ADR-007)                   | No       | Ninguna regla nueva sobre un request.                                                                                                                                                                                                                                  |
| Decisión transversal (ADR-009)             | **Sí**   | Enmienda fechada de ADR-013: forma del anillo por módulo, núcleo `http/`, `generated/` fuera de `src/`, reglas nuevas, variantes Onion/radical/fusión descartadas con su motivo.                                                                                       |
| Toca `src/` → dependencias (ADR-013)       | **Sí**   | Es la feature: `MOD` ampliado al anillo, cuatro reglas nuevas con fixture, las existentes reubicadas con su fixture; ningún import nuevo entre módulos (R-02: el reparto de la raíz de `http/` elimina las 23 aristas cruzadas de hoy sin adaptadores de composición). |
| ADR-023 / ADR-024                          | **Sí**   | Casos de uso, servicios, errores y entidades no se tocan; los gateways siguen recibiendo entidades.                                                                                                                                                                    |
| ADR-016 (gates)                            | **Sí**   | Sin excepciones nuevas; `generated/` excluido de lint, formato, knip y mutación como hoy el `.d.ts`; el gate de mutación completo en CI al cierre (archivos movidos, cero sobrevivientes esperados).                                                                   |
| ADR-015 (idioma)                           | **Sí**   | Rutas, reglas y scripts en inglés; ADR, spec y quickstart en castellano; `check:identifiers` vigila las citas.                                                                                                                                                         |
| ADR-011 / ADR-017 (tipado, compilador)     | **Sí**   | Subpath imports de Node resueltos por TS NodeNext, Vitest y dependency-cruiser (R-04); `rootDir: "src"` se conserva porque `.d.ts` está exento y el catálogo se emite como `.js` + `.d.ts`.                                                                            |

**Resultado pre-Phase 0**: PASA.
**Post-Phase 1**: PASA. El diseño no agrega violaciones ni excepciones; la única regla que se
relaja es de ruta (`composition-wires-by-module` exime `*-config.ts` además de `config.ts`), y
lo hace para partir un archivo, no para importar algo nuevo.

## Project Structure

### Documentation (this feature)

```text
specs/018-adaptadores-por-modulo/
├── plan.md              # este archivo
├── research.md          # R-01..R-10: lectura del anillo, reparto de la raíz, reglas, generado, cliente, Retry-After, config, herramientas, orden
├── data-model.md        # forma del árbol, generated/, composición, tabla de reglas
├── quickstart.md        # verificación por historia y cierre
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

Sin `contracts/`: la superficie HTTP no cambia (FR-008); el contrato y el mapa quedan
idénticos y `contract:check` lo verifica.

### Source Code (repository root)

```text
generated/                       api.d.ts, problem-types.js, problem-types.d.ts   (contract:types; versionado; linguist-generated)
client/                          index.ts (export ./client del paquete; tsconfig.client.json)
config/platform.json             + retryAfterSeconds
src/
├── main.ts
├── composition/
│   ├── config.ts  merchants-config.ts  experiments-config.ts  levels-config.ts  operators-config.ts
│   ├── modules/<m>.ts           importa interface-adapters/<m>/index.js (+ shared-kernel)
│   └── adapters/                reservado (vacío al cierre)
├── domain/<m>/                  sin cambio
├── application/<m>/             sin cambio
├── interface-adapters/
│   ├── http/                    núcleo genérico (typed, to-problem, problem-details, status, boundary, security/)
│   ├── shared-kernel/           paging, random-id, system-clock, windowed-map, index.ts
│   └── <m>/                     controllers/  presenters.ts  security/  gateways/  index.ts
└── infrastructure/
    ├── http/                    Fastify: build-server (+ retryAfterSeconds), dispatch, cors, raw-bodies, …
    └── logging/                 pino
scripts/
├── contract-types.mjs           escribe los dos artefactos
├── contract-types-check.mjs     verifica los dos
├── contract-problem-types.mjs   nuevo: catálogo → generated/problem-types.{js,d.ts}
└── shape-rules.mjs              rutas nuevas (controllers por módulo, MAY_INSTANTIATE)
tests/
├── unit/interface-adapters/<m>/ (desde unit/gateways/<m> y unit/http)
├── architecture/fixtures/src/   forma nueva + fixtures de las reglas nuevas
└── audit/fixtures/*/src/        forma nueva
.dependency-cruiser.cjs          MOD ampliado, 4 reglas nuevas, rutas de las existentes
package.json                     imports {"#generated/*", "#client"}, export ./client → dist/client, build de dos proyectos
knip.json  eslint.config.mjs  stryker.config.json  .prettierignore  .gitattributes   generated/ y client/
docs/adr/013-*.md                enmienda 2026-09-21
CLAUDE.md                        tabla de anillos, paso 4 de "feature que toca HTTP", notas que citan rutas
.claude/skills/auditing-architecture/   run-gates.mjs, referencias, evals
```

**Structure Decision**: corte vertical por módulo dentro del anillo, con la lectura estricta de
Clean Architecture (R-01); núcleo `http/` con lista blanca de lo que puede conocer (R-02);
artefactos derivados en `generated/` por subpath imports de Node (R-04); orden de trabajo por
módulo con verificación tras cada movimiento (R-10).

## Complexity Tracking

Sin violaciones que justificar.
