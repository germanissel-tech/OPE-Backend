---
paths:
  - "tests/audit/**"
  - ".claude/skills/**"
  - "scripts/audit/**"
  - "audit.profile.json"
---

# Auditoría de arquitectura (ADR-032)

Las skills `auditing-architecture` y `conditioning-project` viven en `.claude/skills/`, como las de
spec-kit: versionadas con el repositorio, sin instalación global ni plugin (decisión del dueño,
2026-09-22). La primera es sólo el método: lo que es de este repo está en `audit.profile.json`
(alcances, gates, fuentes de verdad con su severidad, criterios, evals). Los gates hablan el
protocolo `findings-v1` por los adaptadores de `scripts/audit/gate-*.mjs`; agregar un gate es un
adaptador y una línea en el perfil; agregar una fuente de verdad, una línea en `sources[]`. Los
criterios de diseño están en `docs/auditoria/criterios-diseno.md`; las evaluaciones propias en
`tests/audit/evals/` (las universales viajan con la skill). Las skills no importan nada del repo
por ruta (`tests/audit/skills-isolation.test.ts`); llevarlas a otro proyecto es copiar los dos
directorios y escribir su perfil (`conditioning-project` lo hace).
