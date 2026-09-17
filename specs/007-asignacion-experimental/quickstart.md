# Quickstart — Feature 007: validar la asignación experimental y el ledger

## 1. Todo junto

```bash
npm run contract:check && npm run quality && npm test && npm run test:contract && npm run release-check
```

Esperado: todo en 0; `check:api-map` sigue en `3 built, 20 planned` (ninguna operación nueva).

## 2. Asignación determinista y estable (US1)

```bash
npx vitest run tests/unit/domain/experiment
```

Cubre: mismo visitante mil veces → mismo brazo; 100 000 visitantes con repartos 50/20/80 →
±1 pp; mismo visitante en dos merchants → independencia; 0 % y 100 %; `activeExperiment` con
cerrado y activo. Manual: cambiar `seed` en la configuración de prueba y ver que los brazos
cambian (es un experimento distinto).

## 3. Registro `ASSIGNED` y orquestación (US2, US3)

```bash
npx vitest run tests/integration/assignment.test.ts tests/unit/application/experiment
```

Con un merchant configurado con experimento activo (`OPE_MERCHANTS` con `experiments`):

```bash
npm run dev
curl -s -X POST http://127.0.0.1:3000/v1/events -H "content-type: application/json" \
  -H "X-OPE-Ingest-Key: <clave>" -d '{"events":[{"type":"product_viewed","eventId":"evt_00000001","sessionId":"ses_00000001","visitorId":"vis_00000001","occurredAt":"<ahora>","page":{"pageType":"product","productId":"SKU-1"},"device":"mobile"}]}'
```

Esperado: `decision.reason` es `control-arm` o `decision-plane-unavailable` según el brazo del
visitante; el cuerpo no contiene `arm` ni `experimentId`. Repetir con otro `eventId` → la
misma sesión/visitante recibe el mismo motivo (mismo brazo).

## 4. Ledger no disponible (US4)

```bash
npx vitest run tests/integration/ledger-unavailable.test.ts
```

Ingesta con el ledger de asignaciones o de decisiones no disponible → `202` con
`decision.reason = "ledger-unavailable"`, sin asignación ni decisión registradas; exposición →
`503 urn:ope:problem:ledger-unavailable` con `Retry-After`; con el ledger de vuelta, todo
normal.

## 5. Carga informativa (US5)

```bash
npm run build && npm run test:load                 # 30 s, 20 conexiones
OPE_LOAD_DURATION=10 OPE_LOAD_CONNECTIONS=50 npm run test:load
```

Imprime `load: … batches/s, p50 … ms, p95 … ms, p99 … ms, errors …, non2xx …`. Siempre termina
en 0 (salvo que el servidor no arranque).

## 6. Aislamiento y latencia

```bash
npx vitest run tests/integration/isolation.test.ts tests/integration/ingest-latency.test.ts
```

## Estado (histórico, fechado)

| Fecha      | Estado                                                |
| ---------- | ----------------------------------------------------- |
| 2026-09-17 | Plan aprobado; hash y reparto verificados; sin código |
