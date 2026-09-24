# docs/ — decisiones, lenguaje y auditorías

Lo que el repositorio decide y cómo lo nombra. Todo en castellano (ADR-015). Las fuentes de
verdad, en orden, son la constitución (`.specify/memory/constitution.md`), los documentos del MVP
(fuera del repo), las specs (`specs/`) y el contrato (`contracts/`); este directorio registra las
decisiones transversales que esas fuentes toman (ADR-009), el glosario que las traduce al contrato
(ADR-008) y las auditorías que las revisan. Los documentos de la API publicada se generan y no se
commitean (`docs/api/`, ignorado por git; `npm run contract:docs`).

## Inventario

| Entrada      | Qué es                                                                                                                                                                                            | Fuente o derivado | Quién lo lee                                                             | Verificación                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `adr/`       | Registro de decisiones de arquitectura: un archivo por decisión con frontmatter (`numero`, `titulo`, `estado`, `fecha`, `fuente`); su README explica estados y plantilla.                         | fuente            | toda persona o agente; los `research.md` de las features citan `ADR-NNN` | `check:adrs` (frontmatter y citas), `check:identifiers` (lo citado existe)        |
| `deudas.md`  | Registro de deudas técnicas: lo que se sabe que falta, con su estado y dónde se cerró. Vive acá y no dentro de una spec porque **recibe filas de features que todavía no existen** (feature 026). | fuente            | toda persona o agente que pregunta qué queda pendiente                   | `check:markers` y `check:identifiers` (lee `docs/`), `tests/docs/readmes.test.ts` |
| `auditoria/` | `criterios-diseno.md` (lo que `audit.profile.json` nombra en `criteria`; la skill lo lee entero) y los informes y handoffs fechados de cada auditoría integral.                                   | fuente            | la skill de auditoría (criterios), el dueño (informes)                   | `check:markers`; la skill de auditoría (feature 019)                              |
| `dominio/`   | Glosario del lenguaje ubicuo: una nota por término (`es`, `en`, `contexto`, `estado`, `fuente`, `uso`), `eventos/` para el vocabulario de eventos y `_tecnicos.json` para los técnicos.           | fuente            | `check:glossary`; quien escribe contrato o código                        | `check:glossary` (todo sustantivo del contrato resuelve; toda nota con fuente)    |
