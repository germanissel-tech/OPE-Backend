# Research — Adaptadores por módulo (018)

Fecha: 2026-09-21. Cada decisión cita la evidencia del repositorio que la sostiene.

## R-01 — Lectura del anillo: Uncle Bob estricto, entrada y salida por nombre dentro del módulo

**Decisión**: `interface-adapters/` conserva controllers, presenters, security handlers **y**
gateways (todo lo que traduce, en las dos direcciones); `infrastructure/` sólo hospeda o provee
tecnología. Dentro de cada módulo la dirección se lee por el nombre: `controllers/`,
`presenters.ts`, `security/` (entrada) y `gateways/` (salida).

**Motivo**: evaluado con el dueño (2026-09-21) contra la variante Onion (gateways en
`infrastructure/<m>/`) y la radical (`src/modules/<m>/`). La estricta es la que ADR-013 ya fija,
mantiene la regla verificable "sólo `infrastructure/http/` importa Fastify" y deja `infrastructure/`
con su sentido literal (10 archivos: host y logger). La incomodidad de "entrada y salida en la
misma carpeta" se resuelve con los nombres del libro dentro del módulo, sin mover de anillo.

**Alternativas**: Onion — mejor prior del agente y persistencia en un solo lugar, pero un módulo
en cuatro directorios y la reescritura de `infrastructure/`; descartada. Radical — rompe los
anillos y el tooling; descartada. Fusionar archivos — contraria a "un controller por operación,
un gateway por puerto y tecnología"; descartada.

## R-02 — Destino de cada archivo de la raíz de `http/`

Inventario de exports (`grep -n "^export"`) y de quién los importa:

| Hoy                                                            | Export                                                                             | Conoce                     | Destino                                                                                                    |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `boundary.ts`                                                  | `instantOf`, `idempotent`, `pageQueryOf`, `pageDto`                                | nada                       | núcleo `http/boundary.ts`                                                                                  |
| `boundary.ts`                                                  | `linesOf` (`OrderItem`)                                                            | `outcomes`                 | `outcomes/presenters.ts`                                                                                   |
| `admin-boundary.ts`                                            | `merchantIdOf` (path → `MerchantId`)                                               | `shared-kernel`            | núcleo `http/boundary.ts`                                                                                  |
| `admin-boundary.ts`                                            | `merchantPageResponse` (operador + merchant del path + paginación)                 | principal, `shared-kernel` | núcleo `http/boundary.ts` (lo usan `configuration`, `experiment` y `admin`: sin él, tres imports cruzados) |
| `admin-boundary.ts`                                            | `merchantDto`, `rotationResponse`                                                  | `merchant`                 | `merchant/presenters.ts`                                                                                   |
| `admin-boundary.ts`                                            | `adminEntryDto`, `anchorDiagnosticDto`                                             | `admin`                    | `admin/presenters.ts`                                                                                      |
| `configuration-boundary.ts`                                    | `platformDto`, `treatmentDefaultsDto`, `declaredDto`, `effectiveDto`, `versionDto` | `configuration`            | `configuration/presenters.ts`                                                                              |
| `experiment-boundary.ts`                                       | `experimentDto`, `transitionResponse`, `PERCENT`                                   | `experiment`               | `experiment/presenters.ts`                                                                                 |
| `security/principal.ts`, `capabilities.ts`, `headers.ts`       | `merchantOf`, `operatorOf`, capacidades por consumidor, lectura de header          | principales                | núcleo `http/security/`                                                                                    |
| `security/ingest-key.ts`, `platform-key.ts`                    | handlers de la credencial del merchant                                             | `merchant`                 | `merchant/security/`                                                                                       |
| `security/admin-token.ts`                                      | handler del token de operador                                                      | `admin`                    | `admin/security/`                                                                                          |
| `typed.ts`, `to-problem.ts`, `status.ts`, `problem-details.ts` | tipado, traducción, estados, constructor de problemas                              | contrato                   | núcleo `http/`                                                                                             |

