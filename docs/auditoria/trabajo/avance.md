# Avance — auditoría integral (014)

**Anclaje**: `main` @ `8d12aa2` · **Rama**: `014-auditoria-integral` · **Traza**:
`specs/014-auditoria-integral/tasks.md` · **Método**: `specs/014-auditoria-integral/`

## Estado por fase

| Fase                                 | Estado    | Próxima tarea (tasks.md) | Commit de cierre |
| ------------------------------------ | --------- | ------------------------ | ---------------- |
| 0 Base                               | cerrada   | —                        | (ver git log)    |
| 1 Lectura fina                       | en curso  | T093 (`experiment`)      | —                |
| 2 Robustez                           | pendiente | —                        | —                |
| 3 Seguridad, escalabilidad y pruebas | pendiente | —                        | —                |
| 4 Cumplimiento funcional             | pendiente | —                        | —                |
| 5 Cierre                             | pendiente | —                        | —                |

## Próximo paso exacto

T093: gates de `experiment` y lectura por ejes de sus 11 archivos; siguen `ingestion`, `catalog`, `barrier`, `selection`, `commercial`, `decision`, `ledger`, `outcomes` y las transversales T166–T171.

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
- Precisión de la rúbrica (ejes 2 y 7, sesión 2): prosa o comentario que describe una decisión ya retirada (un modo, un ADR reemplazado, un número de feature equivocado) es `guide#Documentación viva` (`medium`); `high` con el ADR queda para cuando un documento afirma una **regla distinta** de la que el código aplica. Aplicado en F-008, F-011, F-014, F-015.
- Herramienta (sesión 2): `run-gates.mjs --dir src/interface-adapters/http` lintea `generated/api.d.ts` porque pasa los archivos con `--no-ignore` (para poder linterar fixtures); `npm run lint` lo ignora por configuración. Es un falso `fail` del gate en ese alcance, no del código; propuesta para la skill (fuera de esta auditoría): aplicar `--no-ignore` sólo bajo `tests/*/fixtures/`.
- Precisión de la rúbrica (eje 7, sesión 2): `ADR-008` es fuente `high` sólo cuando un término del glosario existe y el código usa otro o cuando un sustantivo del contrato no tiene nota; una nota **desactualizada** (describe una forma anterior del concepto) no viola ADR-008 (que exige nota, fuente y cita) y va como `clarity:stale-glossary-note` (`low`). Aplicado en F-005.
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

| Alcance         | Gates                                                                                                                                                                | Archivos leídos                       | Hallazgos por eje (1–7)                                                                    | Contraste documental                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| system          | `gates/modulo-system.json`: 6 pass; dead-code informa 4 tipos                                                                                                        | 7 src + 1 test                        | 1: — · 2: — · 3: — · 4: — · 5: — · 6: F-006 · 7: —                                         | spec 001 FR-047 ✓; ADR-024 (ServiceHealth como tipo) ✓                                                                                                                                    |
| merchant        | `gates/modulo-merchant.json`: 6 pass; dead-code informa 9 tipos                                                                                                      | 14 src + 6 tests                      | 1: — · 2: F-008 · 3: — · 4: — · 5: **F-007 (high)** · 6: — · 7: —                          | ADR-014/025/029 ✓ en código; ADR-024 §4 ✗ (F-007); glosario credencial-de-ingesta ✓; S-10 (`includes`) anotado para fase 3                                                                |
| http-compartido | `gates/modulo-http-compartido.json`: lint **fail sobre `generated/api.d.ts`** (artefacto de `run-gates --dir` + `--no-ignore`; `npm run lint` lo ignora), resto pass | 9 src (+ generated, client) + 5 tests | 1: — · 2: — · 3: F-009 (F-010 refutado) · 4: — · 5: — · 6: — · 7: —                        | ADR-001/002/020/023/025/029 ✓; réplicas capabilities/problem-types con prueba ✓                                                                                                           |
| infrastructure  | `gates/modulo-infrastructure.json`: 6 pass                                                                                                                           | 6 src + 3 unit + cors/logging-privacy | 1: — · 2: F-011 · 3: F-012 (S-06), F-013 · 4: (F-003 2ª ubicación) · 5: — · 6: — · 7: —    | ADR-014 (strip mapping) ✓, ADR-025 (headers desde el cableado) ✓, ADR-029 (rawBody) ✓; 01 §10.2 (logs sin IP/headers/body) ✓ con prueba                                                   |
| composition     | `gates/modulo-composition.json`: 6 pass; dead-code informa 2 tipos                                                                                                   | 24 src + 4 unit + bootstrap.test      | 1: — · 2: — · 3: — · 4: — · 5: (F-007 2ª ubicación: experimentos) · 6: — · 7: F-014, F-015 | ADR-013 enmienda ✓ en código, ✗ en prosa (F-015); ADR-018 ✓ en código, ✗ en CLAUDE.md (F-014); `*-config.ts` de políticas delegan reglas a `.of` ✓; merchants/experimentos no (F-007)     |
| shared-kernel   | `gates/modulo-shared-kernel.json`: 6 gates pass; dead-code informa 9 tipos exportados sin importador                                                                 | 17 src + 4 tests                      | 1: F-004 · 2: F-001 · 3: — · 4: F-003 · 5: — · 6: — (F-002 refutado) · 7: F-005            | glosario importe/intervencion/incentivo/no-op/brazo (intervencion desactualizada → F-005); ADR-023/024/025 ✓; CLAUDE.md § Notas operativas (réplicas NO_OP/anchors/barriers con prueba) ✓ |

