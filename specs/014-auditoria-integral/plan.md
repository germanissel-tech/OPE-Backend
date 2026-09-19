# Implementation Plan: Auditoría integral de ingeniería de software del backend (001–013)

**Branch**: `014-auditoria-integral` | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-auditoria-integral/spec.md`

## Summary

Auditar en modo lectura el backend construido por las features 001–013 (`main` en `8d12aa2`)
y producir un informe verificable: cada hallazgo con `file:line`, cita literal, fuente y
severidad derivada; gates citados como hechos; refutación antes de confirmar; sin
puntuaciones; estado global por regla fija. Sobre las seis dimensiones del handoff se pone en
primer plano lo que el dueño pidió: **lectura fina archivo por archivo** de los doce módulos
más `infrastructure` y `composition` con una **rúbrica de siete ejes** con fuente citable, un
**contraste documentación ↔ código**, y una **matriz de cumplimiento funcional** que da a cada
afirmación DECIDIDA su prueba o su hueco. El trabajo se organiza en **seis fases** (0–5) con
cierre verificable; `tasks.md` es la traza; cada fase termina con un commit en la rama; el PR
se abre al final.

## Technical Context

**Language/Version**: sin cambio (Node.js 22, TypeScript 7 / API 6); la feature no escribe
código.

**Primary Dependencies**: la skill `auditing-architecture` tal como está (`run-gates.mjs`,
`verify-finding.mjs`, `criterios-diseno.md`, `refutacion.md`, `formato-hallazgo.md`); los
comandos del repo (`contract:check`, `quality`, `typecheck`, `test`, `build`, `test:contract`,
`test:mutation -- --all`, `check:markers`); `git` para anclar el alcance.

**Storage**: archivos Markdown y JSON en `specs/014-auditoria-integral/` y
`docs/auditoria/` (informe y `trabajo/`), commiteados por fase en la rama.

**Testing**: la verificación de esta feature es mecánica y documental: `verify-finding.mjs`
sobre todos los hallazgos (SC-001); `git diff --stat main` limitado a los dos directorios
(SC-006); las comprobaciones de completitud de SC-002/SC-003 se hacen con la traza
(`tasks.md`) y con la lista de afirmaciones (`trabajo/afirmaciones.md`); `check:markers` sigue
pasando (el informe no introduce marcadores bloqueantes).

**Target Platform**: sin cambio · **Project Type**: auditoría documental sobre un web-service
contract-first

**Performance Goals**: N/A. Duración estimada: 11 sesiones (R-01).

**Constraints**: modo lectura (FR-001); anclaje a `8d12aa2`; los documentos del MVP se leen
desde `..`; la mutación completa corre en segundo plano y puede no terminar en la sesión que
la lanza (R-06); el informe no usa las palabras marcador `ABIERTO`/`PLACEHOLDER` (R-08).

**Scale/Scope**: 12 módulos + 2 directorios; 176 archivos en `src/` (cifra del handoff, se
verifica en fase 0); 29 ADRs; 3 documentos del MVP; 13 specs con sus `FR`/`SC`; 10 principios;
12 sospechas; 7 ejes × 14 alcances.

## Constitution Check

| Gate                                            | ¿Aplica? | Cómo se cumple                                                                                                                                                          |
| ----------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Superficie HTTP / contrato                      | No       | No se toca `contracts/` (FR-001)                                                                                                                                        |
| Persistencia o API → aislamiento por merchant   | No       | Sin código; el aislamiento se **audita** en la fase 4 (constitución V, fila de la matriz)                                                                               |
| Plano de decisión → sin red, `NO_OP` con motivo | No       | Sin código; se audita en fases 2 y 4 (constitución II y IV)                                                                                                             |
| Ledger / cadena de evidencia                    | No       | Sin código; se audita en fase 4 (constitución IX, 01 §5)                                                                                                                |
| Campo nuevo de evento u orden / PII             | No       | Sin contrato; PII en logs y `detail` se audita en fase 3 (VII)                                                                                                          |
| LLM en runtime                                  | No       | Nada nuevo; se audita que siga en cero (VIII)                                                                                                                           |
| `x-invariants` / sustantivo nuevo               | No       | Sin contrato ni glosario nuevos                                                                                                                                         |
| Toca `src/` → dirección de dependencias         | No       | `src/` no cambia (SC-006)                                                                                                                                               |
| Estado epistémico (DECIDIDO/PROPUESTO/ABIERTO)  | **Sí**   | Toda afirmación de la matriz cita el estado del documento fuente; un hallazgo `high` sólo nace de un DECIDIDO, una sección de la constitución o un ADR (FR-002, FR-012) |
| Decisiones transversales en `docs/adr/`         | **Sí**   | Esta feature no decide nada transversal; lo que el informe recomiende se propone, no se registra                                                                        |
| Sin cifras de estado en prosa viva              | **Sí**   | El informe es histórico y fechado (`2026-09-19`); las cifras que cita son las de esa fecha y se dicen como tales                                                        |
| Revisión de cumplimiento del PR                 | **Sí**   | El PR declara: ningún gate de código aplica; el diff toca sólo `specs/014-…` y `docs/auditoria/`                                                                        |

**Resultado pre-Phase 0**: PASA. **Post-Phase 1**: PASA (sin cambios de diseño que lo alteren).

## Project Structure

### Documentation (this feature)

```text
specs/014-auditoria-integral/
├── plan.md
├── research.md                 # R-01..R-09: decisiones de método con su justificación
├── data-model.md               # hallazgo, afirmación, sospecha, fase, módulo auditado, informe
├── quickstart.md               # cómo retomar una sesión y cómo verificar el cierre de cada fase
├── contracts/
│   ├── rubrica.md              # los siete ejes, sus preguntas y la fuente citable de cada uno
│   ├── informe-plantilla.md    # las siete secciones del informe y el cuadro por módulo
│   ├── avance-plantilla.md     # formato de docs/auditoria/trabajo/avance.md
│   └── afirmaciones-plantilla.md  # formato de la lista de afirmaciones DECIDIDAS
└── tasks.md                    # /speckit-tasks: la traza
```

### Source Code (repository root)

```text
docs/auditoria/
├── 2026-09-19-handoff-auditoria-integral.md      # entrada (existente, se commitea con la feature)
├── 2026-09-19-informe-auditoria-integral.md      # entregable, crece por fase
└── trabajo/
    ├── avance.md                                 # estado por fase; lo primero que lee cada sesión
    ├── afirmaciones.md                           # lista DECIDIDA con evidencia o hueco (fase 0 → 4)
    ├── gates/
    │   ├── global-<comando>.txt                  # salida cruda de cada comando global (fase 0)
    │   ├── mutation-full.json                    # reporte de mutación completa (fase 0/3)
    │   └── modulo-<nombre>.json                  # run-gates.mjs --json por alcance (fase 1)
    └── hallazgos/
        ├── fase-1.json … fase-4.json             # hallazgos por fase, verificados por script
        └── refutados.json                        # anexo consolidado (fase 5)