Con ese reparto **ningún módulo del anillo necesita importar de otro módulo del anillo**: las
23 aristas cruzadas de hoy (`merchant → admin-boundary` ×8, `configuration → admin-boundary` ×3,
`experiment → admin-boundary` ×2, etc.) se convierten en imports al núcleo. No hace falta ningún
adaptador de composición ni ampliar el mapa de contextos. La regla FR-005 queda igualmente
escrita para el futuro.

**Qué puede importar el núcleo `http/`**: de `interface-adapters/`, nada fuera de `http/`; de
`domain/`, sólo `shared-kernel`, `operator` y `merchant` (los principales que la seguridad
genérica entrega: `Merchant`, `Operator`, `MerchantId`); de `application/`, sólo
`shared-kernel` (`Page`, `PageQuery`, `UseCase`) y los servicios de resolución de credenciales
que el handler genérico no toca (ninguno hoy). Es la definición operativa de "no conoce ningún
módulo de feature", y la regla `adapters-core-knows-no-module` la escribe con esa lista blanca.

## R-03 — Reglas de arquitectura nuevas y cómo se escriben en dependency-cruiser

`MOD` pasa de `(domain|application)/` a `(domain|application|interface-adapters)/` en
`modules-only-via-index` y en `contextRules`, con dos ajustes: `interface-adapters/http/` no es
un módulo (se excluye del `from` y del `to` de esas reglas) y el `shared-kernel` del anillo queda
siempre permitido (ya lo está en el mapa). Reglas nuevas:

| Regla                                  | from                                 | to (prohibido)                                                                                                                                                                           | Fixture                                           |
| -------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `adapters-core-knows-no-module`        | `interface-adapters/http/`           | `interface-adapters/(?!http/)[^/]+/`, `domain/(?!shared-kernel\|operator\|merchant)`, `application/(?!shared-kernel)`                                                                    | `src/interface-adapters/http/bad-module.ts`       |
| `composition-imports-module-index`     | `composition/modules/([^/]+)\.ts`    | `interface-adapters/`, salvo `interface-adapters/$1/index.ts` y `interface-adapters/shared-kernel/index.ts`; `composition/adapters/` exento (los adaptadores entre módulos son del root) | `src/composition/modules/bad-deep-import.ts`      |
| `gateways-drivers-from-infrastructure` | `interface-adapters/[^/]+/gateways/` | `dependencyTypes: npm*` salvo una lista blanca de drivers puros de Node (`node:crypto`) y lo que `infrastructure/<driver>/` re-exporte                                                   | `src/interface-adapters/a/gateways/bad-driver.ts` |
| `contextRules` en el anillo            | `interface-adapters/<m>/`            | otro módulo del anillo fuera del mapa                                                                                                                                                    | `src/interface-adapters/a/bad-context.ts`         |

`gateways-no-cross` y `controllers-no-gateways` cambian de ruta (`interface-adapters/([^/]+)/gateways/`,
`interface-adapters/[^/]+/controllers/`) y conservan su fixture. `profiles-compose-modules` apunta
a `interface-adapters/[^/]+/gateways/`. `problem-translation-only-in-http` no cambia.
`composition-wires-by-module` exime `composition/[a-z-]*config\.ts` (R-08).

**`gateways-drivers-from-infrastructure` hoy**: los únicos npm/Node que importan los gateways son
`node:crypto` (minters, HMAC) y nada más (`grep from "[a-z:@]"` en el anillo: 5 × `node:crypto`,
1 × `openapi-fetch` en el cliente). La regla nace con `node:` permitido y npm prohibido; el
driver de Postgres entrará por `infrastructure/postgres/` cuando llegue la persistencia.

**Verificación**: `tests/architecture/architecture.test.ts` ya recorre "toda regla atrapa su
fixture" y "los legítimos no disparan nada": cada regla nueva entra con su archivo `bad-*.ts` y,
donde aplica, su `ok-*.ts`. Los fixtures existentes bajo `src/interface-adapters/{gateways,http}`
se mueven a la forma nueva (`src/interface-adapters/a/gateways/…`).

## R-04 — Lo generado sale de `src/`: `generated/` con subpath imports de Node

**Decisión**: `generated/api.d.ts` y `generated/problem-types.{js,d.ts}` en la raíz del repo,
importados como `#generated/api.js` y `#generated/problem-types.js` mediante el campo `imports`
de `package.json` (`"#generated/*": "./generated/*"`).

