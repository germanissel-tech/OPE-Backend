# Quickstart — Merchants, configuración en tres niveles y administración (017)

## Prerrequisitos

- `npm ci`; `uvx` para `test:contract`; `origin/main` con el contrato 1.3.0 (`building`).
- Un operador: `node scripts/mint-admin-token.mjs ops-1` imprime el token (una vez) y la
  entrada para `OPE_ADMIN_OPERATORS`; `config/dev-operators.json` trae uno para `npm run dev`.

## Verificar cada historia

### US1 — Un merchant se opera, no se despliega

```bash
npm run dev                         # arranca vacío + semilla de config/dev-merchants.json (operador system)
curl -s -H "Authorization: Bearer $TOKEN" localhost:3000/v1/admin/merchants          # lista
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"origins":["https://tienda.example"],"signature":true}' localhost:3000/v1/admin/merchants   # 201, credenciales una vez
# con la clave de ingesta devuelta: POST /v1/events autentica; GET /v1/admin/merchants/{id} no muestra valores
# POST .../ingest-keys {"graceSeconds":60} → la vieja vale 60 s más; PUT .../kill-switch {"enabled":false} → decisiones NO_OP merchant-off
# POST .../deactivate → 401 con cualquier clave del merchant; GET .../log muestra cada acción con operatorId
npm test -- tests/integration/admin-merchants.test.ts tests/integration/isolation.test.ts
```

Esperado: escenarios 1–7 de US1; un token con alcance `["mrc_a"]` recibe 403 `merchant-out-of-scope` sobre `mrc_b` sin que exista o no.

### US2 — Configuración versionada, sin políticas en el código

```bash
curl -s -H "Authorization: Bearer $TOKEN" localhost:3000/v1/admin/platform-configuration     # platform-1
curl -s -H "Authorization: Bearer $TOKEN" localhost:3000/v1/admin/treatment-defaults         # defaults-1
# POST .../configuration {"declared":{"freshness":{"stockAndPriceMs":600000},"locales":{"supported":["es-AR"]}}} → 201 version 1
# POST /v1/events → la decisión en app.ports.decisions lleva configuration {platform-1, defaults-1, 1}
npm test -- tests/unit/configuration tests/governance/behaviour-constants.test.ts tests/integration/admin-configuration.test.ts
```

Esperado: `release-levels.test.ts` verde con los archivos reales; `behaviour-constants.test.ts` confirma que `freshness.ts`, `sync-level.ts`, `dedup-window.ts`, `session-window.ts`, `visitor-window.ts`, `signature-window.ts`, `default-policy.ts`, `default-commercial-policy.ts` ya no existen; las pruebas de integración de catálogo, ingesta y decisión pasan **sin cambiar expectativas** (mismos valores, ahora en los archivos).

### US3 — Experimentos

```bash
# POST .../experiments {"treatmentPercent":50,"seed":"s1","targetSample":32000} → 201 calibrating
# POST .../configuration → 201 (en calibración se acepta)
# POST .../experiments/{id}/activate → 200 active, windowStartedAt
# POST .../configuration → 409 configuration-frozen
# POST .../configuration {"declared":{...},"corrective":true,"reason":"anchor fix"} → 201 y windowRestarts += 1
# POST .../experiments/{id}/close → 200 closed; siguiente lote → NO_OP no-active-experiment
npm test -- tests/integration/admin-experiments.test.ts tests/unit/domain/experiment
```

### US4 — SDK

```bash
curl -s -H "X-OPE-Ingest-Key: $INGEST" -H "Origin: https://tienda.example" localhost:3000/v1/sdk/config
# POST /v1/sdk/diagnostics {"unresolved":[{"anchor":"size_selector","pageType":"product"}]} → 202
# GET /v1/admin/merchants/{id}/anchor-diagnostics → count 1
npm test -- tests/integration/sdk-config.test.ts
```

## Cierre

```bash
npm run format:check && npm run quality && npm run typecheck && npm run test:all && npm run test:mutation && npm run test:contract && npm run release-check
```

Un commit por historia; PR a `main` sin merge. `release-check` sigue avisando la marca `building`.

## Cambios respecto del plan

