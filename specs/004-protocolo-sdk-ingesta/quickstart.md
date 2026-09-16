# Quickstart — Feature 004: validar el protocolo del SDK y la composición

## 1. Todo junto

```bash
npm run contract:check && npm run typecheck && npm run arch && npm test && npm run test:contract && npm run release-check
```

Esperado: todo en 0; `check:glossary`, `check:invariant-tests` y `check:markers` sin problemas
(sólo `PROPUESTO` en la intervención y el protocolo de decisión, que no bloquean).

## 2. Composición y arquitectura (US1)

```bash
npm run arch                                  # 0 violaciones con la configuración de anillos + módulos
npx vitest run tests/architecture             # un fixture por regla: cada uno falla por el nombre esperado
npx vitest run tests/integration/bootstrap    # bootstrap con override de clock; close() cierra todo
```

Manual: en `src/domain/ingestion/batch.ts` agregar `import { x } from "../../application/ingestion/index.js"`
→ `npm run arch` falla con `domain-is-pure`. En `src/application/ledger/confirm-exposure.ts`
importar `../merchant/ports/merchant-directory.js` (no el `index.ts`) → `modules-only-via-index`.
Importar `../system/index.js` desde `ledger` → `context-map:ledger`.

## 3. Ingesta (US2) y decisión (US3)

```bash
npm run contract:mock            # merchant de prueba por defecto; clave en la salida
```

```bash
curl -s -X POST http://localhost:3000/v1/events \
  -H "content-type: application/json" -H "X-OPE-Ingest-Key: <clave>" \
  -d '{"events":[{"type":"product_viewed","eventId":"evt_00000001","sessionId":"ses_00000001","visitorId":"vis_00000001","occurredAt":"<ahora en RFC 3339>","page":{"pageType":"product","productId":"SKU-1"},"device":"mobile"}]}'
```

(el ejemplo completo del contrato está en `contracts/examples/event-batch.yaml`)

Esperado: `202` con `accepted`, `duplicates`, `results[]` y `decision.outcome = "NO_OP"` con
`reason` del catálogo. Repetir el mismo lote → los mismos `eventId` vuelven como `duplicate`.
Sin la clave → `401 urn:ope:problem:unauthorized`. Con un campo extra en un evento → `400` con
el puntero exacto. Con dos `visitorId` en el lote → `422 urn:ope:problem:session-visitor-mismatch`.

Automático: `npx vitest run tests/integration/ingest-events tests/unit/domain/ingestion`.

## 4. Exposición (US4)

```bash
npx vitest run tests/integration/confirm-exposure
```

Cubre: decisión inexistente y de otro merchant → `422 exposure-decision-unknown` (misma
respuesta); decisión `NO_OP` → `422 exposure-of-no-op`; decisión `INTERVENE` inyectada en el
ledger → `201 recorded`, segunda vez `200 already-recorded`.

## 5. Orígenes (US5)

```bash
npx vitest run tests/integration/cors
```

Manual: `curl -i -X OPTIONS http://localhost:3000/v1/events -H "Origin: https://tienda-de-prueba.example" -H "Access-Control-Request-Method: POST"`
→ `204` con `Access-Control-Allow-Origin`; con un origen no registrado → sin ese header. Un
`POST` con clave del merchant A y `Origin` del merchant B → `403 origin-not-allowed`.

## 6. Aislamiento, latencia y privacidad

```bash
npx vitest run tests/integration/isolation tests/integration/ingest-latency tests/integration/logging-privacy
```

`ingest-latency` imprime p50/p95 de 200 lotes de 20 eventos (SC-003: p95 < 50 ms).
`logging-privacy` captura el log y afirma que no aparecen IP, `remoteAddress` ni la clave.

## 7. Contrato

```bash
npm run contract:check          # lint, bundle, diff (compatible: sólo operaciones nuevas), tipos al día, 4 checks
npm run contract:docs           # docs/api/index.html con las tres operaciones y la unión de eventos
npm run test:contract           # Schemathesis sobre getHealth, ingestEvents y confirmExposure
```

## Estado (histórico, fechado)

| Fecha      | Elemento                                                          | Estado         | Evidencia                                                                                                                     |
| ---------- | ----------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-16 | Plan aprobado; diseño del contrato validado                       | —              | `specs/004-protocolo-sdk-ingesta/contracts/` pasa Redocly + Spectral + bundle + tipos                                         |
| 2026-09-16 | US1 anillos, módulos, composición tipada                          | BUILT / TESTED | `npm run arch` 0 violaciones; `tests/architecture` (13 reglas con fixture); `tests/integration/bootstrap.test.ts`             |
| 2026-09-16 | US5 credencial de ingesta y CORS por merchant                     | BUILT / TESTED | `tests/integration/ingest-key.test.ts`, `cors.test.ts`; `[invariant:origin-not-allowed]`                                      |
| 2026-09-16 | US2 ingesta deduplicada y validada                                | BUILT / TESTED | `tests/integration/ingest-events.test.ts` (18 casos), `tests/unit/domain/ingestion`, `logging-privacy.test.ts`                |
| 2026-09-16 | US3 decisión NO_OP inline con motivo                              | BUILT / TESTED | `tests/unit/domain/ledger/decision.test.ts`, `no-op-reasons.test.ts`; protocolo `PROPUESTO` para el SDK                       |
| 2026-09-16 | US4 confirmación de exposición                                    | BUILT / TESTED | `tests/integration/confirm-exposure.test.ts`; `[invariant:exposure-decision-unknown]`, `[invariant:exposure-of-no-op]`        |
| 2026-09-16 | Aislamiento entre merchants (FR-050)                              | TESTED         | `tests/integration/isolation.test.ts` (dedup, decisiones, exposiciones, orígenes, credenciales)                               |
| 2026-09-16 | Latencia de ingesta (SC-003)                                      | TESTED         | 200 lotes × 20 eventos vía `inject`: p50 = 0,55 ms, p95 = 0,87 ms, máx 1,83 ms (Windows, perfil memoria)                      |
| 2026-09-16 | Schemathesis sobre `getHealth`, `ingestEvents`, `confirmExposure` | TESTED         | `npm run test:contract`: 1685 casos generados, 0 fallas                                                                       |
| 2026-09-16 | Hallazgos corregidos durante la implementación                    | —              | `discriminator.mapping` vs Ajv/openapi-typescript (R-05); `type: object` en `Event` (Schemathesis); mapa `ingestion → ledger` |
