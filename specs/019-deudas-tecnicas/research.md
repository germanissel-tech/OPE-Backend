# Research — Deudas técnicas del tooling y las skills (019)

Decisiones del plan, una por incógnita. Cada una cita la evidencia medida en el repositorio el
2026-09-21 (rama `019-deudas-tecnicas` sobre `main` en `619414d`). El registro abierto de la spec
puede sumar deudas; cada deuda nueva agrega sus `R-NN-x` al final sin renumerar.

## R-01 — Perfil de auditoría: nombre, lugar y esquema (D-01)

**Decisión**: `audit.profile.json` en la raíz del repositorio, con `profileVersion: 1` (entero;
la skill acepta exactamente las versiones que conoce). Su esquema JSON viaja con la skill
(`scripts/audit-profile.schema.json`) y el archivo lo referencia con `$schema`. Forma
(detalle y ejemplo completo en [contracts/audit-profile.md](./contracts/audit-profile.md)):

- `sourceRoot`: raíz del código auditable (`src`).
- `scopes`: cómo se resuelve cada alcance. `module.roots` es una lista de plantillas con
  `{name}` (`src/domain/{name}`, `src/application/{name}`, `src/interface-adapters/{name}`);
  `diff.base` la referencia contra la que se compara (`origin/main`) y `diff.include` los globs
  que cuentan (`src/**`). `dir` no necesita configuración.
- `gates[]`: `id`, `mode` (`blocking | informative`), `scopes?` (por defecto todos; `mutation`
  sólo `diff`), `run` (comando) y `format: "findings-v1"`. **Protocolo del adaptador**: recibe
  `--files-from <archivo>` (una ruta por línea; evita el límite de longitud de línea de Windows)
  y escribe en stdout `{ "findings": [{ "file", "line", "rule", "message" }] }`; con
  `--list-rules` escribe `{ "rules": ["..."] }` (para resolver fuentes `lint:`/`arch:`/`shape:`);
  salida 0 = corrió (los hallazgos deciden `pass | fail`), distinta de 0 = **degradado** (motivo
  = stderr). Un hallazgo sin `file` o sin `line` se descarta y cuenta para "degradado" si el gate
  no entregó ninguno válido.
- `sources[]`: `kind` (prefijo literal: `ADR-`, `constitution#`, `guide#`, `lint:`, `arch:`,
  `shape:`, `clarity:`), `severity` (`high | medium | low`) y `resolve` de tipo cerrado que la
  skill implementa: `file-glob` (`docs/adr/{id}-*.md`), `markdown-heading` (archivo + el resto
  del identificador es un encabezado), `gate-rule` (pregunta `--list-rules` al gate nombrado),
  `criteria-section` (encabezado del documento de criterios).
- `criteria`: ruta del documento de criterios (`docs/auditoria/criterios-diseno.md`).
- `evals`: ruta de las evaluaciones propias (`tests/audit/evals`).

**Rationale**: todo lo que hoy `run-gates.mjs` y `verify-finding.mjs` tienen escrito
(medido: imports de `scripts/lib.mjs`, `governance-lib.mjs`, `shape-rules.mjs`,
`eslint.config.mjs`; nombres de anillos y de gates; ocho clases de fuente con su resolución) cabe
en esas seis claves. Los resolutores son un vocabulario cerrado porque un resolutor arbitrario
sería código del proyecto dentro de la skill por otra vía. El protocolo del adaptador es la
frontera: lo que emite hallazgos como datos es del proyecto; lo que los junta, refuta y verifica
es del método.

**Alternativas**: perfil en YAML (menos tooling: JSON tiene esquema y el editor lo valida);
perfil en `package.json` (ata la skill a Node); un resolutor `command` libre (reintroduce código
del proyecto en la skill). Descartadas.

## R-02 — Forma del plugin y cómo lo consume este repo (D-01, D-02)

**Decisión**: las dos skills viajan en **un plugin de Claude Code** cuyo fuente vive en este
repositorio, en `plugins/auditable-architecture/`:

```text
plugins/auditable-architecture/
├── .claude-plugin/plugin.json        name, version (semver), description
├── README.md                         inventario (D-06) y cómo instalarlo en otro proyecto
├── skills/auditing-architecture/     SKILL.md, references/, scripts/, evals/ (universales)
└── skills/conditioning-project/      SKILL.md, templates/, scripts/
```

