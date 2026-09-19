# Informe — auditoría integral del backend de OPE (features 001–013)

**Fecha**: 2026-09-19 · **Alcance**: `main` en `8d12aa2` · **Método**:
`specs/014-auditoria-integral/` · **Estado global**: (pendiente: fase 5)

Cómo leer este informe: cada hallazgo `F-NNN` trae `file:line`, cita literal, regla con su
fuente, severidad derivada de la fuente (constitución, ADR, sección DECIDIDA del MVP o `FR`/`SC`
de una spec ⇒ `high`; `CLAUDE.md`, lint, arch, shape ⇒ `medium`; claridad ⇒ `low`), propuesta
`before/after` y la prueba que lo cubriría. Todo hallazgo pasó por la refutación
(`.claude/skills/auditing-architecture/references/refutacion.md`) y por `verify-finding.mjs`;
los que no sobrevivieron están en §5 con su motivo. Los gates (§2) son hechos: se citan tal
cual. No hay puntuaciones; el estado global (§7) sale de una regla fija.

## 1. Alcance y método

**Anclaje**: la rama `014-auditoria-integral` nace de `main` en `8d12aa2` (PR #22, feature 013)
y sólo escribe en `specs/014-auditoria-integral/` y `docs/auditoria/`; el código auditado es el
de ese commit. Único cambio de herramienta en la rama: `ee6ac73`, que agrega a
`verify-finding` las fuentes `mvp:` y `spec:` (decisión del dueño, R-03) para que un hallazgo
funcional cite la sección del documento del MVP o el `FR`/`SC` de la spec y se verifique igual
que los demás.

**Método**: `specs/014-auditoria-integral/` (spec, plan, research R-01..R-09, rúbrica de siete
ejes en `contracts/rubrica.md`, traza en `tasks.md`). Seis fases: base, lectura fina por
alcance (15 alcances × 7 ejes con contraste documental), robustez, seguridad/escalabilidad/
pruebas, cumplimiento funcional, cierre. Cada fase deja sus hallazgos en
`trabajo/hallazgos/fase-N.json`, verificados por `verify-finding.mjs`, y una sección de este
informe.

**Qué se leyó en la fase 0** (2026-09-19, sesión 1): `.specify/memory/constitution.md` (v1.2.0),
`CLAUDE.md`, los 29 ADRs, `../01-arquitectura-mvp.md`, `../02-integracion-ecommerce.md`,
`../03-alcance-mvp.md`, `contracts/api-map.yaml`, `CONTEXT_MAP` de `.dependency-cruiser.cjs`.
De ahí salió `trabajo/afirmaciones.md`: 479 afirmaciones (51 de la constitución, 22 de `01`,
9 de `02`, 17 de `03`, 380 `FR`/`SC` de las specs 001–013) que la fase 4 resuelve una por una,
y 10 enunciados `PROPUESTO`/`ABIERTO` listados aparte porque no generan `high`.

**Qué se corrió**: los comandos de §2.1, con su salida cruda en `trabajo/gates/`. La mutación
completa (`test:mutation -- --all`) se lanzó en segundo plano al cierre de la fase 0; su reporte
se usa en la fase 3 (`trabajo/gates/mutation-full.json`).

**Cifras del alcance en `8d12aa2`** (históricas, contadas en la fase 0): `src/` tiene 175
archivos `.ts` más 1 generado (`domain` 60, `application` 53, `interface-adapters` 31,
`infrastructure` 6, `composition` 24, `main.ts`); por módulo: `shared-kernel` 17, `system` 7,
`merchant` 15, `ledger` 16, `experiment` 11, `ingestion` 13, `catalog` 13, `barrier` 9,
`selection` 4, `commercial` 4, `decision` 18, `outcomes` 18. `tests/` tiene 124 archivos
`*.test.ts` y 3 `*.test-d.ts` (el handoff dice "259 archivos de prueba": cuenta también
fixtures y helpers). 29 ADRs, 59 notas de glosario, 7 operaciones construidas de 23 en el mapa.

**Qué no se pudo verificar**: nada hasta ahora; los tres documentos del MVP son legibles desde
la sesión. (Se completa en la fase 5.)

**Cómo leer un hallazgo**: ver la cabecera. Un hallazgo con fuente `mvp:` o `spec:` cita una
sección DECIDIDA o un requisito de una spec aprobada; la severidad la impone la fuente, no el
auditor.

## 2. Gates (hechos)

### 2.1 Globales

Corridos el 2026-09-19 sobre `8d12aa2` (Node v22.23.2, npm 11.10.0, Windows 11). Salida cruda
en `trabajo/gates/global-<comando>.txt`.

| Comando                          | Resultado                                                                                                                                                                                                                                               | Salida                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `npm run contract:check`         | exit 0 — lint, bundle, diff contra `origin/main`, tipos sin drift, invariantes, glosario, ADRs (29, 531 citas, ninguna rota), marcadores (0 abiertos, 2 propuestos), idioma (0 excepciones)                                                             | `global-contract-check.txt` |
| `npm run quality`                | exit 0 — 5 gates verdes: lint (excepciones en línea: 0, `global-lint-exceptions.txt`), arch, duplicación (0 clones en `src/`; 30 informativos en `tests/`+`scripts/`), código muerto (0 bloqueantes; 159 tipos exportados sin uso, informativo), idioma | `global-quality.txt`        |
| `npm run typecheck`              | exit 0                                                                                                                                                                                                                                                  | `global-typecheck.txt`      |
| `npm test`                       | exit 0 — 120 archivos, 1004 pruebas, 147 s                                                                                                                                                                                                              | `global-test.txt`           |
| `npm run build`                  | exit 0                                                                                                                                                                                                                                                  | `global-build.txt`          |
| `npm run test:contract`          | exit 0 — Schemathesis: 2433 casos generados, 2433 pasados, 72 omitidos; aviso "schema validation mismatch" en 5 operaciones (`POST /v1/events`, `/v1/exposures`, `/v1/orders`, `/v1/returns`, `PUT /v1/catalog`) → S-09, fase 3                         | `global-test-contract.txt`  |
| `npm run check:markers`          | exit 0 — 0 abiertos, 2 propuestos (ADR-020), 0 placeholders                                                                                                                                                                                             | `global-markers.txt`        |
| `npm run test:mutation -- --all` | lanzado en segundo plano al cierre de la fase 0; resultado en la fase 3                                                                                                                                                                                 | `mutation-full.log/.json`   |

Dos cifras informativas que las fases 1 y 3 retoman: los 159 tipos exportados que nadie
importa y los 30 clones en `tests/`+`scripts/`.

### 2.2 Por alcance

(pendiente: fase 1)

## 3. Hallazgos confirmados

### 3.A Clean architecture, SOLID y lectura fina

(pendiente: fase 1)

#### Cuadro por módulo

(pendiente: fase 1; final en fase 5)

### 3.B Robustez

(pendiente: fase 2)

### 3.C Escalabilidad y camino a la 017

(pendiente: fase 3)

### 3.D Seguridad

(pendiente: fase 3)

### 3.E Calidad de las pruebas

(pendiente: fase 3)

### 3.F Cumplimiento funcional

(pendiente: fase 4)

## 4. Matriz de cumplimiento

### 4.1 Constitución I–X

(pendiente: fase 4)

### 4.2 Criterios de aceptación de 03 §10

(pendiente: fase 4)

### 4.3 Documentos del MVP

(pendiente: fase 4)

### 4.4 Specs 001–013

(pendiente: fase 4)

## 5. Refutados (anexo)

(pendiente: fase 5)

## 6. Riesgos para la 014–017

(pendiente: fases 2–3; cierre en fase 5)

## 7. Estado global

(pendiente: fase 5)
