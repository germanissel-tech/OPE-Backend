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

- 2026-09-21 línea base: `main` en `94f38e9`; proyecto `fast` 1 247 pruebas / 142 archivos (`test:all` 1 268); 71 archivos en el anillo (`inventory-before.txt`, incluido el `.d.ts` generado).
- 2026-09-21 US1: los movimientos se hicieron por script (resolución de cada import relativo contra la ruta vieja y reescritura desde la nueva; `typecheck` como juez) y no bloque por bloque: 73 archivos movidos, 87 reescritos, cero aserciones cambiadas. Inventario final por nombre: los mismos archivos menos los tres `*-boundary.ts` (repartidos en cinco `presenters.ts`) más once `index.ts`. `merchantPageResponse` se tipa por su forma (`MerchantPageHttpRequest`), no por la operación `listExperiments`: el núcleo no puede nombrar una operación de un módulo. `problem-translation-only-in-http` se amplió al borde entero del anillo (controllers, presenters, seguridad de cualquier módulo) y sigue prohibida en los gateways. `barrier`, `selection`, `commercial` y `operator` no tienen directorio en el anillo (sin adaptadores). `composition/adapters/` no quedó vacío: `switchAwarePolicyDirectory` une los puertos de `decision`, `configuration` y `merchant` y el mapa no permite `decision → merchant`; era la única arista cruzada real del anillo y ahora es un adaptador del root (R-02 la había pasado por alto porque el mapa no regía en los gateways). `config.ts` (342 líneas) → `config.ts` (63), `merchants-config.ts`, `experiments-config.ts`, `levels-config.ts`, `env.ts` (texto y JSON del entorno) y `seed-errors.ts` (el error de dominio localizado en el campo de la semilla); ningún mensaje de `ConfigError` cambió. Los tres commits de trabajo se agruparon en uno.
- 2026-09-21 US2: `gateways-drivers-from-infrastructure` se escribe con `dependencyTypes: EXTERNAL` menos `core` (dependency-cruiser reporta `node:crypto` como `crypto`, tipo `core`); el fixture usa `fastify` (un paquete instalado: uno inexistente cae en `unknown`, no en `npm`). Los fixtures de arquitectura ganan `index.ts` por módulo y un módulo `merchant` marcador para la regla de contexto del anillo. La skill de auditoría resuelve `--module` por `interface-adapters/<m>/` directamente.
- 2026-09-21 US3: los tipos del contrato se leen como `#generated/api.js` (subpath import de Node: TS NodeNext, Vitest y dependency-cruiser lo resuelven; `aliased-subpath-import` verificado en el grafo); `typed.ts` re-exporta `components`/`operations` para los módulos y `generated-only-from-http-core` lo hace obligatorio. El catálogo generado se emite como `.js` + `.d.ts` (`rootDir: "src"` se conserva: un `.d.ts` está exento y el `.js` no se compila); `contract:types:check` verifica los tres artefactos; `OPE_PROBLEM_TYPES_FILE` sirve a la prueba de drift. La prueba de réplica (`tests/unit/problem-details.test.ts`) desaparece y las de `problem()` pasan al núcleo. `Retry-After` lo agrega un hook `onSend` de Fastify a toda `503` que no lo traiga, con `retryAfterSeconds` de `config/platform.json` (campo aditivo en el contrato); `toProblem` ya no devuelve headers y su prueba unitaria cambió de expectativa (única aserción tocada, y es del adaptador, no del comportamiento HTTP: las integraciones siguen esperando `retry-after: 5`). El cliente vive en `client/index.ts` con `tsconfig.client.json` (`npm run build` compila los dos proyectos; export `./client` → `dist/client/`); las pruebas tipan sus DTO con `#generated/api.js`. `check:identifiers` lee también `client/`, `generated/`, `tsconfig.client.json` y `.gitattributes`.
- 2026-09-21 cierre: `src/` 304 archivos escritos a mano; el anillo 81 archivos (11 módulos + núcleo + shared-kernel; antes 70 + el generado); `infrastructure/` sin cambio de tamaño. Gate de mutación completo en CI (archivos movidos: corrida larga, una vez).
