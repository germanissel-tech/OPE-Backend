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

_(se completa durante la implementación)_
