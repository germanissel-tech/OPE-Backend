---
description: "Traza de la auditoría integral (014): una tarea por unidad de trabajo, marcada al cerrarse"
---

# Tasks: Auditoría integral de ingeniería de software del backend (001–013)

**Input**: `specs/014-auditoria-integral/` (plan.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: rama `014-auditoria-integral` desde `main` @ `8d12aa2`; sesión con acceso a `..` (documentos del MVP); commit `ee6ac73` (fuentes `mvp:`/`spec:` en `verify-finding`, R-03).

**Tests**: no hay código; la verificación es mecánica y documental (`verify-finding`, `git diff --stat`, `check:markers`, cuentas de la traza). Ver `quickstart.md`.

**Organization**: por **fase de la auditoría** (0–5), que es como se ejecuta y se commitea. Cada tarea lleva la historia que sirve: US1 verificabilidad · US2 calidad fina por módulo · US3 cumplimiento funcional · US4 traza entre sesiones · US5 estado global y riesgos.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede hacerse en paralelo con las vecinas (archivos distintos, sin dependencia)
- **[Story]**: US1–US5 de `spec.md`
- Rutas exactas; `trabajo/` = `docs/auditoria/trabajo/`; `informe` = `docs/auditoria/2026-09-19-informe-auditoria-integral.md`

## Cómo se usa esta traza (US4)

1. Cada sesión: `cat docs/auditoria/trabajo/avance.md`, luego la primera `[ ]` de este archivo.
2. Una tarea se marca `[x]` sólo cuando su salida está escrita donde la tarea dice.
3. Al cerrar una fase: `quickstart.md` § "Verificar el cierre de una fase" y el commit `docs(auditoria): fase N — …`.
4. Una duda que cambie alcance o criterio: se plantea al dueño, se anota en `avance.md` § "Dudas", y recién entonces se sigue.

---

## Fase 0: Base (contexto, hechos globales, afirmaciones, rúbrica)

**Purpose**: dejar el terreno para que las fases 1–4 no repitan lecturas ni comandos, y fijar la vara antes de leer el primer archivo.

**Cierra**: informe §1 (borrador) y §2.1; `trabajo/afirmaciones.md`; `trabajo/avance.md`. Commit `docs(auditoria): fase 0 — base`.

### Estructura de trabajo

- [x] T001 [US4] Crear `docs/auditoria/trabajo/{gates,hallazgos}/` y `trabajo/avance.md` desde `specs/014-auditoria-integral/contracts/avance-plantilla.md` (anclaje `8d12aa2`, fase 0 en curso)
- [x] T002 [US4] Crear el informe `docs/auditoria/2026-09-19-informe-auditoria-integral.md` con las siete secciones de `contracts/informe-plantilla.md` marcadas `(pendiente: fase N)`; añadir el handoff existente al índice de git
- [x] T003 [US4] Verificar el aislamiento del alcance (SC-006): `git diff --stat main -- . ':!specs/014-auditoria-integral' ':!docs/auditoria' ':!.claude/skills/auditing-architecture' ':!tests/audit'` vacío; anotar en `avance.md` que el único cambio fuera de los dos directorios es el commit `ee6ac73` (R-03)

### Lecturas base (anotar cada una en `avance.md` § "Lecturas hechas")

- [x] T004 [P] [US3] Leer `.specify/memory/constitution.md` completa (I–X, contrato de datos, stack, flujo, governance) y anotar las secciones citables
- [x] T005 [P] [US2] Leer `CLAUDE.md` completo y anotar las secciones `guide#` citables (Anillos y módulos, Cómo se escribe un caso de uso, Cómo se escribe una entidad, Gates de calidad, Tipado, Documentación viva, Convenciones)
- [x] T006 [P] [US2] Leer `docs/adr/001..012` (contrato, gobernanza, lint, tipos) y anotar por ADR qué módulo o archivo lo cita
- [x] T007 [P] [US2] Leer `docs/adr/013..020` (anillos, SDK, idioma, gates, TS7, sin mock, mapa del contrato, consumidores) idem
- [x] T008 [P] [US2] Leer `docs/adr/021..029` (ledger, asignación, casos de uso, dominio rico, catálogo, políticas, selección, cadena de evidencia, firma) idem
- [x] T009 [P] [US3] Leer `../01-arquitectura-mvp.md` completo; anotar §4, §5, §6, §9, §10 y el estado (DECIDIDO/PROPUESTO/ABIERTO) de cada afirmación
- [x] T010 [P] [US3] Leer `../02-integracion-ecommerce.md` completo; anotar §4 y §5 idem
- [x] T011 [P] [US3] Leer `../03-alcance-mvp.md` completo; anotar §4.5, §4.7, §4.8, §4.11, §6, §10 idem
- [x] T012 [P] [US2] Leer `contracts/api-map.yaml` (consumidores, capacidades, operaciones built/planned) y `.dependency-cruiser.cjs` (`CONTEXT_MAP`) para fijar la lista de 12 módulos y sus dependencias permitidas

### Comandos globales (salida cruda a `trabajo/gates/global-<comando>.txt`; fila en `avance.md` § "Comandos corridos")

- [x] T013 [US1] `npm ci` (registrar versión de Node y npm en `avance.md`)
- [x] T014 [US1] `npm run contract:check` → `trabajo/gates/global-contract-check.txt`
- [x] T015 [P] [US1] `npm run quality` → `trabajo/gates/global-quality.txt`
- [x] T016 [P] [US1] `npm run typecheck` → `trabajo/gates/global-typecheck.txt`
- [x] T017 [P] [US1] `npm test` → `trabajo/gates/global-test.txt` (registrar el total de pruebas)
- [x] T018 [US1] `npm run build` y luego `npm run test:contract` → `trabajo/gates/global-test-contract.txt` (registrar casos generados y las operaciones con 'schema validation mismatch', S-09)
- [x] T019 [P] [US1] `npm run check:markers` → `trabajo/gates/global-markers.txt`
- [x] T020 [US1] Lanzar `npm run test:mutation -- --all` en segundo plano (borrar `reports/mutation/stryker-incremental.json` antes, gotcha del handoff); al terminar copiar `reports/mutation/report.json` a `trabajo/gates/mutation-full.json` y anotar duración y resultado (R-06)
- [x] T021 [US1] Contar y registrar en `avance.md`: archivos `.ts` en `src/` por anillo y por módulo, archivos de prueba en `tests/`, ADRs, notas de glosario — las cifras del handoff §2 se confirman o corrigen

### Afirmaciones DECIDIDAS (`trabajo/afirmaciones.md` desde `contracts/afirmaciones-plantilla.md`; R-07)

- [x] T022 [P] [US3] Extraer las afirmaciones de la constitución: principios I–X (cada MUST) y "Flujo de desarrollo" (pruebas por autoridad, end-to-end, contaminación cruzada) → `A-0xx`
- [x] T023 [P] [US3] Extraer las de `01` §4 (cinco autoridades), §4.3 (evidencia), §4.5 (política comercial), §5 (cadena de evidencia), §6 (identidades), §9 (garantías), §10 (privacidad), con estado
- [x] T024 [P] [US3] Extraer las de `02` §4 (catálogo) y §5 (correlación A/B/C), con estado
- [x] T025 [P] [US3] Extraer las de `03` §4.5, §4.7, §4.8, §4.11, §6 (D-A/D-B/D-C) y §10 (criterios de aceptación, uno por fila), con estado
- [x] T026 [P] [US3] Extraer `FR-`/`SC-` de `specs/001..005/spec.md` (una subtabla por feature; el `quickstart.md` de cada una como primera evidencia candidata)
- [x] T027 [P] [US3] Extraer `FR-`/`SC-` de `specs/006..009/spec.md` idem
- [x] T028 [P] [US3] Extraer `FR-`/`SC-` de `specs/010..013/spec.md` idem
- [x] T029 [US3] Listar aparte los enunciados `PROPUESTO`/`ABIERTO` encontrados (no generan `high`) y las doce sospechas del handoff §6 como `S-01..S-12` en `avance.md`

### Rúbrica e informe

- [x] T030 [US2] Confirmar `contracts/rubrica.md` contra lo leído: cada fuente citada existe en `8d12aa2` (secciones de `CLAUDE.md`, ADRs, reglas de lint/arch/shape); corregir la rúbrica si una fuente no existe — antes de leer el primer módulo
- [x] T031 [US1] Redactar informe §1 (alcance y método: qué se leyó, qué se corrió, qué no se pudo verificar, cómo leer un hallazgo) y §2.1 (gates globales: comando → resultado → archivo)
- [x] T032 [US4] Cierre de fase 0: `avance.md` (fase 0 cerrada, fase 1 en curso con su primera tarea), `quickstart.md` § cierre, commit `docs(auditoria): fase 0 — base`; resumen al dueño

**Checkpoint**: contexto completo, hechos globales guardados, vara fijada. Sin esto no se lee ningún módulo.

---

## Fase 1: Lectura fina por alcance (skill + rúbrica + contraste documental)

**Purpose**: US2 — cada alcance leído archivo por archivo con los siete ejes; US1 — hallazgos verificados.

**Cierra**: informe §2.2 y §3.A (con el cuadro por módulo en borrador); `trabajo/hallazgos/fase-1.json`. Commits por sesión: `docs(auditoria): fase 1 — <alcances>`.

**Procedimiento por alcance** (R-05): gates → lectura por ejes (anotar cada archivo leído en `avance.md` § "Archivos leídos por alcance") → contraste documental → hallazgos refutados y verificados → fila del cuadro. Orden sugerido: kernel y bordes primero, camino crítico después, medición al final.

### Alcance `shared-kernel` — ids, tiempo, reloj, logger

- [x] T033 [US1] Gates de `shared-kernel`: `run-gates.mjs --module shared-kernel --json` → `trabajo/gates/modulo-shared-kernel.json`; citar en informe §2.2
- [x] T034 [US2] `shared-kernel` eje 1 nombres sobre src/domain/shared-kernel/, src/application/shared-kernel/, src/interface-adapters/gateways/shared-kernel/, src/composition/modules/shared-kernel.ts y sus pruebas en `tests/` (términos del glosario, nombres que dicen qué deciden, abreviaturas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-1-`
- [x] T035 [US2] `shared-kernel` eje 2 comentarios sobre src/domain/shared-kernel/, src/application/shared-kernel/, src/interface-adapters/gateways/shared-kernel/, src/composition/modules/shared-kernel.ts y sus pruebas en `tests/` (encabezados con el porqué y la decisión, comentarios que repiten o mienten, idioma); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-2-`
- [x] T036 [US2] `shared-kernel` eje 3 tamaño y forma sobre src/domain/shared-kernel/, src/application/shared-kernel/, src/interface-adapters/gateways/shared-kernel/, src/composition/modules/shared-kernel.ts y sus pruebas en `tests/` (funciones de una lectura, una razón de cambio por archivo, booleanos que esconden dos funciones); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-3-`
- [x] T037 [US2] `shared-kernel` eje 4 tipos sobre src/domain/shared-kernel/, src/application/shared-kernel/, src/interface-adapters/gateways/shared-kernel/, src/composition/modules/shared-kernel.ts y sus pruebas en `tests/` (`Result`, uniones de literales, ids marcados, `of`/`rehydrate`, `as`, `| undefined` explícito); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-4-`
- [x] T038 [US2] `shared-kernel` eje 5 errores sobre src/domain/shared-kernel/, src/application/shared-kernel/, src/interface-adapters/gateways/shared-kernel/, src/composition/modules/shared-kernel.ts y sus pruebas en `tests/` (tipo y motivo en cada fallo, `throw` por regla de negocio, `catch` que traga, catálogo de problemas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-5-`
- [x] T039 [US2] `shared-kernel` eje 6 pruebas como documentación sobre src/domain/shared-kernel/, src/application/shared-kernel/, src/interface-adapters/gateways/shared-kernel/, src/composition/modules/shared-kernel.ts y sus pruebas en `tests/` (nombres que dicen la regla, pruebas acopladas a la implementación o al reloj, reglas sin prueba); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-6-`
- [x] T040 [US2] `shared-kernel` eje 7 documentación ↔ código sobre src/domain/shared-kernel/, src/application/shared-kernel/, src/interface-adapters/gateways/shared-kernel/, src/composition/modules/shared-kernel.ts y sus pruebas en `tests/` (glosario, ADRs citados, spec y quickstart de la feature, `CLAUDE.md`); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-7-`
- [x] T041 [US2] `shared-kernel` contraste documental: ADR-013, ADR-015, ADR-024; glosario `_tecnicos.json`; spec 004/008/009 — cada desvío es un hallazgo con las dos líneas y la severidad del documento (eje 7)
- [x] T042 [US1] `shared-kernel` refutación (`refutacion.md`) y `verify-finding.mjs trabajo/hallazgos/fase-1.json`; fila de `shared-kernel` en `avance.md` § Módulos (archivos leídos, hallazgos por eje) y en el cuadro por módulo del informe §3.A

### Alcance `system` — salud del servicio

- [x] T043 [US1] Gates de `system`: `run-gates.mjs --module system --json` → `trabajo/gates/modulo-system.json`; citar en informe §2.2
- [x] T044 [US2] `system` eje 1 nombres sobre src/domain/system/, src/application/system/, src/interface-adapters/http/controllers/system/, src/composition/modules/system.ts y sus pruebas en `tests/` (términos del glosario, nombres que dicen qué deciden, abreviaturas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-1-`
- [x] T045 [US2] `system` eje 2 comentarios sobre src/domain/system/, src/application/system/, src/interface-adapters/http/controllers/system/, src/composition/modules/system.ts y sus pruebas en `tests/` (encabezados con el porqué y la decisión, comentarios que repiten o mienten, idioma); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-2-`
- [x] T046 [US2] `system` eje 3 tamaño y forma sobre src/domain/system/, src/application/system/, src/interface-adapters/http/controllers/system/, src/composition/modules/system.ts y sus pruebas en `tests/` (funciones de una lectura, una razón de cambio por archivo, booleanos que esconden dos funciones); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-3-`
- [x] T047 [US2] `system` eje 4 tipos sobre src/domain/system/, src/application/system/, src/interface-adapters/http/controllers/system/, src/composition/modules/system.ts y sus pruebas en `tests/` (`Result`, uniones de literales, ids marcados, `of`/`rehydrate`, `as`, `| undefined` explícito); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-4-`
- [x] T048 [US2] `system` eje 5 errores sobre src/domain/system/, src/application/system/, src/interface-adapters/http/controllers/system/, src/composition/modules/system.ts y sus pruebas en `tests/` (tipo y motivo en cada fallo, `throw` por regla de negocio, `catch` que traga, catálogo de problemas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-5-`
- [x] T049 [US2] `system` eje 6 pruebas como documentación sobre src/domain/system/, src/application/system/, src/interface-adapters/http/controllers/system/, src/composition/modules/system.ts y sus pruebas en `tests/` (nombres que dicen la regla, pruebas acopladas a la implementación o al reloj, reglas sin prueba); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-6-`
- [x] T050 [US2] `system` eje 7 documentación ↔ código sobre src/domain/system/, src/application/system/, src/interface-adapters/http/controllers/system/, src/composition/modules/system.ts y sus pruebas en `tests/` (glosario, ADRs citados, spec y quickstart de la feature, `CLAUDE.md`); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-7-`
- [x] T051 [US2] `system` contraste documental: ADR-013; spec 001 — cada desvío es un hallazgo con las dos líneas y la severidad del documento (eje 7)
- [x] T052 [US1] `system` refutación (`refutacion.md`) y `verify-finding.mjs trabajo/hallazgos/fase-1.json`; fila de `system` en `avance.md` § Módulos (archivos leídos, hallazgos por eje) y en el cuadro por módulo del informe §3.A

### Alcance `merchant` — merchant, credenciales, orígenes, firma de plataforma, políticas por merchant

- [x] T053 [US1] Gates de `merchant`: `run-gates.mjs --module merchant --json` → `trabajo/gates/modulo-merchant.json`; citar en informe §2.2
- [x] T054 [US2] `merchant` eje 1 nombres sobre src/domain/merchant/, src/application/merchant/, src/interface-adapters/gateways/merchant/, src/composition/modules/merchant.ts y sus pruebas en `tests/` (términos del glosario, nombres que dicen qué deciden, abreviaturas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-1-`
- [x] T055 [US2] `merchant` eje 2 comentarios sobre src/domain/merchant/, src/application/merchant/, src/interface-adapters/gateways/merchant/, src/composition/modules/merchant.ts y sus pruebas en `tests/` (encabezados con el porqué y la decisión, comentarios que repiten o mienten, idioma); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-2-`
- [x] T056 [US2] `merchant` eje 3 tamaño y forma sobre src/domain/merchant/, src/application/merchant/, src/interface-adapters/gateways/merchant/, src/composition/modules/merchant.ts y sus pruebas en `tests/` (funciones de una lectura, una razón de cambio por archivo, booleanos que esconden dos funciones); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-3-`
- [x] T057 [US2] `merchant` eje 4 tipos sobre src/domain/merchant/, src/application/merchant/, src/interface-adapters/gateways/merchant/, src/composition/modules/merchant.ts y sus pruebas en `tests/` (`Result`, uniones de literales, ids marcados, `of`/`rehydrate`, `as`, `| undefined` explícito); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-4-`
- [x] T058 [US2] `merchant` eje 5 errores sobre src/domain/merchant/, src/application/merchant/, src/interface-adapters/gateways/merchant/, src/composition/modules/merchant.ts y sus pruebas en `tests/` (tipo y motivo en cada fallo, `throw` por regla de negocio, `catch` que traga, catálogo de problemas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-5-`
- [x] T059 [US2] `merchant` eje 6 pruebas como documentación sobre src/domain/merchant/, src/application/merchant/, src/interface-adapters/gateways/merchant/, src/composition/modules/merchant.ts y sus pruebas en `tests/` (nombres que dicen la regla, pruebas acopladas a la implementación o al reloj, reglas sin prueba); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-6-`
- [x] T060 [US2] `merchant` eje 7 documentación ↔ código sobre src/domain/merchant/, src/application/merchant/, src/interface-adapters/gateways/merchant/, src/composition/modules/merchant.ts y sus pruebas en `tests/` (glosario, ADRs citados, spec y quickstart de la feature, `CLAUDE.md`); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-7-`
- [x] T061 [US2] `merchant` contraste documental: ADR-014, ADR-020, ADR-025, ADR-026, ADR-029; glosario merchant/credencial/firma-de-plataforma; specs 004/010/011/013 — cada desvío es un hallazgo con las dos líneas y la severidad del documento (eje 7)
- [x] T062 [US1] `merchant` refutación (`refutacion.md`) y `verify-finding.mjs trabajo/hallazgos/fase-1.json`; fila de `merchant` en `avance.md` § Módulos (archivos leídos, hallazgos por eje) y en el cuadro por módulo del informe §3.A

### Alcance `http-compartido` — borde HTTP común: seguridad, Problem Details, tipos generados, cliente

- [x] T063 [US1] Gates de `http-compartido`: `run-gates.mjs --dir src/interface-adapters/http --json` → `trabajo/gates/modulo-http-compartido.json`; citar en informe §2.2
- [x] T064 [US2] `http-compartido` eje 1 nombres sobre src/interface-adapters/http/{boundary,to-problem,problem-details,typed,client}.ts y security/ y sus pruebas en `tests/` (términos del glosario, nombres que dicen qué deciden, abreviaturas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-1-`
- [x] T065 [US2] `http-compartido` eje 2 comentarios sobre src/interface-adapters/http/{boundary,to-problem,problem-details,typed,client}.ts y security/ y sus pruebas en `tests/` (encabezados con el porqué y la decisión, comentarios que repiten o mienten, idioma); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-2-`
- [x] T066 [US2] `http-compartido` eje 3 tamaño y forma sobre src/interface-adapters/http/{boundary,to-problem,problem-details,typed,client}.ts y security/ y sus pruebas en `tests/` (funciones de una lectura, una razón de cambio por archivo, booleanos que esconden dos funciones); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-3-`
- [x] T067 [US2] `http-compartido` eje 4 tipos sobre src/interface-adapters/http/{boundary,to-problem,problem-details,typed,client}.ts y security/ y sus pruebas en `tests/` (`Result`, uniones de literales, ids marcados, `of`/`rehydrate`, `as`, `| undefined` explícito); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-4-`
- [x] T068 [US2] `http-compartido` eje 5 errores sobre src/interface-adapters/http/{boundary,to-problem,problem-details,typed,client}.ts y security/ y sus pruebas en `tests/` (tipo y motivo en cada fallo, `throw` por regla de negocio, `catch` que traga, catálogo de problemas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-5-`
- [x] T069 [US2] `http-compartido` eje 6 pruebas como documentación sobre src/interface-adapters/http/{boundary,to-problem,problem-details,typed,client}.ts y security/ y sus pruebas en `tests/` (nombres que dicen la regla, pruebas acopladas a la implementación o al reloj, reglas sin prueba); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-6-`
- [x] T070 [US2] `http-compartido` eje 7 documentación ↔ código sobre src/interface-adapters/http/{boundary,to-problem,problem-details,typed,client}.ts y security/ y sus pruebas en `tests/` (glosario, ADRs citados, spec y quickstart de la feature, `CLAUDE.md`); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-7-`
- [x] T071 [US2] `http-compartido` contraste documental: ADR-001, ADR-002, ADR-014, ADR-020, ADR-029; spec 001/004/013 — cada desvío es un hallazgo con las dos líneas y la severidad del documento (eje 7)
- [x] T072 [US1] `http-compartido` refutación (`refutacion.md`) y `verify-finding.mjs trabajo/hallazgos/fase-1.json`; fila de `http-compartido` en `avance.md` § Módulos (archivos leídos, hallazgos por eje) y en el cuadro por módulo del informe §3.A

### Alcance `infrastructure` — Fastify + openapi-backend, CORS, logging

- [x] T073 [US1] Gates de `infrastructure`: `run-gates.mjs --dir src/infrastructure --json` → `trabajo/gates/modulo-infrastructure.json`; citar en informe §2.2
- [x] T074 [US2] `infrastructure` eje 1 nombres sobre src/infrastructure/http/ (build-server, cors, request-logging, load-contract, strip-discriminator-mappings) y logging/ y sus pruebas en `tests/` (términos del glosario, nombres que dicen qué deciden, abreviaturas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-1-`
- [x] T075 [US2] `infrastructure` eje 2 comentarios sobre src/infrastructure/http/ (build-server, cors, request-logging, load-contract, strip-discriminator-mappings) y logging/ y sus pruebas en `tests/` (encabezados con el porqué y la decisión, comentarios que repiten o mienten, idioma); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-2-`
- [x] T076 [US2] `infrastructure` eje 3 tamaño y forma sobre src/infrastructure/http/ (build-server, cors, request-logging, load-contract, strip-discriminator-mappings) y logging/ y sus pruebas en `tests/` (funciones de una lectura, una razón de cambio por archivo, booleanos que esconden dos funciones); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-3-`
- [x] T077 [US2] `infrastructure` eje 4 tipos sobre src/infrastructure/http/ (build-server, cors, request-logging, load-contract, strip-discriminator-mappings) y logging/ y sus pruebas en `tests/` (`Result`, uniones de literales, ids marcados, `of`/`rehydrate`, `as`, `| undefined` explícito); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-4-`
- [x] T078 [US2] `infrastructure` eje 5 errores sobre src/infrastructure/http/ (build-server, cors, request-logging, load-contract, strip-discriminator-mappings) y logging/ y sus pruebas en `tests/` (tipo y motivo en cada fallo, `throw` por regla de negocio, `catch` que traga, catálogo de problemas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-5-`
- [x] T079 [US2] `infrastructure` eje 6 pruebas como documentación sobre src/infrastructure/http/ (build-server, cors, request-logging, load-contract, strip-discriminator-mappings) y logging/ y sus pruebas en `tests/` (nombres que dicen la regla, pruebas acopladas a la implementación o al reloj, reglas sin prueba); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-6-`
- [x] T080 [US2] `infrastructure` eje 7 documentación ↔ código sobre src/infrastructure/http/ (build-server, cors, request-logging, load-contract, strip-discriminator-mappings) y logging/ y sus pruebas en `tests/` (glosario, ADRs citados, spec y quickstart de la feature, `CLAUDE.md`); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-7-`
- [x] T081 [US2] `infrastructure` contraste documental: ADR-004, ADR-005/018, ADR-014; spec 001/004 — cada desvío es un hallazgo con las dos líneas y la severidad del documento (eje 7)
- [x] T082 [US1] `infrastructure` refutación (`refutacion.md`) y `verify-finding.mjs trabajo/hallazgos/fase-1.json`; fila de `infrastructure` en `avance.md` § Módulos (archivos leídos, hallazgos por eje) y en el cuadro por módulo del informe §3.A

### Alcance `composition` — composición, configuración, ciclo de vida

- [x] T083 [US1] Gates de `composition`: `run-gates.mjs --dir src/composition --json` → `trabajo/gates/modulo-composition.json`; citar en informe §2.2
- [x] T084 [US2] `composition` eje 1 nombres sobre src/composition/ (bootstrap, wiring, ports, profile, profiles/, modules/, config, *-config.ts, lifecycle, start, coverage) y src/main.ts y sus pruebas en `tests/` (términos del glosario, nombres que dicen qué deciden, abreviaturas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-1-`
- [x] T085 [US2] `composition` eje 2 comentarios sobre src/composition/ (bootstrap, wiring, ports, profile, profiles/, modules/, config, *-config.ts, lifecycle, start, coverage) y src/main.ts y sus pruebas en `tests/` (encabezados con el porqué y la decisión, comentarios que repiten o mienten, idioma); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-2-`
- [x] T086 [US2] `composition` eje 3 tamaño y forma sobre src/composition/ (bootstrap, wiring, ports, profile, profiles/, modules/, config, *-config.ts, lifecycle, start, coverage) y src/main.ts y sus pruebas en `tests/` (funciones de una lectura, una razón de cambio por archivo, booleanos que esconden dos funciones); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-3-`
- [x] T087 [US2] `composition` eje 4 tipos sobre src/composition/ (bootstrap, wiring, ports, profile, profiles/, modules/, config, *-config.ts, lifecycle, start, coverage) y src/main.ts y sus pruebas en `tests/` (`Result`, uniones de literales, ids marcados, `of`/`rehydrate`, `as`, `| undefined` explícito); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-4-`
- [x] T088 [US2] `composition` eje 5 errores sobre src/composition/ (bootstrap, wiring, ports, profile, profiles/, modules/, config, *-config.ts, lifecycle, start, coverage) y src/main.ts y sus pruebas en `tests/` (tipo y motivo en cada fallo, `throw` por regla de negocio, `catch` que traga, catálogo de problemas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-5-`
- [x] T089 [US2] `composition` eje 6 pruebas como documentación sobre src/composition/ (bootstrap, wiring, ports, profile, profiles/, modules/, config, *-config.ts, lifecycle, start, coverage) y src/main.ts y sus pruebas en `tests/` (nombres que dicen la regla, pruebas acopladas a la implementación o al reloj, reglas sin prueba); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-6-`
- [x] T090 [US2] `composition` eje 7 documentación ↔ código sobre src/composition/ (bootstrap, wiring, ports, profile, profiles/, modules/, config, *-config.ts, lifecycle, start, coverage) y src/main.ts y sus pruebas en `tests/` (glosario, ADRs citados, spec y quickstart de la feature, `CLAUDE.md`); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-7-`
- [x] T091 [US2] `composition` contraste documental: ADR-013 (y enmiendas), ADR-018, ADR-024, ADR-026, ADR-027; CLAUDE.md § Anillos y módulos; specs 004/005/011/012 — cada desvío es un hallazgo con las dos líneas y la severidad del documento (eje 7)
- [x] T092 [US1] `composition` refutación (`refutacion.md`) y `verify-finding.mjs trabajo/hallazgos/fase-1.json`; fila de `composition` en `avance.md` § Módulos (archivos leídos, hallazgos por eje) y en el cuadro por módulo del informe §3.A

### Alcance `experiment` — asignación determinista (FNV-1a), holdout, ledger de asignaciones

- [x] T093 [US1] Gates de `experiment`: `run-gates.mjs --module experiment --json` → `trabajo/gates/modulo-experiment.json`; citar en informe §2.2
- [x] T094 [US2] `experiment` eje 1 nombres sobre src/domain/experiment/, src/application/experiment/, src/interface-adapters/gateways/experiment/, src/composition/modules/experiment.ts y sus pruebas en `tests/` (términos del glosario, nombres que dicen qué deciden, abreviaturas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-1-`
- [x] T095 [US2] `experiment` eje 2 comentarios sobre src/domain/experiment/, src/application/experiment/, src/interface-adapters/gateways/experiment/, src/composition/modules/experiment.ts y sus pruebas en `tests/` (encabezados con el porqué y la decisión, comentarios que repiten o mienten, idioma); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-2-`
- [x] T096 [US2] `experiment` eje 3 tamaño y forma sobre src/domain/experiment/, src/application/experiment/, src/interface-adapters/gateways/experiment/, src/composition/modules/experiment.ts y sus pruebas en `tests/` (funciones de una lectura, una razón de cambio por archivo, booleanos que esconden dos funciones); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-3-`
- [x] T097 [US2] `experiment` eje 4 tipos sobre src/domain/experiment/, src/application/experiment/, src/interface-adapters/gateways/experiment/, src/composition/modules/experiment.ts y sus pruebas en `tests/` (`Result`, uniones de literales, ids marcados, `of`/`rehydrate`, `as`, `| undefined` explícito); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-4-`
- [x] T098 [US2] `experiment` eje 5 errores sobre src/domain/experiment/, src/application/experiment/, src/interface-adapters/gateways/experiment/, src/composition/modules/experiment.ts y sus pruebas en `tests/` (tipo y motivo en cada fallo, `throw` por regla de negocio, `catch` que traga, catálogo de problemas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-5-`
- [x] T099 [US2] `experiment` eje 6 pruebas como documentación sobre src/domain/experiment/, src/application/experiment/, src/interface-adapters/gateways/experiment/, src/composition/modules/experiment.ts y sus pruebas en `tests/` (nombres que dicen la regla, pruebas acopladas a la implementación o al reloj, reglas sin prueba); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-6-`
- [x] T100 [US2] `experiment` eje 7 documentación ↔ código sobre src/domain/experiment/, src/application/experiment/, src/interface-adapters/gateways/experiment/, src/composition/modules/experiment.ts y sus pruebas en `tests/` (glosario, ADRs citados, spec y quickstart de la feature, `CLAUDE.md`); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-7-`
- [x] T101 [US2] `experiment` contraste documental: ADR-021, ADR-022; glosario asignacion/experimento/brazo; spec 007 — cada desvío es un hallazgo con las dos líneas y la severidad del documento (eje 7)
- [x] T102 [US1] `experiment` refutación (`refutacion.md`) y `verify-finding.mjs trabajo/hallazgos/fase-1.json`; fila de `experiment` en `avance.md` § Módulos (archivos leídos, hallazgos por eje) y en el cuadro por módulo del informe §3.A

### Alcance `ingestion` — lotes de eventos, dedup, foco, entrada al plano de decisión

- [x] T103 [US1] Gates de `ingestion`: `run-gates.mjs --module ingestion --json` → `trabajo/gates/modulo-ingestion.json`; citar en informe §2.2
- [x] T104 [US2] `ingestion` eje 1 nombres sobre src/domain/ingestion/, src/application/ingestion/, src/interface-adapters/gateways/ingestion/, src/interface-adapters/http/controllers/ingestion/, src/composition/modules/ingestion.ts y sus pruebas en `tests/` (términos del glosario, nombres que dicen qué deciden, abreviaturas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-1-`
- [x] T105 [US2] `ingestion` eje 2 comentarios sobre src/domain/ingestion/, src/application/ingestion/, src/interface-adapters/gateways/ingestion/, src/interface-adapters/http/controllers/ingestion/, src/composition/modules/ingestion.ts y sus pruebas en `tests/` (encabezados con el porqué y la decisión, comentarios que repiten o mienten, idioma); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-2-`
- [x] T106 [US2] `ingestion` eje 3 tamaño y forma sobre src/domain/ingestion/, src/application/ingestion/, src/interface-adapters/gateways/ingestion/, src/interface-adapters/http/controllers/ingestion/, src/composition/modules/ingestion.ts y sus pruebas en `tests/` (funciones de una lectura, una razón de cambio por archivo, booleanos que esconden dos funciones); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-3-`
- [x] T107 [US2] `ingestion` eje 4 tipos sobre src/domain/ingestion/, src/application/ingestion/, src/interface-adapters/gateways/ingestion/, src/interface-adapters/http/controllers/ingestion/, src/composition/modules/ingestion.ts y sus pruebas en `tests/` (`Result`, uniones de literales, ids marcados, `of`/`rehydrate`, `as`, `| undefined` explícito); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-4-`
- [x] T108 [US2] `ingestion` eje 5 errores sobre src/domain/ingestion/, src/application/ingestion/, src/interface-adapters/gateways/ingestion/, src/interface-adapters/http/controllers/ingestion/, src/composition/modules/ingestion.ts y sus pruebas en `tests/` (tipo y motivo en cada fallo, `throw` por regla de negocio, `catch` que traga, catálogo de problemas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-5-`
- [x] T109 [US2] `ingestion` eje 6 pruebas como documentación sobre src/domain/ingestion/, src/application/ingestion/, src/interface-adapters/gateways/ingestion/, src/interface-adapters/http/controllers/ingestion/, src/composition/modules/ingestion.ts y sus pruebas en `tests/` (nombres que dicen la regla, pruebas acopladas a la implementación o al reloj, reglas sin prueba); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-6-`
- [x] T110 [US2] `ingestion` eje 7 documentación ↔ código sobre src/domain/ingestion/, src/application/ingestion/, src/interface-adapters/gateways/ingestion/, src/interface-adapters/http/controllers/ingestion/, src/composition/modules/ingestion.ts y sus pruebas en `tests/` (glosario, ADRs citados, spec y quickstart de la feature, `CLAUDE.md`); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-7-`
- [x] T111 [US2] `ingestion` contraste documental: ADR-014, ADR-023; glosario evento/lote/dedup; specs 004/008/011 — cada desvío es un hallazgo con las dos líneas y la severidad del documento (eje 7)
- [x] T112 [US1] `ingestion` refutación (`refutacion.md`) y `verify-finding.mjs trabajo/hallazgos/fase-1.json`; fila de `ingestion` en `avance.md` § Módulos (archivos leídos, hallazgos por eje) y en el cuadro por módulo del informe §3.A

### Alcance `catalog` — snapshot de catálogo y stock, verdad de producto, frescura

- [x] T113 [US1] Gates de `catalog`: `run-gates.mjs --module catalog --json` → `trabajo/gates/modulo-catalog.json`; citar en informe §2.2
- [x] T114 [US2] `catalog` eje 1 nombres sobre src/domain/catalog/, src/application/catalog/, src/interface-adapters/gateways/catalog/, src/interface-adapters/http/controllers/catalog/, src/composition/modules/catalog.ts y sus pruebas en `tests/` (términos del glosario, nombres que dicen qué deciden, abreviaturas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-1-`
- [x] T115 [US2] `catalog` eje 2 comentarios sobre src/domain/catalog/, src/application/catalog/, src/interface-adapters/gateways/catalog/, src/interface-adapters/http/controllers/catalog/, src/composition/modules/catalog.ts y sus pruebas en `tests/` (encabezados con el porqué y la decisión, comentarios que repiten o mienten, idioma); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-2-`
- [x] T116 [US2] `catalog` eje 3 tamaño y forma sobre src/domain/catalog/, src/application/catalog/, src/interface-adapters/gateways/catalog/, src/interface-adapters/http/controllers/catalog/, src/composition/modules/catalog.ts y sus pruebas en `tests/` (funciones de una lectura, una razón de cambio por archivo, booleanos que esconden dos funciones); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-3-`
- [x] T117 [US2] `catalog` eje 4 tipos sobre src/domain/catalog/, src/application/catalog/, src/interface-adapters/gateways/catalog/, src/interface-adapters/http/controllers/catalog/, src/composition/modules/catalog.ts y sus pruebas en `tests/` (`Result`, uniones de literales, ids marcados, `of`/`rehydrate`, `as`, `| undefined` explícito); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-4-`
- [x] T118 [US2] `catalog` eje 5 errores sobre src/domain/catalog/, src/application/catalog/, src/interface-adapters/gateways/catalog/, src/interface-adapters/http/controllers/catalog/, src/composition/modules/catalog.ts y sus pruebas en `tests/` (tipo y motivo en cada fallo, `throw` por regla de negocio, `catch` que traga, catálogo de problemas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-5-`
- [x] T119 [US2] `catalog` eje 6 pruebas como documentación sobre src/domain/catalog/, src/application/catalog/, src/interface-adapters/gateways/catalog/, src/interface-adapters/http/controllers/catalog/, src/composition/modules/catalog.ts y sus pruebas en `tests/` (nombres que dicen la regla, pruebas acopladas a la implementación o al reloj, reglas sin prueba); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-6-`
- [x] T120 [US2] `catalog` eje 7 documentación ↔ código sobre src/domain/catalog/, src/application/catalog/, src/interface-adapters/gateways/catalog/, src/interface-adapters/http/controllers/catalog/, src/composition/modules/catalog.ts y sus pruebas en `tests/` (glosario, ADRs citados, spec y quickstart de la feature, `CLAUDE.md`); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-7-`
- [x] T121 [US2] `catalog` contraste documental: ADR-025; glosario catalogo/snapshot/verdad-de-producto; spec 010 — cada desvío es un hallazgo con las dos líneas y la severidad del documento (eje 7)
- [x] T122 [US1] `catalog` refutación (`refutacion.md`) y `verify-finding.mjs trabajo/hallazgos/fase-1.json`; fila de `catalog` en `avance.md` § Módulos (archivos leídos, hallazgos por eje) y en el cuadro por módulo del informe §3.A

### Alcance `barrier` — señales, condiciones, reglas de barrera, evidencia

- [x] T123 [US1] Gates de `barrier`: `run-gates.mjs --module barrier --json` → `trabajo/gates/modulo-barrier.json`; citar en informe §2.2
- [x] T124 [US2] `barrier` eje 1 nombres sobre src/domain/barrier/, src/application/barrier/ y sus pruebas en `tests/` (términos del glosario, nombres que dicen qué deciden, abreviaturas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-1-`
- [x] T125 [US2] `barrier` eje 2 comentarios sobre src/domain/barrier/, src/application/barrier/ y sus pruebas en `tests/` (encabezados con el porqué y la decisión, comentarios que repiten o mienten, idioma); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-2-`
- [x] T126 [US2] `barrier` eje 3 tamaño y forma sobre src/domain/barrier/, src/application/barrier/ y sus pruebas en `tests/` (funciones de una lectura, una razón de cambio por archivo, booleanos que esconden dos funciones); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-3-`
- [x] T127 [US2] `barrier` eje 4 tipos sobre src/domain/barrier/, src/application/barrier/ y sus pruebas en `tests/` (`Result`, uniones de literales, ids marcados, `of`/`rehydrate`, `as`, `| undefined` explícito); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-4-`
- [x] T128 [US2] `barrier` eje 5 errores sobre src/domain/barrier/, src/application/barrier/ y sus pruebas en `tests/` (tipo y motivo en cada fallo, `throw` por regla de negocio, `catch` que traga, catálogo de problemas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-5-`
- [x] T129 [US2] `barrier` eje 6 pruebas como documentación sobre src/domain/barrier/, src/application/barrier/ y sus pruebas en `tests/` (nombres que dicen la regla, pruebas acopladas a la implementación o al reloj, reglas sin prueba); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-6-`
- [x] T130 [US2] `barrier` eje 7 documentación ↔ código sobre src/domain/barrier/, src/application/barrier/ y sus pruebas en `tests/` (glosario, ADRs citados, spec y quickstart de la feature, `CLAUDE.md`); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-7-`
- [x] T131 [US2] `barrier` contraste documental: ADR-026; glosario barrera/senal/evidencia; spec 011 — cada desvío es un hallazgo con las dos líneas y la severidad del documento (eje 7)
- [x] T132 [US1] `barrier` refutación (`refutacion.md`) y `verify-finding.mjs trabajo/hallazgos/fase-1.json`; fila de `barrier` en `avance.md` § Módulos (archivos leídos, hallazgos por eje) y en el cuadro por módulo del informe §3.A

### Alcance `selection` — candidatos, quality gate

- [x] T133 [US1] Gates de `selection`: `run-gates.mjs --module selection --json` → `trabajo/gates/modulo-selection.json`; citar en informe §2.2
- [x] T134 [US2] `selection` eje 1 nombres sobre src/domain/selection/ y sus pruebas en `tests/` (términos del glosario, nombres que dicen qué deciden, abreviaturas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-1-`
- [x] T135 [US2] `selection` eje 2 comentarios sobre src/domain/selection/ y sus pruebas en `tests/` (encabezados con el porqué y la decisión, comentarios que repiten o mienten, idioma); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-2-`
- [x] T136 [US2] `selection` eje 3 tamaño y forma sobre src/domain/selection/ y sus pruebas en `tests/` (funciones de una lectura, una razón de cambio por archivo, booleanos que esconden dos funciones); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-3-`
- [x] T137 [US2] `selection` eje 4 tipos sobre src/domain/selection/ y sus pruebas en `tests/` (`Result`, uniones de literales, ids marcados, `of`/`rehydrate`, `as`, `| undefined` explícito); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-4-`
- [x] T138 [US2] `selection` eje 5 errores sobre src/domain/selection/ y sus pruebas en `tests/` (tipo y motivo en cada fallo, `throw` por regla de negocio, `catch` que traga, catálogo de problemas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-5-`
- [x] T139 [US2] `selection` eje 6 pruebas como documentación sobre src/domain/selection/ y sus pruebas en `tests/` (nombres que dicen la regla, pruebas acopladas a la implementación o al reloj, reglas sin prueba); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-6-`
- [x] T140 [US2] `selection` eje 7 documentación ↔ código sobre src/domain/selection/ y sus pruebas en `tests/` (glosario, ADRs citados, spec y quickstart de la feature, `CLAUDE.md`); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-7-`
- [x] T141 [US2] `selection` contraste documental: ADR-027; glosario candidato/quality-gate; spec 012 — cada desvío es un hallazgo con las dos líneas y la severidad del documento (eje 7)
- [x] T142 [US1] `selection` refutación (`refutacion.md`) y `verify-finding.mjs trabajo/hallazgos/fase-1.json`; fila de `selection` en `avance.md` § Módulos (archivos leídos, hallazgos por eje) y en el cuadro por módulo del informe §3.A

### Alcance `commercial` — escalera del incentivo, política comercial

- [x] T143 [US1] Gates de `commercial`: `run-gates.mjs --module commercial --json` → `trabajo/gates/modulo-commercial.json`; citar en informe §2.2
- [x] T144 [US2] `commercial` eje 1 nombres sobre src/domain/commercial/ y sus pruebas en `tests/` (términos del glosario, nombres que dicen qué deciden, abreviaturas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-1-`
- [x] T145 [US2] `commercial` eje 2 comentarios sobre src/domain/commercial/ y sus pruebas en `tests/` (encabezados con el porqué y la decisión, comentarios que repiten o mienten, idioma); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-2-`
- [x] T146 [US2] `commercial` eje 3 tamaño y forma sobre src/domain/commercial/ y sus pruebas en `tests/` (funciones de una lectura, una razón de cambio por archivo, booleanos que esconden dos funciones); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-3-`
- [x] T147 [US2] `commercial` eje 4 tipos sobre src/domain/commercial/ y sus pruebas en `tests/` (`Result`, uniones de literales, ids marcados, `of`/`rehydrate`, `as`, `| undefined` explícito); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-4-`
- [x] T148 [US2] `commercial` eje 5 errores sobre src/domain/commercial/ y sus pruebas en `tests/` (tipo y motivo en cada fallo, `throw` por regla de negocio, `catch` que traga, catálogo de problemas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-5-`
- [x] T149 [US2] `commercial` eje 6 pruebas como documentación sobre src/domain/commercial/ y sus pruebas en `tests/` (nombres que dicen la regla, pruebas acopladas a la implementación o al reloj, reglas sin prueba); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-6-`
- [x] T150 [US2] `commercial` eje 7 documentación ↔ código sobre src/domain/commercial/ y sus pruebas en `tests/` (glosario, ADRs citados, spec y quickstart de la feature, `CLAUDE.md`); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-7-`
- [x] T151 [US2] `commercial` contraste documental: ADR-027; 03 §4.8; glosario incentivo/escalera; spec 012 — cada desvío es un hallazgo con las dos líneas y la severidad del documento (eje 7)
- [x] T152 [US1] `commercial` refutación (`refutacion.md`) y `verify-finding.mjs trabajo/hallazgos/fase-1.json`; fila de `commercial` en `avance.md` § Módulos (archivos leídos, hallazgos por eje) y en el cuadro por módulo del informe §3.A

### Alcance `decision` — orquestación del plano de decisión, política por merchant, estado de sesión/visitante

- [x] T153 [US1] Gates de `decision`: `run-gates.mjs --module decision --json` → `trabajo/gates/modulo-decision.json`; citar en informe §2.2
- [x] T154 [US2] `decision` eje 1 nombres sobre src/domain/decision/, src/application/decision/ (DecisionService, DecisionRecorder, políticas), src/interface-adapters/gateways/decision/, src/composition/modules/decision.ts y sus pruebas en `tests/` (términos del glosario, nombres que dicen qué deciden, abreviaturas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-1-`
- [x] T155 [US2] `decision` eje 2 comentarios sobre src/domain/decision/, src/application/decision/ (DecisionService, DecisionRecorder, políticas), src/interface-adapters/gateways/decision/, src/composition/modules/decision.ts y sus pruebas en `tests/` (encabezados con el porqué y la decisión, comentarios que repiten o mienten, idioma); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-2-`
- [x] T156 [US2] `decision` eje 3 tamaño y forma sobre src/domain/decision/, src/application/decision/ (DecisionService, DecisionRecorder, políticas), src/interface-adapters/gateways/decision/, src/composition/modules/decision.ts y sus pruebas en `tests/` (funciones de una lectura, una razón de cambio por archivo, booleanos que esconden dos funciones); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-3-`
- [x] T157 [US2] `decision` eje 4 tipos sobre src/domain/decision/, src/application/decision/ (DecisionService, DecisionRecorder, políticas), src/interface-adapters/gateways/decision/, src/composition/modules/decision.ts y sus pruebas en `tests/` (`Result`, uniones de literales, ids marcados, `of`/`rehydrate`, `as`, `| undefined` explícito); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-4-`
- [x] T158 [US2] `decision` eje 5 errores sobre src/domain/decision/, src/application/decision/ (DecisionService, DecisionRecorder, políticas), src/interface-adapters/gateways/decision/, src/composition/modules/decision.ts y sus pruebas en `tests/` (tipo y motivo en cada fallo, `throw` por regla de negocio, `catch` que traga, catálogo de problemas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-5-`
- [x] T159 [US2] `decision` eje 6 pruebas como documentación sobre src/domain/decision/, src/application/decision/ (DecisionService, DecisionRecorder, políticas), src/interface-adapters/gateways/decision/, src/composition/modules/decision.ts y sus pruebas en `tests/` (nombres que dicen la regla, pruebas acopladas a la implementación o al reloj, reglas sin prueba); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-6-`
- [x] T160 [US2] `decision` eje 7 documentación ↔ código sobre src/domain/decision/, src/application/decision/ (DecisionService, DecisionRecorder, políticas), src/interface-adapters/gateways/decision/, src/composition/modules/decision.ts y sus pruebas en `tests/` (glosario, ADRs citados, spec y quickstart de la feature, `CLAUDE.md`); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-7-`
- [x] T161 [US2] `decision` contraste documental: ADR-023, ADR-026, ADR-027; 01 §4; glosario decision/intervencion/no-op; specs 011/012 — cada desvío es un hallazgo con las dos líneas y la severidad del documento (eje 7)
- [x] T162 [US1] `decision` refutación (`refutacion.md`) y `verify-finding.mjs trabajo/hallazgos/fase-1.json`; fila de `decision` en `avance.md` § Módulos (archivos leídos, hallazgos por eje) y en el cuadro por módulo del informe §3.A

### Alcance `ledger` — decisiones, exposiciones, cadena de evidencia

- [x] T163 [US1] Gates de `ledger`: `run-gates.mjs --module ledger --json` → `trabajo/gates/modulo-ledger.json`; citar en informe §2.2
- [x] T164 [US2] `ledger` eje 1 nombres sobre src/domain/ledger/, src/application/ledger/, src/interface-adapters/gateways/ledger/, src/interface-adapters/http/controllers/ledger/, src/composition/modules/ledger.ts y sus pruebas en `tests/` (términos del glosario, nombres que dicen qué deciden, abreviaturas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-1-`
- [x] T165 [US2] `ledger` eje 2 comentarios sobre src/domain/ledger/, src/application/ledger/, src/interface-adapters/gateways/ledger/, src/interface-adapters/http/controllers/ledger/, src/composition/modules/ledger.ts y sus pruebas en `tests/` (encabezados con el porqué y la decisión, comentarios que repiten o mienten, idioma); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-2-`
- [x] T166 [US2] `ledger` eje 3 tamaño y forma sobre src/domain/ledger/, src/application/ledger/, src/interface-adapters/gateways/ledger/, src/interface-adapters/http/controllers/ledger/, src/composition/modules/ledger.ts y sus pruebas en `tests/` (funciones de una lectura, una razón de cambio por archivo, booleanos que esconden dos funciones); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-3-`
- [x] T167 [US2] `ledger` eje 4 tipos sobre src/domain/ledger/, src/application/ledger/, src/interface-adapters/gateways/ledger/, src/interface-adapters/http/controllers/ledger/, src/composition/modules/ledger.ts y sus pruebas en `tests/` (`Result`, uniones de literales, ids marcados, `of`/`rehydrate`, `as`, `| undefined` explícito); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-4-`
- [x] T168 [US2] `ledger` eje 5 errores sobre src/domain/ledger/, src/application/ledger/, src/interface-adapters/gateways/ledger/, src/interface-adapters/http/controllers/ledger/, src/composition/modules/ledger.ts y sus pruebas en `tests/` (tipo y motivo en cada fallo, `throw` por regla de negocio, `catch` que traga, catálogo de problemas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-5-`
- [x] T169 [US2] `ledger` eje 6 pruebas como documentación sobre src/domain/ledger/, src/application/ledger/, src/interface-adapters/gateways/ledger/, src/interface-adapters/http/controllers/ledger/, src/composition/modules/ledger.ts y sus pruebas en `tests/` (nombres que dicen la regla, pruebas acopladas a la implementación o al reloj, reglas sin prueba); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-6-`
- [x] T170 [US2] `ledger` eje 7 documentación ↔ código sobre src/domain/ledger/, src/application/ledger/, src/interface-adapters/gateways/ledger/, src/interface-adapters/http/controllers/ledger/, src/composition/modules/ledger.ts y sus pruebas en `tests/` (glosario, ADRs citados, spec y quickstart de la feature, `CLAUDE.md`); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-7-`
- [x] T171 [US2] `ledger` contraste documental: ADR-021, ADR-028; 01 §5; glosario ledger/exposicion; specs 004/007/013 — cada desvío es un hallazgo con las dos líneas y la severidad del documento (eje 7)
- [x] T172 [US1] `ledger` refutación (`refutacion.md`) y `verify-finding.mjs trabajo/hallazgos/fase-1.json`; fila de `ledger` en `avance.md` § Módulos (archivos leídos, hallazgos por eje) y en el cuadro por módulo del informe §3.A

### Alcance `outcomes` — órdenes, corroboraciones, devoluciones, correlación, redención

- [x] T173 [US1] Gates de `outcomes`: `run-gates.mjs --module outcomes --json` → `trabajo/gates/modulo-outcomes.json`; citar en informe §2.2
- [x] T174 [US2] `outcomes` eje 1 nombres sobre src/domain/outcomes/, src/application/outcomes/, src/interface-adapters/gateways/outcomes/, src/interface-adapters/http/controllers/outcomes/, src/composition/modules/outcomes.ts y sus pruebas en `tests/` (términos del glosario, nombres que dicen qué deciden, abreviaturas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-1-`
- [x] T175 [US2] `outcomes` eje 2 comentarios sobre src/domain/outcomes/, src/application/outcomes/, src/interface-adapters/gateways/outcomes/, src/interface-adapters/http/controllers/outcomes/, src/composition/modules/outcomes.ts y sus pruebas en `tests/` (encabezados con el porqué y la decisión, comentarios que repiten o mienten, idioma); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-2-`
- [x] T176 [US2] `outcomes` eje 3 tamaño y forma sobre src/domain/outcomes/, src/application/outcomes/, src/interface-adapters/gateways/outcomes/, src/interface-adapters/http/controllers/outcomes/, src/composition/modules/outcomes.ts y sus pruebas en `tests/` (funciones de una lectura, una razón de cambio por archivo, booleanos que esconden dos funciones); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-3-`
- [x] T177 [US2] `outcomes` eje 4 tipos sobre src/domain/outcomes/, src/application/outcomes/, src/interface-adapters/gateways/outcomes/, src/interface-adapters/http/controllers/outcomes/, src/composition/modules/outcomes.ts y sus pruebas en `tests/` (`Result`, uniones de literales, ids marcados, `of`/`rehydrate`, `as`, `| undefined` explícito); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-4-`
- [x] T178 [US2] `outcomes` eje 5 errores sobre src/domain/outcomes/, src/application/outcomes/, src/interface-adapters/gateways/outcomes/, src/interface-adapters/http/controllers/outcomes/, src/composition/modules/outcomes.ts y sus pruebas en `tests/` (tipo y motivo en cada fallo, `throw` por regla de negocio, `catch` que traga, catálogo de problemas); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-5-`
- [x] T179 [US2] `outcomes` eje 6 pruebas como documentación sobre src/domain/outcomes/, src/application/outcomes/, src/interface-adapters/gateways/outcomes/, src/interface-adapters/http/controllers/outcomes/, src/composition/modules/outcomes.ts y sus pruebas en `tests/` (nombres que dicen la regla, pruebas acopladas a la implementación o al reloj, reglas sin prueba); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-6-`
- [x] T180 [US2] `outcomes` eje 7 documentación ↔ código sobre src/domain/outcomes/, src/application/outcomes/, src/interface-adapters/gateways/outcomes/, src/interface-adapters/http/controllers/outcomes/, src/composition/modules/outcomes.ts y sus pruebas en `tests/` (glosario, ADRs citados, spec y quickstart de la feature, `CLAUDE.md`); hallazgos `proposed` a `trabajo/hallazgos/fase-1.json` con `rule.id` prefijado `axis-7-`
- [x] T181 [US2] `outcomes` contraste documental: ADR-028, ADR-029; 01 §5, 02 §5; glosario orden-verificada/orden-atribuida/correlacion-pendiente/corroboracion/devolucion; spec 013 — cada desvío es un hallazgo con las dos líneas y la severidad del documento (eje 7)
- [x] T182 [US1] `outcomes` refutación (`refutacion.md`) y `verify-finding.mjs trabajo/hallazgos/fase-1.json`; fila de `outcomes` en `avance.md` § Módulos (archivos leídos, hallazgos por eje) y en el cuadro por módulo del informe §3.A

### Transversales de la dimensión A (handoff §5.A)

- [x] T183 [US2] Lógica de negocio fuera del dominio: buscar condiciones sobre hechos del negocio en `src/interface-adapters/http/controllers/**`, `src/interface-adapters/gateways/**`, `src/composition/*-config.ts`, `src/infrastructure/http/build-server.ts`; hallazgos con `constitution#I`
- [x] T184 [US2] Puertos DIP/ISP en `src/application/*/ports/*.ts`: `DecisionLedger.bySession` (¿puerto propio de `outcomes`?), `OrderLedger` (órdenes y devoluciones: ¿una responsabilidad o dos?)
- [x] T185 [US2] `src/application/decision/services/decision.service.ts`: ¿orquestador que transporta contexto (ADR-027) o ya decide? (`evidenceOf`, `selectionOf`); S-05 candidato
- [x] T186 [US2] `src/composition/{config,condition-config,decision-policy-config,commercial-policy-config}.ts`: ¿parseo de forma o reglas? (ADR-024: las invariantes viven en el dominio)
- [x] T187 [US2] OCP frente a 014/015: qué archivos toca agregar un flag, un candidato de mensaje o un hecho nuevo; hallazgo si toca más de un módulo o un `switch` sin exhaustividad
- [x] T188 [US2] LSP/ADR-024: para cada clase con `of`/`rehydrate` en `src/domain/**`, ¿`rehydrate` puede producir un estado que `of` no admite y algún consumidor lo asume válido?
- [x] T189 [US1] Redactar informe §2.2 (15 filas) y §3.A completo (hallazgos por severidad + cuadro por módulo 15 × 7); `verify-finding` sobre `fase-1.json` completo
- [x] T190 [US4] Cierre de fase 1: `avance.md`, commit `docs(auditoria): fase 1 — lectura fina`, resumen al dueño

**Checkpoint**: 15 alcances × 7 ejes en el informe; todos los archivos de `src/` figuran como leídos.

---

## Fase 2: Robustez (handoff §5.B)

**Purpose**: fail-closed en cada borde; concurrencia y crecimiento en memoria; relojes; `throw` que deberían ser resultados.

**Cierra**: informe §3.B y §6 (borrador de riesgos); `trabajo/hallazgos/fase-2.json`. Commit `docs(auditoria): fase 2 — robustez`.

- [x] T191 [US3] Fail-closed en cada borde: `src/interface-adapters/http/to-problem.ts`, `HEADERS_BY_CODE`, `unrecorded`/`ledger-unavailable` en `DecisionRecorder` e `IngestBatchUseCase`, los `503` de `outcomes` — dónde un `undefined`, `NaN`, reloj desfasado o ledger caído produce algo distinto de `NO_OP`/`503`/`4xx` tipado
- [x] T192 [US3] Concurrencia en memoria: `memoryOrderLedger.record` (sección síncrona), `NotifyReturnUseCase` (`find` → `recordReturn` con `await`), `DecisionService` lee/escribe `SessionState`/`VisitorState` con `await`s — ¿dos lotes simultáneos de la misma sesión duplican una intervención o saltan el cooldown? (hay prueba de una intervención por sesión, no de interleaving)
- [x] T193 [US3] Ventanas y podas: `SESSION_WINDOW`, `VISITOR_WINDOW`, `DEDUP_WINDOW` (TTL y máximo) vs. `memoryDecisionLedger` (índice por sesión), `memoryOrderLedger`, `memoryCorroborationLedger`, `memoryAssignmentLedger`, `memoryExposureLedger` que no podan; ¿está escrito en un ADR o es deuda silenciosa? → S-01
- [x] T194 [US3] Relojes: tolerancias de 5 min (eventos, catálogo, órdenes, corroboraciones, firma) y 24 h hacia atrás en eventos — consistencia entre sí y con `02`
- [x] T195 [US3] Cuerpos grandes: `bodyLimit` 32 MiB del catálogo; firma HMAC sobre los bytes crudos en el security handler (`keepRawBodies` en `build-server.ts`); costo por request y liberación del `WeakMap`
- [x] T196 [US3] `throw` en `src/application/**` y `src/domain/**` que deberían ser `Result` (grep `throw new` + lectura); cada uno con `constitution#II` o ADR-023
- [x] T197 [US3] S-05 `DecisionService` cerca del límite y con cinco `Stryker disable`; S-06 `build-server.ts` (428 líneas) con más de una razón de cambio — veredicto con hallazgo o refutación
- [x] T198 [US5] Supuestos de "una instancia" escritos sin nombrarse (dedup en memoria, idempotencia en el gateway, estado de sesión): lista con `file:line` para la 017 → informe §6 borrador
- [x] T199 [US1] Refutación y `verify-finding` sobre `fase-2.json`; redactar informe §3.B
- [x] T200 [US4] Cierre de fase 2: `avance.md`, commit `docs(auditoria): fase 2 — robustez`, resumen al dueño

---

## Fase 3: Escalabilidad, seguridad y calidad de las pruebas (handoff §5.C/D/E, sin ampliar)

**Purpose**: responder cada pregunta del handoff con evidencia; verificar cada excepción de mutación.

**Cierra**: informe §3.C, §3.D, §3.E; `trabajo/hallazgos/fase-3.json`. Commit `docs(auditoria): fase 3 — seguridad, escalabilidad y pruebas`.

### C — Escalabilidad y camino a la 017

- [x] T201 [US5] Puertos aptos para Postgres sin cambiar casos de uso: `Promise` en todo puerto (ADR-024), `Result<…, LedgerUnavailable>` en todo `record`, aliasing de `Order` en `memoryOrderLedger` (el caso de uso recibe el objeto guardado)
- [x] T202 [US5] Costo del camino crítico: `Signals` por lote, `BarrierRules.infer`, `QualityGate` sobre todos los candidatos, `FactContext` por decisión; `bySession` devuelve toda la sesión y `Correlation`/`Redemption` la recorren — ¿O(n²) escondido?
- [x] T203 [US5] Tiempo de desarrollo: mutación ~10 min por PR y suite ~2 min; pruebas redundantes o lentas (`tests/integration/*` levantan la app entera por caso)

### D — Seguridad

- [x] T204 [P] [US3] `Merchant.owns`/`ownsPlatformKey` con `includes` (no tiempo constante) vs. `PlatformSignature.matches` (constante): ¿importa para `platformKey`? → S-10
- [x] T205 [P] [US3] Redacción en logs: `request-logging.ts` y todo log de casos de uso / `LoggedUseCase` — ¿filtra request, claves, secretos, firma, brazo o `visitorId` donde no corresponde? (constitución VII, ADR-022)
- [x] T206 [P] [US3] CORS derivado de los headers de credencial por módulo; `platformKey` sin CORS; ¿alguna operación de plataforma alcanzable desde un navegador con `ingestKey`?
- [x] T207 [P] [US3] PII fuera de los esquemas: logs, ejemplos del contrato, `detail` que interpola valores del request (`orderId`, SKU)
- [x] T208 [US3] Firma: replay dentro de la ventana de 5 min absorbido por idempotencia (órdenes, devoluciones, `PUT /v1/catalog` con mismo `capturedAt`); rotación de secretos sin ventana de gracia → S-11

### E — Calidad de las pruebas

- [x] T209 [US1] Cada `// Stryker disable` verificado contra `trabajo/gates/mutation-full.json` (o el incremental, R-06): `decision.service.ts` ×4, `build-server.ts` ×4, `notify-order.ts`, `condition.ts`, `signals.ts`, `cors.ts` — ¿mutante equivalente o inalcanzable, o comodidad?
- [x] T210 [P] [US1] Pruebas informativas que nunca fallan por cifras (latencia, carga): ¿alguna debería ser gate?
- [x] T211 [P] [US1] `tests/helpers/test-app.ts`: dos merchants fijos, A con `treatmentPercent: 100` — ¿comportamiento de CONTROL probado sólo con `merchant(0)` ad hoc?
- [x] T212 [P] [US1] Determinismo: pruebas que dependen del orden de un `Map` o de `Date.now()` (`eventOf` usa `new Date()` por defecto)
- [x] T213 [P] [US1] Réplicas contrato ↔ código con prueba (problem types, capacidades, motivos NO_OP, barreras, anclajes, vocabulario de eventos, `OrderStatus`); ¿faltan `REDEMPTION_VERDICTS`, `STEPS`?
- [x] T214 [US3] S-09 'schema validation mismatch' de Schemathesis en 5 operaciones (`trabajo/gates/global-test-contract.txt`): inherente a `pattern`/`additionalProperties: false` o contrato más estricto que el servidor; S-12 deuda declarada en CLAUDE.md (ADR-017, parche de Stryker, `oas3-schema` apagada) contrastada con el código
- [x] T215 [US1] Refutación y `verify-finding` sobre `fase-3.json`; redactar informe §3.C, §3.D, §3.E
- [x] T216 [US4] Cierre de fase 3: `avance.md`, commit `docs(auditoria): fase 3 — seguridad, escalabilidad y pruebas`, resumen al dueño

---

## Fase 4: Cumplimiento funcional (US3)

**Purpose**: cada afirmación DECIDIDA con su prueba o su hueco; cada sospecha con veredicto.

**Cierra**: informe §3.F y §4; `trabajo/afirmaciones.md` resuelto; `trabajo/hallazgos/fase-4.json`. Commits por sesión: `docs(auditoria): fase 4 — <bloque>`.

**Método**: para cada fila de `afirmaciones.md`, buscar primero en el `quickstart.md` de la feature (tabla escenario → prueba), abrir la prueba y confirmar que verifica lo afirmado; si no, buscar en `tests/`; si no, hueco. Una contradicción con un DECIDIDO es `F-NNN` con `mvp:`/`spec:`/`constitution#` como fuente.

### Constitución I–X

- [x] T217 [P] [US3] Constitución I. Separación de autoridades: evidencia (prueba/gate con ruta) o hueco → fila de `afirmaciones.md` e informe §4.1
- [x] T218 [P] [US3] Constitución II. Fail-closed: evidencia (prueba/gate con ruta) o hueco → fila de `afirmaciones.md` e informe §4.1
- [x] T219 [P] [US3] Constitución III. La medición precede y no se contamina (misma inferencia para ambos brazos: `decision.service.test.ts`): evidencia (prueba/gate con ruta) o hueco → fila de `afirmaciones.md` e informe §4.1
- [x] T220 [P] [US3] Constitución IV. Dos caminos, dos garantías (sin red en el camino crítico): evidencia (prueba/gate con ruta) o hueco → fila de `afirmaciones.md` e informe §4.1
- [x] T221 [P] [US3] Constitución V. Aislamiento por merchant (`isolation.test.ts` y equivalentes): evidencia (prueba/gate con ruta) o hueco → fila de `afirmaciones.md` e informe §4.1
- [x] T222 [P] [US3] Constitución VI. Identidad e idempotencia explícitas: evidencia (prueba/gate con ruta) o hueco → fila de `afirmaciones.md` e informe §4.1
- [x] T223 [P] [US3] Constitución VII. OPE observa comportamiento, no personas: evidencia (prueba/gate con ruta) o hueco → fila de `afirmaciones.md` e informe §4.1
- [x] T224 [P] [US3] Constitución VIII. Cero LLM en runtime: evidencia (prueba/gate con ruta) o hueco → fila de `afirmaciones.md` e informe §4.1
- [x] T225 [P] [US3] Constitución IX. Nada entra al reporte sin trazabilidad (¿toda decisión, exposición, orden y devolución se reconstruye desde el ledger?): evidencia (prueba/gate con ruta) o hueco → fila de `afirmaciones.md` e informe §4.1
- [x] T226 [P] [US3] Constitución X. Puertos en los dos bordes: evidencia (prueba/gate con ruta) o hueco → fila de `afirmaciones.md` e informe §4.1

### Documentos del MVP

- [x] T227 [US3] `03` §10 criterios de aceptación, uno por fila → informe §4.2
- [x] T228 [P] [US3] `01` §4 (las cinco autoridades) y §4.3 (evidencia) y §4.5 (política comercial) → §4.3
- [x] T229 [P] [US3] `01` §5 (cadena de evidencia `ASSIGNED → EXPOSED → VERIFIED_ORDER → ATTRIBUTED_ORDER → RETURNED`) y §6 (identidades) → §4.3; S-03 (redención sin exposición) y S-04 (correlación confía en `sessionId`) reciben veredicto aquí
- [x] T230 [P] [US3] `01` §9 (garantías) y §10 (privacidad) → §4.3
- [x] T231 [P] [US3] `02` §4 (catálogo) y §5 (correlación A atribuye, B nunca, C no existe) → §4.3
- [x] T232 [P] [US3] `03` §4.5 (evidencia que sostiene un mensaje: sin escasez ni prueba social), §4.7 (memoria), §4.8 (escalera del incentivo: orden, D-B, incentivo sólo en precio), §4.11 (privacidad), §6 (D-A/D-B/D-C) → §4.3; S-02 (`commercial-policy-blocked` inalcanzable) recibe veredicto aquí

### Specs 001–013 (`FR`/`SC` → evidencia o hueco; `quickstart.md` § "Cambios respecto del plan" leído entero)

- [x] T233 [P] [US3] `specs/001-api-contract-toolchain/`: cada `FR`/`SC` con evidencia o hueco → §4.4
- [x] T234 [P] [US3] `specs/002-gobernanza-contrato-codigo/`: cada `FR`/`SC` con evidencia o hueco → §4.4
- [x] T235 [P] [US3] `specs/003-calidad-de-codigo/`: cada `FR`/`SC` con evidencia o hueco → §4.4
- [x] T236 [P] [US3] `specs/004-protocolo-sdk-ingesta/`: cada `FR`/`SC` con evidencia o hueco → §4.4
- [x] T237 [P] [US3] `specs/005-auditoria-calidad/`: cada `FR`/`SC` con evidencia o hueco → §4.4
- [x] T238 [P] [US3] `specs/006-mapa-del-contrato/`: cada `FR`/`SC` con evidencia o hueco → §4.4
- [x] T239 [P] [US3] `specs/007-asignacion-experimental/`: cada `FR`/`SC` con evidencia o hueco → §4.4
- [x] T240 [P] [US3] `specs/008-casos-de-uso-y-errores/`: cada `FR`/`SC` con evidencia o hueco → §4.4
- [x] T241 [P] [US3] `specs/009-dominio-rico/`: cada `FR`/`SC` con evidencia o hueco → §4.4
- [x] T242 [P] [US3] `specs/010-catalogo-y-stock/`: cada `FR`/`SC` con evidencia o hueco → §4.4
- [x] T243 [P] [US3] `specs/011-plano-de-decision-i/`: cada `FR`/`SC` con evidencia o hueco → §4.4
- [x] T244 [P] [US3] `specs/012-plano-de-decision-ii/`: cada `FR`/`SC` con evidencia o hueco → §4.4
- [x] T245 [P] [US3] `specs/013-outcomes-ordenes-y-devoluciones/`: cada `FR`/`SC` con evidencia o hueco → §4.4; S-07 (`| undefined` explícito en outcomes) y S-08 (`Return` en `order.ts`, `Corroboration` clase) reciben veredicto aquí
- [x] T246 [US3] Marcadores: ¿hay decisiones tomadas en código que deberían estar marcadas y no lo están? (`check:markers` dice 0 abiertos / 2 propuestos); propuestas al dueño en el informe, sin escribir marcadores
- [x] T247 [US1] Refutación y `verify-finding` sobre `fase-4.json`; redactar informe §3.F (con la tabla S-01..S-12) y §4 completo
- [x] T248 [US4] Cierre de fase 4: `avance.md`, commit `docs(auditoria): fase 4 — cumplimiento funcional`, resumen al dueño

---

## Fase 5: Cierre (US5, US1, US4)

**Purpose**: un informe consistente, verificado en bloque, con estado derivado y riesgos para 014–017.

**Cierra**: informe §5, §6, §7 y §1 completado; PR. Commit `docs(auditoria): fase 5 — cierre`.

- [ ] T249 [US1] Segunda pasada de refutación sobre **todos** los hallazgos `confirmed` de `fase-1..4.json` (`refutacion.md`); los que caen pasan a `refuted` con motivo
- [ ] T250 [US1] Deduplicar entre fases (mismo defecto = un `F-NNN`, el menor; el otro se cita); consolidar `trabajo/hallazgos/refutados.json`
- [ ] T251 [US1] `verify-finding.mjs` sobre cada `fase-N.json` y sobre el conjunto: ninguno rechazado (SC-001)
- [ ] T252 [US5] Redactar informe §5 (refutados, con dónde nació cada uno) y §6 (riesgos para 014–017: riesgo · `file:line` · feature que lo absorbe)
- [ ] T253 [US5] Calcular el estado global desde los JSON y los gates (`rejected` / `changes-required` / `approved`) y escribir §7 con las cuentas; poner el estado en la cabecera del informe
- [ ] T254 [US2] Cuadro por módulo final en §3.A: 15 filas × 7 ejes, lista de `F-NNN` o "sin hallazgos" (SC-002)
- [ ] T255 [US3] Comprobar SC-003: `afirmaciones.md` sin filas vacías; una fila por principio y por criterio de 03 §10; S-01..S-12 con veredicto
- [ ] T256 [US1] Completar §1 (todo lo leído y corrido, sesiones, lo no verificable) y relectura completa del informe: cada hallazgo con sus siete campos, citas literales, sin puntuaciones, sin palabras marcador (`npm run check:markers`), `npx prettier --check docs/auditoria specs/014-auditoria-integral`
- [ ] T257 [US4] SC-006: `git diff --stat main` limitado a `specs/014-auditoria-integral/`, `docs/auditoria/` y el commit `ee6ac73`; `avance.md` con las seis fases cerradas y sus hashes
- [ ] T258 [US4] Commit `docs(auditoria): fase 5 — cierre`; PR `014-auditoria-integral` → `main` con la descripción del Constitution Check (ningún gate de código aplica; diff limitado); sin merge hasta que el dueño lo pida

---

## Dependencies & Execution Order

- **Fase 0** no depende de nada y bloquea todo lo demás (rúbrica fijada, afirmaciones extraídas, comandos guardados).
- **Fase 1** → alcances en cualquier orden (el sugerido evita releer: kernel y bordes, camino crítico, medición); dentro de un alcance el orden es gates → ejes → contraste → verificación.
- **Fase 2** usa la lectura de la fase 1 (no la repite); **Fase 3** usa la lista de supuestos de la fase 2 y el reporte de mutación de la fase 0.
- **Fase 4** usa `afirmaciones.md` (fase 0) y los `quickstart.md`; puede empezar antes de cerrar la 3 si el dueño lo pide.
- **Fase 5** requiere las cuatro anteriores cerradas.

## Parallel Opportunities

Las tareas `[P]` de una misma sección tocan documentos distintos y pueden repartirse entre sesiones sin conflicto; dentro de un alcance de la fase 1 los siete ejes se leen en una pasada (no en paralelo: es el mismo archivo).

## Implementation Strategy

- **Sesión 1**: fase 0 completa.
- **Sesiones 2–5**: fase 1, tres o cuatro alcances por sesión (los chicos —`system`, `selection`, `commercial`— se agrupan).
- **Sesión 6**: fase 2. **Sesión 7**: fase 3. **Sesiones 8–10**: fase 4 (constitución + MVP; specs 001–007; specs 008–013). **Sesión 11**: fase 5.
- Al cierre de cada fase el dueño puede reordenar o detener; la traza queda consistente en cualquier corte.

## Notes

- Ninguna tarea escribe fuera de `docs/auditoria/` y `specs/014-auditoria-integral/`.
- Un hallazgo se marca en su JSON, no en esta lista; esta lista dice qué unidad de trabajo se cerró.
- Las cifras del handoff (176 archivos, 1 003 pruebas, 29 ADRs) se confirman en T021 y se citan como históricas.
