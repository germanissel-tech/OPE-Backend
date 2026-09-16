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
`getHealth` responda `203` y volver a correr → falla con `status_code_conformance` en
`GET /v1/health`.

## 7. Compatibilidad (FR-020)

Automática en `tests/contract-diff/diff.test.ts` (7 incompatibles fallan, 2 compatibles
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

| Elemento | Estado | Evidencia |
|---|---|---|
| Contrato multi-archivo + reglas | por completar en implement | `npm run contract:check` |
| Servidor `getHealth` | por completar | `npm test` |
| Mock / docs / tipos / cliente | por completar | secciones 2, 4, 5 |
| Pruebas de contrato generadas | por completar | `npm run test:contract` |
| CI | por completar | run verde en GitHub Actions |
