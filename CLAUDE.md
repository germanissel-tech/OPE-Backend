# OPE-Backend — instrucciones para agentes

Backend del MVP de OPE (Zona B). Se construye de cero; la POC no es base de código.
Idioma (ADR-015): documentación, specs, ADRs, glosario y commits en **español**. Código, comentarios,
strings, mensajes de error y de log, contrato OpenAPI (descripciones, catálogos, mensajes de reglas),
configuraciones y CI en **inglés**; `npm run check:language` lo hace cumplir. Excepción en línea:
`// lang:es -- motivo` (sin motivo falla; se cuentan, objetivo `Language exceptions: 0`).

## Fuentes de verdad, en este orden

1. `.specify/memory/constitution.md` — principios y gates. Prevalece sobre todo lo demás.
2. Documentos del MVP (fuera del repo, en `../`): `01-arquitectura-mvp.md`,
   `02-integracion-ecommerce.md`, `03-alcance-mvp.md`. Si no podés leerlos, la sesión se lanzó
   sin `--add-dir ..`; pedilo antes de asumir.
3. `specs/NNN-*/` — spec, plan y tareas de cada feature.
4. `contracts/openapi.yaml` — única fuente de verdad de toda superficie HTTP.

## Flujo de trabajo (inamovible)

`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
Nada se implementa sin spec ni plan. El plan debe pasar el Constitution Check.

Dentro de una feature que toca HTTP, el orden es:

1. Cambiar el contrato en `contracts/` (multi-archivo, `$ref`). La raíz `openapi.yaml` no
   declara `components` (salvo `securitySchemes`, que `security` referencia por nombre): cada
   archivo de `components/` se referencia por ruta relativa desde donde se usa y el bundle lo
   promueve a `#/components/<tipo>/<NombreDeArchivo>`.
2. `npm run contract:check` en verde (lint, bundle, compatibilidad contra `main`, drift de
   tipos). Si agrega una regla nueva al ruleset, agregar su fixture en
   `tests/contract-rules/fixtures/` (la prueba falla si falta).
3. Regenerar tipos (`npm run contract:types`). **Nunca editar lo generado a mano.**
4. Reglas puras en `src/domain/<módulo>/`, caso de uso y puertos en
   `src/application/<módulo>/`, controller en
   `src/interface-adapters/http/controllers/<módulo>/<operacion>.ts` tipado con
   `OperationHandler<"<operationId>">` (sólo traduce DTO ↔ dominio; lee el merchant con
   `merchantOf(req)`), gateway del puerto en `src/interface-adapters/gateways/<módulo>/`, y
   cableado en `src/composition/` (puerto en `ports.ts`, perfil en `profiles/memory.ts`, caso
   de uso en `use-cases.ts`, controller en `bootstrap.ts`). El servidor rutea por
   `operationId`; no hay otro mecanismo de rutas.
5. `npm run format:check && npm run quality && npm run typecheck && npm test && npm run test:mutation && npm run test:contract`
   en verde. El hook de pre-commit corre formato, lint y typecheck sobre lo staged; el resto lo
   corre CI.

Antes del paso 1, si la operación trae **un sustantivo nuevo**, su nota en `docs/dominio/`
(ADR-008); si trae **una regla que el esquema no expresa**, su `x-invariants` con tipo propio
en `contracts/problem-types.yaml` y una prueba `[invariant:<slug>]` (ADR-007); si toma **una
decisión transversal**, su ADR en `docs/adr/` (ADR-009).

### Comandos

