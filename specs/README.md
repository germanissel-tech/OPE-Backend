# specs/ — una carpeta por feature

El flujo de trabajo es spec-kit y es inamovible: `/speckit-specify` → `/speckit-plan` →
`/speckit-tasks` → `/speckit-implement`. Nada se implementa sin spec ni plan, y todo plan pasa
el Constitution Check contra `.specify/memory/constitution.md`. Cada feature tiene un directorio
numerado con su `spec.md` (qué y por qué), `plan.md` (cómo, con el Constitution Check),
`research.md` (decisiones con evidencia, citando ADR), `data-model.md`, `quickstart.md` (cómo
verificarla, con la sección "Cambios respecto del plan" fechada), `tasks.md` y `checklists/`; a
veces `contracts/` con los contratos internos del diseño. Son documentos **históricos**: cuentan
lo que se decidió cuando se decidió; lo vigente está en el código, el contrato, los ADR y
`CLAUDE.md`. Las cifras que traen son de su fecha.

## Inventario

| Entrada         | Qué es                                                                                              | Fuente o derivado | Quién lo lee                                                               | Verificación                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `NNN-<nombre>/` | Una feature: spec, plan, research, data-model, quickstart, tasks, checklists; a veces `contracts/`. | fuente            | spec-kit (`.specify/feature.json` apunta a la activa), los ADR (`fuente:`) | `check:markers` (`ABIERTO`, `PROPUESTO`, `PLACEHOLDER`), `check:adrs` (citas), `check:api-map` (features del mapa con directorio) |
