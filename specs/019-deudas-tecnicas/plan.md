# Implementation Plan: Deudas técnicas del tooling y las skills (registro abierto)

**Branch**: `019-deudas-tecnicas` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-deudas-tecnicas/spec.md`

## Summary

Cinco historias independientes, una fase cada una, en el orden D-06 → D-04 → D-05 → D-01 → D-02
(R-09). D-06 fija una convención con prueba: todo directorio de primer nivel que no es código
tiene un README con inventario que una prueba mantiene igual al directorio, más verificaciones
de cabecera en `generated/`, `patches/` y `scripts/`. D-04 le da a `config/` esquemas: los dos
niveles del release generados desde el contrato en `generated/schemas/`, la semilla y los
operadores escritos una vez y probados contra sus lectores, descripciones obligatorias en el
contrato. D-05 le da a `contracts/` su README con la tabla de extensiones `x-*` verificada,
"cómo agregar", y resuelve `webhooks/` y las cabeceras desactualizadas. D-01 saca la skill de
auditoría del repo a un plugin de Claude Code (`plugins/auditable-architecture/`) que sólo lee
un perfil (`audit.profile.json` v1) y adaptadores de gate con protocolo fijo; el repo conserva
perfil, criterios, evals propias y adaptadores; las nueve evaluaciones dan lo mismo. D-02 agrega
al plugin la skill de acondicionamiento (inspección, preguntas mínimas, escritura idempotente,
doctor). ADR-032 registra "método portable y perfil por proyecto" y la convención de README. El
plan se regenera por historia cuando el registro suma una deuda: cada fase es autocontenida.
Detalle en [research.md](./research.md) (R-01..R-10), [data-model.md](./data-model.md) y
[contracts/](./contracts/).

## Technical Context

**Language/Version**: TypeScript 7 para pruebas y composición; scripts del plugin y del repo en
JavaScript ESM con `checkJs` y JSDoc (ADR-012); Node ≥ 22. SKILL.md en castellano, scripts en
inglés (ADR-015).

**Primary Dependencies**: sin dependencias nuevas. Ajv 8 (ya presente, `ajv/dist/2020`) para
validar `config/` contra esquemas; `yaml` para la generación de esquemas desde el bundle;
Spectral para la regla de descripciones; Vitest proyecto `tools` para inventario, cabeceras,
evals y acondicionamiento. Claude Code CLI para `claude plugin validate` (verificación manual del
quickstart, no de la suite).

**Storage**: N/A.

**Testing**: Vitest `fast` (esquemas de `config/` contra lectores, drift de generado) y `tools`
(`tests/docs/readmes.test.ts`, `tests/audit/audit.test.ts` reescrita sobre el plugin,
`tests/audit/conditioning.test.ts`, reglas del contrato con su fixture). La mitad cognitiva de
la auditoría se corre una vez y se registra fechada.

**Target Platform**: repositorio (tooling, documentación, skills); el servidor sólo cambia en
composición (quitar `$schema` antes de los lectores).

**Project Type**: deuda técnica de tooling y documentación en un backend existente.

**Performance Goals**: N/A. La prueba de inventario y las de cabecera son de lectura de disco;
las de evals ejecutan gates sobre fixtures como hoy.

**Constraints**: cero cambios de comportamiento del servidor (los valores de `config/` y los
mensajes de `ConfigError` no cambian); el contrato bundleado, el mapa y lo generado hoy sin
cambio salvo descripciones y comentarios (D-04 agrega descripciones donde falten: aditivo); las
nueve `expected.json` sin diff; el plugin sin ningún import del repo; las pruebas del repo sin
acceso externo (el plugin vive en el repo); commits en español, uno por historia; sin push ni
merge sin el dueño.

**Scale/Scope**: 11 README nuevos (uno por directorio de la tabla de R-06, incluido `plugins/`);
1 suite de documentación (~200 líneas); 1 generador de esquemas (~60 líneas) + 2 esquemas
escritos a mano; 1 regla Spectral con fixture; 1 plugin con 2 skills (~8 scripts, 3 referencias,
2 plantillas, 2 evals universales); 7 adaptadores de gate en `scripts/audit/` (~30 líneas cada
uno, reutilizando lo que `run-gates.mjs` ya hace); 9 evals movidas; 1 ADR; CLAUDE.md y README
acortados y enlazados.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Evaluados los once principios de la constitución v1.4.2.

| Gate                                       | ¿Aplica? | Cómo se cumple                                                                                                                                                                                                                                                        |
| ------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Separación de autoridades               | No       | No se toca ninguna autoridad; la única línea de `src/` que cambia es de composición (quitar `$schema`).                                                                                                                                                               |
| II. Fail-closed                            | No       | Sin cambio de respuestas ni de `NO_OP`. Los esquemas de `config/` no relajan nada: los lectores siguen siendo el juez y la prueba de coincidencia exige que esquema y lector rechacen lo mismo.                                                                       |
| III. La medición precede y no se contamina | No       | Dominio y aplicación intactos.                                                                                                                                                                                                                                        |
| IV. Dos caminos, dos garantías             | No       | Sin I/O nueva en runtime.                                                                                                                                                                                                                                             |
| V. Aislamiento por merchant                | No       | Sin cambio en credenciales ni stores. La semilla de desarrollo gana esquema, no campos.                                                                                                                                                                               |
| VI. Identidad explícita / contrato primero | **Sí**   | Los esquemas de los niveles se **derivan** del contrato (una fuente, drift verificado), como los tipos y el catálogo; la regla de descripciones eleva el contrato como documentación única de esos campos. Ningún esquema de la API cambia de forma.                  |
| VII. Comportamiento, no personas           | No       | Ningún esquema de datos ni log cambia.                                                                                                                                                                                                                                |
| VIII. Cero LLM                             | **Sí**   | Las skills son procedimientos para el agente en tiempo de desarrollo; nada de runtime. Sin cambio.                                                                                                                                                                    |
| IX. Trazabilidad                           | **Sí**   | Del lado del método: cada hallazgo sigue exigiendo `file:line`, fuente resuelta y verificación; el perfil declara las fuentes y su severidad en vez de tenerlas escritas. ADR-032 registra la decisión y las alternativas.                                            |
| X. Puertos en los dos bordes               | No       | Sin cambio.                                                                                                                                                                                                                                                           |
| XI. Ninguna política vive en el código     | **Sí**   | Los valores de `config/` no cambian; ganan esquema y documentación. `check:behaviour-constants` sigue vigilando. Por analogía, lo que la skill tenía escrito del proyecto (gates, anillos, fuentes) pasa a un perfil declarativo: la misma regla aplicada al tooling. |
| Mapa del contrato / superficie HTTP        | **Sí**   | Sin cambio de operaciones; `check:api-map` en verde. `webhooks/` no está en el mapa (R-07).                                                                                                                                                                           |
| Sustantivo nuevo (glosario, ADR-008)       | No       | Ningún sustantivo nuevo en el contrato (sólo descripciones).                                                                                                                                                                                                          |
| `x-invariants` (ADR-007)                   | No       | Ninguna regla nueva sobre requests.                                                                                                                                                                                                                                   |
| Decisión transversal (ADR-009)             | **Sí**   | ADR-032 "Método portable y perfil por proyecto; README con inventario por directorio" (R-02, R-03, R-06).                                                                                                                                                             |
| Toca `src/` → dependencias (ADR-013)       | **Sí**   | Sólo `composition/*-config.ts` (quitar `$schema`); `arch` sin cambio de reglas.                                                                                                                                                                                       |
| ADR-023 / ADR-024                          | No       | Sin casos de uso ni entidades nuevas.                                                                                                                                                                                                                                 |
| ADR-016 (gates)                            | **Sí**   | Cero excepciones nuevas; los adaptadores de gate en `scripts/audit/` corren con `checkJs`; `generated/schemas/` excluido como el resto de lo generado; mutación sobre las pocas líneas de composición cambiadas.                                                      |
| ADR-015 (idioma)                           | **Sí**   | README y SKILL.md en castellano; scripts, esquemas, perfil, plugin.json y mensajes en inglés; `check:language` lo verifica (los README de directorios entran como documentación).                                                                                     |
| ADR-011 / ADR-012 / ADR-017                | **Sí**   | Scripts nuevos con JSDoc y `tsconfig.scripts.json`; el plugin tiene su propio `jsconfig`/verificación dentro del proyecto `tools` (los scripts del plugin se verifican con `checkJs` desde el repo sin que el plugin importe nada del repo).                          |
| ADR-018 (sin mock)                         | **Sí**   | `npm run dev` sigue arrancando con la misma semilla; el `$schema` no llega al lector.                                                                                                                                                                                 |

**Resultado pre-Phase 0**: PASA.
**Post-Phase 1**: PASA. El diseño no agrega excepciones. La única relajación es en composición:
los lectores de `config/` toleran la clave `$schema` quitándola antes de la forma cerrada; nada
más se abre.

## Project Structure

### Documentation (this feature)

```text
specs/019-deudas-tecnicas/
├── plan.md                      # este archivo (una fase por historia; se regenera por historia)
├── research.md                  # R-01..R-10
├── data-model.md                # formas de perfil, gate, eval, plugin, esquemas, inventario
├── quickstart.md                # verificación por historia y cierre
├── contracts/
│   ├── audit-profile.md         # perfil v1, protocolo findings-v1, evals, doctor
│   ├── readme-inventory.md      # contrato del README con inventario y cabeceras
│   └── config-schemas.md        # esquemas de config/ y prueba contra lectores
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks (fases = historias; regenerable por historia)
```

### Source Code (repository root)

```text
.claude-plugin/marketplace.json                marketplace local: plugins/auditable-architecture
.claude/settings.json                          habilita el plugin en este repo
.claude/skills/                                sólo spec-kit (auditing-architecture reemplazada)
audit.profile.json                             perfil v1 de este repo (R-01)
plugins/                                       ← nuevo directorio de primer nivel (README D-06)
└── auditable-architecture/
    ├── .claude-plugin/plugin.json
    ├── README.md
    └── skills/
        ├── auditing-architecture/             SKILL.md · references/{formato-hallazgo,refutacion}.md
        │   ├── scripts/                       run-gates.mjs · verify-finding.mjs · profile.mjs (carga y valida) · audit-profile.schema.json · audit-finding.schema.json
        │   └── evals/                         identical-functions/ · empty-catch/ (fixture, expected, requires, README)
        └── conditioning-project/              SKILL.md · templates/{criterios-diseno.template.md, audit.profile.template.json}
            └── scripts/                       inspect.mjs · write-profile.mjs · doctor.mjs
scripts/
├── README.md                                  (D-06)
├── audit/                                     gate-lint · gate-arch · gate-shape · gate-duplication · gate-dead-code · gate-language · gate-mutation (protocolo findings-v1)
├── contract-schemas-lib.mjs                   (D-04) esquemas JSON de los niveles desde el bundle
└── contract-types.mjs / contract-types-check.mjs   + generated/schemas/
generated/
├── README.md                                  (D-06)
└── schemas/                                   platform-configuration.schema.json · treatment-defaults.schema.json
config/
├── README.md                                  (D-06 + columnas D-04)
├── schemas/                                   merchants-seed.schema.json · operators.schema.json
└── *.json                                     + "$schema"
contracts/
├── README.md                                  (D-05: inventario, convenciones, ## Extensiones, cómo agregar)
├── .spectral.yaml + rules/functions/configurationFieldsDescribed.js   (D-04)
├── problem-types.yaml                         cabecera corregida (D-05)
└── webhooks/                                  borrado (R-07) salvo decisión del dueño
docs/
├── README.md                                  (D-06)
├── adr/032-metodo-portable-y-perfil-por-proyecto.md
└── auditoria/criterios-diseno.md              (desde la skill)
patches/README.md · client/README.md · reports/README.md · specs/README.md · tests/README.md   (D-06)
src/composition/{levels-config,merchants-config,operators-config}.ts    quitan "$schema" antes del lector
tests/
├── docs/readmes.test.ts                       inventario + cabeceras (tools)
├── audit/audit.test.ts                        sobre el plugin y el perfil; evals propias en tests/audit/evals/<n>/ + fixtures como hoy
├── audit/conditioning.test.ts                 + fixtures/empty-repo/
├── unit/composition/config-schemas.test.ts    + fixtures/config-schemas/{valid,invalid}/
└── contract-rules/fixtures/ope-configuration-fields-described.yaml
CLAUDE.md, README.md                           acortados y enlazados a los README de directorio
```

**Structure Decision**: el plugin vive en el repo (`plugins/`) para que las pruebas lo ejecuten
por ruta sin acceso externo (R-02); todo lo que es de este proyecto queda fuera del plugin
(`audit.profile.json`, `scripts/audit/`, `docs/auditoria/`, `tests/audit/evals/`). `generated/`
gana `schemas/` por el mismo generador y la misma verificación de drift (R-05). Los README son
uno por directorio de la tabla de R-06 y la prueba es una sola.

## Fases (una por historia; regenerables por separado)

| Fase | Historia | Produce                                                                                                                                                                     | Cierra con                                                                            |
| ---- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1    | D-06     | `tests/docs/readmes.test.ts`, 11 README, cabeceras corregidas, CLAUDE.md/README enlazados                                                                                   | gates comunes; `test:tools` con la suite nueva                                        |
| 2    | D-04     | `contract-schemas-lib.mjs`, `generated/schemas/`, `config/schemas/`, `$schema` en `config/`, regla Spectral, prueba contra lectores, columnas propias en `config/README.md` | gates comunes; `contract:check`; `npm test`                                           |
| 3    | D-05     | `contracts/README.md` completo (extensiones, cómo agregar), `webhooks/`, cabeceras de catálogos y severidades                                                               | gates comunes; `contract:check` sin cambio de bundle                                  |
| 4    | D-01     | plugin con `auditing-architecture`, perfil, adaptadores, evals movidas, criterios en `docs/auditoria/`, ADR-032, `.claude/skills/auditing-architecture/` borrada            | gates comunes; `test:tools` (nueve evals + universales); corrida cognitiva registrada |
| 5    | D-02     | `conditioning-project` con sus scripts y plantillas, fixture `empty-repo`, prueba                                                                                           | gates comunes; `test:tools`                                                           |

Una deuda nueva = una fase nueva al final de esta tabla y de `tasks.md`; las fases cerradas no
se reescriben.

## Complexity Tracking

Sin violaciones que justificar.