| Comando                                           | Qué hace                                                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm run contract:lint`                           | Redocly (estructura) + Spectral (`contracts/.spectral.yaml`, reglas `ope-*`)                                     |
| `npm run contract:bundle`                         | Bundle en `contracts/dist/openapi.yaml` (derivado, no se commitea)                                               |
| `npm run contract:diff`                           | Cambios incompatibles contra `origin/main` (oasdiff); `CONTRACT_BASE_REF` para otra base                         |
| `npm run contract:types` / `contract:types:check` | Regenera `src/interface-adapters/http/generated/api.d.ts` / falla si está desactualizado                         |
| `npm run contract:check`                          | lint → bundle → diff → drift de tipos. Corre antes de cualquier commit                                           |
| `npm run contract:mock`                           | El mismo servidor en modo mock (`OPE_MOCK=1`): responde los ejemplos del contrato                                |
| `npm run contract:docs`                           | `docs/api/index.html` autocontenido; se rehúsa si `contract:check` falla                                         |
| `npm run build` / `dev` / `typecheck`             | `tsc` a `dist/` / `tsx watch` / `tsc --noEmit` incluyendo `tests/types/*.test-d.ts`                              |
| `npm test`                                        | Vitest: unitarias, integración (`fastify.inject`), reglas del contrato, compatibilidad, gobernanza, arquitectura |
| `npm run test:contract`                           | Schemathesis (`uvx`) contra el servidor levantado                                                                |
| `npm run arch`                                    | dependency-cruiser sobre `src/`: dirección de dependencias entre capas (ADR-006)                                 |
| `npm run check:invariant-tests`                   | Toda `x-invariants` del contrato tiene su prueba `[invariant:<slug>]`                                            |
| `npm run check:glossary`                          | Todo sustantivo del contrato resuelve a `docs/dominio/`; toda nota con fuente                                    |
| `npm run check:adrs`                              | Frontmatter de `docs/adr/` y ninguna cita `ADR-NNN` rota                                                         |
| `npm run check:markers`                           | Lista `ABIERTO` / `PROPUESTO` / `PLACEHOLDER`; `-- --strict` falla con bloqueantes                               |
| `npm run check:language`                          | Texto en español en comentarios, strings, contrato, configs o CI (lista `scripts/language-denylist.json`)        |
| `npm run format` / `format:check`                 | Prettier: formatea todo / falla si algo difiere del formato canónico (único formateador, ADR-011)                |
| `npm run lint` / `lint:fix`                       | ESLint estricto con tipos + conteo de excepciones (`Lint exceptions: N`) / arregla lo automático                 |
| `npm run release-check`                           | `contract:check` + marcadores en modo estricto: la puerta antes de publicar                                      |
| `npm run check:duplication`                       | jscpd: clones estructurales; bloquea en `src/`, informa en `tests/` y `scripts/`                                 |
| `npm run check:dead-code`                         | knip: archivos, exports y dependencias sin uso bloquean; tipos exportados sin uso informan                       |
| `npm run quality`                                 | `lint` → `arch` → `check:duplication` → `check:dead-code` → `check:language`; se detiene en el primero rojo      |
| `npm run test:mutation`                           | Stryker sobre las líneas de `src/` cambiadas contra `origin/main`; `-- --all` muta todo, informativo             |

Los cinco `check:*` de gobernanza corren dentro de `contract:check`; `quality` encadena los gates de calidad (ADR-016).

### Anillos y módulos (ADR-013, verificado por `npm run arch`)

`src/` contiene `main.ts`, `composition/` y cuatro anillos; nada más. Dependencia sólo hacia
adentro:

| Anillo                    | Qué va ahí                                                                                             | Puede importar de                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `src/domain/`             | reglas y valores puros, por módulo                                                                     | sólo `domain/`. **Nada de npm ni de Node, ni tipos**                                                  |
| `src/application/`        | casos de uso y **los puertos que definen** (`<módulo>/ports/`), por módulo                             | `domain/`, `application/`. Tampoco npm ni Node                                                        |
| `src/interface-adapters/` | `http/` (controllers, security, tipos generados, cliente) y `gateways/<módulo>/` (implementan puertos) | `application/`, `domain/`, npm. Un gateway no importa otro gateway; un controller no importa gateways |
| `src/infrastructure/`     | frameworks y drivers: Fastify + openapi-backend, CORS, logging                                         | todo menos `composition/` y `main.ts`                                                                 |
| `src/composition/`        | `Ports` (contenedor tipado), perfiles, casos de uso, `bootstrap()`                                     | todo; sólo `main.ts` y las pruebas lo importan                                                        |
| `src/main.ts`             | lee configuración, `bootstrap`, señales                                                                | `composition/` y Node; nadie lo importa                                                               |

**Módulos** dentro de `domain/` y `application/`: `shared-kernel`, `system`, `merchant`,
`ledger`, `ingestion` (los demás cuando llegue su feature). Cada módulo expone su API pública
en `index.ts`; un módulo importa de otro **sólo por su `index.ts`** y sólo si el mapa de
contextos (`CONTEXT_MAP` en `.dependency-cruiser.cjs`) lo permite. Agregar un módulo =
agregar una entrada al mapa. Cada regla tiene un fixture en `tests/architecture/fixtures/`.

**Composición** (DI manual, sin contenedor): `interface Ports` en `src/composition/ports.ts`;
un puerto nuevo sin proveer en el perfil no compila. `bootstrap(config, { ports?, handlers?,
logger? })` devuelve `{ app, ports, close }`; las pruebas usan `startTestApp()` de
`tests/helpers/test-app.ts` (dos merchants fijos, reloj reemplazable). Merchants de prueba por
`OPE_MERCHANTS` (JSON) o `OPE_MERCHANTS_FILE`; con `OPE_MOCK=1` hay uno por defecto.

### Gates de calidad (ADR-016, verificado por `quality` y `test:mutation`)

- Forma del código en el lint (`eslint-plugin-sonarjs` + core): complejidad cognitiva ≤ 15,
  anidamiento ≤ 3, ≤ 4 parámetros, ≤ 60 líneas por función (apagada en `tests/`), sin funciones ni
  ramas idénticas, sin `catch` que ignore el error; números mágicos sólo con nombre en `src/` (0, 1,
  −1 e índices exceptuados). Cada umbral lleva su justificación en `eslint.config.mjs`; los bloques
  por alcance (`SHAPE_RULES`, `SRC_ONLY_RULES`, `TEST_ONLY_RULES`) se exportan para las pruebas.
- Duplicación: ≥ 5 líneas / 50 tokens iguales en `src/` no entran. Código muerto: `knip.json`
  lista las entradas y las exclusiones; los motivos están en el encabezado de
  `scripts/check-dead-code.mjs` (knip no admite comentarios).
- Mutación: un cambio no entra si un mutante de sus propias líneas sobrevive. `StringLiteral`
  está excluido (prosa; los literales tipados ya son errores de compilación al mutarse). El
  runner lleva `patches/@stryker-mutator+vitest-runner+10.0.0.patch` hasta que stryker-js#6210
  se publique; `patch-package` lo aplica en `postinstall` y falla si deja de aplicar.
- Forma de los anillos (`tests/architecture/shape-rules.ts`): ≤ 300 líneas por archivo en
  `domain/` y `application/`; un controller por `operationId`; ningún `new` de un paquete npm fuera
  de `composition/`, `infrastructure/` y los gateways.
- Excepciones: en línea y con motivo, como las de lint (`Lint exceptions: N`); en mutación,
  `// Stryker disable next-line <mutador>: <motivo>`.

### Tipado (ADR-011, ADR-012, ADR-017; verificado por `lint` y `typecheck`)

- Compilador: TypeScript 7 (`@typescript/native`) ejecuta `build` y `typecheck`; `typescript` es
  el alias de `@typescript/typescript6` (API 6.0) que importan typescript-eslint,
  openapi-typescript y dependency-cruiser, hasta que admitan la API ≥ 7.1 (ADR-017).

- Sin `any` explícito ni valores `any` (`no-unsafe-*`), sin `!`, promesas siempre manejadas,
  `switch` exhaustivo, imports de tipo con `type`. El borde con una librería que expone `any`
  se lee como `unknown` y se estrecha (ver `build-server.ts`, `tests/helpers/json.ts`).
- Una excepción va **en la línea**, con motivo: `// eslint-disable-next-line <regla> -- <motivo>`.
  Sin motivo o sin uso, falla. Objetivo permanente: `Lint exceptions: 0`.
- Scripts JavaScript (`scripts/`, `contracts/rules/functions/`) se verifican con `checkJs`:
  toda función exportada lleva su firma en JSDoc; los valores desconocidos se leen con
  `prop()`/`isObject()`; los tipos compartidos son `@typedef` importables (`@import`).
- `erasableSyntaxOnly`: sin `enum` ni parámetros de propiedad; uniones de literales y campos
  explícitos. `noPropertyAccessFromIndexSignature`: `env["PORT"]`, no `env.PORT`.
- Formato: Prettier, y nada más. `npm run format` antes de commitear; el hook lo verifica.

### Notas operativas del contrato

- Ruleset de Spectral en estilo bloque (no `{ a: b }`), `"off"` entre comillas.
  `oas3-schema` está apagada por un bug con path items `$ref` en 3.1; la estructura la
  valida Redocly. Detalle en `specs/001-api-contract-toolchain/research.md` (R-02).
- Lista de datos personales prohibidos: **sólo** `contracts/rules/pii-denylist.json`.
- Catálogo de tipos de error: `contracts/problem-types.yaml` (`urn:ope:problem:<slug>`),
  replicado en `src/interface-adapters/http/problem-details.ts` y verificado por prueba.
  Catálogo de motivos de `NO_OP`: `contracts/no-op-reasons.yaml`, replicado en
  `src/domain/ingestion/no-op-reasons.ts` (string con patrón, no enum: ampliar es compatible).
- Uniones discriminadas (`Event`): `type: object` + `oneOf` + `discriminator` **con `mapping`**
  y `type: { enum: [valor] }` en cada rama (sin `const`). Ajv no acepta `mapping` y sólo aplica
  el discriminador a objetos: el servidor lo quita en runtime
  (`infrastructure/http/strip-discriminator-mappings.ts`) y el `type: object` es obligatorio.
  Sólo el subconjunto de JSON Schema que OpenAPI 3.0 admite (ADR-014).
- Operación autenticada con la credencial de ingesta ⇒ `security: [{ ingestKey: [] }]`; el
  security handler resuelve el merchant antes de validar el body (401 / 403
  `origin-not-allowed`). Los logs nunca llevan IP, headers ni cuerpo (`request-logging.ts`).
- Cambio incompatible ⇒ `info.version` a la mayor siguiente **y** prefijo `/v<N>/`.
- Todo schema de un media type es `$ref` a `components/schemas` (nunca inline).
- `x-invariants` sobre la operación (si depende de otro recurso) o sobre el schema (si sólo
  involucra sus campos): `type` (slug del catálogo, nunca `unprocessable`), `status`, `rule`,
  `description`. Toda `422` nombra en su ejemplo la invariante que la produce.
- Operación autenticada ⇒ `x-required-capabilities: [recurso:accion]`; pública ⇒ sin él.

### Documentación viva

- **Sin cifras de estado en prosa viva** (cuántas reglas, pruebas, operaciones, términos): se
  desactualizan y nadie las corrige. Las informan `contract:check`, `npm test` y
  `check:markers`. Las tablas de estado de `specs/*/quickstart.md` son históricas y fechadas.
- Decisiones transversales en `docs/adr/` (citar `ADR-NNN`); el `research.md` de una feature
  las cita y conserva la evidencia.
- Lo no resuelto se marca con `ABIERTO`, `PROPUESTO` o `PLACEHOLDER` dentro del texto al que
  pertenece; `release-check` no pasa con `ABIERTO` ni `PLACEHOLDER`. Lo abierto del MVP
  (D3–D6) vive en ADR-010, no como marcador del contrato.

## Reglas que fallan el build (no son sugerencias)

- `merchantId` nunca en path, query ni body: se deriva de la credencial.
- Ningún campo de dato personal en ningún esquema (lista en el ruleset de lint).
- Todo request body con `additionalProperties: false`.
- Todo error es RFC 9457 Problem Details.
- Cambio incompatible del contrato ⇒ nueva versión mayor, o falla.
- Cero llamadas a modelos de lenguaje en runtime.
- Sin I/O de red ni escritura bloqueante en el camino crítico de decisión.
- Toda feature que toca persistencia o API incluye pruebas de aislamiento entre merchants.

## Convenciones

- TypeScript `strict`. Sin `any`. Un módulo por autoridad. Composition root único en
  `src/composition/` (ADR-013). Identificadores como tipos marcados (`MerchantId`, `SessionId`,
  …, `src/domain/shared-kernel/`).
- Porcentajes 0–100 sólo en el borde (DTO); adentro, tasas 0–1.
- `NO_OP` es un resultado válido con motivo, nunca una excepción.
- Marcar afirmaciones como `DECIDIDO` / `PROPUESTO` / `ABIERTO` y estado del sistema como
  **BUILT / CONNECTED / ACTIVE / TESTED**. No afirmar que algo funciona sin prueba ejecutable.
- Commits: conventional commits, en español, un cambio por commit. No commitear sin que las
  pruebas pasen. No hacer push sin que el usuario lo pida.

## Si existe `HANDOFF.md` en la raíz

Leerlo primero: contiene el estado de la tarea en curso. Borrarlo cuando la tarea que describe
esté terminada y commiteada.
