# Quickstart — Feature 003: validar lint, formato y tipado

## 1. Todo junto

```bash
npm run format:check && npm run lint && npm run typecheck && npm run arch && npm test
```

Esperado: todo en 0; `lint` termina con `Excepciones de lint: 0`.

## 2. El tipado fuerte se hace cumplir (US1)

Automático: `npx vitest run tests/lint`. Manual, en `src/domain/health.ts`:

```ts
export const leak: any = 1; // → @typescript-eslint/no-explicit-any
```

```bash
npm run lint      # falla nombrando src/domain/health.ts, línea y regla
git checkout src/domain/health.ts
```

Lo mismo con `void Promise.resolve()` sin manejar (`no-floating-promises`), `x!`
(`no-non-null-assertion`), un `switch` sobre `ServiceStatus` sin `degraded`
(`switch-exhaustiveness-check`), y `// eslint-disable-next-line` sin `-- motivo`
(`eslint-comments/require-description`).

## 3. Formato (US2)

```bash
npx vitest run tests/format
# manual: quitar un punto y coma en src/main.ts
npm run format:check   # falla nombrando src/main.ts
npm run format         # lo corrige; format:check pasa; correrlo de nuevo no cambia nada
```

## 4. Tipos en scripts (US3)

```bash
npx vitest run tests/typecheck
# manual: en scripts/check-markers.mjs escribir `found.lenght` en vez de `found.length`
npm run typecheck      # falla: TS2339 en scripts/check-markers.mjs
node scripts/check-markers.mjs   # sigue corriendo igual (los scripts no se compilan)
```

## 5. Compilador endurecido (US4)

`npx vitest run tests/typecheck` cubre TS4111 (index signature con punto), TS2307 (import
con efectos secundarios inexistente) y TS1294 (`enum`). `npm run build` pasa.

## 6. Hook (US5)

```bash
npx vitest run tests/hooks
# manual:
echo "const x=1" >> src/main.ts && git add src/main.ts && git commit -m "prueba"
# → rechazado por prettier (y por lint). Deshacer: git reset src/main.ts && git checkout src/main.ts
```

Un clon nuevo: `npm ci` deja el hook instalado (`.git/hooks/pre-commit` existe).

## 7. Sin cambio de comportamiento (SC-004)

`npm test` con las aserciones de la 001 y la 002 intactas; `npm run test:contract` 9/9;
los `curl` de `specs/001-api-contract-toolchain/quickstart.md` §3/§4 iguales.

## Estado al cierre de la feature

Corrida completa el 2026-09-16 en Windows 11 / Node 22.23.2 (rama `003-calidad-de-codigo`).
Cifras históricas de esa corrida; el estado vivo lo informan los comandos.

| Elemento                              | Estado         | Evidencia                                                                                                                                                                                                      |
| ------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format:check` + `lint` + `typecheck` | BUILT / TESTED | exit 0 en **14 s** (SC-002 < 60 s); `Excepciones de lint: 0` (SC-003)                                                                                                                                          |
| Reglas de lint clave                  | TESTED         | `tests/lint` 15/15: 14 fixtures fallan con su regla (`no-explicit-any`, `no-unsafe-*`, promesas, `!`, `switch`, imports, directivas sin motivo/sin uso, `@ts-expect-error` sin descripción); `valid.ts` limpio |
| Formato                               | TESTED         | `tests/format` 3/3: falla, corrige, idempotente, LF; lista única en `.prettierignore`                                                                                                                          |
| `checkJs` en scripts                  | TESTED         | `tests/typecheck` 2/2 para scripts: TS2551 en `bad-script.mjs` y el script ejecuta igual con `node`; manual: `lenght` en `check-markers.mjs` → `typecheck` falla y el script sigue corriendo                   |
| Compilador endurecido                 | TESTED         | `tests/typecheck` 4/4: TS4111, TS2307, TS1294 y `valid.ts`; `npm run build` OK                                                                                                                                 |
| Hook de pre-commit                    | BUILT / TESTED | `tests/hooks` 3/3; manual: archivo mal formateado → commit rechazado en **5 s**; la instalación la hace `npm install` (`.git/hooks/pre-commit`)                                                                |
| Sin cambio de comportamiento (SC-004) | TESTED         | suite anterior sin tocar aserciones; `test:contract` 9/9; `arch` 0 violaciones                                                                                                                                 |
| Suite completa                        | TESTED         | `npm test` 135/135 en 21 archivos (40 s); `release-check: OK`                                                                                                                                                  |
| CI                                    | BUILT          | `format:check` y `lint` agregados al workflow; se verifica en el primer push                                                                                                                                   |

Nota: `tests/contract-rules/gen-fixtures.mjs` declara `Doc` como `Record<string, any>` en JSDoc
a propósito (los mutadores rompen partes arbitrarias de un contrato de prueba); es el único
lugar con `any` y está fuera del alcance de `no-explicit-any` (JS sin tipos en ESLint).
