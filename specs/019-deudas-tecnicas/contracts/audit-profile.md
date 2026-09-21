# Contrato — Perfil de auditoría y protocolo de adaptadores (D-01, D-02; R-01)

Lo que un proyecto le dice a la skill y lo que un gate le entrega. La skill no conoce nada fuera
de esto.

## `audit.profile.json` (versión 1)

```json
{
  "$schema": "./plugins/auditable-architecture/skills/auditing-architecture/scripts/audit-profile.schema.json",
  "profileVersion": 1,
  "sourceRoot": "src",
  "scopes": {
    "module": {
      "roots": ["src/domain/{name}", "src/application/{name}", "src/interface-adapters/{name}"]
    },
    "diff": { "base": "origin/main", "include": ["src/**"] }
  },
  "gates": [
    { "id": "lint", "mode": "blocking", "run": "node scripts/audit/gate-lint.mjs", "format": "findings-v1" },
    { "id": "arch", "mode": "blocking", "run": "node scripts/audit/gate-arch.mjs", "format": "findings-v1" },
    {
      "id": "shape",
      "mode": "blocking",
      "run": "node scripts/audit/gate-shape.mjs",
      "format": "findings-v1"
    },
    {
      "id": "duplication",
      "mode": "blocking",
      "run": "node scripts/audit/gate-duplication.mjs",
      "format": "findings-v1"
    },
    {
      "id": "dead-code",
      "mode": "blocking",
      "run": "node scripts/audit/gate-dead-code.mjs",
      "format": "findings-v1"
    },
    {
      "id": "language",
      "mode": "blocking",
      "run": "node scripts/audit/gate-language.mjs",
      "format": "findings-v1"
    },
    {
      "id": "mutation",
      "mode": "informative",
      "scopes": ["diff"],
      "run": "node scripts/audit/gate-mutation.mjs",
      "format": "findings-v1"
    }
  ],
  "sources": [
    {
      "kind": "constitution#",
      "severity": "high",
      "resolve": { "type": "markdown-heading", "file": ".specify/memory/constitution.md" }
    },
    {
      "kind": "ADR-",
      "severity": "high",
      "resolve": { "type": "file-glob", "pattern": "docs/adr/{id}-*.md" }
    },
    {
      "kind": "guide#",
      "severity": "medium",
      "resolve": { "type": "markdown-heading", "file": "CLAUDE.md" }
    },
    { "kind": "lint:", "severity": "medium", "resolve": { "type": "gate-rule", "gate": "lint" } },
    { "kind": "arch:", "severity": "medium", "resolve": { "type": "gate-rule", "gate": "arch" } },
    { "kind": "shape:", "severity": "medium", "resolve": { "type": "gate-rule", "gate": "shape" } },
    { "kind": "clarity:", "severity": "low", "resolve": { "type": "criteria-section" } }
  ],
  "criteria": "docs/auditoria/criterios-diseno.md",
  "evals": "tests/audit/evals",
  "conditioning": { "answers": {} }
}
```

Reglas:

- `profileVersion` desconocida ⇒ la skill termina con `profile version N not supported (this
skill understands 1)`, sin auditar. Sin archivo ⇒ `no audit.profile.json in <raíz>: run the
conditioning-project skill to create one`, sin auditar.
- `gates[].scopes` ausente = todos los alcances. `mode: blocking` en `fail` ⇒ `rejected`;
  `blocking` degradado ⇒ nunca `approved`.
- `sources[].kind` es prefijo literal del `rule.source` de un hallazgo; el resto del string es
  el identificador que el resolutor busca. Una fuente cuyo prefijo no está declarado ⇒
  `verified: false`, motivo `source kind not declared in profile`.
- `conditioning.answers` lo escribe la skill de acondicionamiento y sólo ella lo lee.
- Rutas relativas a la raíz del repositorio; separador `/`.

## Protocolo `findings-v1` (adaptador de gate)

Invocación: `<run> --files-from <archivo>` — una ruta por línea, relativa a la raíz; lista vacía
posible (el gate responde sin hallazgos).

Salida estándar, JSON:

```json
{
  "findings": [{ "file": "src/x.ts", "line": 12, "rule": "sonarjs/no-identical-functions", "message": "..." }]
}
```

Invocación: `<run> --list-rules` → `{ "rules": ["sonarjs/no-identical-functions", "..."] }`.

Códigos de salida: `0` = corrió (los hallazgos deciden); cualquier otro = degradado, motivo =
stderr recortado a una línea. `file` y `line` obligatorios; un hallazgo sin ellos se descarta.
`rule` es el identificador que las fuentes `lint:`/`arch:`/`shape:` citan.

## Evaluaciones

Un directorio por eval con `expected.json` (lista de hallazgos esperados: `file`, `line`,
`rule.source`, `severity`, `verified: true`), `README.md` (qué defecto y qué aporta la revisión
sobre el gate) y `fixture/src/…` (o, en el repo, `tests/audit/fixtures/<nombre>/src`). Las
universales del plugin agregan `requires.json` (`{ "gateRule": "<regla>" }`): el anfitrión las
corre sólo si un gate de su perfil lista esa regla.

## Salida del doctor (`conditioning-project`)

```json
{
  "gates": [
    { "id": "lint", "status": "ready" },
    { "id": "mutation", "status": "degraded", "reason": "..." }
  ],
  "sources": [
    { "kind": "ADR-", "status": "ready" },
    { "kind": "constitution#", "status": "missing" }
  ],
  "criteria": { "status": "ready", "placeholders": 0 },
  "maxVerdict": "rejected"
}
```

`maxVerdict` = `rejected` si hay algún gate `blocking` listo o alguna fuente `high` lista; si no,
`changes-required`. Estados: `ready | missing | degraded`.