y un marketplace mínimo en la raíz (`.claude-plugin/marketplace.json`, `source:
./plugins/auditable-architecture`). Este repo lo habilita en `.claude/settings.json`
(`extraKnownMarketplaces` + `enabledPlugins`); otro proyecto lo instala con
`claude plugin marketplace add <repo>` y `claude plugin install auditable-architecture@<nombre>`, o
en desarrollo con `--plugin-dir`. `claude plugin validate plugins/auditable-architecture` es parte
del quickstart. La versión del plugin y `profileVersion` son independientes: el plugin sube de
versión con cada cambio; `profileVersion` sólo cuando cambia la forma del perfil.

**Rationale**: el requisito duro es que las nueve evaluaciones sigan corriendo en CI sin acceso
externo (spec, edge case "convivencia"): con el fuente en el repo, las pruebas ejecutan los
scripts del plugin por su ruta (`plugins/.../scripts/run-gates.mjs`) y no dependen de la
instalación. La portabilidad no se pierde: el plugin no importa nada del repo (SC-01-2 lo
verifica por inspección de imports) y se instala en otro proyecto desde este repo o desde una
copia. Cuando madure, extraerlo a su propio repositorio es mover el directorio y cambiar la
fuente del marketplace; se anota como paso futuro, no como parte de la 019.

**Alternativas**: repositorio propio desde el inicio (la CI de este repo dependería de un
checkout externo o de una copia fijada que diverge); skill personal en `~/.claude/skills/`
(no versionable ni probable en CI). Descartadas.

## R-03 — Convivencia con `.claude/skills/auditing-architecture/` (D-01)

**Decisión**: **reemplazo**. `.claude/skills/auditing-architecture/` desaparece; la skill queda
sólo en el plugin. `.claude/skills/` conserva las de spec-kit. Lo que hoy está en la skill y es
del proyecto se muda:

| Hoy (skill)                           | Destino                                                  |
| ------------------------------------- | -------------------------------------------------------- |
| `references/criterios-diseno.md`      | `docs/auditoria/criterios-diseno.md`                     |
| `references/formato-hallazgo.md`      | plugin (método)                                          |
| `references/refutacion.md`            | plugin (método)                                          |
| `scripts/audit-finding.schema.json`   | plugin (método)                                          |
| `scripts/run-gates.mjs`               | plugin, reescrito sobre el perfil (R-01)                 |
| `scripts/verify-finding.mjs`          | plugin, reescrito sobre `sources[]` del perfil           |
| `evals/<propio>/{expected,README}`    | `tests/audit/evals/<nombre>/`                            |
| `evals/<universal>/…`                 | plugin `skills/auditing-architecture/evals/<nombre>/`    |
| `evals/RESULTS.md`                    | `tests/audit/evals/RESULTS.md` (histórico del repo)      |
| lo que `run-gates` sabía de este repo | `scripts/audit/gate-*.mjs` (adaptadores, protocolo R-01) |

Los adaptadores del repo (`scripts/audit/gate-lint.mjs`, `gate-arch.mjs`, `gate-shape.mjs`,
`gate-duplication.mjs`, `gate-dead-code.mjs`, `gate-language.mjs`, `gate-mutation.mjs`)
reutilizan `scripts/lib.mjs`, `shape-rules.mjs` y `eslint.config.mjs` como hoy lo hace
`run-gates.mjs`: es el mismo código, del lado correcto de la frontera.

**Rationale**: una copia fijada además del plugin son dos fuentes del mismo método; la prueba
de no-regresión (los nueve `expected.json` sin cambio, SC-01-1) es la garantía de que el
reemplazo no pierde nada.

## R-04 — Evaluaciones universales y propias (D-01)

Medido por la fuente que cada `expected.json` espera:

| Eval                          | Fuente esperada                       | Clase                                                                 |
| ----------------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| identical-domain-functions    | `lint:sonarjs/no-identical-functions` | **universal** (cualquier lint con sonarjs)                            |
| empty-catch                   | `constitution#II. Fail-closed`        | propia (la fuente es de este repo); **universal en variante `lint:`** |
| magic-signal-strings          | `lint:ope/no-magic-strings`           | propia (regla propia del repo)                                        |
| controller-instantiates-infra | `constitution#I`                      | propia                                                                |
| env-dynamic-import            | `constitution#I`                      | propia                                                                |
| central-wiring-list           | `ADR-013`                             | propia                                                                |
| hardcoded-profile             | `ADR-013`                             | propia                                                                |
| profile-picks-gateways        | `ADR-013`                             | propia                                                                |
| mode-flag-across-layers       | `ADR-018` (sólo revisión cognitiva)   | propia                                                                |

