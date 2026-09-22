---
name: conditioning-project
description: Makes a repository auditable by the auditing-architecture skill, the way spec-kit's init makes it spec-driven. Inspects what the project already has (a constitution, ADRs, an agent guide, quality tools, gate adapters, the organisation of its source root, a git base), asks only what it cannot detect, writes audit.profile.json and the design criteria document pre-filled from the project's own sources (PLACEHOLDER where nothing was decided), marks every tool without a gate adapter as pending, and runs a doctor that says what is ready, what is missing and the verdict an audit could reach today. Idempotent; never overwrites a manual edit; never invents an owner's decision. Use when asked to condition, prepare, onboard or bootstrap a project for the audit, or when the audit reports that audit.profile.json is missing.
---

# Acondicionar un proyecto para la auditoría

Deja un repositorio —nuevo o existente— **auditable**: con un perfil que la skill
`auditing-architecture` puede leer, un documento de criterios de diseño con las fuentes del
proyecto citadas, los adaptadores de gate que faltan marcados como pendientes, y un diagnóstico
que dice hasta dónde puede llegar una auditoría hoy. No instala herramientas de calidad ni
inventa decisiones: detecta lo que hay, pregunta lo que no, y deja escrito lo que falta.

Los scripts se citan como `${SKILL}/scripts/...` (`${SKILL}` es el directorio de esta skill).

## Checklist

```
Conditioning progress:
- [ ] 1. Inspeccionado (inspect.mjs): fuentes, herramientas, adaptadores, módulos, base de diff
- [ ] 2. Preguntado sólo lo que inspect dejó en `questions[]` (AskUserQuestion, con la sugerencia)
- [ ] 3. Escrito (write-profile.mjs --answers): perfil, criterios prellenados, pendientes
- [ ] 4. Doctor corrido (doctor.mjs): tabla listo / falta / degradado y veredicto máximo
- [ ] 5. Reportado: qué se escribió, qué quedó pendiente y qué recomienda la skill
```

## Paso 1 — Inspeccionar

```bash
node ${SKILL}/scripts/inspect.mjs .
```

Devuelve JSON: `sources` (constitución de spec-kit, ADR, guía para agentes, specs: por
presencia), `tools` (ESLint, dependency-cruiser, jscpd, knip, Stryker, ruff, golangci-lint: por
archivo de configuración o dependencia, con el adaptador `scripts/audit/gate-<gate>.mjs` si ya
existe), `adapters` (los adaptadores presentes), `modules` (la regla de módulo inferida: los
anillos de `src/` que comparten nombres de módulo, ordenados por cuántos módulos tienen),
`sourceRoot`, `diffBase` (la rama por defecto del remoto), `existingProfile` y `questions[]`.
Nada que se detectó se pregunta; un perfil existente responde por sí mismo.

## Paso 2 — Preguntar sólo lo que falta

Por cada entrada de `questions[]`, una pregunta con `AskUserQuestion`: sus `options` y su
`suggested` como recomendación. Las tres posibles: `moduleRoots` (plantillas con `{name}`),
`blockingGates` (`all`, `none` o la lista), `diffBase`. Ninguna otra: lo demás se detecta o se
deja pendiente.

## Paso 3 — Escribir

```bash
node ${SKILL}/scripts/write-profile.mjs . --answers '{"moduleRoots":["src/{name}"],"blockingGates":"all","diffBase":"origin/main"}'
```

Escribe `audit.profile.json` (versión 1; los gates son los adaptadores presentes, con el modo y
los alcances que cada adaptador declara con `--describe` y la respuesta `blockingGates`; las
fuentes son las detectadas más una clase `<gate>:` por gate y `clarity:`; las respuestas quedan
en `conditioning.answers`; las herramientas sin adaptador en `conditioning.pending`) y
`docs/auditoria/criterios-diseno.md` desde `templates/criterios-diseno.template.md`: por
criterio, las secciones de la constitución y los ADR cuyos títulos coinciden con sus palabras
clave como fuente citada, y `PLACEHOLDER` donde no hay nada. Idempotente: un archivo igual a lo
que se generaría se deja (`unchanged`); uno distinto (una edición del dueño) **no se pisa** y se
reporta (`differs …`). `--dry-run` imprime lo que escribiría.

Sin constitución ni ADR no los inventa: el perfil sale sin esas clases de fuente, el doctor las
lista como faltantes y el reporte recomienda `/speckit-constitution` (si spec-kit está) o un
directorio de ADR.

## Paso 4 — Doctor

```bash
node ${SKILL}/scripts/doctor.mjs .          # tabla legible; --json para la salida estructurada
```

Por gate: `ready` (lista sus reglas y responde `findings-v1` sobre una lista vacía) o `degraded`
con motivo. Por clase de fuente: `ready` (una resolución de muestra encuentra algo) o `missing`.
Criterios: `ready`, `degraded` (con `PLACEHOLDER`) o `missing`. Y el **veredicto máximo**:
`rejected` sólo si hay algún gate `blocking` listo o alguna fuente `high` lista; si no,
`changes-required`, y lo dice: sin fuentes de severidad alta una auditoría no puede rechazar
nada.

## Paso 5 — Reporte

Qué se escribió (o qué difiere y se conservó), qué quedó pendiente (adaptadores por escribir,
`PLACEHOLDER` por decidir, fuentes que faltan) y qué hacer con cada cosa. Sin cifras
decorativas: la tabla del doctor es el estado.

## Prohibido

- Instalar o configurar herramientas de calidad (eso es un scaffold aparte, opt-in).
- Escribir una constitución, un ADR o un criterio en nombre del dueño.
- Pisar un archivo que el dueño editó.
- Preguntar lo que `inspect` ya detectó.
