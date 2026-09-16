# Quickstart — Feature 001: validar la cadena de herramientas del contrato

Guía de validación ejecutable. Cada bloque dice qué correr y qué debe pasar. El estado
(BUILT / TESTED) sólo se marca cuando el comando corrió y dio ese resultado.

## Prerrequisitos

- Node.js 22 (`.nvmrc`), npm 10+.
- `uv` instalado (`uvx --version`) para las pruebas de contrato con Schemathesis.
- Red disponible la primera vez que corre `contract:diff` (descarga el binario de oasdiff a
  `node_modules/.cache/oasdiff/`).
- Repo con rama `main` disponible (`git fetch origin main`) para la comparación de
  compatibilidad. Si `main` no tiene contrato, la comparación se omite con aviso.

```bash
npm ci
```

## 1. Verificación del contrato (US1)

```bash
npm run contract:check
```

Esperado: sale 0; imprime lint de Redocly y Spectral sin errores ni warnings, bundle creado en
`contracts/dist/openapi.yaml`, `AVISO: sin contrato base, comparación omitida` (mientras
`main` no tenga contrato) o `Sin cambios incompatibles`, y `Tipos generados al día`.

Prueba negativa manual (opcional; la automática está en `tests/contract-rules/`):

```bash
# agregar en contracts/paths/health.yaml, bajo get:, un parámetro de query llamado merchantId
npm run contract:lint
```

Esperado: sale ≠ 0 con `ope-no-merchant-id-in-request`, `contracts/paths/health.yaml:<línea>`
y el mensaje con la corrección. Revertir el cambio.

## 2. Tipos y cliente (US3)

```bash
npm run contract:types          # regenera src/generated/api.d.ts
git status --short src/generated  # sin cambios: la generación es determinista y está al día
npm run typecheck               # incluye tests/types/client.test-d.ts (SC-007)
```

Esperado: `git status` vacío; `typecheck` sale 0. Editar a mano `src/generated/api.d.ts` y
correr `npm run contract:types:check` debe salir ≠ 0 con `Tipos generados desactualizados`.

## 3. Servidor real (US2)

```bash
npm run build && npm test
```

Esperado: Vitest en verde. `tests/integration/server.test.ts` cubre: `200` de `getHealth`
con cuerpo válido; `404`/`405`/`501` como `application/problem+json`; `400` ante query
desconocida y ante JSON inválido con `errors[]`; `500` cuando el manejador devuelve un cuerpo
fuera del contrato (el cuerpo inválido no sale) y cuando lanza; arranque rechazado con
contrato inválido; `register` rechazado con `operationId` inexistente (SC-005).

Manual:

```bash
npm run dev
curl -i http://127.0.0.1:3000/v1/health
curl -i "http://127.0.0.1:3000/v1/health?x=1"
curl -i http://127.0.0.1:3000/nope
```

Esperado: `200` JSON `{status, contractVersion, timestamp}`; `400` problem+json con
`errors[0].pointer = "/query/x"`; `404` problem+json con `type: urn:ope:problem:not-found`.

## 4. Mock (US3)

```bash
npm run contract:mock
curl -i http://127.0.0.1:3000/v1/health
curl -i "http://127.0.0.1:3000/v1/health?x=1"
```

Esperado: `200` con exactamente el ejemplo `health-ok` del contrato; `400` idéntico al del
servidor real (mismo código, mismo `type`).

## 5. Documentación (US4)

```bash
npm run contract:docs
```

Esperado: `docs/api/index.html` autocontenido con `getHealth`, su descripción, el ejemplo y
las respuestas `400`/`500`. Correrlo dos veces produce el mismo archivo (SC-006). Con un
contrato que no pasa `contract:check`, el comando falla antes de generar.

## 6. Pruebas de contrato generadas (US5)

```bash
npm run test:contract
```

Esperado: levanta el servidor en un puerto efímero, corre Schemathesis con `--checks all`
sobre `contracts/dist/openapi.yaml` y termina sin fallas. Prueba negativa: hacer que
`getHealth` responda `203` (`OPE_HANDLERS_MODULE=tests/contract/fixtures/health-203.ts`) y
volver a correr → falla en `GET /v1/health` (el servidor convierte el código no declarado en
`500 response-contract-violation`; Schemathesis lo reporta como *Server error*).

## 7. Compatibilidad (FR-020)

Automática en `tests/contract-diff/diff.test.ts` (8 incompatibles fallan, 2 compatibles
pasan, con bump de major pasa). Manual, una vez que `main` tenga contrato:

```bash
# quitar contractVersion de contracts/components/schemas/Health.yaml
npm run contract:diff
```

Esperado: sale ≠ 0 con `response-required-property-removed` (o `-optional-`) en
`GET /v1/health`. Subir `info.version` a `2.0.0` y prefijo a `/v2` → sale 0 con
`Cambio incompatible esperado: versión mayor 1 → 2`.

## 8. CI

Push de la rama y abrir PR: el workflow `ci` corre `contract:check`, `build`, `test`,
`test:contract` y termina en < 5 min (SC-004).

## Estado al cierre de la feature

Corrida completa el 2026-09-16 en Windows 11 / Node 22.23.2 (rama `001-api-contract-toolchain`).

| Elemento | Estado | Evidencia |
|---|---|---|
| Contrato multi-archivo + 13 reglas `ope-*` + heredadas | BUILT / TESTED | `npm run contract:check` exit 0 en **9 s** (SC-002 < 30 s); `tests/contract-rules` 29/29 con un fixture por regla (SC-001) |
| Compatibilidad (oasdiff + severidades) | BUILT / TESTED | `tests/contract-diff` 13/13: 8 incompatibles fallan, 2 compatibles pasan, bump de major pasa, sin base se omite con aviso |
| Servidor `getHealth` (Fastify + openapi-backend) | BUILT / TESTED | `tests/integration/server.test.ts` 14/14; `curl` manual §3 (200, 400 `/query/x`, 404, 405 `Allow: GET`) |
| Tipos de manejador (FR-046) y cliente (SC-007) | BUILT / TESTED | `npm run typecheck` exit 0 con `tests/types/*.test-d.ts` (`@ts-expect-error` en los usos incorrectos) |
| Mock | BUILT / TESTED | `tests/integration/mock.test.ts` 3/3; `curl` manual §4 devuelve el ejemplo y el mismo 400 que el real |
| Tipos generados y drift | BUILT / TESTED | `contract:types` dos veces → `git status` limpio (SC-006); `tests/unit/contract-types-check.test.ts` 2/2 |
| Docs | BUILT / TESTED | `tests/unit/contract-docs.test.ts` 2/2: autocontenido (sin script/link remotos), byte a byte idéntico en dos corridas (SC-006), rechaza contrato inválido |
| Pruebas de contrato generadas | BUILT / TESTED | `npm run test:contract` exit 0 (9 casos, 6 s); negativa con `health-203.ts` exit 1 reportando `GET /v1/health` |
| SC-003 (texto de la operación sólo en `contracts/`) | TESTED | `grep -r "Estado del servicio"` fuera de `contracts/`, `docs/`, `specs/`: sólo `src/generated/api.d.ts` (derivado) y una aserción en `tests/unit/contract-docs.test.ts` |
| Suite completa | TESTED | `npm test` 68/68 en 8 archivos (34 s) |
| CI (`.github/workflows/ci.yml`) | BUILT | Sin ejecución todavía: no hay push. SC-004 (< 5 min) queda por verificar en el primer run; estimado local ≈ 1 min sin contar `npm ci`. |
