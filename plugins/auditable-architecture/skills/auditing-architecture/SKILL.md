---
name: auditing-architecture
description: Audits a module, a directory or the current diff of a project against its own design criteria (constitution, ADRs, agent guide, gates) as its audit profile (audit.profile.json) declares them. Runs the project's deterministic gates first, proposes findings with file:line and source, refutes each one, verifies them by script against the profile and reports a derived status (approved / changes-required / rejected). Use when asked to audit, review the architecture, check SOLID or DRY, assess technical debt, or review the changes against the main branch. Needs an audit.profile.json at the root of the repository (the conditioning-project skill writes one).
---

# Auditoría de arquitectura y calidad

Procedimiento, no opinión: los gates dicen los hechos, la revisión cognitiva agrega lo que
ninguna regla ve, y nada entra al reporte sin `file:line`, fuente y verificación por script.
Sin puntuación numérica. La skill es el **método**; todo lo que es del proyecto —qué gates hay,
cómo se resuelve un módulo, qué fuentes de verdad existen y qué severidad imponen, dónde están
los criterios de diseño y las evaluaciones propias— lo dice el **perfil** del proyecto,
`audit.profile.json` en la raíz del repositorio. Nada de esta skill sabe de un proyecto en
particular.

Los scripts se citan como `${SKILL}/scripts/...`: `${SKILL}` es el directorio de esta skill
(dentro del plugin instalado, o `plugins/auditable-architecture/skills/auditing-architecture`
cuando el plugin vive en el repositorio).

## Checklist

Copiar y tachar a medida que se avanza:

```
Audit progress:
- [ ] 0. Perfil cargado (audit.profile.json); sin perfil o versión desconocida ⇒ decirlo y terminar
- [ ] 1. Alcance resuelto (--module | --dir | --diff); vacío ⇒ decirlo y terminar
- [ ] 2. Gates corridos (run-gates.mjs --json) y leídos como hechos
- [ ] 3. Criterios leídos (el documento que profile.criteria nombra, entero)
- [ ] 4. Hallazgos propuestos (JSON según references/formato-hallazgo.md, status: proposed)
- [ ] 5. Cada hallazgo refutado o confirmado (references/refutacion.md)
- [ ] 6. verify-finding.mjs corrido; los `verified: false` descartados y dichos
- [ ] 7. Reporte con estado global derivado
```

## Paso 0 — Perfil

`run-gates.mjs` y `verify-finding.mjs` leen `audit.profile.json` de la raíz del repositorio
(`--root <ruta>` para otra). Sin perfil, terminan con
`no audit.profile.json in <raíz>: run the conditioning-project skill to create one`; con una
versión que no entienden, con `profile version N not supported (this skill understands 1)`.
En los dos casos el reporte es esa línea y nada más: no se audita sin perfil ni se inventa uno.
La forma del perfil está en `scripts/audit-profile.schema.json`.

## Paso 1 — Alcance

Uno de:

- `--module <nombre>`: los directorios que `profile.scopes.module.roots` plantea con `{name}`.
- `--dir <ruta>`: ese directorio.
- `--diff`: los archivos cambiados contra `profile.scopes.diff.base` (más los sin trackear),
  dentro de `profile.scopes.diff.include`.

Si el alcance no tiene archivos, el reporte es una línea ("alcance vacío: …") y termina. No se
inventan hallazgos.

## Paso 2 — Gates (hechos)

Ejecutar exactamente:

```bash
node ${SKILL}/scripts/run-gates.mjs --module <nombre> --json
# o --dir <ruta> --json, o --diff --json
```

Devuelve `{ scope, files, gates: [{ gate, mode, status, findings[], reason? }] }` con un
resultado por gate del perfil aplicable al alcance. `status` es `pass`, `fail` o `degraded`
(el adaptador no corrió o no entregó hallazgos válidos; `reason` dice por qué). Un gate
`blocking` en `fail` ya decide `rejected` (paso 7) y uno `blocking` degradado impide `approved`;
la revisión cognitiva se hace igual para que el autor tenga la lista completa. Nunca
reinterpretar un gate: se cita tal cual.

## Paso 3 — Criterios

Leer **entero** el documento que `profile.criteria` nombra: define SRP, OCP, LSP, ISP, DIP,
DRY, claridad y errores en términos del proyecto, con la fuente de cada uno y qué ya ve un
gate. Un hallazgo sobre algo que un gate ya reporta es ruido salvo que aporte el caso que la
regla no ve.

## Paso 4 — Hallazgos propuestos

Leer cada archivo del alcance. Por cada defecto, un objeto JSON con la forma de
`references/formato-hallazgo.md`: `id`, `file`, `line`, `rule { id, source }`, `severity`
(la impone la clase de la fuente según `profile.sources[]`, nunca el revisor), `evidence`
(cita literal), `proposal { before, after }` (código), `coveringTest`, `status: "proposed"`.
Guardarlos en un archivo (p. ej. `/tmp/findings.json`).

## Paso 5 — Refutación

Pasar cada hallazgo por `references/refutacion.md`. Lo que no sobrevive pasa a
`status: "refuted"` con `refutation`; lo que sobrevive, a `"confirmed"`. Refutar en serio: una
decisión registrada que lo justifica, un gate que ya lo reporta, una prueba propuesta que hoy
no fallaría.

## Paso 6 — Verificación mecánica

```bash
node ${SKILL}/scripts/verify-finding.mjs /tmp/findings.json
```

Valida la forma, que `file:line` existe, que `rule.source` empieza con una clase que el perfil
declara y resuelve por su resolutor, y que la severidad es la que esa clase impone. Un
`verified: false` se descarta del reporte y se menciona con su `reason`; no se corrige a mano
para que pase.

## Paso 7 — Reporte

Secciones, en este orden: **Alcance** (con la lista de archivos) · **Gates** (gate por gate,
con los degradados y su motivo) · **Hallazgos** (sólo `confirmed` + `verified: true`, por
severidad) · **Refutados** (anexo con su `refutation`) · **Estado global**.

Estado global, regla fija:

- `rejected`: algún gate `blocking` en `fail`, o algún hallazgo `high`.
- `changes-required`: ningún `high`, pero algún `medium` o algún gate `blocking` degradado.
- `approved`: sólo `low` o nada, y ningún gate `blocking` degradado.

## Prohibido

- Puntuaciones numéricas o "notas" de mantenibilidad.
- Hallazgos sin `file:line`, sin cita literal en `evidence` o con `after` en prosa.
- Repetir lo que un gate ya lista sin aportar el caso que la regla no ve.
- Cambiar un hallazgo para que `verify-finding` lo acepte en vez de descartarlo.
- Auditar sin perfil, o inventar gates y fuentes que el perfil no declara.

## Evaluación

Dos juegos: las **universales** viajan con la skill en `evals/<nombre>/` (fixture propio,
`expected.json`, `requires.json` con la regla de gate que exigen, README) y las corre cualquier
proyecto cuyo perfil liste esa regla; las **propias** de cada proyecto viven donde
`profile.evals` apunta, con el mismo formato. La mitad determinista la verifica la suite del
proyecto (gates sobre cada fixture, `verify-finding` sobre cada esperado); la cognitiva se
evalúa corriendo esta skill sobre cada fixture y comparando con `expected.json`, con
resultados fechados junto a las evaluaciones.
