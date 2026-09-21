# Quickstart — Adaptadores por módulo (018)

## Prerrequisitos

- `main` con la 017 mergeada (`94f38e9`); `npm ci`; `npm run contract:bundle`.
- Línea base: `npm test` (1 268 pruebas) y `npm run quality` en verde antes de mover nada.

## Verificar cada historia

### US1 — La forma

```bash
ls src/interface-adapters                     # http/ shared-kernel/ y un directorio por módulo, cada uno con index.ts
ls src/interface-adapters/http                # sin ningún nombre de módulo: typed, to-problem, problem-details, status, boundary, security/
grep -rn "interface-adapters/" src/composition/modules | grep -v "/index.js"   # vacío
npm run typecheck && npm test                 # 1 268 pruebas, cero aserciones cambiadas
git diff main -- contracts/                   # vacío
```

### US2 — Las reglas

```bash
npm run arch                                  # limpio sobre src/
npx vitest run tests/architecture             # cada regla nueva atrapa su fixture; los legítimos no disparan nada
```

### US3 — Lo generado

```bash
npm run contract:types && git status --short generated/   # nada que commitear si está al día
npm run contract:types:check                  # verifica api.d.ts y problem-types.{js,d.ts}
ls src/interface-adapters/http | grep -c generated        # 0
test ! -f tests/unit/problem-details.test.ts  # la réplica y su prueba no existen
grep -rn "retryAfterSeconds" config/platform.json src/    # el valor sólo en el nivel de plataforma
```

### US4 — Documentación y herramientas

```bash
npm run check:adrs && npm run check:identifiers && npm run check:language
npm run test:tools                            # auditoría sobre fixtures y cadena de calidad con las rutas nuevas
```

## Cierre

```bash
npm run format:check && npm run quality && npm run typecheck && npm run test:all && npm run test:contract && npm run release-check
```

`test:mutation` lo corre CI en el push de cierre (los archivos movidos entran enteros al diff:
una corrida larga, una vez, cero sobrevivientes esperados). PR a `main` sin merge.

## Cambios respecto del plan

_(se completa durante la implementación)_
