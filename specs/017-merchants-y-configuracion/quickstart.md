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

- 2026-09-20 T001: línea base en `ccaa60c` (main tras la PR #25); `contract:check` y `npm test` en verde.
- 2026-09-20 T003 (pedido del dueño): `test:scoped` + CI sin `lint`/`arch` repetidos; `tests/hooks/ci.test.ts` actualizado; `resolveBaseRef` compartido en `scripts/lib.mjs` (tres scripts lo duplicaban).
- 2026-09-20 Phase 2: `AdminScopeService` no existe: la regla es del `Operator` (`scopeFor`) y el caso de uso la invoca; `AuditedUseCase` registra aceptadas, rechazadas y **denegadas** en un solo lugar (evita la doble entrada). `StoreUnavailable` (503, `Retry-After`) en el kernel para los stores de la feature. Las notas del glosario resuelven por palabra: `registro-de-administracion` lleva `en: log`, `diagnostico-de-anclajes` `en: diagnostics`, `estrategia-de-sincronizacion` pasa a `en: sync-strategy`; vocabulario técnico ampliado (`_tecnicos.json`). Consumidor `admin` como `server` (sin CORS). Supervivientes de mutación resueltos por reestructura (paginación sin condicional redundante, clave del diagnóstico por `JSON.stringify`) y pruebas (regex del bearer, lector de resultado en rechazos, huella con token vacío).
- 2026-09-20 holdout (decisión del dueño): ADR-022/026 lo mandaban a esta feature. `holdoutPercent` es un default de tratamiento (5) que el merchant sobrescribe en su versión de configuración, **incluido 0** (todo el tráfico a OPE); sin mínimo de plataforma. Abrir un experimento con `treatmentPercent > 100 − holdout` se rechaza (422 `treatment-exceeds-holdout`) en vez de recortar con advertencia (fail-closed y registro). Los merchants de desarrollo y prueba declaran `holdoutPercent: 0` y conservan el 100 %. Se implementa en US2 (default y campo) y US3 (regla al abrir).
- 2026-09-20 US1: módulo `operator` extraído del `admin` (`Operator`, `OperatorId`, errores) para que `merchant` conozca al operador sin depender de `admin` (`CONTEXT_MAP`: `merchant: [shared-kernel, operator]`). `DefaultScopedMerchantService.find` concentra alcance + existencia (403 y 404 con cuerpo idéntico para lo que el operador no alcanza); `rotationResponse` y `pageOf` compartidos (duplicación). `MerchantDirectory` resuelve por huella y `now` (una credencial en gracia sigue valiendo); la ventana máxima de gracia (`ROTATION_GRACE_MAX_HOURS = 168` en `modules/merchant.ts`) y el tope de diagnósticos (`DIAGNOSTICS_KEPT = 200` en `modules/admin.ts`) son las dos constantes que US2 mueve al nivel de plataforma. `MerchantId` acepta `^[A-Za-z0-9_-]{3,64}$` (la semilla de desarrollo usa `m_a`); los ids acuñados son `mrc_` + 12 base32. `ope-required-error-responses` exige `422` sólo con `x-invariants` (fixture `valid-body-without-invariants.yaml`). `test:contract` corre con el header del operador (`CONTRACT_OPERATOR`); Schemathesis avisa 404 en las operaciones con `merchantId` generado, informativo.
- 2026-09-20 US1, mutación: `PolicySet` (las tres políticas) y `PolicySource` (`policySetFor`) separan lo que gobierna de lo que enciende: `configPolicySource` ya no decide `enabled`; `switchAwarePolicyDirectory` lo lee del store (mutante equivalente eliminado por reestructura). El id de merchant es un byte aleatorio por carácter base32 (256 = 8 × 32, sin sesgo; sin bucle de bits). Supervivientes reales cubiertos con pruebas: set sin credencial de ingesta, forma de `Merchant.credential` (`toStrictEqual`), firma registrada sin secreto, orden de expiración con dos vigentes en ambos órdenes del registro, operador `system` sin token, secreto sólo en la credencial `signing` del store, clave ausente sin tocar el minter, DTO durante la gracia (`expiresAt`), `experimentId` en el resultado del registro, store desconocido ⇒ apagado. En la corrida completa varios mutantes **estáticos** (regex del bearer, `Retry-After` de `store-unavailable`, `Merchant.of` ejecutado al cargar el módulo de prueba) figuraron como sobrevivientes y murieron en la corrida enfocada (`--files … --force`): específicos del runner, no del código.
