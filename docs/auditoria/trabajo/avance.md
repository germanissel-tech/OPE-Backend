# Avance — auditoría integral (014)

**Anclaje**: `main` @ `8d12aa2` · **Rama**: `014-auditoria-integral` · **Traza**:
`specs/014-auditoria-integral/tasks.md` · **Método**: `specs/014-auditoria-integral/`

## Estado por fase

| Fase                                 | Estado    | Próxima tarea (tasks.md) | Commit de cierre |
| ------------------------------------ | --------- | ------------------------ | ---------------- |
| 0 Base                               | cerrada   | —                        | (ver git log)    |
| 1 Lectura fina                       | en curso  | T033 (`shared-kernel`)   | —                |
| 2 Robustez                           | pendiente | —                        | —                |
| 3 Seguridad, escalabilidad y pruebas | pendiente | —                        | —                |
| 4 Cumplimiento funcional             | pendiente | —                        | —                |
| 5 Cierre                             | pendiente | —                        | —                |

## Próximo paso exacto

T033: gates de `shared-kernel` (`run-gates.mjs --module shared-kernel --json`) y después la lectura por ejes de sus 17 archivos (`contracts/rubrica.md`).

## Entorno

Node v22.23.2 · npm 11.10.0 · Windows 11 · sesión con acceso a `..` (documentos del MVP
legibles: `01-arquitectura-mvp.md`, `02-integracion-ecommerce.md`, `03-alcance-mvp.md`).

Cambios fuera de `specs/014-…` y `docs/auditoria/` en esta rama: sólo `ee6ac73` (fuentes
`mvp:`/`spec:` en `verify-finding`, decisión del dueño, R-03). `git diff --stat main` excluyendo
esos cuatro directorios: vacío (T003, 2026-09-19).

## Lecturas hechas

- constitución v1.2.0: completa (sesión 1). Secciones citables: I–X, "Contrato de datos e identidad", "Stack y restricciones técnicas", "Flujo de desarrollo", "Governance".
- CLAUDE.md: completo (sesión 1). `guide#` citables: "Flujo de trabajo", "Comandos", "Anillos y módulos", "Cómo se escribe un caso de uso", "Cómo se escribe una entidad", "Gates de calidad", "Tipado", "Notas operativas del contrato", "Documentación viva", "Reglas que fallan el build", "Convenciones".
- ADRs 001–029: completos (sesión 1). Reemplazados: 005 (→018), 006 (→013). Con enmiendas/precisiones: 003, 013 (puntos 1–6), 020, 021, 022, 023, 024, 025, 026.
- MVP: `01` completo (§0–§14 y anexo); `02` completo; `03` §4–§12 (§1–§3 no están en el alcance de cumplimiento). Sesión 1.
- api-map (consumidores, 9 features planificadas 010–018, 7 operaciones built / 23) y `CONTEXT_MAP` (12 módulos): sesión 1.
- specs (spec + quickstart): FR/SC extraídos de las 13 specs (sesión 1); la lectura de los quickstarts es de la fase 4.

### Observaciones anotadas durante la fase 0 (candidatas a hallazgo; se resuelven en su fase, no acá)

- `CLAUDE.md` § Anillos y módulos, párrafo "Composición": la frase "y, en modo real, falla si el contrato declara…" quedó pegada a la de `readConfig` y "modo real" ya no existe (ADR-018); la misma afirmación aparece dos veces en el párrafo. → fase 1, alcance `composition`, eje 7.
- `docs/adr/013` enmienda: el punto 3 dice "en modo real" (ADR-018 retiró los modos) y el punto 6 quedó pegado al párrafo de cierre del punto 5 (formato). → fase 1, alcance `composition`, eje 7.
- Handoff §2 dice "259 archivos de prueba"; contados: 124 `*.test.ts` + 3 `*.test-d.ts` (el resto son fixtures y helpers). Cifra histórica, no hallazgo.
- `check:dead-code` informa 159 tipos exportados sin uso; `check:duplication` informa 30 clones en `tests/`+`scripts/`. → fase 1 (eje 3/6 por módulo) y fase 3 (E).

## Comandos corridos

