# Quickstart — Feature 009: validar el dominio rico

## 1. Todo junto

```bash
npm run contract:check && npm run quality && npm test && npm run test:contract && npm run release-check
```

Esperado: todo en 0; `contract:diff` "No incompatible changes"; `check:markers` lista el
`PROPUESTO` de ADR-024 (stub de decisión → feature 011).

## 2. Sólo existe válido (US1)

```bash
npx vitest run tests/unit/domain
```

Cubre: `EventBatch.of` con dos visitantes → `session-visitor-mismatch`; fuera de tolerancia →
`event-timestamp-out-of-range`; `Experiment.of` con tasa 1.5 o semilla vacía → error del
módulo; `Merchant.of` con origen `ftp:/x` → `invalid-origin`; `NoOpDecision`/`InterveneDecision`
y `rehydrate` por `outcome`.

## 3. Reglas con su dueño y regla de lint (US2)

```bash
npx vitest run tests/unit/domain/experiment/assignment-regression.test.ts tests/lint
npm run lint
```

Cubre: 100 000 visitantes × 3 repartos con el mismo fingerprint que antes del refactor;
`tests/lint/fixtures/as-src/domain/demo/loose-function.ts` falla con
`ope/domain-no-loose-functions`. Manual: agregar `export function f() {}` a cualquier archivo
de `src/domain/<módulo>/` → `npm run lint` falla nombrándolo.

## 4. Fail-closed en configuración (US3)

```bash
OPE_MERCHANTS='[{"merchantId":"m_x","ingestKeys":["k"],"origins":["https://ok.example"],"experiments":[{"experimentId":"exp_x","treatmentPercent":150,"seed":"s","status":"active","startedAt":"2026-09-18T00:00:00Z"}]}]' npm run dev
```

Esperado: no arranca; el error nombra `merchants[0].experiments[0].treatmentPercent`. Ídem con
`"origins":["not an origin"]` → `merchants[0].origins[0]`.

## 5. Políticas y puertos (US4)

```bash
grep -rn "DEDUP_WINDOW" src/           # sólo application/ingestion/policies y composición
grep -rn "Promise<.*> |" src/application/**/ports   # esperado: nada
npx vitest run tests/integration
```

## Estado al cierre (histórico)

Se completa al terminar la implementación.
