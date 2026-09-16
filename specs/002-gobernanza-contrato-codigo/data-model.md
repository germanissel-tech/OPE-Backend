# Data model — Feature 002

Sin persistencia. Entidades = artefactos verificables y capas de código.

## Invariante (`x-invariants[]`)

| Campo         | Regla                                                                               |
| ------------- | ----------------------------------------------------------------------------------- |
| `type`        | slug de `contracts/problem-types.yaml` (sin `urn:ope:problem:`); no `unprocessable` |
| `status`      | entero; igual al `status` del catálogo para ese slug                                |
| `rule`        | string no vacío, condición inequívoca                                               |
| `description` | string no vacío                                                                     |
| ubicación     | operación (`paths.*.<método>.x-invariants`) o raíz de un schema                     |
| prueba        | título de `it()` que contiene `[invariant:<slug>]`                                  |

## Decisión (`docs/adr/NNN-slug.md`)

Frontmatter: `numero` (= NNN), `titulo`, `estado` ∈ {propuesta, aceptada, reemplazada,
abierta}, `fecha` (ISO), `fuente` (spec/research/sesión/documento), opcional `reemplaza`.
Secciones: Contexto, Decisión, Consecuencias. Cita: `ADR-NNN`.

## Marcador

Token en mayúsculas ∈ {`ABIERTO`, `PROPUESTO`, `PLACEHOLDER`} fuera de backticks, en
`contracts/**/*.yaml`, `docs/**/*.md`, `README.md`, `CLAUDE.md`. Bloqueante: `ABIERTO`,
`PLACEHOLDER`. Atributos: archivo, línea, texto de la línea.

## Término del glosario (`docs/dominio/<es>.md`)

Frontmatter: `es`, `en`, `contexto`, `estado` ∈ {aprobado, propuesto}, `fuente`
(`constitucion#<sección>` | `mvp:<archivo>#<sección>` | ruta relativa), opcional `uso` ∈
{disponible, pendiente}. Cuerpo: cita textual. Reglas: `fuente` obligatoria y existente
(externa: verificada si el directorio está disponible); sin uso en el contrato ⇒ `uso`
obligatorio. Lista técnica: `docs/dominio/_tecnicos.json` (`{ "terms": [...] }`).

## Capa (`.dependency-cruiser.cjs`)

| Capa             | Ruta                  | Importa de                                                                               |
| ---------------- | --------------------- | ---------------------------------------------------------------------------------------- |
| dominio          | `src/domain/**`       | dominio                                                                                  |
| puertos          | `src/ports/**`        | dominio, puertos                                                                         |
| adaptadores      | `src/adapters/<x>/**` | puertos, dominio, mismo adaptador, generated, npm/core; tipos de `src/handlers/typed.ts` |
| manejadores      | `src/handlers/**`     | dominio, puertos, generated, manejadores                                                 |
| cliente          | `src/client/**`       | generated, npm                                                                           |
| composition root | `src/main.ts`         | todo; nadie lo importa                                                                   |

## Dominio mínimo de esta feature

- `src/domain/health.ts`: `serviceHealth(input: { now: Date; contractVersion: string }) =>
{ status: "ok" | "degraded"; contractVersion: string; timestamp: Date }`. Puro.
- `src/ports/clock.ts`: `interface Clock { now(): Date }`.
- `src/adapters/clock/system-clock.ts`: `systemClock: Clock`.
- `src/handlers/health.ts`: `makeGetHealth({ contractVersion, clock })` → DTO `Health`
  (`timestamp` a ISO 8601). Mismo comportamiento HTTP que la 001.
