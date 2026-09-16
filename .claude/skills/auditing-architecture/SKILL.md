---
name: auditing-architecture
description: Audits a module, a directory or the current diff of the OPE backend against clean architecture, SOLID, DRY and clarity as this repository defines them (constitution, ADRs, CLAUDE.md). Runs the deterministic gates first, proposes findings with file:line and source, refutes each one, verifies them by script and reports a derived status (approved / changes-required / rejected). Use when asked to audit, review the architecture, check SOLID or DRY, assess technical debt, or review the changes against main.
---

# Auditoría de arquitectura y calidad

Procedimiento, no opinión: los gates dicen los hechos, la revisión cognitiva agrega lo que
ninguna regla ve, y nada entra al reporte sin `file:line`, fuente y verificación por script.
Sin puntuación numérica.

## Checklist

Copiar y tachar a medida que se avanza:

```
Audit progress:
- [ ] 1. Alcance resuelto (--module | --dir | --diff); vacío ⇒ decirlo y terminar
- [ ] 2. Gates corridos (run-gates.mjs --json) y leídos como hechos
- [ ] 3. Criterios leídos (references/criterios-diseno.md)
- [ ] 4. Hallazgos propuestos (JSON según references/formato-hallazgo.md, status: proposed)
- [ ] 5. Cada hallazgo refutado o confirmado (references/refutacion.md)
- [ ] 6. verify-finding.mjs corrido; los `verified: false` descartados y dichos
- [ ] 7. Reporte con estado global derivado
```

## Paso 1 — Alcance

Uno de:

- `--module <nombre>`: `src/domain/<nombre>`, `src/application/<nombre>` y sus adaptadores.
- `--dir <ruta>`: ese directorio.
- `--diff`: los archivos de `src/` cambiados contra `origin/main` (incluye el árbol de trabajo).

Si el alcance no tiene archivos, el reporte es una línea ("alcance vacío: …") y termina. No se
inventan hallazgos.

## Paso 2 — Gates (hechos)

Ejecutar exactamente:

```bash
node .claude/skills/auditing-architecture/scripts/run-gates.mjs --module <nombre> --json
# o --dir <ruta> --json, o --diff --json
```

Devuelve `{ scope, files, gates: [{ gate, mode, status, findings[] }] }` con `lint`, `arch`,
`shape`, `duplication`, `dead-code`, `language` y, con `--diff`, `mutation`. Un gate
bloqueante en `fail` ya decide `rejected` (paso 7); la revisión cognitiva se hace igual para que
el autor tenga la lista completa. Nunca reinterpretar un gate: se cita tal cual.

## Paso 3 — Criterios

Leer `references/criterios-diseno.md` **entero**: define SRP, OCP, LSP, ISP, DIP, DRY, claridad
y errores en términos de este repo, con la fuente de cada uno y qué ya ve un gate. Un hallazgo
sobre algo que un gate ya reporta es ruido salvo que aporte el caso que la regla no ve.

## Paso 4 — Hallazgos propuestos

Leer cada archivo del alcance. Por cada defecto, un objeto JSON con la forma de
`references/formato-hallazgo.md`: `id`, `file`, `line`, `rule { id, source }`, `severity`
(la decide la fuente: `ADR-`/`constitution#` ⇒ high; `guide#`/`lint:`/`arch:` ⇒ medium;
`clarity:` ⇒ low), `evidence` (cita literal), `proposal { before, after }` (código),
`coveringTest`, `status: "proposed"`. Guardarlos en un archivo (p. ej. `/tmp/findings.json`).

## Paso 5 — Refutación

Pasar cada hallazgo por `references/refutacion.md`. Lo que no sobrevive pasa a
`status: "refuted"` con `refutation`; lo que sobrevive, a `"confirmed"`. Refutar en serio: un
ADR que lo justifica, un gate que ya lo reporta, una prueba propuesta que hoy no fallaría.

## Paso 6 — Verificación mecánica

```bash
node .claude/skills/auditing-architecture/scripts/verify-finding.mjs /tmp/findings.json
```

Valida el esquema, que `file:line` existe y que `rule.source` resuelve (ADR, sección de la
constitución o de CLAUDE.md, regla de lint o de dependency-cruiser). Un `verified: false` se
descarta del reporte y se menciona con su `reason`; no se corrige a mano para que pase.

## Paso 7 — Reporte

Secciones, en este orden: **Alcance** (con la lista de archivos) · **Gates** (gate por gate) ·
**Hallazgos** (sólo `confirmed` + `verified: true`, por severidad) · **Refutados** (anexo con su
`refutation`) · **Estado global**.

Estado global, regla fija:

- `rejected`: algún gate bloqueante `fail`, o algún hallazgo `high`.
- `changes-required`: ningún `high`, algún `medium`.
- `approved`: sólo `low` o nada.

## Prohibido

- Puntuaciones numéricas o "notas" de mantenibilidad.
- Hallazgos sin `file:line`, sin cita literal en `evidence` o con `after` en prosa.
- Repetir lo que un gate ya lista sin aportar el caso que la regla no ve.
- Cambiar un hallazgo para que `verify-finding` lo acepte en vez de descartarlo.

## Evaluación

`evals/<nombre>/` trae un escenario por defecto conocido, con su `expected.json` y su README; los fixtures viven en
`tests/audit/fixtures/<nombre>/src`. `npm test -- tests/audit` verifica la mitad determinista;
la cognitiva se evalúa corriendo esta skill sobre cada fixture y comparando con `expected.json`
(resultados fechados en `evals/RESULTS.md`).