**Decisión**: el plugin lleva dos evaluaciones universales (`identical-functions`,
`empty-catch`) con su fixture, su `expected.json` en términos de regla de gate (`lint:<regla>`,
severidad `medium`) y un `requires.json` (`{ "gateRule": "sonarjs/no-ignored-exceptions" }`): el
proyecto anfitrión las corre con **su** perfil sólo si algún gate lista esa regla. Las nueve del
repo se quedan como están (mismos `expected.json`) en `tests/audit/evals/`; `empty-catch` existe
en las dos formas porque esperan fuentes distintas (la del repo eleva a `constitution#II`, y ese
ascenso es justamente lo que la revisión cognitiva aporta y el README del eval explica). La prueba
determinista (`tests/audit/audit.test.ts`) recorre las nueve propias más las universales que el
perfil admite.

## R-05 — Esquemas de `config/` (D-04)

**Decisión**:

- **Niveles del release** (`platform.json`, `treatment-defaults.json`): esquemas **generados**
  por `contract:types` desde el bundle (`components.schemas.PlatformConfiguration` y
  `TreatmentDefaults`), a `generated/schemas/platform-configuration.schema.json` y
  `treatment-defaults.schema.json`, verificados por `contract:types:check` como el resto. La
  conversión OpenAPI 3.0 → JSON Schema 2020-12 es mecánica sobre el subconjunto que el contrato
  usa (ADR-014): reescribir `#/components/schemas/X` a `#/$defs/X` recogiendo las definiciones
  transitivas, `nullable` no se usa, `discriminator` no aparece en estos esquemas; se agrega
  `$schema`, `$id`, y la propiedad `$schema` (string) a los objetos raíz porque llevan
  `additionalProperties: false`. Lo hace `scripts/contract-schemas-lib.mjs` (~60 líneas),
  invocado por `contract-types.mjs`.
- **Semilla y operadores** (`dev-merchants.json`, `dev-operators.json`): esquemas escritos una
  vez en `config/schemas/merchants-seed.schema.json` y `operators.schema.json` (JSON Schema
  2020-12, descripción por campo, `additionalProperties: false`). No son DTO de la API: viven con
  lo que describen e inventariados por el README de `config/`.
- **Referencia desde cada archivo**: `"$schema": "../generated/schemas/…"` o
  `"./schemas/…"`. Los lectores de los niveles son de forma cerrada
  (`shape.closed` refusa claves desconocidas): `composition/levels-config.ts` quita `$schema`
  antes de entregar el objeto al lector (`withoutSchemaReference`, ~5 líneas); `merchants-config`
  y `operators-config` ya son de composición y hacen lo mismo. Aplicación y dominio no se tocan.
- **Verificación** (`tests/unit/composition/config-schemas.test.ts`, proyecto `fast`, Ajv 2020
  que ya es dependencia): (1) cada archivo de `config/` valida contra el esquema que referencia;
  (2) para la semilla y los operadores, un conjunto de fixtures válidos e inválidos (uno por
  campo) en el que el veredicto de Ajv y el del lector coinciden; una divergencia falla nombrando
  el fixture.
- **Descripciones obligatorias**: regla Spectral `ope-configuration-fields-described` sobre
  toda propiedad alcanzable desde `PlatformConfiguration` y `TreatmentDefaults` (recorre `$ref`),
  con su fixture en `tests/contract-rules/fixtures/`. Medido: los sub-esquemas de política
  (`DecisionPolicy`, `CommercialPolicy`, condiciones, `SyncLevelRules`, `Freshness`,
  `EvidenceProfile`, `DedupWindow`) ya llevan descripción en la mayoría de los campos; la regla
  fija lo que falte.

**Alternativas**: esquemas de los niveles escritos a mano (réplica: exactamente lo que la 018
eliminó para el catálogo de problemas); mover la semilla al contrato (no es API, y expondría
claves crudas en la documentación publicada). Descartadas.

