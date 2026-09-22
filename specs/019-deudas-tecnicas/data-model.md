# Data model — Deudas técnicas del tooling y las skills (019)

Sin entidades de dominio: la feature no toca `src/domain/` ni `src/application/`. Lo que sigue
son las formas de los artefactos que las historias producen y las reglas que las pruebas
verifican. Detalle de cada forma en `contracts/`.

## Perfil y plugin (D-01, D-02)

| Entidad               | Forma                                                                                                        | Reglas                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `AuditProfile`        | `audit.profile.json` v1: `sourceRoot`, `scopes`, `gates[]`, `sources[]`, `criteria`, `evals`, `conditioning` | versión exacta o rechazo; rutas relativas; esquema JSON en el plugin; ver `contracts/audit-profile.md`                               |
| `Gate`                | `id`, `mode`, `scopes?`, `run`, `format`                                                                     | `format = findings-v1`; `--files-from`, `--list-rules`; salida ≠ 0 ⇒ `degraded`                                                      |
| `GateResult`          | `gate`, `mode`, `status: pass \| fail \| degraded`, `reason?`, `findings[]`                                  | hallazgo sin `file`/`line` descartado; `blocking` + `fail` ⇒ `rejected`; `blocking` + `degraded` ⇒ nunca `approved`                  |
| `SourceKind`          | `kind`, `severity`, `resolve: file-glob \| markdown-heading \| gate-rule \| criteria-section`                | prefijo literal; resolutores cerrados; fuente no declarada ⇒ `verified: false`                                                       |
| `Finding`             | sin cambio (`audit-finding.schema.json` del plugin)                                                          | la severidad la impone `SourceKind`, no el autor                                                                                     |
| `Eval`                | `expected.json`, `README.md`, fixture; universal: + `requires.json`                                          | propias en `tests/audit/evals/`, universales en el plugin; el anfitrión corre las universales cuyo `gateRule` lista algún gate       |
| `Skills`              | `.claude/skills/{auditing-architecture,conditioning-project}/` (enmienda 2026-09-22: sin plugin)             | no importan nada del repo por ruta (prueba por inspección de imports); llevarlas a otro proyecto es copiar los dos directorios       |
| `DoctorReport`        | `gates[]`, `sources[]`, `criteria`, `maxVerdict`                                                             | `maxVerdict = rejected` sólo con gate `blocking` listo o fuente `high` lista; estados `ready \| missing \| degraded`                 |
| `ConditioningAnswers` | `conditioning.answers` dentro del perfil                                                                     | lo escribe sólo la skill de acondicionamiento; una segunda corrida regenera desde ahí y no pisa ediciones manuales (reporta el diff) |

## Esquemas de configuración (D-04)

| Entidad                          | Forma                                                                                         | Reglas                                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GeneratedConfigSchema`          | `generated/schemas/<kebab>.schema.json`, 2020-12, `$defs` transitivos, `$comment` de generado | derivado del bundle por `contract:types`; drift por `contract:types:check`; `properties.$schema` admitido |
| `SeedSchema` / `OperatorsSchema` | `config/schemas/*.schema.json`, 2020-12, descripción por campo                                | escrito una vez; la prueba de coincidencia con el lector lo mantiene fiel                                 |
| `ConfigFile`                     | los cuatro JSON de `config/` con `$schema`                                                    | valida contra su esquema en la suite; composición quita `$schema` antes del lector; valores sin cambio    |

## Inventario y cabeceras (D-05, D-06)

| Entidad           | Forma                                                                                           | Reglas                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `InventoryReadme` | `README.md` con `## Inventario` (tabla, primera columna la entrada)                             | faltantes y sobrantes = fallo; filas patrón; columnas fijas + propias; sin cifras en prosa; ver `contracts/readme-inventory.md` |
| `DirectoryPolicy` | fila de la tabla de la prueba: `dir`, `exclude[]`, `columns[]`, `sections[]`                    | lista explícita; exclusiones globales fijas; un directorio de primer nivel nuevo sin política ni README falla                   |
| `ExtensionsTable` | `## Extensiones` en `contracts/README.md`: `Extensión`, `Dónde`, `Forma`, `Regla`, `Consumidor` | igual, en los dos sentidos, al conjunto de claves `x-*` de la fuente del contrato                                               |
| `GeneratedHeader` | primera línea de `generated/*`                                                                  | cita un script que existe                                                                                                       |
| `PatchHeader`     | comentarios iniciales de `patches/*.patch`                                                      | `# Fix:` y `# Retire:` presentes                                                                                                |
| `ScriptHeader`    | primera línea no shebang de `scripts/**/*.mjs`                                                  | empieza con `//`                                                                                                                |

## Transiciones del registro (spec)

`evaluada → especificada → implementada`; `evaluada | especificada → descartada`. `implementada`
exige commit citado en la columna "Cierre". Sin vuelta atrás: lo que una historia posterior
cambia de una `implementada` es una deuda nueva.