**Por qué subpath imports y no `paths` de tsconfig**: el proyecto es ESM NodeNext con
`rootDir: "src"`; un alias de `paths` no lo resuelve Node en runtime y un `.ts` fuera de
`rootDir` no compila. Los subpath imports los resuelven Node, TypeScript (NodeNext), Vitest
(Vite) y dependency-cruiser 18 (`dependencyTypes: "aliased-subpath-import"`, verificado en
`node_modules/dependency-cruiser/types/shared-types.d.mts`). Un `.d.ts` está exento de `rootDir`,
así que `api.d.ts` no necesita compilarse.

**Por qué el catálogo se emite como `.js` + `.d.ts` y no como `.ts`**: tiene valores en runtime
(status y título) y no puede vivir fuera de `rootDir` como `.ts`. El generador escribe los dos
archivos de texto, deterministas; no hay paso de compilación aparte ni JS compilado commiteado
"a mano": es el generador el que lo escribe, igual que `api.d.ts`. La declaración lleva los
literales (`readonly status: 409`) para que `ProblemOf<E>` siga discriminando por status.

**Versionado**: los tres archivos siguen en git (la compilación, las pruebas y CI los necesitan
sin correr el generador); `contract:types:check` compara los tres con el contrato;
`.gitattributes` los marca `linguist-generated=true`; knip, ESLint, Prettier y Stryker excluyen
`generated/**` (hoy excluyen `src/interface-adapters/http/generated/**`: se mueve la ruta).

## R-05 — El catálogo de problemas generado desde `contracts/problem-types.yaml`

`scripts/contract-problem-types.mjs` (`checkJs`, JSDoc) lee el YAML con `readYaml` de
`governance-lib.mjs` y emite:

```js
// generated/problem-types.js — generated from contracts/problem-types.yaml by contract:types
export const PROBLEM_NAMESPACE = "urn:ope:problem:";
export const PROBLEM_TYPES = Object.freeze({
  "validation-failed": Object.freeze({ status: 400, title: "The request does not satisfy the contract" }),
  …
});
```

y el `.d.ts` con `export declare const PROBLEM_TYPES: { readonly "validation-failed": { readonly status: 400; readonly title: "…" }; … }`
y `export type ProblemSlug = keyof typeof PROBLEM_TYPES`. Orden: el del YAML. Comentarios de
grupo: si el YAML lleva `group:` por entrada se emiten como comentario; los que hoy sólo existen
en la réplica manual se pierden a propósito (edge case del spec).

`interface-adapters/http/problem-details.ts` queda con `ProblemDetails`/`ValidationError` (del
contrato), `PROBLEM_CONTENT_TYPE`, re-export de lo generado y `problem(slug, options)`. Se
elimina `tests/unit/problem-details.test.ts` (réplica); `tests/unit/domain/error-codes.test.ts`
pasa a leer `ProblemSlug` de lo generado. La igualdad de contenido con la réplica de hoy es la
verificación del generador: si difiere, alguna de las 1 268 pruebas lo dice.

`contract:types` pasa a escribir los dos artefactos; `contract:types:check` compara los dos.
`scripts/lib.mjs` (`generatedTypesPath`) y `contract-types-lib.mjs` cambian de ruta.

## R-06 — `Retry-After` como valor del nivel de plataforma

Hoy `HEADERS_BY_CODE` en `problem-details.ts` fija `retry-after: 5` para `ledger-unavailable` y
`store-unavailable` (constante `LEDGER_RETRY_AFTER_SECONDS`, no inventariada por
`check:behaviour-constants`). Constitución XI: va al nivel 1.

**Decisión**: `config/platform.json` gana `retryAfterSeconds` (5); `PlatformConfiguration` lo
juzga (entero ≥ 1); el header lo agrega la infraestructura: `buildServer` recibe
`retryAfterSeconds` y `dispatch.ts` lo escribe en toda respuesta `503` que no lo traiga. Así
`toProblem` deja de conocer headers y los controllers no cambian. El contrato ya documenta el
header en `ServiceUnavailable.yaml`; las pruebas que esperan `retry-after: 5` siguen iguales
porque el archivo declara 5. `check:behaviour-constants` suma el nombre a su lista.