## R-06 — Prueba de inventario y verificaciones de cabecera (D-06)

**Decisión**: `tests/docs/readmes.test.ts` en el proyecto `tools` (se agrega `tests/docs/**` a
`TOOL_SUITES`). Contrato del README en
[contracts/readme-inventory.md](./contracts/readme-inventory.md): una sección `## Inventario` con
una tabla cuya primera columna es la entrada entre comillas de código (`archivo` o `dir/`), y
columnas fijas `Qué es`, `Fuente o derivado`, `Quién lo lee`, `Verificación`; una fila puede ser
un **patrón** (`NNN-<nombre>/`, con `<…>` como comodín) para directorios de entradas homogéneas
(`specs/`). La prueba lleva la tabla de directorios con exclusiones y columnas propias:

| Directorio   | Exclusiones                  | Columnas propias                                   |
| ------------ | ---------------------------- | -------------------------------------------------- |
| `config/`    | —                            | `Variable de entorno`, `Cuándo se lee`             |
| `contracts/` | `dist/` (derivado, ignorado) | tabla `## Extensiones` (D-05)                      |
| `generated/` | —                            | —                                                  |
| `patches/`   | —                            | —                                                  |
| `scripts/`   | —                            | `Clase` (entrypoint, CLI, librería, plugin, datos) |
| `docs/`      | —                            | —                                                  |
| `tests/`     | —                            | `Proyecto` (`fast`, `tools`, ambos)                |
| `client/`    | —                            | —                                                  |
| `specs/`     | —                            | fila patrón obligatoria                            |
| `plugins/`   | —                            | —                                                  |

Las entradas se enumeran con `git ls-files`: lo ignorado por git (`contracts/dist/`, `reports/`,
`docs/api/`) no existe para la prueba, y `reports/` no lleva README porque no es parte del
repositorio. Globalmente excluidos: `node_modules/`, `.git/`, `dist/`, `src/` (código: lo describe ADR-013 y
CLAUDE.md), `.claude/`, `.specify/`, `.github/` (dot-directorios de herramientas; sus README son
opcionales). Las entradas ocultas dentro de un directorio inventariado (`.spectral.yaml`,
`.gitkeep`) **cuentan**. Cifras en prosa: la prueba falla si el README contiene un número seguido
de "archivos", "reglas", "pruebas" u "operaciones" (misma denylist que usa `check:markers` para
documentación viva, o una lista propia si no existe).

Verificaciones de cabecera en la misma suite:

- `generated/*`: primera línea `// GENERATED by scripts/<x>.mjs from <fuente>` y el script
  existe (medido: `problem-types.js` cita `scripts/contract-problem-types.mjs`, inexistente; la
  cabecera la escribe `contract-problem-types-lib.mjs` y se corrige ahí).
- `patches/*.patch`: cabecera con líneas `# Fix:` y `# Retire:` (se reescribe la actual, que ya
  tiene el contenido, a esa forma).
- `scripts/**/*.mjs`: la primera línea que no es shebang es un comentario `//` (medido:
  `contract-types-lib.mjs` no lo tiene).

**Rationale**: la prueba verifica el **primer nivel** de cada directorio (edge case de la spec):
`contracts/components/schemas/` se nombra como subdirectorio con su convención, no archivo por
archivo. Una convención sin prueba diverge; una prueba sin convención escrita es arbitraria: por
eso las dos van juntas en `contracts/readme-inventory.md` y en el ADR.

## R-07 — `webhooks/` (D-05)

**Medido**: `contracts/webhooks/.gitkeep` existe desde la 001; el mapa del contrato no declara
ningún webhook; la feature "Platform port" (`019` del mapa) describe `pull`/`subscribe` como OPE
consultando o consumiendo (salida), y un webhook entrante sería una operación bajo `paths/` con
`platformKey`, no un objeto `webhooks` de OpenAPI.

**Decisión propuesta**: borrar `contracts/webhooks/`. Si el dueño prefiere conservarlo, el README
lo inventaría como "reservado para webhooks OpenAPI 3.1; ninguna feature del mapa lo usa" y se
marca `PROPUESTO`. Se resuelve en la tarea correspondiente; ambas opciones cumplen FR-05-4.

