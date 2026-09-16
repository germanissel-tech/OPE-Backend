# Data model — Feature 005

Sin datos de dominio. Entidades = configuraciones, sus invariantes y la forma de un hallazgo.

## Gate

| Campo       | Valor                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| nombre      | `lint`, `arch`, `duplication`, `dead-code`, `language`, `mutation`, `shape`                                         |
| alcance     | por gate (tabla abajo)                                                                                              |
| exclusiones | `.prettierignore` (lista única) + las propias del gate, siempre explícitas en su config                             |
| modo        | `blocking` (falla `quality`/CI) o `informative` (imprime, sale 0)                                                   |
| umbral      | número con justificación en comentario contiguo (FR-013)                                                            |
| fixture     | un archivo que lo viola bajo `tests/<área>/fixtures/` y una prueba que confirma la falla (FR-051)                   |
| salida JSON | `{ gate, mode, status: "pass" \| "fail", findings: [{ file, line?, rule, message }] }` — la consume `run-gates.mjs` |

| Gate          | Alcance bloqueante                                                                                    | Alcance informativo          | Config                             |
| ------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------- |
| `lint`        | `src/`, `tests/`, `scripts/`, `contracts/rules/functions/`                                            | —                            | `eslint.config.mjs`                |
| `arch`        | `src/`                                                                                                | —                            | `.dependency-cruiser.cjs`          |
| `shape`       | `src/domain/`, `src/application/`, `src/interface-adapters/http/controllers/`, `src/` (instanciación) | —                            | `tests/architecture/shape.test.ts` |
| `duplication` | `src/` sin `generated/`                                                                               | `tests/`, `scripts/`         | `scripts/check-duplication.mjs`    |
| `dead-code`   | `files`, `exports`, `dependencies`, `unlisted`                                                        | `types`, `nsTypes`           | `knip.json`                        |
| `language`    | FR-001 (código, pruebas, scripts, contrato, configs, CI, scripts de la skill)                         | —                            | `scripts/language-denylist.json`   |
| `mutation`    | líneas de `src/` del diff contra `origin/main`                                                        | `src/` completo (programado) | `stryker.config.json`              |

## Excepción justificada

Misma forma en todos los gates que la admiten: en la línea afectada (o la anterior), regla
y motivo obligatorio; sin motivo ⇒ falla; contadas al final del comando.

| Gate        | Sintaxis                                                      | Contador                 |
| ----------- | ------------------------------------------------------------- | ------------------------ |
| `lint`      | `// eslint-disable-next-line <regla> -- <motivo>`             | `Lint exceptions: N`     |
| `language`  | `// lang:es -- <motivo>` · `# lang:es -- <motivo>` (YAML)     | `Language exceptions: N` |
| `dead-code` | entrada en `knip.json` con comentario en el script que lo usa | (lista en la config)     |
| `mutation`  | `// Stryker disable next-line <mutador>: <motivo>`            | (informado por Stryker)  |

Objetivo al cierre: 0 en `lint` y `language`.

## Lista de palabras del español (`scripts/language-denylist.json`)

```json
{
  "_doc": "...",
  "words": ["el", "la", "los", "las", "un", "una", "que", "para", "por", "con", "sin", "cada", "..."]
}
```

Invariantes: sin palabras de una letra; sin acentos (los cubre el detector de caracteres);
minúsculas; sin duplicados; toda palabra debe no existir en inglés (`no`, `error`, `final`
quedan fuera). Verificado por `tests/governance/language.test.ts`.

## Hallazgo de auditoría (`contracts/audit-finding.schema.json`)