### Archivos leídos por alcance

- system (sesión 2): `src/domain/system/{health,index}.ts`, `src/application/system/{index,ports/contract-info,use-cases/get-service-health.use-case}.ts`, `src/interface-adapters/http/controllers/system/get-health.ts`, `src/composition/modules/system.ts`; `tests/unit/health.test.ts`.
- merchant (sesión 2): `src/domain/merchant/{errors,index,merchant,origin,platform-signature}.ts`, `src/application/merchant/{index,policies/signature-window,ports/merchant-directory,ports/message-authenticator,services/ingest-key.service,services/platform-key.service,services/platform-signature.service}.ts`, `src/interface-adapters/gateways/merchant/{config-merchant-directory,node-message-authenticator}.ts`, `src/composition/modules/merchant.ts`; pruebas `tests/unit/domain/merchant/{merchant,platform-signature}.test.ts`, `tests/unit/application/merchant/{ingest-key,platform-key,platform-signature}.service.test.ts`, `tests/integration/platform-signature.test.ts` (nombres leídos).
- http-compartido (sesión 2): `src/interface-adapters/http/{boundary,client,problem-details,to-problem,typed}.ts`, `security/{capabilities,headers,ingest-key,platform-key}.ts`; pruebas `tests/unit/http/{capabilities,instant-guard,security-handlers,to-problem}.test.ts`, `tests/unit/problem-details.test.ts` (nombres leídos).
- infrastructure (sesión 2): `src/infrastructure/http/{build-server,cors,load-contract,request-logging,strip-discriminator-mappings}.ts`, `src/infrastructure/logging/pino-logger.ts`; pruebas `tests/unit/infrastructure/*.test.ts`, `tests/integration/{cors,logging-privacy}.test.ts` (nombres leídos).
- composition (sesión 2): `src/composition/{bootstrap,config,config-error,condition-config,coverage,decision-policy-config,commercial-policy-config,lifecycle,ports,profile,start,wiring}.ts`, `modules/*.ts` (13), `profiles/local.ts`, `src/main.ts` (config, condition-config, modules/decision, profiles/local, config-error leídos completos; el resto ya leído en la sesión que los escribió y releído por diff); pruebas `tests/unit/composition/*.test.ts`, `tests/integration/bootstrap.test.ts`.
- shared-kernel (sesión 2): `src/domain/shared-kernel/{arm,barrier,errors,ids,index,intervention,money,no-op-reasons,result,time}.ts`, `src/application/shared-kernel/{index,use-case}.ts`, `ports/{clock,logger}.ts`, `decorators/logged-use-case.ts`, `src/interface-adapters/gateways/shared-kernel/system-clock.ts`, `src/composition/modules/shared-kernel.ts`; pruebas `tests/unit/domain/shared-kernel/{errors,money,time}.test.ts`, `tests/unit/application/shared-kernel/logged-use-case.test.ts`; réplicas `tests/unit/{no-op-reasons,anchors,barriers}.test.ts` (existen).

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

- 2026-09-19 (sesión 2): fase 1, alcances `shared-kernel`, `system`, `merchant`, `http-compartido`, `infrastructure`, `composition` (T033–T092). Hallazgos F-001..F-015 (1 high, 5 medium, 7 low, 2 refutados) en `hallazgos/fase-1.json`, verificados. Mutación completa aún corriendo (76 % a las ~14:60).
- 2026-09-19 (sesión 1): spec, plan, tasks y extensión de fuentes commiteados (`ee6ac73`,
  `f127179`). Fase 0 completa: lecturas base, comandos globales (todos exit 0), `afirmaciones.md`
  (479 filas), rúbrica confirmada, informe §1 y §2.1. Mutación completa lanzada en segundo plano
  (si esta sesión termina antes, la próxima copia `reports/mutation/report.json` a
  `gates/mutation-full.json` y anota la duración del log).
