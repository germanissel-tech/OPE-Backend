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

| Fecha      | Elemento                                                       | Estado         | Evidencia                                                                                                                        |
| ---------- | -------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-17 | Plan aprobado; hash y reparto verificados                      | —              | research R-01: FNV-1a ±0,3 pp sobre 100k visitantes                                                                              |
| 2026-09-17 | US4 semántica de escritura del ledger (ADR-021)                | BUILT / TESTED | `RecordOutcome`; `tests/integration/ledger-unavailable.test.ts` (ingesta 202 `ledger-unavailable`, exposición 503, recuperación) |
| 2026-09-17 | US1 asignación determinista y estable                          | BUILT / TESTED | `tests/unit/domain/experiment/assignment.test.ts` (determinismo, reparto 50/20/80 ±1 pp, independencia, bordes, vectores FNV)    |
| 2026-09-17 | US2 registro `ASSIGNED` idempotente                            | BUILT / TESTED | `tests/unit/application/experiment/assign-visitor.test.ts`, `memory-assignment-ledger.test.ts`, `integration/assignment.test.ts` |
| 2026-09-17 | US3 CONTROL en el mismo pipeline, brazo nunca como campo       | BUILT / TESTED | `integration/assignment.test.ts`; latencia por brazo p95 CONTROL 1,10 ms / TREATMENT 0,91 ms (inject, Windows)                   |
| 2026-09-17 | Aislamiento (mismo visitante en dos merchants; cerrado/activo) | TESTED         | `integration/isolation.test.ts`                                                                                                  |
| 2026-09-17 | US5 prueba de carga informativa (`npm run test:load`)          | BUILT          | Windows 11, Node 22, perfil memoria, servidor construido, lotes de 20 eventos (ver abajo)                                        |

Cifras de carga de referencia (2026-09-17, misma máquina; autocannon expone p90 y p97,5, no
p95; **no es SLA**):

| Duración | Conexiones | Lotes/s | p50   | p90    | p97,5  | p99    | Errores |
| -------- | ---------- | ------- | ----- | ------ | ------ | ------ | ------- |
| 5 s      | 20         | 1895    | 9 ms  | 16 ms  | 20 ms  | 22 ms  | 0       |
| 30 s     | 20         | 931     | 18 ms | 39 ms  | 46 ms  | 49 ms  | 0       |
| 15 s     | 100        | 1101    | 63 ms | 187 ms | 223 ms | 238 ms | 0       |

Lectura: una instancia en memoria sostiene ~1.000 lotes/s (~20.000 eventos/s) con 20
conexiones; el throughput cae con la duración porque el ledger y la deduplicación en memoria
crecen sin límite de retención (argumento para la 008: persistencia con buffer acotado). Con
100 conexiones la latencia sube por encima del objetivo de diseño de 150 ms en p99 sólo en
cola; el piloto (01 §5.6) está órdenes de magnitud por debajo de estas cifras.