| Campo          | Tipo / valores                                                                                                                              | Obligatorio |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `id`           | string único en el reporte                                                                                                                  | sí          |
| `file`         | ruta relativa al repo, existente                                                                                                            | sí          |
| `line`         | entero ≥ 1, dentro del archivo                                                                                                              | sí          |
| `rule`         | `{ id, source }` — `source` ∈ `ADR-NNN` · `constitution#<sección>` · `lint:<regla>` · `arch:<regla>` · `guide#<sección>` · `clarity:<slug>` | sí          |
| `severity`     | `high` (constitución/ADR) · `medium` (guía de agentes) · `low` (claridad)                                                                   | sí          |
| `evidence`     | fragmento citado (≤ 20 líneas)                                                                                                              | sí          |
| `proposal`     | `{ before, after }`                                                                                                                         | sí          |
| `coveringTest` | qué prueba lo cubriría (nombre y ubicación propuestos)                                                                                      | sí          |
| `status`       | `proposed` → `confirmed` \| `refuted`; `refuted` lleva `refutation`                                                                         | sí          |
| `verified`     | boolean puesto por `verify-finding.mjs`; `reason` si `false`                                                                                | script      |

Regla de severidad ↔ `source`: `ADR-NNN` y `constitution#` ⇒ `high`; `guide#`, `lint:`, `arch:` y
`shape:` ⇒ `medium` (una regla de lint o de arquitectura en rojo ya la reporta el gate; en un
hallazgo cognitivo la fuente `lint:` significa "misma intención, caso que la regla no ve");
`clarity:<slug>` (nombres, legibilidad; sin fuente formal) ⇒ `low`. `verify-finding` rechaza un hallazgo cuya severidad no corresponde
a su fuente.

## Reporte de auditoría

| Sección       | Contenido                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| alcance       | `module:<nombre>` · `dir:<ruta>` · `diff:<base>...HEAD`, con la lista de archivos examinados                                              |
| gates         | salida JSON de `run-gates.mjs`, por gate: `pass`/`fail` y hallazgos                                                                       |
| hallazgos     | sólo `status: confirmed` y `verified: true`; los refutados van en un anexo con su `refutation`                                            |
| estado global | `rejected` si algún gate bloqueante `fail` o algún hallazgo `high`; `changes-required` si algún `medium`; `approved` si sólo `low` o nada |

## Criterio de diseño (`references/criterios-diseno.md`)

| Campo         | Contenido                                                                       |
| ------------- | ------------------------------------------------------------------------------- |
| principio     | SRP · OCP · LSP · ISP · DIP · DRY · claridad · errores                          |
| definición    | qué significa en este repo (anillos, módulos, puertos, catálogos, `NO_OP`)      |
| fuente        | `constitution#I`, `ADR-013`, `arch:controllers-no-gateways`, `ADR-008`, …       |
| viola         | ejemplo mínimo                                                                  |
| cumple        | ejemplo mínimo                                                                  |
| lo ve un gate | sí/no — si sí, el hallazgo cognitivo sólo aporta el caso que la regla no atrapa |

## Escenario de evaluación (`evals/<nombre>/`)

| Archivo         | Contenido                                                                           |
| --------------- | ----------------------------------------------------------------------------------- |
| `fixture/`      | árbol mínimo `src/...` con el defecto                                               |
| `expected.json` | hallazgo esperado: `file`, `line`, `rule.id`, `rule.source`, `severity`             |
| `README.md`     | qué defecto es, qué gate lo ve (si alguno) y qué debe agregar la revisión cognitiva |

Escenarios: `controller-instantiates-infra` (gate `arch` + `shape` regla 3; fuente
`constitution#I`, `high`), `identical-domain-functions` (gate `lint:sonarjs/no-identical-functions`;
cognitivo: proponer la función común y su prueba), `empty-catch`
(gate `lint:sonarjs/no-ignored-exceptions`; cognitivo: qué error se traga y qué `NO_OP` con
motivo debería salir, `constitution#II`).

## Rangos de mutación (`scripts/mutation-diff.mjs`)

Entrada: `git diff --unified=0 <base>...HEAD -- src`. Por hunk `@@ -a,b +c,d @@` con `d > 0`:
rango `c..c+d-1` del archivo nuevo. Salida: `mutate: ["src/x.ts:c-e", …]`, sin los archivos
que `ignorePatterns` excluye. Invariantes: rangos dentro del archivo; archivo existente en
`HEAD`; sin rangos ⇒ salida `{ skipped: "no-production-lines" }`; sin base ⇒
`{ skipped: "no-base-ref" }`. Verificado por `tests/governance/mutation-diff.test.ts` con
diffs sintéticos.
