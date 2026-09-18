# Quickstart — Feature 008: validar la forma de la capa de aplicación

## 1. Todo junto

```bash
npm run contract:check && npm run quality && npm test && npm run test:contract && npm run release-check
```

Esperado: todo en 0; `contract:diff` reporta "No incompatible changes" (el contrato no cambia);
`check:api-map` sin cambio.

## 2. Forma de los casos de uso (US1, US2)

```bash
npm run lint && npm run arch
npx vitest run tests/lint tests/architecture
```

Cubre: cada fixture de `tests/lint/fixtures/as-src/` de las reglas `ope/use-case-shape`,
`ope/dependencies-are-interfaces`, `ope/domain-error-shape`, `ope/no-throw-domain-error` y
`ope/no-generic-catch-in-application` falla con su regla; los fixtures de
`tests/architecture/fixtures/src/` de `use-cases-no-use-cases`, `services-no-use-cases` y
`problem-translation-only-in-http` fallan con su regla. Manual: crear
`src/application/ingestion/use-cases/foo.ts` con `export class Foo {}` → `npm run lint` falla
nombrando el archivo; hacer que un caso de uso importe otro → `npm run arch` falla nombrando
ambos.

## 3. Errores tipados y réplica (US3, US4)

```bash
npx vitest run tests/unit/domain/shared-kernel tests/unit/http/to-problem.test.ts tests/unit/application
```

Cubre: `Result` cerrado sobre `DomainError` (prueba de tipos en `tests/types/`), `switch`
exhaustivo sobre `error.code`, todo `code` de `domain/**/errors.ts` existe en
`contracts/problem-types.yaml` y es único, `toProblem` produce `type`/`status`/`title`/`detail`/
`instance` y `Retry-After` para `ledger-unavailable`. Las pruebas de integración de 004–007
(`tests/integration/`) pasan sin cambios en aserciones.

## 4. Decorador de registro (US5)

```bash
npx vitest run tests/unit/application/shared-kernel/logged-use-case.test.ts
npm run dev   # y enviar un lote como en la quickstart de la 007
```

Esperado en el log: una entrada `{ useCase: "ingestBatch", durationMs, outcome: "ok" }` (o
el `code` del error) sin request ni `visitorId`.

## 5. Sin cambio de comportamiento (FR-052)

```bash
git diff main -- tests/integration tests/contract-rules contracts | grep -c "^[-+]expect"   # esperado: 0
npm run test:mutation
```

## Estado al cierre (histórico, 2026-09-17)

| Comando                                                                                        | Resultado                                                                                      |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm test` al inicio (T001)                                                                    | 57 archivos, 426 pruebas                                                                       |
| `npm test` al cierre                                                                           | 63 archivos, 453 pruebas (las nuevas: tipos, réplica, reglas, decorador, `IngestBatchUseCase`) |
| `npm run quality`                                                                              | 5 gates en verde; `Lint exceptions: 0`                                                         |
| `npm run test:mutation`                                                                        | every mutant died                                                                              |
| `npm run test:contract` (Schemathesis)                                                         | verde, sin cambios en el contrato                                                              |
| `git diff main -- tests/integration tests/contract-rules contracts \| grep -c "^[-+] *expect"` | 0                                                                                              |
