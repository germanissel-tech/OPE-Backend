# Data model — Auditoría integral (014)

Entidades de la auditoría. Ninguna es código: viven en Markdown y JSON bajo
`docs/auditoria/trabajo/` y en el informe.

## Hallazgo (`hallazgos/fase-N.json`, formato de la skill)

| Campo          | Tipo / regla                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | `F-NNN`, único en toda la auditoría (numeración continua entre fases; la fase 5 deduplica conservando el menor)                   |
| `file`, `line` | ruta relativa con `/` y línea existente en `8d12aa2`                                                                              |
| `rule.id`      | slug corto del criterio (`comment-contradicts-code`, `throw-for-business-rule`, …)                                                |
| `rule.source`  | `ADR-NNN` · `constitution#<sección>` · `guide#<sección>` · `lint:` · `arch:` · `shape:` · `clarity:<slug>` (y lo que decida R-03) |
| `severity`     | derivada de la fuente: ADR/constitución/DECIDIDO del MVP ⇒ `high`; `guide#`/lint/arch/shape ⇒ `medium`; `clarity:` ⇒ `low`        |
| `evidence`     | cita literal ≤ 20 líneas                                                                                                          |
| `proposal`     | `{ before, after }` en código                                                                                                     |
| `coveringTest` | prueba que lo cubriría (ruta y nombre)                                                                                            |
| `status`       | `proposed` → `confirmed` \| `refuted` (+ `refutation`)                                                                            |
| `dimension`    | `A` … `F` (campo del informe, no del esquema: se lleva en el nombre de sección y en `rule.id`)                                    |
| `axis`         | eje de la rúbrica (1–7) para los hallazgos de la fase 1 (idem: en `rule.id`, prefijo `axis-N-`)                                   |

Relaciones: un hallazgo nace en una fase; puede cerrar una **sospecha**; puede ser la
evidencia de un hueco de una **afirmación**.

## Afirmación (`afirmaciones.md`)

| Campo     | Regla                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------ |
| `id`      | `A-NNN`                                                                                                |
| origen    | `constitution#<principio>` · `01 §n.m` · `02 §n.m` · `03 §n.m` · `spec:NNN FR-nnn` · `spec:NNN SC-nnn` |
| estado    | `DECIDIDO` (o MUST) · `PROPUESTO` · `ABIERTO` — sólo el primero puede producir `high`                  |
| texto     | enunciado abreviado, con cita si es corta                                                              |
| evidencia | prueba o gate (ruta y nombre) · **hueco** (qué faltaría probar) · `F-NNN` si el código la contradice   |
| fase      | en la que se cerró (0 = extraída; 4 = resuelta)                                                        |

## Sospecha (handoff §6)

`S-01` … `S-12`; veredicto `confirmada` (con `F-NNN`) o `refutada` (con motivo); fase en la
que se resolvió (2, 3 o 4 según su naturaleza; ver `tasks.md`).

## Fase

| Campo    | Regla                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------- |
| número   | 0–5                                                                                                 |
| objetivo | una frase                                                                                           |
| tareas   | las de `tasks.md` con su prefijo de fase                                                            |
| cierra   | secciones del informe                                                                               |
| commit   | `docs(auditoria): fase N — <resumen>`                                                               |
| estado   | `pendiente` · `en curso` (con la próxima tarea) · `cerrada` (con el hash del commit) en `avance.md` |

## Módulo auditado (alcance de la fase 1)

| Campo                   | Regla                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| nombre                  | uno de los 12 módulos, `infrastructure`, `composition`                                            |
| archivos leídos         | lista completa en `avance.md` (dominio, aplicación, gateways, controllers, pruebas)               |
| gates                   | `gates/modulo-<nombre>.json`                                                                      |
| hallazgos por eje       | siete entradas (lista de `F-NNN` o "sin hallazgos"); es la fila del cuadro por módulo del informe |
| documentos contrastados | notas de glosario, ADRs, spec y quickstart citados                                                |

## Informe

Siete secciones en orden fijo (`contracts/informe-plantilla.md`) más el cuadro por módulo al
final de §3.A. El estado global (§7) se deriva de §2 y §3 por la regla fija y se recalcula en
la fase 5 (SC-004).