## R-08 — Skill de acondicionamiento: forma y idempotencia (D-02)

**Decisión**: `skills/conditioning-project/` con tres scripts y dos plantillas:

- `scripts/inspect.mjs <raíz>` → JSON con lo detectado: fuentes (`.specify/memory/constitution.md`,
  `docs/adr/`, `CLAUDE.md`/`AGENTS.md`), herramientas por presencia de archivo o dependencia
  (`eslint.config.*`, `.dependency-cruiser.*`, `.jscpd.json`/`jscpd` en `package.json`, `knip.json`,
  `stryker.config.*`, `ruff.toml`, `.golangci.yml`, …), organización de `src/` (propuesta de
  `scopes.module.roots` por los directorios de segundo nivel que se repiten), base de `diff`
  (rama por defecto del remoto). Sin escribir nada.
- `scripts/write-profile.mjs <raíz> --answers <json>` → escribe `audit.profile.json`,
  `docs/auditoria/criterios-diseno.md` desde `templates/criterios-diseno.template.md`
  prellenado (por cada criterio, la sección de la constitución o el ADR cuyo título coincide por
  palabras clave, citado como fuente; si no hay, `PLACEHOLDER`), y por cada gate detectado sin
  adaptador una entrada `pending` en el perfil con el comando que faltaría. **Idempotencia**: las
  respuestas quedan en el perfil (`conditioning.answers`); una segunda corrida regenera desde las
  mismas respuestas y compara: si el archivo existente coincide con lo regenerado, no escribe; si
  difiere (edición manual), no pisa y reporta el diff.
- `scripts/doctor.mjs <raíz>` → tabla `listo | falta | degradado` por gate (corre `--list-rules`
  y una corrida vacía), por clase de fuente (al menos una resolución), por criterios (sin
  `PLACEHOLDER` bloqueante), y el **veredicto máximo**: `rejected` sólo si hay algún gate
  `blocking` o alguna fuente `high`; si no, `changes-required` y lo dice.
- `SKILL.md` orquesta: inspeccionar → preguntar sólo lo no detectado (con `AskUserQuestion`:
  regla de módulo, gates bloqueantes, base de `diff`) → escribir → doctor. Sin constitución ni
  ADR recomienda `/speckit-constitution` y deja la fuente `pending`.

**Verificación**: `tests/audit/conditioning.test.ts` (tools): sobre este repo, `inspect` no
necesita preguntas (todo detectado), `write-profile` produce un perfil equivalente al commiteado
(comparación estructural) y `doctor` da 0 falta / 0 degradado; sobre
`tests/audit/fixtures/empty-repo/` escribe el mínimo, el doctor lista las fuentes pendientes y
termina con éxito; dos corridas seguidas: la segunda no cambia archivos (hash del árbol).

## R-09 — Orden, commits y documentación

**Decisión**: D-06 → D-04 → D-05 → D-01 → D-02, un commit por historia. D-06 primero porque fija
la convención y la prueba que D-04 y D-05 instancian, y porque el plugin (`plugins/`) es un
directorio nuevo de primer nivel que nace con su README. ADR-032 "Método portable y perfil por
proyecto" (D-01) también registra la convención de README con inventario (D-06) como su segunda
decisión, para no abrir dos ADR de tooling en la misma feature. CLAUDE.md: al cerrar D-06 se
achica lo descriptivo que cada README absorbe (tabla de comandos queda; las notas de `config/` y
`contracts/` se acortan y enlazan). `check:identifiers` y la prueba de documentación vigilan las
rutas citadas.

## R-10 — Riesgos

- **Plugin: mecanismo de instalación**: la forma `.claude-plugin/plugin.json` + marketplace es
  la documentada por Claude Code; `claude plugin validate` en el quickstart lo confirma antes de
  commitear D-01. Si el CLI local no la admite, el plugin sigue siendo válido por `--plugin-dir`
  y las pruebas no dependen de la instalación.
- **Conversión OpenAPI → JSON Schema**: acotada al subconjunto de ADR-014 y a dos esquemas; una
  prueba de drift y la validación de los archivos reales contra lo generado atrapan cualquier
  construcción no soportada.
- **Prueba de inventario demasiado estricta**: se calibra con exclusiones explícitas en la
  tabla, nunca relajando el contrato del README.