| Comando                                  | Fecha                                | Salida                                           | Resumen                                                                                      |
| ---------------------------------------- | ------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `npm ci`                                 | 2026-09-19                           | —                                                | Node v22.23.2, npm 11.10.0                                                                   |
| `npm run contract:check`                 | 2026-09-19                           | `gates/global-contract-check.txt`                | exit 0; ADRs 29/531 citas; markers 0/2/0; language 0                                         |
| `npm run quality`                        | 2026-09-19                           | `gates/global-quality.txt`                       | exit 0; 5 gates; 0 clones src, 30 informativos tests+scripts; 159 tipos sin uso informativos |
| `node scripts/check-lint-exceptions.mjs` | 2026-09-19                           | `gates/global-lint-exceptions.txt`               | `Lint exceptions: 0`                                                                         |
| `npm run typecheck`                      | 2026-09-19                           | `gates/global-typecheck.txt`                     | exit 0                                                                                       |
| `npm test`                               | 2026-09-19                           | `gates/global-test.txt`                          | exit 0; 120 archivos, 1004 pruebas, 147 s                                                    |
| `npm run build`                          | 2026-09-19                           | `gates/global-build.txt`                         | exit 0 (dist/ de 8d12aa2)                                                                    |
| `npm run test:contract`                  | 2026-09-19                           | `gates/global-test-contract.txt`                 | exit 0; 2433/2433; mismatch en 5 operaciones (S-09)                                          |
| `npm run check:markers`                  | 2026-09-19                           | `gates/global-markers.txt`                       | 0 abiertos, 2 propuestos, 0 placeholders                                                     |
| `npm run test:mutation -- --all`         | 2026-09-19 (lanzado 14:31, en curso) | `gates/mutation-full.log` → `mutation-full.json` | pendiente (fase 3)                                                                           |
| rúbrica: 30 fuentes por `verify-finding` | 2026-09-19                           | —                                                | 30/30 resuelven (T030)                                                                       |

## Módulos (fase 1)

| Alcance | Gates | Archivos leídos | Hallazgos por eje (1–7) | Contraste documental |
| ------- | ----- | --------------- | ----------------------- | -------------------- |

### Archivos leídos por alcance

(se completa en la fase 1)

## Sospechas (handoff §6)

| S    | Fase | Veredicto | F-NNN / motivo |
| ---- | ---- | --------- | -------------- |
| S-01 | 2    | —         |                |
| S-02 | 4    | —         |                |
| S-03 | 4    | —         |                |
| S-04 | 4    | —         |                |
| S-05 | 2    | —         |                |
| S-06 | 2    | —         |                |
| S-07 | 4    | —         |                |
| S-08 | 4    | —         |                |
| S-09 | 3    | —         |                |
| S-10 | 3    | —         |                |
| S-11 | 3    | —         |                |
| S-12 | 3    | —         |                |

## Dudas planteadas al dueño y respuestas

| Fecha      | Duda                                                                                      | Respuesta                                                                               | Efecto                                                     |
| ---------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 2026-09-19 | ¿Tratar la auditoría como feature 014 (corre la numeración de `api-map`)?                 | Sí                                                                                      | `specs/014-auditoria-integral/`, rama homónima             |
| 2026-09-19 | ¿Commitear el avance por fase en la rama?                                                 | Sí                                                                                      | un commit por fase; PR al final; nada a `main` sin pedirlo |
| 2026-09-19 | ¿Reportar al cierre de cada fase?                                                         | Sí; dudas una a una a medida que surjan                                                 | resumen por fase                                           |
| 2026-09-19 | ¿Cómo citar un documento del MVP o un `FR`/`SC` como fuente para `verify-finding`? (R-03) | Opción 1: ampliar la gramática de la skill (`mvp:`, `spec:`), commit previo a la fase 0 | `ee6ac73`                                                  |

## Notas de sesión

- 2026-09-19 (sesión 1): spec, plan, tasks y extensión de fuentes commiteados (`ee6ac73`,
  `f127179`). Fase 0 completa: lecturas base, comandos globales (todos exit 0), `afirmaciones.md`
  (479 filas), rúbrica confirmada, informe §1 y §2.1. Mutación completa lanzada en segundo plano
  (si esta sesión termina antes, la próxima copia `reports/mutation/report.json` a
  `gates/mutation-full.json` y anota la duración del log).