Resumen al cierre (2026-09-21): las cuatro historias entraron en cuatro commits, uno por historia,
más el de fundamentos y dos de herramientas (pruebas por alcance; presupuesto del gate de mutación en CI).
Forma final de la semilla (`OPE_MERCHANTS[i]`): `merchantId`, `ingestKeys`, `platformKeys?`,
`platformSecrets?`, `origins`, `experiments?[]` (`experimentId`, `treatmentPercent`, `seed`,
`targetSample`, `cuts?`, `status`, `openedAt`) y cualquier campo de
`MerchantConfigurationDeclared` (la versión 1). Archivos de nivel: `config/platform.json`
(`platform-1`) y `config/treatment-defaults.json` (`defaults-1`), con la forma de
`contracts/components/schemas/{PlatformConfiguration,TreatmentDefaults}.yaml`. Operadores:
`config/dev-operators.json` (`ope_dev_admin_token`). Decisiones tomadas en el camino y
supervivientes de mutación, por historia, en las entradas fechadas que siguen; el gate completo
de mutación es CI (ritmo en dos velocidades, ADR-016 enmendado). Queda para la feature de
calidad: el runner de vitest con corridas grandes; para después de 017: la spec del refactor de
`interface-adapters` por módulo.

- 2026-09-20 T001: línea base en `ccaa60c` (main tras la PR #25); `contract:check` y `npm test` en verde.
- 2026-09-20 T003 (pedido del dueño): `test:scoped` + CI sin `lint`/`arch` repetidos; `tests/hooks/ci.test.ts` actualizado; `resolveBaseRef` compartido en `scripts/lib.mjs` (tres scripts lo duplicaban).
- 2026-09-20 Phase 2: `AdminScopeService` no existe: la regla es del `Operator` (`scopeFor`) y el caso de uso la invoca; `AuditedUseCase` registra aceptadas, rechazadas y **denegadas** en un solo lugar (evita la doble entrada). `StoreUnavailable` (503, `Retry-After`) en el kernel para los stores de la feature. Las notas del glosario resuelven por palabra: `registro-de-administracion` lleva `en: log`, `diagnostico-de-anclajes` `en: diagnostics`, `estrategia-de-sincronizacion` pasa a `en: sync-strategy`; vocabulario técnico ampliado (`_tecnicos.json`). Consumidor `admin` como `server` (sin CORS). Supervivientes de mutación resueltos por reestructura (paginación sin condicional redundante, clave del diagnóstico por `JSON.stringify`) y pruebas (regex del bearer, lector de resultado en rechazos, huella con token vacío).
- 2026-09-20 holdout (decisión del dueño): ADR-022/026 lo mandaban a esta feature. `holdoutPercent` es un default de tratamiento (5) que el merchant sobrescribe en su versión de configuración, **incluido 0** (todo el tráfico a OPE); sin mínimo de plataforma. Abrir un experimento con `treatmentPercent > 100 − holdout` se rechaza (422 `treatment-exceeds-holdout`) en vez de recortar con advertencia (fail-closed y registro). Los merchants de desarrollo y prueba declaran `holdoutPercent: 0` y conservan el 100 %. Se implementa en US2 (default y campo) y US3 (regla al abrir).
- 2026-09-20 US1: módulo `operator` extraído del `admin` (`Operator`, `OperatorId`, errores) para que `merchant` conozca al operador sin depender de `admin` (`CONTEXT_MAP`: `merchant: [shared-kernel, operator]`). `DefaultScopedMerchantService.find` concentra alcance + existencia (403 y 404 con cuerpo idéntico para lo que el operador no alcanza); `rotationResponse` y `pageOf` compartidos (duplicación). `MerchantDirectory` resuelve por huella y `now` (una credencial en gracia sigue valiendo); la ventana máxima de gracia (`ROTATION_GRACE_MAX_HOURS = 168` en `modules/merchant.ts`) y el tope de diagnósticos (`DIAGNOSTICS_KEPT = 200` en `modules/admin.ts`) son las dos constantes que US2 mueve al nivel de plataforma. `MerchantId` acepta `^[A-Za-z0-9_-]{3,64}$` (la semilla de desarrollo usa `m_a`); los ids acuñados son `mrc_` + 12 base32. `ope-required-error-responses` exige `422` sólo con `x-invariants` (fixture `valid-body-without-invariants.yaml`). `test:contract` corre con el header del operador (`CONTRACT_OPERATOR`); Schemathesis avisa 404 en las operaciones con `merchantId` generado, informativo.
- 2026-09-20 US1, mutación: `PolicySet` (las tres políticas) y `PolicySource` (`policySetFor`) separan lo que gobierna de lo que enciende: `configPolicySource` ya no decide `enabled`; `switchAwarePolicyDirectory` lo lee del store (mutante equivalente eliminado por reestructura). El id de merchant es un byte aleatorio por carácter base32 (256 = 8 × 32, sin sesgo; sin bucle de bits). Supervivientes reales cubiertos con pruebas: set sin credencial de ingesta, forma de `Merchant.credential` (`toStrictEqual`), firma registrada sin secreto, orden de expiración con dos vigentes en ambos órdenes del registro, operador `system` sin token, secreto sólo en la credencial `signing` del store, clave ausente sin tocar el minter, DTO durante la gracia (`expiresAt`), `experimentId` en el resultado del registro, store desconocido ⇒ apagado. En la corrida completa varios mutantes **estáticos** (regex del bearer, `Retry-After` de `store-unavailable`, `Merchant.of` ejecutado al cargar el módulo de prueba) figuraron como sobrevivientes y murieron en la corrida enfocada (`--files … --force`): específicos del runner, no del código.
- 2026-09-20 US2: los lectores de forma (`application/configuration/input/`, `Shape` con la primera ofensa y sin `throw`) reemplazan a `composition/{condition,decision-policy,commercial-policy}-config.ts` y sirven por igual a la semilla, a los archivos del release y al body de la API; `readConfig` los usa (la regla `composition-wires-by-module` exceptúa `config.ts`). El contrato admite dos niveles de combinadores en `Condition` (Spectral no resuelve la recursión); el dominio, cualquiera. Un solo tipo de problema para los valores (`invalid-configuration-value`, 422 con `errors[].pointer` en JSON pointer bajo `declared`); los slugs de las fábricas de política siguen en 500 (arranque). Una política declarada se funde campo por campo sobre el default (`PolicyInput.merge`); `TreatmentValues.judge` es el único juez de los valores; `SyncLevelRules` y `FreshnessBudget` pasan al dominio `catalog`. Nivel de plataforma: se agregó `eventPastToleranceMs` (la tolerancia hacia atrás también era constante). `check:behaviour-constants` es el sexto gate de `quality`. La ventana de visitante la aplica `DefaultStateService`; `DecisionService` recibe `barriers` activas y `versions` por `PolicySet`. La semilla publica la versión 1 por `ImportMerchantConfigurationUseCase` (sin congelamiento: la semilla es el origen); con experimento activo la API exige `corrective` + `reason` (409 `configuration-frozen`); el reinicio de ventana llega con US3. `InvalidPlatformConfiguration`/`InvalidTreatmentDefaults` no existen: `InvalidConfigurationValue` con `pointer` cubre los tres niveles. La resolución `readTreatmentDefaults` exige el archivo completo; `check:glossary` resuelve compuestos por secuencia (`commercial-policy` + `declared`).
- 2026-09-21 US2, mutación: la corrida completa (1407 mutantes, 733 estáticos) reportó `mutation runner executed zero tests for 43 covered mutant(s)` y ~200 sobrevivientes; el mismo mutante (`declared.ts:124`) "sobrevive" en la corrida grande y muere solo (`--files …:124-124`): es el runner en corridas grandes, no el código. Veredicto obtenido **archivo por archivo** (`--files <uno> --force`, ~3 min cada uno), donde el runner es fiable. Causa de los estáticos: los helpers de prueba construían los niveles al cargar el módulo; ahora `testLevels()` / `testVisitorWindow()` son perezosos y `state.service.test.ts` construye su sujeto dentro de cada prueba. Queda abierto para la feature de calidad: investigar el runner con corridas grandes (o `ignoreStatic`).
- 2026-09-21 US2, gate de mutación (decisión del dueño): ritmo en dos velocidades — por historia la cadena rápida local; por hito (push/PR) CI corre todo, mutación incluida. `ignoreStatic: true` (ADR-016 enmendado): comprobado a mano que los "sobrevivientes" estáticos (`declared.ts` sin `complete(...)`, `policy-inputs.ts:146`) mueren al aplicarlos. Sobrevivientes no estáticos de US2, todos tratados: 13 reales cubiertos con pruebas (anclaje con campo de más, defaults incompletos, listas que no son listas, combinador `any`, hecho con campo de más, bordes de plataforma y de `holdoutPercent`, `sameContentAs` por bandera y por motivo, selector en blanco en índice 0, `fallback` de idiomas, barreras activas, servicio servido desde memoria, `errors[].pointer` de la razón), 3 equivalentes reestructurados (`path` tipado en los errores del catálogo, `canonical` sin rama `null`) y 2 placeholders del lector con `Stryker disable` motivado.
- 2026-09-21 US3: el experimento nace `calibrating` por `POST .../experiments` (`treatmentPercent`, `seed`, `targetSample`, `cuts` como porcentajes crecientes de la muestra, D-F; sin cortes, la muestra es el único) y el store juzga el set (`Experiments.of`: uno abierto, ids únicos) **dentro** de `open` (01 §6); `multiple-active-experiments` desaparece a favor de `experiment-already-open` (409) y `invalid-treatment-share`/`invalid-seed` pasan a 422 porque ahora los emite la API. El holdout se lee por el puerto `HoldoutSource` (la composición lo enlaza a la configuración efectiva; el módulo `experiment` no importa `configuration`) y lo juzga `Experiment.withinHoldout` en buckets enteros. `activate`/`close` son idempotentes (200 sin cambio); `close` desde calibración deja `activatedAt` vacío. `AssignmentService.assign` devuelve `{ assignment, phase }` y `DecisionService` estampa `phase: calibration`; el DTO del SDK no cambia. La versión correctiva sólo congela y reinicia con experimento **activo** (en calibración es una versión más, `windowRestarted: false`); un store que numere una correctiva sin motivo es error de programación (cubierto con un store falso). `ImportExperimentsUseCase` (módulo `experiment`, no `ImportMerchantsUseCase`: el mapa de contextos no deja a `merchant` conocer `experiment`) abre los de la semilla sólo con el store vacío; `CONTEXT_MAP`: `experiment` gana `merchant` (alcance del operador). Compartido para no duplicar: `DefaultExperimentLookupService` (alcance + existencia del experimento), `transitionResponse` (activar/cerrar) y `merchantPageResponse` (listados paginados de un merchant, también el de versiones), `gateways/shared-kernel/random-id.ts` (ids `mrc_`/`exp_`). Semilla: `startedAt` → `openedAt`, `targetSample` obligatorio, `cuts` opcional; `Experiment.rehydrate` en pruebas por `tests/helpers/experiments.ts`.
- 2026-09-21 US4: `getSdkConfig` y `reportAnchorDiagnostics` viven en el módulo `admin` (dueño del diagnóstico) con tag `ingest` y `ingestKey`; la vista del SDK entra por el puerto `SdkConfigurationSource` (no se importa `configuration`: la composición enlaza `sdkConfigurationOf`), y `GetSdkConfigUseCase` recibe el `Merchant` resuelto por el security handler para `enabled` (sin store ni segundo lookup). Sin `x-invariants` en las dos operaciones del SDK: la regla de `Origin` la aplica el security handler y `ope-required-error-responses` exigiría un 422 sin invariante que lo produzca. `PageType` pasa a esquema propio (mismo enum; `PageContext` lo referencia). Sin `SdkLocales` ni `SdkConfigurationView` en el contrato: `Locales` y `AnchorMap` se reutilizan. `diagnostico-de-anclajes` pasa a `en: diagnostic` (resuelve `AnchorDiagnostic` y el segmento `anchor-diagnostics`). `merchantPageResponse` sirve también `listAnchorDiagnostics`. Tope de plataforma probado con `resetPorts({ config: { levels } })` (`anchorDiagnosticsKept: 2`).
- 2026-09-21 cierre, gate de mutación en CI (27 sobrevivientes en 58 min, corrida completa de la rama): 17 eran `closed`/`required`/`has` de los lectores de forma (`declared.ts`, `platform.ts`, `policies.ts`, `condition.ts`) que ninguna prueba ejercía con un campo de más o de menos en ese registro — reales, aunque en US2 se los tomó por estáticos del runner; `tests/unit/application/configuration/readers.test.ts` cierra cada registro de los tres lectores. Reales también: `get`/`update` del store de experimentos con varios experimentos, `maxIds: 0`, versión de defaults en blanco, secreto de firma vacío, `details.path` del presupuesto de frescura. Equivalentes reestructurados: los spreads condicionales de `reason` y `fallback` en los controllers (los tipos admiten `undefined`), las ramas de camino vacío de `PolicyInput.located` (toda fábrica nombra su campo). CI: `concurrency` por rama (un push cancela al anterior; la PR del mismo repo no duplica el run), presupuesto de 60 min y el incremental se guarda aunque el gate falle (`actions/cache/save` con `if: always()`): la corrida siguiente re-testea sólo lo que cambió.
