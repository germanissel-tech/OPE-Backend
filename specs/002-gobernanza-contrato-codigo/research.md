# Research — Feature 002: gobernanza del contrato y del código

**Fecha**: 2026-09-16 · **Estado**: completo. Las decisiones transversales que salen de acá
se registran como ADR en `docs/adr/` durante la implementación (FR-020); este archivo las cita.

## R-01 Dónde vive cada verificación

- **Decisión (DECIDIDO)**: tres mecanismos, elegidos por lo que cada uno puede ver:

  | Ve | Mecanismo | Reglas de esta feature |
  |---|---|---|
  | El contrato **resuelto** (un solo árbol) | Spectral, función custom, fixture por regla (como en la 001) | `ope-invariants`, `ope-no-generic-422`, `ope-required-capabilities` |
  | El contrato **sin resolver**, archivo por archivo, con `$ref` visibles | Redocly *assertions* (`redocly.yaml`) | `rule/media-type-schema-ref` |
  | Contrato **más** otros artefactos (docs, tests, ADRs) | Script Node `.mjs` en `scripts/check-*.mjs`, con fixtures en `tests/governance/` | ADRs, marcadores, glosario, invariante → prueba, arquitectura |

- **Por qué Redocly para "schema por `$ref`"**: Spectral con `resolved: false` sólo ve el archivo
  raíz, y en nuestro contrato los path items son `$ref` a `paths/*.yaml`, así que no llegaría a
  los media types. Redocly lintea los archivos fuente y reporta archivo:línea del hijo.
  **Verificado** (Redocly 2.53.2): la assertion `subject: {type: MediaType, property: schema}`
  + `assertions: {ref: true}` pasa sobre `contracts/` y falla en
  `tests/contract-rules/fixtures/valid.yaml:46` (schema inline de `createThing`), con salida
  `--format json` que incluye `ruleId`, `pointer` y `start.line`. Consecuencia: los fixtures de
  la 001 que tienen schemas inline se corrigen para seguir siendo válidos.
- **Alternativa rechazada**: segundo ruleset de Spectral aplicado a `paths/*.yaml` sueltos;
  funciona pero duplica configuración y no aporta nada sobre la assertion de Redocly.

## R-02 `x-invariants`: forma y verificación

- **Decisión (DECIDIDO → ADR-007)**: extensión `x-invariants` (array) admitida en
  operaciones y en esquemas (objeto raíz del schema). Cada entrada: `type` (slug del catálogo,
  sin el namespace), `status`, `rule`, `description`. Adaptación del formato de las-animas
  (`code` de un enum) a Problem Details: el slug **es** el tipo de error que la operación emite.
- Regla Spectral `ope-invariants` (resuelta, `given: $`): recorre el documento juntando
  `x-invariants`; falla por campo faltante, por `type` fuera de `contracts/problem-types.yaml`
  (cargado con el mismo mecanismo que la lista PII: `functionOptions.catalog` relativo al
  ruleset) y por `status` distinto al del catálogo. Con cero invariantes pasa (FR-005).
- **Invariante → prueba** (FR-003): script `scripts/check-invariant-tests.mjs`. Lee el bundle,
  junta los `type` declarados y busca en `tests/**/*.test.ts` un título de prueba que contenga
  el marcador `[invariant:<slug>]`. Convención elegida por ser buscable con `grep` y por no
  requerir registro aparte: `it("[invariant:order-duplicated] rechaza un orderId ya procesado", …)`.
  Acepta `--bundle` y `--tests-dir` para probarse contra fixtures.
- **Sin genéricos** (FR-004): regla Spectral `ope-no-generic-422`: para cada operación con
  respuesta `422` resuelta, todo `example`/`examples[*].value.type` del media type
  `application/problem+json` debe (a) no ser `urn:ope:problem:unprocessable` y (b) coincidir con
  el `type` de una invariante declarada sobre la operación o sobre el schema de su request
  body. Así el `422` documenta exactamente qué regla lo produce. El componente
  `contracts/components/responses/UnprocessableEntity.yaml` (ejemplo genérico, sin uso) se
  elimina; `unprocessable` sigue en el catálogo como respuesta de último recurso del servidor.

## R-03 Glosario y verificación de lenguaje