src/, contracts/, docs/adr/, CLAUDE.md, specs/001..013   # SÓLO LECTURA
```

**Structure Decision**: dos raíces. `specs/014-…` guarda el método (qué se hace y con qué
vara) y la traza; `docs/auditoria/` guarda el resultado y los datos crudos que lo sostienen.
Los hallazgos viven en JSON (formato de la skill) para que `verify-finding` los valide en
bloque y para que el informe los cite sin reescribirlos.

## Fases (resumen; el detalle operativo es `tasks.md`)

| Fase                                 | Cierra                                                                                                                         | Sección del informe | Sesiones |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------- | -------- |
| 0 Base                               | Lecturas base; comandos globales con salida guardada; mutación completa lanzada; `afirmaciones.md`; rúbrica fijada             | §1, §2 (global)     | 1        |
| 1 Lectura fina por módulo            | 14 alcances × (skill + lectura por rúbrica + contraste documental); `hallazgos/fase-1.json`; cuadro por módulo en borrador     | §2 (módulos), §3.A  | 4        |
| 2 Robustez                           | Preguntas §5.B del handoff; sospechas 1, 5, 6; `throw` que deberían ser `Result`; supuestos de instancia única con `file:line` | §3.B, §6 borrador   | 1        |
| 3 Seguridad, escalabilidad y pruebas | Preguntas §5.C/D/E; sospechas 9–12; los `Stryker disable` uno por uno contra el reporte completo                               | §3.C, §3.D, §3.E    | 1        |
| 4 Cumplimiento funcional             | Cada afirmación con evidencia o hueco; sospechas 2, 3, 4, 7, 8; `quickstart.md` de cada feature como fuente de desvíos         | §3.F, §4            | 3        |
| 5 Cierre                             | Refutación global; `verify-finding` sobre el conjunto; deduplicación; §5, §6, §7; cuadro por módulo final; relectura; PR       | §5, §6, §7          | 1        |

Cada fase termina con: sección(es) del informe redactadas, `avance.md` actualizado, tareas de
la fase marcadas en `tasks.md`, commit `docs(auditoria): fase N — …`, y un resumen al dueño con
la decisión de seguir.

## Complexity Tracking

Sin violaciones del Constitution Check. La única decisión de método que quedaba abierta
(R-03: cómo citar un documento del MVP o un `FR`/`SC` como fuente) la tomó el dueño: la
gramática de fuentes de la skill gana `mvp:` y `spec:` en un commit previo a la fase 0.