**Alternativa descartada**: un puerto `RetryPolicy` inyectado a `toProblem` — obliga a pasar
configuración por cada controller para un header que es del transporte.

## R-07 — El cliente para consumidores fuera de `src/`

`http/client.ts` es un export del paquete (`"./client"` en `package.json`), no un adaptador del
servidor; lo importan 9 archivos de pruebas sólo para tipar DTO (`components`).

**Decisión**: `client/index.ts` en la raíz con `tsconfig.client.json` (`rootDir: client`,
`outDir: dist/client`), `npm run build` compila los dos proyectos, el export del paquete apunta a
`dist/client/index.js`; `src/` no lo importa (regla `nobody-imports-composition`-style no hace
falta: no está en `src/`). Las pruebas tipan sus DTO con `#generated/api.js` (`components`);
`tests/types/client.test-d.ts` importa `#client` (subpath import `"#client": "./client/index.ts"`
para las pruebas) o la ruta relativa. knip: entry `client/index.ts`.

## R-08 — `composition/config.ts` partido

342 líneas: variables de entorno, semilla de merchants, experimentos de la semilla y niveles
del release. `operators-config.ts` ya es el modelo. **Decisión**: `merchants-config.ts`
(`parseMerchants`, `judgeSeed`, `declaredOf`), `experiments-config.ts` (`parseExperiments`,
`parseExperiment`, `moved`), `levels-config.ts` (`readLevels`), y `config.ts` con `readConfig`,
`AppConfig`, `MerchantConfig`, `ReleaseLevels` y el enrutado de variables. `ConfigError` sigue en
`config-error.ts`; ningún mensaje cambia (las pruebas de `config.test.ts` son el juez).
`composition-wires-by-module` exime `composition/[a-z-]*config\.ts$`.

## R-09 — Pruebas y herramientas

- Pruebas unitarias del anillo: `tests/unit/gateways/<m>/` y `tests/unit/http/` →
  `tests/unit/interface-adapters/<m>/` y `tests/unit/interface-adapters/http/` (`git mv`).
- 52 archivos de prueba cambian rutas de import (typecheck los verifica); 0 aserciones cambian.
- `scripts/shape-rules.mjs`: la regla "un controller por operationId" recorre
  `interface-adapters/*/controllers/`; `MAY_INSTANTIATE` pasa a `interface-adapters/*/gateways/`.
- `knip.json`: entries `client/index.ts`; ignore `generated/**`.
- `.claude/skills/auditing-architecture`: `run-gates.mjs` resuelve `--module` por
  `interface-adapters/<m>/`; `criterios-diseno.md` y `formato-hallazgo.md` citan rutas; los
  fixtures de `tests/audit/fixtures/*/src/` y los `expected.json` de dos evals se mueven a la forma
  nueva.
- Gate de mutación: los archivos movidos entran al diff completos; el incremental los identifica
  por ruta, así que la corrida de CI del primer push es larga (~40 min) y debe dar 0
  sobrevivientes. Se hace una vez, al cierre, con `--files` local sólo si aparece alguno.

## R-10 — Orden de trabajo para que el riesgo se vea en cada paso

1. Núcleo y presenters: repartir la raíz de `http/` (R-02) sin mover controllers todavía;
   `typecheck` + `npm test`.
2. Módulos, uno por commit de trabajo (no de historia): `git mv` de controllers, security y
   gateways al directorio del módulo, `index.ts`, composición por `index.ts`; `typecheck` +
   `npm test` tras cada módulo.
3. Reglas y fixtures (R-03) al final de US1, cuando todo está en su lugar: la regla y el código
   real se verifican juntos.
4. Generado y cliente (R-04, R-05, R-07), `Retry-After` (R-06), `config.ts` (R-08).
5. Documentación y herramientas (R-09), cadena completa, PR.

Un commit por historia, según CLAUDE.md; los pasos intermedios se agrupan con `git commit
--squash` antes de cerrar cada historia o se dejan como commits de trabajo si el dueño lo
prefiere (se pregunta al cerrar US1).