- **Decisión (DECIDIDO → ADR-008)**: `docs/dominio/<termino-es>.md` con frontmatter
  `es`, `en`, `contexto`, `estado` (`aprobado` | `propuesto`), `fuente`, `uso` (opcional:
  `disponible` | `pendiente`) y una cita textual de la fuente en el cuerpo. Lista técnica en
  `docs/dominio/_tecnicos.json` (única fuente, ampliable): `health`, `problem`, `details`,
  `error`, `errors`, `v1`, `request`, `response`, `list`, `create`, `update`, `pointer`,
  `message`, `status`, `type`, `title`, `detail`, `instance`.
- Script `scripts/check-glossary.mjs` (bundle + `docs/dominio/`): (1) sustantivos del
  contrato = segmentos de ruta (sin `v1` ni `{param}`) partidos por `-`, y nombres de
  `components.schemas` partidos por camelCase y sin sufijos `Request|Response|List|Create|Update`;
  cada palabra resuelve al `en` de una nota (sin mayúsculas, sin plural `s`/`es`) o a la lista
  técnica, o bien el compuesto entero resuelve; (2) toda nota tiene `fuente`; (3) la fuente
  existe; (4) toda nota sin uso en el contrato declara `uso`.
- **La fuente puede estar fuera del repo.** Los documentos del MVP viven en `../` (no se
  copian: son fuente, no artefacto). Formato de `fuente`: `constitucion#VI` (repo),
  `mvp:01-arquitectura-mvp.md#7` (externo) o ruta relativa al repo. Los externos se verifican
  cuando el directorio está disponible (`OPE_MVP_DOCS`, default `..`); si no está — en CI —
  el script lo dice con un aviso explícito y **no** falla por ese motivo. La cita textual en
  el cuerpo de la nota es obligatoria siempre y es lo que hace la nota verificable a ojo.
- **Semilla del glosario**: las identidades que la constitución VI ya fija en inglés
  (`merchant`, `event`, `session`, `visitor`, `order`, `decision`) con `fuente:
  constitucion#VI`, `estado: aprobado` y `uso: pendiente` (ningún contrato las usa todavía).
  No se traduce nada nuevo: traducir es una decisión (regla tomada de las-animas).

## R-04 ADRs y marcadores

- **Decisión (DECIDIDO → ADR-009)**: `docs/adr/NNN-slug.md` con frontmatter `numero`,
  `titulo`, `estado` (`propuesta` | `aceptada` | `reemplazada` | `abierta`), `fecha`, `fuente`,
  y secciones Contexto / Decisión / Consecuencias. Citas con la forma `ADR-NNN`.
  `scripts/check-adrs.mjs`: valida frontmatter de cada ADR y busca `ADR-\d{3}` en `docs/`,
  `specs/`, `contracts/`, `README.md`, `CLAUDE.md`, `.specify/memory/constitution.md`; falla
  si el número no existe.
- ADRs a crear (migrando `specs/001/research.md`, que pasa a citarlos):
  `001-mapa-de-codigos-400-422` (R-06), `002-tipos-de-problema-urn` (R-11),
  `003-versionado-del-contrato` (R-12), `004-herramientas-del-contrato` (R-02/R-03/R-04:
  Spectral con `oas3-schema` apagada, Redocly, oasdiff con severidades),
  `005-mock-desde-el-servidor` (R-07), `006-capas-y-direccion-de-dependencias` (nuevo, R-06 de
  esta feature), `007-invariantes-declaradas`, `008-glosario-con-fuente`,
  `009-marcadores-y-puerta-de-release`, `010-decisiones-abiertas-del-mvp` (D3–D6,
  `estado: abierta`; se cierran en los documentos del MVP, no acá).
- **Marcadores**: `ABIERTO`, `PROPUESTO`, `PLACEHOLDER` como tokens en mayúsculas.
  `scripts/check-markers.mjs [--strict]` recorre `contracts/**/*.yaml`, `docs/**/*.md`,
  `README.md`, `CLAUDE.md`; lista archivo:línea:texto; con `--strict` sale 1 si hay `ABIERTO`
  o `PLACEHOLDER`. No cuenta tokens dentro de backticks (para poder nombrarlos en la guía) ni
  el campo `estado:` del frontmatter. `specs/` y `.specify/` quedan fuera: son históricos y la
  constitución los usa como vocabulario. `DECIDIDO` no es marcador.
- `npm run release-check` = `contract:check` + `check-markers --strict`.

## R-05 Capacidad por operación

- **Decisión (DECIDIDO)**: extensión `x-required-capabilities` (array de strings no vacío,
  forma `<recurso>:<accion>`, p. ej. `events:write`) obligatoria cuando la operación tiene
  `security` no vacío (propio o heredado del root) y prohibida cuando es pública (`security:
  []`). Regla Spectral `ope-required-capabilities`, resuelta, misma función auxiliar de
  `ope-required-error-responses` para decidir si está autenticada. Sin operación real que la
  ejercite hasta la 003; fixtures la prueban en ambos sentidos.

## R-06 Capas y prueba de arquitectura → dependency-cruiser

- **Decisión (DECIDIDO → ADR-006)**: `dependency-cruiser@18.3.1`, configuración
  `.dependency-cruiser.cjs`, ejecutado por `npm run arch` (en `contract:check`? no: en `test`
  vía `tests/architecture/architecture.test.ts` y como paso explícito en CI).
- **Verificado** (18.3.1 sobre `src/` actual): resuelve imports `./x.js` → `x.ts` con
  `tsConfig` sin opciones extra; clasifica `local`, `npm`, `core` y marca `type-only`
  (`tsPreCompilationDeps: "specify"`); una regla `from: src/handlers → to: src/server` reporta
  la violación con archivo, import y nombre de regla. **Limitación observada**: un import
  mixto (`import Fastify, { type X } from "fastify"`) quedó marcado `type-only` aunque
  `Fastify` se usa como valor. Consecuencia de diseño: **no se confía en `type-only` para
  permitir dependencias en el dominio**; dominio y puertos no importan nada de `npm` ni de
  `core`, tipos incluidos. Si un tipo hace falta, se define en el dominio.
- Capas y reglas (rutas con `(^|/)src/…` para que los fixtures bajo `tests/architecture/fixtures/src/`
  matcheen las mismas reglas):

  | Capa | Puede importar | No puede |
  |---|---|---|
  | `src/domain/**` | `src/domain` | todo lo demás, `npm`, `core` |
  | `src/ports/**` | `src/domain`, `src/ports` | adapters, handlers, generated, `npm`, `core` |
  | `src/adapters/<x>/**` | `src/ports`, `src/domain`, `src/adapters/<x>`, `src/generated`, `npm`, `core` | otros `src/adapters/<y>`, `src/handlers`, `src/main` |
  | `src/handlers/**` | `src/domain`, `src/ports`, `src/generated`, `src/handlers` | `src/adapters`, `src/main`, `npm` en runtime |
  | `src/client/**` | `src/generated`, `npm` | el resto |
  | `src/generated/**` | nada | — |
  | `src/main.ts` | todo | nadie lo importa (`to: main` prohibido) |

  Más: `no-circular` y `no-orphans` (salvo `generated`).
- **Reubicación del código de la 001** (sin cambio de comportamiento):

  | Antes | Después | Capa |
  |---|---|---|
  | `src/server/build-server.ts` | `src/adapters/http/build-server.ts` | adaptador HTTP (Fastify + openapi-backend) |
  | `src/server/problem-details.ts` | `src/adapters/http/problem-details.ts` | adaptador HTTP (DTO de error) |
  | `src/server/handlers.ts` (tipos) | `src/handlers/typed.ts` | manejadores (tipos DTO desde generated) |
  | `src/handlers/health.ts` | `src/handlers/health.ts` (traduce) + `src/domain/health.ts` (valor puro `serviceHealth`) + `src/ports/clock.ts` (`Clock`) + `src/adapters/clock/system-clock.ts` | las cuatro capas, con el caso más chico posible |
  | `src/main.ts` | igual; cablea `systemClock` | composition root |

  `build-server` importa `Handlers` (tipos) de `src/handlers/typed.ts`: adaptador → handlers
  es import de **tipos**; la regla lo permite explícitamente sólo para `typed.ts`
  (`to: src/handlers/typed.ts, dependencyTypes: type-only`). Es la única excepción y queda
  nombrada en la configuración.

## R-07 Disciplina documental

- `CLAUDE.md`: prohibir cifras de estado en prosa viva (cantidad de reglas, pruebas,
  operaciones) y remitir a `npm run contract:check` / `npm test` / `npm run check:markers`. La
  tabla de estado de `quickstart.md` de cada feature es histórica (fechada) y puede llevar
  números. Los marcadores se nombran entre backticks en la guía para no contarlos.

## R-08 Tiempo de `contract:check`

- Los scripts nuevos leen el bundle ya generado y unos pocos archivos; estimación < 1 s cada
  uno. Redocly y Spectral no cambian de costo con reglas adicionales de forma medible. Se
  vuelve a medir al cierre (SC-002 < 30 s; la 001 cerró en 9 s).
