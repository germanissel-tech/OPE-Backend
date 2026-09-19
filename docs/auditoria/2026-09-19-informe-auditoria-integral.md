# Informe — auditoría integral del backend de OPE (features 001–013)

**Fecha**: 2026-09-19 · **Alcance**: `main` en `8d12aa2` · **Método**:
`specs/014-auditoria-integral/` · **Estado global**: (pendiente: fase 5)

Cómo leer este informe: cada hallazgo `F-NNN` trae `file:line`, cita literal, regla con su
fuente, severidad derivada de la fuente (constitución, ADR, sección DECIDIDA del MVP o `FR`/`SC`
de una spec ⇒ `high`; `CLAUDE.md`, lint, arch, shape ⇒ `medium`; claridad ⇒ `low`), propuesta
`before/after` y la prueba que lo cubriría. Todo hallazgo pasó por la refutación
(`.claude/skills/auditing-architecture/references/refutacion.md`) y por `verify-finding.mjs`;
los que no sobrevivieron están en §5 con su motivo. Los gates (§2) son hechos: se citan tal
cual. No hay puntuaciones; el estado global (§7) sale de una regla fija.

## 1. Alcance y método

**Anclaje**: la rama `014-auditoria-integral` nace de `main` en `8d12aa2` (PR #22, feature 013)
y sólo escribe en `specs/014-auditoria-integral/` y `docs/auditoria/`; el código auditado es el
de ese commit. Único cambio de herramienta en la rama: `ee6ac73`, que agrega a
`verify-finding` las fuentes `mvp:` y `spec:` (decisión del dueño, R-03) para que un hallazgo
funcional cite la sección del documento del MVP o el `FR`/`SC` de la spec y se verifique igual
que los demás.

**Método**: `specs/014-auditoria-integral/` (spec, plan, research R-01..R-09, rúbrica de siete
ejes en `contracts/rubrica.md`, traza en `tasks.md`). Seis fases: base, lectura fina por
alcance (15 alcances × 7 ejes con contraste documental), robustez, seguridad/escalabilidad/
pruebas, cumplimiento funcional, cierre. Cada fase deja sus hallazgos en
`trabajo/hallazgos/fase-N.json`, verificados por `verify-finding.mjs`, y una sección de este
informe.

**Qué se leyó en la fase 0** (2026-09-19, sesión 1): `.specify/memory/constitution.md` (v1.2.0),
`CLAUDE.md`, los 29 ADRs, `../01-arquitectura-mvp.md`, `../02-integracion-ecommerce.md`,
`../03-alcance-mvp.md`, `contracts/api-map.yaml`, `CONTEXT_MAP` de `.dependency-cruiser.cjs`.
De ahí salió `trabajo/afirmaciones.md`: 479 afirmaciones (51 de la constitución, 22 de `01`,
9 de `02`, 17 de `03`, 380 `FR`/`SC` de las specs 001–013) que la fase 4 resuelve una por una,
y 10 enunciados `PROPUESTO`/`ABIERTO` listados aparte porque no generan `high`.

**Qué se corrió**: los comandos de §2.1, con su salida cruda en `trabajo/gates/`. La mutación
completa (`test:mutation -- --all`) se lanzó en segundo plano al cierre de la fase 0; su reporte
se usa en la fase 3 (`trabajo/gates/mutation-full.json`).

**Cifras del alcance en `8d12aa2`** (históricas, contadas en la fase 0): `src/` tiene 175
archivos `.ts` más 1 generado (`domain` 60, `application` 53, `interface-adapters` 31,
`infrastructure` 6, `composition` 24, `main.ts`); por módulo: `shared-kernel` 17, `system` 7,
`merchant` 15, `ledger` 16, `experiment` 11, `ingestion` 13, `catalog` 13, `barrier` 9,
`selection` 4, `commercial` 4, `decision` 18, `outcomes` 18. `tests/` tiene 124 archivos
`*.test.ts` y 3 `*.test-d.ts` (el handoff dice "259 archivos de prueba": cuenta también
fixtures y helpers). 29 ADRs, 59 notas de glosario, 7 operaciones construidas de 23 en el mapa.

**Qué no se pudo verificar**: nada hasta ahora; los tres documentos del MVP son legibles desde
la sesión. (Se completa en la fase 5.)

**Cómo leer un hallazgo**: ver la cabecera. Un hallazgo con fuente `mvp:` o `spec:` cita una
sección DECIDIDA o un requisito de una spec aprobada; la severidad la impone la fuente, no el
auditor.

## 2. Gates (hechos)

### 2.1 Globales

Corridos el 2026-09-19 sobre `8d12aa2` (Node v22.23.2, npm 11.10.0, Windows 11). Salida cruda
en `trabajo/gates/global-<comando>.txt`.

| Comando                          | Resultado                                                                                                                                                                                                                                               | Salida                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `npm run contract:check`         | exit 0 — lint, bundle, diff contra `origin/main`, tipos sin drift, invariantes, glosario, ADRs (29, 531 citas, ninguna rota), marcadores (0 abiertos, 2 propuestos), idioma (0 excepciones)                                                             | `global-contract-check.txt` |
| `npm run quality`                | exit 0 — 5 gates verdes: lint (excepciones en línea: 0, `global-lint-exceptions.txt`), arch, duplicación (0 clones en `src/`; 30 informativos en `tests/`+`scripts/`), código muerto (0 bloqueantes; 159 tipos exportados sin uso, informativo), idioma | `global-quality.txt`        |
| `npm run typecheck`              | exit 0                                                                                                                                                                                                                                                  | `global-typecheck.txt`      |
| `npm test`                       | exit 0 — 120 archivos, 1004 pruebas, 147 s                                                                                                                                                                                                              | `global-test.txt`           |
| `npm run build`                  | exit 0                                                                                                                                                                                                                                                  | `global-build.txt`          |
| `npm run test:contract`          | exit 0 — Schemathesis: 2433 casos generados, 2433 pasados, 72 omitidos; aviso "schema validation mismatch" en 5 operaciones (`POST /v1/events`, `/v1/exposures`, `/v1/orders`, `/v1/returns`, `PUT /v1/catalog`) → S-09, fase 3                         | `global-test-contract.txt`  |
| `npm run check:markers`          | exit 0 — 0 abiertos, 2 propuestos (ADR-020), 0 placeholders                                                                                                                                                                                             | `global-markers.txt`        |
| `npm run test:mutation -- --all` | lanzado en segundo plano al cierre de la fase 0; resultado en la fase 3                                                                                                                                                                                 | `mutation-full.log/.json`   |

Dos cifras informativas que las fases 1 y 3 retoman: los 159 tipos exportados que nadie
importa y los 30 clones en `tests/`+`scripts/`.

### 2.2 Por alcance

Corridos el 2026-09-19 con `run-gates.mjs --module <nombre> --json` (o `--dir` para los tres alcances sin módulo); salida cruda en `trabajo/gates/modulo-<alcance>.json`. Quince alcances: los doce módulos, el borde HTTP común, `infrastructure` y `composition`.

| Alcance         | Archivos | lint       | arch | shape | duplication | dead-code                                   | language | Nota                                                                                                                                                      |
| --------------- | -------- | ---------- | ---- | ----- | ----------- | ------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shared-kernel   | 16       | pass       | pass | pass  | pass        | pass (9 tipos sin importador, informativo)  | pass     | —                                                                                                                                                         |
| system          | 6        | pass       | pass | pass  | pass        | pass (4 tipos sin importador, informativo)  | pass     | —                                                                                                                                                         |
| merchant        | 14       | pass       | pass | pass  | pass        | pass (9 tipos sin importador, informativo)  | pass     | —                                                                                                                                                         |
| http-compartido | 17       | fail (111) | pass | pass  | pass        | pass (8 tipos sin importador, informativo)  | pass     | el `fail` de lint es sobre `generated/api.d.ts`: artefacto de `run-gates --dir` con `--no-ignore` (`npm run lint` lo ignora), no un hallazgo del producto |
| infrastructure  | 6        | pass       | pass | pass  | pass        | pass                                        | pass     | —                                                                                                                                                         |
| composition     | 24       | pass       | pass | pass  | pass        | pass (2 tipos sin importador, informativo)  | pass     | —                                                                                                                                                         |
| experiment      | 10       | pass       | pass | pass  | pass        | pass (6 tipos sin importador, informativo)  | pass     | —                                                                                                                                                         |
| ingestion       | 12       | pass       | pass | pass  | pass        | pass (40 tipos sin importador, informativo) | pass     | —                                                                                                                                                         |
| catalog         | 12       | pass       | pass | pass  | pass        | pass (12 tipos sin importador, informativo) | pass     | —                                                                                                                                                         |
| barrier         | 8        | pass       | pass | pass  | pass        | pass (17 tipos sin importador, informativo) | pass     | —                                                                                                                                                         |
| selection       | 4        | pass       | pass | pass  | pass        | pass (1 tipo sin importador, informativo)   | pass     | —                                                                                                                                                         |
| commercial      | 4        | pass       | pass | pass  | pass        | pass (6 tipos sin importador, informativo)  | pass     | —                                                                                                                                                         |
| decision        | 17       | pass       | pass | pass  | pass        | pass (12 tipos sin importador, informativo) | pass     | —                                                                                                                                                         |
| ledger          | 15       | pass       | pass | pass  | pass        | pass (10 tipos sin importador, informativo) | pass     | —                                                                                                                                                         |
| outcomes        | 17       | pass       | pass | pass  | pass        | pass (23 tipos sin importador, informativo) | pass     | —                                                                                                                                                         |

Ningún gate bloqueante en rojo sobre código del producto. Lo informativo (tipos exportados que nadie importa) suma en las quince corridas lo mismo que el `check:dead-code` global de §2.1 y se retoma en la fase 3 (calidad de pruebas y camino a la 017).

## 3. Hallazgos confirmados

### 3.A Clean architecture, SOLID y lectura fina

Fase 1 (lectura fina de quince alcances por siete ejes, con contraste documental). 39 hallazgos confirmados y verificados por `verify-finding.mjs` (`trabajo/hallazgos/fase-1.json`): 1 de severidad alta, 15 media, 23 baja; 3 refutados (F-002, F-010, F-042; motivo en §5). La severidad la fija la fuente: `ADR-`/`constitution#` ⇒ alta; `guide#` (sección de CLAUDE.md), `lint:`, `arch:`, `shape:` ⇒ media; `clarity:` (lo que ninguna regla escrita cubre) ⇒ baja.

Patrones que cruzan alcances (un hallazgo ancla, las demás ubicaciones se nombran en él o en el cuadro):

- Prosa detrás del código (`guide#Documentación viva`): F-008, F-011, F-014, F-015, F-016, F-017, F-023, F-036 — comentarios, CLAUDE.md y un ADR que describen el mock retirado, el "modo real", funciones y flujos que las features 009–011 reemplazaron.
- Conocimiento escrito más de una vez bajo el umbral de los gates: F-021 (`instantOf` ×3 más el exportado), F-030 (predicados de tasa y conteo ×4), F-033 (ventana por merchant ×3), F-022 (números de una constante repetidos en el mensaje de error: ingestion, catalog, barrier ×1, decision ×2, outcomes).
- Reglas del dueño fuera del dueño: F-007 (alta; merchants y experimentos en `config.ts`), con F-039 y F-041 como ecos en composición.
- Números de feature en comentarios: F-017 (ya falso), F-029 (cuatro que se vuelven falsos con la renumeración que esta auditoría introdujo).
- Pruebas como documentación: F-020 (86 de 90 cabeceras citan `FR-` sin spec), F-023, F-024, F-018, F-019.

Lo que se buscó y no se encontró (dimensión A, handoff §5.A): lógica de negocio en controllers, gateways o `build-server.ts` (los controllers sólo traducen; los gateways deciden primero/repetido/conflicto con métodos del dominio; los tres `*-config.ts` de políticas delegan las reglas a `.of` — la excepción es F-007); `switch` sin exhaustividad (los del dominio y del parser lo son; la excepción es F-038, que un `default` esconde); `rehydrate` alimentado desde fuera del proceso (hoy sólo `Money.rehydrate` sobre cuerpos validados por el contrato y F-037; el riesgo LSP de ADR-024 aparece con el store de la 017 y va a §6).

#### F-007 (alta) — Las invariantes del conjunto de credenciales y de experimentos viven en `config.ts`, no en su dueño

`src/domain/merchant/merchant.ts:51` · regla `axis-5-merchant-and-experiment-set-invariants-live-in-config-not-in-the-owner` · fuente `ADR-024`

Cita:

```ts
static of(input: MerchantInput): Result<Merchant, MerchantError> {
    const origins: Origin[] = [];
    for (const [index, text] of input.origins.entries()) {
      const origin = Origin.parse(text);
      if (origin === undefined) return fail(new InvalidOrigin(index));
      origins.push(origin);
    }
    const platformKeys = input.platformKeys ?? [];
    for (const [index, key] of platformKeys.entries()) {
      if (key === "" || input.ingestKeys.includes(key)) return fail(new PlatformKeyCollision(index));
    }
// same class at src/composition/config.ts:182-184 (ADR-022 "at most one active experiment" judged by the parser, no domain owner):
if (experiments.filter((e) => e.isActive()).length > 1) {
  throw new ConfigError(at, "must have at most one active experiment");
}
// and config.ts:196 (experimentId pattern, a rule of the experiment, not a JSON shape)
```

Antes:

```ts
// src/composition/config.ts:131-143 decides the rules:
if (!isStringArray(ingestKeys) || ingestKeys.length === 0 || ingestKeys.length > MAX_INGEST_KEYS) {
  throw new ConfigError(`merchants[${i}].ingestKeys`, "must have one or two keys");
}
// … origins.length === 0, platformKeys.length > 2, platformSecrets.length > 2 likewise
// while Merchant.of accepts { ingestKeys: [], origins: [] } and ["", ""]
```

Después:

```ts
// src/domain/merchant/merchant.ts: the owner judges its credential set (ADR-014: up to two active keys; ADR-025/029: up to two)
static of(input: MerchantInput): Result<Merchant, MerchantError> {
  if (!hasOneOrTwoNonEmpty(input.ingestKeys)) return fail(new InvalidIngestKeys());
  if (input.origins.length === 0) return fail(new InvalidOrigin(0));
  if (platformKeys.length > MAX_ACTIVE_CREDENTIALS) return fail(new PlatformKeyCollision(platformKeys.length));
  …
}
// src/composition/config.ts: parse shape only (arrays of strings) and translate the domain error to ConfigError naming the field
// experiments: a domain owner for the merchant's experiment set (e.g. `Experiments.of(list)` in domain/experiment, or Merchant holding them) rejects two active ones with a DomainError; config translates it
```

Prueba que lo cubriría: tests/unit/domain/merchant/merchant.test.ts: "[invariant] zero, more than two, or empty ingest keys reject the merchant; no origins reject it; more than two platform keys or secrets reject it" (fails today: Merchant.of({ ingestKeys: [], origins: [] }) is ok)

#### F-008 (media) — El comentario de `modules/merchant.ts` describe el mock retirado

`src/composition/modules/merchant.ts:3` · regla `axis-2-comment-describes-the-retired-mock` · fuente `guide#Documentación viva`

Cita:

```ts
// ADR-029) and the CORS policy. Security also runs in mock: the SDK develops against the mock
// with the real key (SC-006).
```

Antes:

```ts
// ADR-029) and the CORS policy. Security also runs in mock: the SDK develops against the mock
// with the real key (SC-006).
```

Después:

```ts
// ADR-029) and the CORS policy.
```

Prueba que lo cubriría: none: a comment; ADR-018 retired the mock and the module list has no mock entry (tests/unit/main.test.ts: "nothing names a server mode, a mock switch or a built-in merchant" covers src/ but not comments)

#### F-011 (media) — JSDoc duplicado y desplazado en `build-server.ts`

`src/infrastructure/http/build-server.ts:110` · regla `axis-2-comments-stale-or-attached-to-the-wrong-declaration` · fuente `guide#Documentación viva`

Cita:

```ts
/** Principals by scheme (without the `authorized` flag) and safe fields for the request log. */
/**
 * What each security handler left in `context.security`, by scheme name. …
 */
function securityOutcomes(…)
// build-server.ts:143-150: the JSDoc "The Fastify instance: transport only…" sits above `BODY_LIMIT_MIB`, not above createApp
// build-server.ts:257: /** What every registration step needs: the API, the server log and the mode. */ — there is no mode (ADR-018)
```

Antes:

```ts
/** Principals by scheme (without the `authorized` flag) and safe fields for the request log. */
/**
 * What each security handler left in `context.security`…
 */
```

Después:

```ts
/**
 * What each security handler left in `context.security`, by scheme name. openapi-backend leaves
 * `security` undefined when the operation is public and adds its own boolean `authorized`.
 */
// and: move "The Fastify instance…" above createApp; "…the API and the server log." for Runtime
```

Prueba que lo cubriría: none: comments; `npm run lint` does not see a JSDoc attached to the wrong declaration

#### F-013 (media) — `maxAge: 600` sin nombre en `cors.ts` (ciego para `no-magic-numbers`)

`src/infrastructure/http/cors.ts:30` · regla `axis-3-unnamed-number-in-object-literal` · fuente `guide#Gates de calidad`

Cita:

```ts
    maxAge: 600,
```

Antes:

```ts
    maxAge: 600,
```

Después:

```ts
/** Seconds a browser may cache the preflight (10 min): long enough for a session, short enough to see a rotated header list. */
const PREFLIGHT_MAX_AGE_SECONDS = minutes(10) / MS_PER_SECOND; // or a plain named constant
…
    maxAge: PREFLIGHT_MAX_AGE_SECONDS,
```

Prueba que lo cubriría: tests/integration/cors.test.ts (Access-Control-Max-Age asserted); note: `no-magic-numbers` runs with `detectObjects: false`, so numbers in object literals are invisible to the gate — the only one in src/ is this

#### F-014 (media) — CLAUDE.md habla de "modo real" y cita ADR-006 en vez de ADR-013/018

`CLAUDE.md:126` · regla `axis-7-guide-and-comments-describe-retired-modes-and-replaced-adrs` · fuente `guide#Documentación viva`

Cita:

```ts
y, en modo real, falla si el contrato declara una operación que ningún módulo sirve; las pruebas usan `startTestApp()`
// CLAUDE.md:130 repeats the same statement ("un contrato con una operación que ningún módulo sirve no arranca")
// CLAUDE.md:73: `npm run arch` … (ADR-006) — ADR-006 was replaced by ADR-013
// src/composition/profiles/local.ts:3: "until real persistence arrives (006)" — persistence is feature 017 (api-map)
```

Antes:

```ts
`readConfig` rechaza con `ConfigError` (variable + problema) lo que no puede arrancar el servidor
y, en modo real, falla si el contrato declara una operación que ningún módulo sirve; las pruebas usan `startTestApp()`…
```

Después:

```ts
`readConfig` rechaza con `ConfigError` (variable + problema) lo que no puede arrancar el servidor; las pruebas usan `startTestApp()`… (the "no arranca" sentence stays once, at the end of the paragraph)
// CLAUDE.md:73 → (ADR-013) · local.ts:3 → (017)
```

Prueba que lo cubriría: none: prose; `check:adrs` verifies citations exist, not that they are current

#### F-015 (media) — ADR-013 conserva prosa del "modo real" y un punto 6 pegado

`docs/adr/013-anillos-modulos-y-composicion.md:71` · regla `axis-7-adr-amendment-mentions-the-retired-mode-and-lost-its-list-shape` · fuente `guide#Documentación viva`

Cita:

```ts
3. **Fail-closed en el arranque** (constitución II): en modo real, `bootstrap` comprueba que
// and docs/adr/013:90: "…la firma es `bootstrap(config, { profile?, modules?, ports?, handlers? })`. 6. **El logger es un puerto…" — point 6 of the amendment is glued to the closing paragraph of point 5
```

Antes:

```ts
3. **Fail-closed en el arranque** (constitución II): en modo real, `bootstrap` comprueba que
```

Después:

```ts
3. **Fail-closed en el arranque** (constitución II): `bootstrap` comprueba que
// and: a blank line before "6. **El logger es un puerto…" so it renders as the sixth point
```

Prueba que lo cubriría: none: prose (ADR-018 retired the modes)

#### F-016 (media) — El comentario de `assignment.service.ts` nombra `assignArm`, retirado por la 009

`src/application/experiment/services/assignment.service.ts:3` · regla `axis-2-comment-names-a-function-retired-by-009` · fuente `guide#Documentación viva`

Cita:

```ts
// (ADR-023). Deterministic (assignArm) and stable: an assignment already recorded wins over the
```

Antes:

```ts
// (ADR-023). Deterministic (assignArm) and stable: an assignment already recorded wins over the
```

Después:

```ts
// (ADR-023). Deterministic (`Experiment.assign`) and stable: an assignment already recorded wins over the
```

Prueba que lo cubriría: none: a comment. `assignArm` was removed by feature 009 (specs/009-dominio-rico/tasks.md:80 "sin `assignArm`, `assignmentKey`, `fnv1a32`, `activeExperiment`"; docs/adr/024-dominio-rico.md:14 names it as the anemic past); no symbol with that name exists in src/

#### F-017 (media) — `modules/experiment.ts` sitúa el store de experimentos en la feature 008

`src/composition/modules/experiment.ts:3` · regla `axis-7-comment-points-the-experiment-store-to-the-wrong-feature` · fuente `guide#Documentación viva`

Cita:

```ts
// Experiments come from configuration (the store arrives with feature 008); the assignment
```

Antes:

```ts
// Experiments come from configuration (the store arrives with feature 008); the assignment
```

Después:

```ts
// Experiments come from configuration (the store arrives with `createExperiment` /
// `closeExperiment`, contracts/api-map.yaml); the assignment
```

Prueba que lo cubriría: none: a comment. Feature 008 is `specs/008-casos-de-uso-y-errores/` and brings no store; contracts/api-map.yaml:206-222 assigns `createExperiment` and `closeExperiment` to feature "014" (planned), a number that moves again now that 014 is the audit — naming the operation instead of the number keeps the comment true

#### F-021 (media) — `instantOf` copiado en tres controllers después de que `boundary.ts` lo exportó

`src/interface-adapters/http/controllers/ingestion/ingest-events.ts:25` · regla `axis-3-instantOf-copied-in-three-controllers-after-boundary-exported-it` · fuente `lint:sonarjs/no-identical-functions`

Cita:

```ts
function instantOf(text: string): Date {
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`The contract admitted an unparsable date-time: ${text}`);
  return date;
}
```

Antes:

```ts
import { toProblem } from "../../to-problem.js";
// …
/** The contract validated `date-time`; a value Date cannot parse is a programming error, not a business one. */
function instantOf(text: string): Date {
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`The contract admitted an unparsable date-time: ${text}`);
  return date;
}
```

Después:

```ts
import { instantOf } from "../../boundary.js";
import { toProblem } from "../../to-problem.js";
// (local copy removed; same in controllers/catalog/upsert-catalog-snapshot.ts:21 and controllers/ledger/confirm-exposure.ts:15)
```

Prueba que lo cubriría: none today: `sonarjs/no-identical-functions` compares functions inside one file and `check:duplication` needs 50 tokens (this one has fewer). `src/interface-adapters/http/boundary.ts:6` exports the identical function since 013 (`8d6cb07`) and only the outcomes controllers import it; a jscpd run with `minTokens` lowered for `controllers/` would list the three copies

#### F-023 (media) — La cabecera de `event-batch.test.ts` promete un `NO_OP` provisional que ya no existe

`tests/unit/domain/ingestion/event-batch.test.ts:2` · regla `axis-6-test-header-promises-a-provisional-no-op-that-no-longer-exists` · fuente `guide#Documentación viva`

Cita:

```ts
// US2 (FR-015, FR-052; ADR-007) and ADR-024: batch invariants, enforced by construction; the
// provisional NO_OP reason of a batch while there is no decision plane.
```

Antes:

```ts
// US2 (FR-015, FR-052; ADR-007) and ADR-024: batch invariants, enforced by construction; the
// provisional NO_OP reason of a batch while there is no decision plane.
```

Después:

```ts
// 004 US2 (FR-015, FR-052; ADR-007) and ADR-024: batch invariants, enforced by construction,
// and the product focus of a batch.
```

Prueba que lo cubriría: none: a comment. The file has two `describe` blocks (`EventBatch.of`, `EventBatch.focus`) and no test about a NO_OP reason; the decision plane exists since 011 (src/application/ingestion/ports/decision-plane.ts) and the batch no longer carries a reason

#### F-026 (media) — `CatalogSnapshot.variant()` y su índice `#byVariant` no los usa producción

`src/domain/catalog/catalog-snapshot.ts:109` · regla `axis-3-variant-index-built-per-snapshot-that-production-never-reads` · fuente `guide#Gates de calidad`

Cita:

```ts
  variant(productId: ProductId, variantId: VariantId): VariantOfProduct | undefined {
    const found = this.#byVariant.get(variantId);
    return found?.product.productId === productId ? found : undefined;
  }
```

Antes:

```ts
// src/application/catalog/services/product-truth.service.ts:50
const found = known.product.variants.find((v) => v.variantId === variantId);
// while every snapshot builds `#byVariant` (catalog-snapshot.ts:68-71) and only two tests call `variant()`
```

Después:

```ts
// either the service asks the owner (the index pays for itself):
const found = snapshot.variant(productId, variantId);
// or the domain drops `#byVariant`, `variant()` and `VariantOfProduct`, keeping the uniqueness Set in `of`
```

Prueba que lo cubriría: none today: `check:dead-code` (knip) sees unused exports, not class methods, so `variant()` and the `#byVariant` map (built for the pilot size of 5 000 × 10 variants on every replace, tests/integration/catalog-size.test.ts) stay although `src/` never calls them; `grep -rn "\.variant(" src` is empty. Whichever way is chosen, tests/unit/application/catalog/product-truth.service.test.ts "lookup" cases keep covering the behaviour

#### F-030 (media) — `isShare`/`isCount` copiados entre módulos; la tasa 0..1 se define cuatro veces

`src/domain/barrier/barrier-rules.ts:52` · regla `axis-3-rate-and-count-predicates-copied-across-modules` · fuente `lint:sonarjs/no-identical-functions`

Cita:

```ts
const isShare = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1;
const isCount = (value: number): boolean => Number.isFinite(value) && value >= 0;
```

Antes:

```ts
// barrier-rules.ts:52-53, condition.ts:112 (isCount again), decision/decision-policy.ts:50 (isShare again),
// experiment/experiment.ts:70 inline:
if (!Number.isFinite(treatmentShare) || treatmentShare < 0 || treatmentShare > 1) {
```

Después:

```ts
// src/domain/shared-kernel/rate.ts — the convention "inside, rates 0..1" written once
export const isRate = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1;
export const isCount = (value: number): boolean => Number.isFinite(value) && value >= 0;
// experiment.ts:70 → if (!isRate(treatmentShare)) …; barrier-rules.ts, condition.ts, decision-policy.ts import them
```

Prueba que lo cubriría: none today: `sonarjs/no-identical-functions` compares within one file and `check:duplication` needs 50 tokens; one-line predicates never reach it. tests/unit/domain/shared-kernel/ would take the table of edge values (NaN, Infinity, -0, 1.0000001) once instead of each module re-proving it (tests/unit/domain/experiment/experiment.test.ts:30, tests/unit/domain/barrier/barrier-rules.test.ts, tests/unit/domain/decision/decision-policy.test.ts)

#### F-031 (media) — La política comercial guarda porcentajes 0–100 dentro del dominio contra la convención

`src/domain/commercial/commercial-policy.ts:38` · regla `axis-4-percentages-inside-the-domain-against-the-rates-convention` · fuente `guide#Convenciones`

Cita:

```ts
  maxIncentivePercent: number;
  incentiveLadderPercent: readonly number[];
  /** Absent: the merchant configured no margin, so nothing with an economic component goes out (01 §4.7). */
  marginPercent?: number;
```

Antes:

```ts
const PERCENT_MAX = 100;
// …
const isPercent = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= PERCENT_MAX;
// …
    if (!Number.isInteger(record.maxIncentivePercent) || !isPercent(record.maxIncentivePercent)) {
```

Después:

```ts
// either the edge converts, as the experiment does (src/composition/config.ts:199 "Shape: an integer percentage. Its range is the domain's rule (Experiment.of, as a rate 0..1)"):
  maxIncentiveShare: number;        // 0..1
  incentiveLadderShare: readonly number[];
  marginShare?: number;
// or an ADR carves the exception: "an incentive is an integer percent the shopper reads (10 %), never a factor", and CLAUDE.md § Convenciones cites it
```

Prueba que lo cubriría: none today: a convention without a gate. CLAUDE.md:406 says "Porcentajes 0–100 sólo en el borde (DTO); adentro, tasas 0–1"; `src/domain/experiment/experiment.ts:23` follows it (`treatmentShare`, "percentages stay at the edge") while `CommercialPolicyRecord` (this file), `DEFAULT_COMMERCIAL_POLICY` (default-commercial-policy.ts:12-14) and `Incentive.value` (src/domain/shared-kernel/intervention.ts:14) carry 0..100 inside the domain, as specs/012-plano-de-decision-ii/research.md:86-87 designed them. Refutation considered: the values are only compared, never multiplied, and the shopper sees the integer — a real reason, but one that lives nowhere the reader of the convention can find

#### F-033 (media) — La ventana acotada por merchant está escrita tres veces en los gateways en memoria

`src/interface-adapters/gateways/decision/memory-session-state-store.ts:22` · regla `axis-3-bounded-window-per-merchant-written-three-times-in-memory-gateways` · fuente `guide#Gates de calidad`

Cita:

```ts
const expire = (sessions: Map<SessionId, SessionState>, now: number): void => {
  for (const [id, state] of sessions) {
    if (now - state.updatedAt.getTime() < window.ttlMs) break;
    sessions.delete(id);
  }
  while (sessions.size > window.maxSessions) {
    const oldest = sessions.keys().next();
    if (oldest.done) break;
    sessions.delete(oldest.value);
  }
};
```

Antes:

```ts
// memory-session-state-store.ts:13-32, memory-visitor-state-store.ts:13-33 and memory-event-dedup.ts:12-31 each own a `bucket` (Map per merchant) and an `expire` (TTL by insertion order, then a cap), identical but for the names
```

Después:

```ts
// src/interface-adapters/gateways/shared-kernel/windowed-map.ts — the knowledge once: per merchant, ordered by last touch, TTL then cap
export function windowedByMerchant<K, V>(
  window: { ttlMs: number; max: number },
  touchedAt: (v: V) => number,
) {
  const byMerchant = new Map<MerchantId, Map<K, V>>();
  const bucket = (merchantId: MerchantId): Map<K, V> => {
    /* as today */
  };
  const expire = (entries: Map<K, V>, now: number): void => {
    /* as today, with touchedAt(v) */
  };
  return { bucket, expire };
}
// the three gateways keep only what differs: the key, the value and when it was touched.
// `.dependency-cruiser.cjs` rule `gateways-no-cross` exempts `gateways/shared-kernel/` (as CONTEXT_MAP does for the module)
```

Prueba que lo cubriría: none today: `check:duplication` (jscpd) compares token sequences and the identifiers differ (`sessions`/`visitors`/`seen`, `maxSessions`/`maxVisitors`/`maxIds`), so three copies of the same 20 lines pass the gate; `sonarjs/no-identical-functions` looks inside one file. tests/unit/gateways/memory-{event-dedup,session-state-store,visitor-state-store}.test.ts prove the TTL and the cap three times ("time window", "size window", "expiring with the window"); one table on the helper would prove it once

#### F-036 (media) — Dos comentarios dicen que la ingesta acuña los ids de decisión; lo hace el recorder desde la 011

`src/application/ledger/ports/decision-id-generator.ts:2` · regla `axis-2-comment-says-ingestion-mints-decision-ids-since-011-the-recorder-does` · fuente `guide#Documentación viva`

Cita:

```ts
// Decision identifier port: the ledger owns the identity of a decision; whoever mints one
// (ingestion today, the decision plane tomorrow) receives a generator, never calls crypto.
```

Antes:

```ts
// Decision identifier port: the ledger owns the identity of a decision; whoever mints one
// (ingestion today, the decision plane tomorrow) receives a generator, never calls crypto.
// — and src/composition/modules/ledger.ts:23:
/** Who mints decision identifiers: the ledger owns the identity, ingestion asks for one. */
```

Después:

```ts
// Decision identifier port: the ledger owns the identity of a decision; its recorder
// (DefaultDecisionRecorder) mints one per decision through this generator, never calling crypto.
// — and src/composition/modules/ledger.ts:23:
/** Who mints decision identifiers: the ledger's recorder, which the decision module receives (`decisionPlaneOf`). */
```

Prueba que lo cubriría: none: comments. Since 011 the only caller of `next()` is src/application/ledger/services/decision-recorder.service.ts:45,55 (`DefaultDecisionRecorder`), built in src/composition/modules/decision.ts:65 for the plane; nothing in src/application/ingestion/ or src/composition/modules/ingestion.ts names `decisionIds` — both comments describe the 004–010 flow

#### F-038 (media) — Una nueva clase de claim (015) cae en el `default` de atributos del quality gate

`src/domain/selection/quality-gate.ts:73` · regla `transversal-ocp-a-new-claim-class-falls-into-the-attribute-default` · fuente `lint:@typescript-eslint/switch-exhaustiveness-check`

Cita:

```ts
      case "incentive":
        // Whether an incentive may be granted is the commercial policy's, not the gate's.
        return undefined;
      default:
        return this.#attribute(claim.slice(ATTRIBUTE_CLAIM_PREFIX.length), evidence);
```

Antes:

```ts
export type Claim =
  | "returns-policy"
  | "fit-data"
  | "current-price"
  | "availability"
  | "incentive"
  | `${typeof ATTRIBUTE_CLAIM_PREFIX}${string}`;
// …
      default:
        return this.#attribute(claim.slice(ATTRIBUTE_CLAIM_PREFIX.length), evidence);
```

Después:

```ts
export type Claim =
  | { kind: "returns-policy" }
  | { kind: "fit-data" }
  | { kind: "current-price" }
  | { kind: "availability" }
  | { kind: "incentive" }
  | { kind: "product-attribute"; key: string };
// …
switch (claim.kind) {
  // … the five cases as today …
  case "product-attribute":
    return this.#attribute(claim.key, evidence);
} // no default: a sixth class does not compile until the gate says what evidence it needs
```

Prueba que lo cubriría: none today: with a `default` branch `switch-exhaustiveness-check` is satisfied, and the template-literal member makes the union open, so the switch cannot be exhaustive as written. When the message catalogue (015, candidate.ts:5) brings a claim class the gate does not know, it is sliced as an attribute key and rejected as `attribute-unknown` — fail-closed, but for the wrong reason and without a compile error. tests/unit/domain/selection/quality-gate.test.ts "every claim with and without evidence" would gain the case by type

#### F-001 (baja) — La cabecera de `domain/shared-kernel/index.ts` describe sólo identidades marcadas

`src/domain/shared-kernel/index.ts:1` · regla `axis-2-header-understates-module` · fuente `clarity:stale-header`

Cita:

```ts
// Public API of the shared-kernel module (domain): branded identities.
```

Antes:

```ts
// Public API of the shared-kernel module (domain): branded identities.
```

Después:

```ts
// Public API of the shared-kernel module (domain): what modules that cannot depend on each other
// share — branded identities, Result/DomainError, Money, time units and the closed vocabularies
// replicated from the contract (NO_OP reasons, anchors, barriers).
```

Prueba que lo cubriría: none: a header comment; the fix is the comment (scope: shared-kernel, axis 2)

#### F-003 (baja) — `LoggedUseCase` estrecha con `as` en vez de con una guarda

`src/application/shared-kernel/decorators/logged-use-case.ts:19` · regla `axis-4-cast-instead-of-narrowing` · fuente `clarity:cast-instead-of-guard`

Cita:

```ts
const result = response as { ok?: unknown; error?: unknown } | null | undefined;
// same pattern at src/infrastructure/http/build-server.ts:131:
const { principal, log } = outcome as { principal?: unknown; log?: Record<string, unknown> };
```

Antes:

```ts
const result = response as { ok?: unknown; error?: unknown } | null | undefined;
if (result?.ok !== false) return OK;
```

Después:

```ts
if (typeof response !== "object" || response === null || !("ok" in response) || response.ok !== false)
  return OK;
const error: unknown = "error" in response ? response.error : undefined;
```

Prueba que lo cubriría: tests/unit/application/shared-kernel/logged-use-case.test.ts (existing cases keep passing; the change is the narrowing, not the behaviour)

#### F-004 (baja) — `systemKernelPorts` no dice lo que cablea (`localKernelPorts`)

`src/composition/modules/shared-kernel.ts:14` · regla `axis-1-binding-name-collides-with-module-name` · fuente `clarity:misleading-name`

Cita:

```ts
export const systemKernelPorts: Bindings<SharedKernelPorts> = {
  clock: () => systemClock,
  logger: () => pinoLogger(),
};
```

Antes:

```ts
export const systemKernelPorts: Bindings<SharedKernelPorts> = {
```

Después:

```ts
// The local binding of the kernel: the system clock and pino to stdout (`system` is also a module name; this is not it).
export const localKernelPorts: Bindings<SharedKernelPorts> = {
```

Prueba que lo cubriría: none: a rename; `tsc` and the profile test (tests/unit/composition/profile.test.ts) cover the wiring

#### F-005 (baja) — La nota de glosario `intervencion.md` quedó detrás del código

`docs/dominio/intervencion.md:13` · regla `axis-7-glossary-note-predates-the-decision-plane` · fuente `clarity:stale-glossary-note`

Cita:

```ts
En el contrato, `Intervention` es el lugar reservado en la decisión (`messageVersionId`, `anchor`); su forma definitiva llega con el plano de decisión.
```

Antes:

```ts
En el contrato, `Intervention` es el lugar reservado en la decisión (`messageVersionId`, `anchor`); su forma definitiva llega con el plano de decisión.
```

Después:

```ts
En el contrato y en `src/domain/shared-kernel/intervention.ts`, `Intervention` es `{ messageVersionId, anchor, incentive? }` (ADR-026, ADR-027): el anclaje donde se renderiza, la versión del mensaje curado (`msg_<barrera>_<anclaje>_<escalón>_v0` hasta la 015) y, cuando la política comercial lo concede, el incentivo.
```

Prueba que lo cubriría: none: a glossary note; `check:glossary` verifies existence and source, not currency

#### F-006 (baja) — La prueba de salud vive fuera de la carpeta de su módulo

`tests/unit/health.test.ts:5` · regla `axis-6-module-test-outside-module-layout` · fuente `clarity:test-location`

Cita:

```ts
describe("getHealth", () => {
```

Antes:

```ts
tests / unit / health.test.ts;
```

Después:

```ts
tests/unit/application/system/get-service-health.use-case.test.ts (same content; the folder is the module, as every other module's tests)
```

Prueba que lo cubriría: none: a move; `npm test` keeps running it

#### F-009 (baja) — `merchantOf` es agnóstico del esquema y vive bajo `ingest-key.ts`

`src/interface-adapters/http/security/ingest-key.ts:36` · regla `axis-3-scheme-agnostic-helper-lives-in-one-scheme-file` · fuente `clarity:misplaced-helper`

Cita:

```ts
export function merchantOf(req: { security: SecurityResults }): Merchant {
  const principal = Object.values(req.security).find((p) => typeof p === "object" && p !== null);
  if (principal !== undefined && "merchant" in principal) return (principal as IngestPrincipal).merchant;
  throw new Error("The operation did not go through a merchant security handler.");
}
```

Antes:

```ts
// security/ingest-key.ts exports merchantOf, which every controller of every scheme imports
```

Después:

```ts
// security/principal.ts: `MerchantPrincipal { merchant }` shared by both handlers, and merchantOf(req) narrowing with a type guard instead of `as IngestPrincipal`
export function merchantOf(req: { security: SecurityResults }): Merchant {
  const principal = Object.values(req.security).find(isMerchantPrincipal);
  if (principal) return principal.merchant;
  throw new Error("The operation did not go through a merchant security handler.");
}
```

Prueba que lo cubriría: tests/unit/http/security-handlers.test.ts: "finds the merchant whichever scheme resolved it" (moves with the function)

#### F-012 (baja) — `build-server.ts` reúne ocho motivos de cambio (S-06)

`src/infrastructure/http/build-server.ts:415` · regla `axis-3-one-file-eight-concerns` · fuente `clarity:many-reasons-to-change`

Cita:

```ts
export async function buildServer<Ops extends OperationsMap<Ops> = operations>(
  options: BuildServerOptions<Ops>,
): Promise<FastifyInstance> {
  const app = await createApp(options);
  const api = createApi(options.definition);
  const runtime: Runtime = { api, log: app.log };
  registerSecurity(api, options.security ?? {});
  registerSpecialHandlers(runtime);
  registerHandlers(runtime, options.handlers);
```

Antes:

```ts
// build-server.ts (428 lines): raw-body parser, Ajv error translation, security + capabilities, special handlers, handler wrapping + response validation, routes + Fastify error handler
```

Después:

```ts
// infrastructure/http/: server.ts (buildServer, createApp, createApi) · raw-body.ts (keepRawBodies, rawBodies) · validation-errors.ts (toValidationErrors) · security.ts (registerSecurity, securityOutcomes, securityFailure, requiredCapabilities) · handlers.ts (registerHandlers, validateResult, notImplemented, special handlers) · routes.ts (mountRoutes, send, unroutable). Same exports; each file one reason to change (transport, contract runtime, security, Problem Details)
```

Prueba que lo cubriría: tests/integration/server.test.ts and logging-privacy.test.ts (unchanged behaviour); handoff S-06

#### F-018 (baja) — `as never` con los constructores marcados importados en la misma prueba

`tests/integration/assignment.test.ts:68` · regla `axis-4-as-never-instead-of-the-imported-branded-constructor` · fuente `clarity:cast-instead-of-constructor`

Cita:

```ts
app.ports.assignments.find("m_a" as never, EXPERIMENT_ID as never, visitorId as never);
```

Antes:

```ts
const find = (visitorId: string) =>
  app.ports.assignments.find("m_a" as never, EXPERIMENT_ID as never, visitorId as never);
```

Después:

```ts
const find = (visitorId: string) =>
  app.ports.assignments.find(asMerchantId("m_a"), asExperimentId(EXPERIMENT_ID), asVisitorId(visitorId));
```

Prueba que lo cubriría: none today. The file imports `asExperimentId, asMerchantId, asVisitorId` at line 6 and still casts at 68, 120, 128, 137 and 139; `as never` appears 59 times in 19 test files (some on purpose, to pass invalid input). `@typescript-eslint/no-unsafe-type-assertion` scoped to tests/ would list them for review

#### F-019 (baja) — Copia de `fnv1a32` en la prueba de regresión sin decir por qué es copia

`tests/unit/domain/experiment/assignment-regression.test.ts:15` · regla `axis-2-copied-hash-without-saying-why-it-is-a-copy` · fuente `clarity:undocumented-intentional-copy`

Cita:

```ts
function fnv1a32(text: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}
```

Antes:

```ts
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
function fnv1a32(text: string): number {
```

Después:

```ts
// Local copy of the domain's FNV-1a (src/domain/experiment/experiment.ts): the domain does not
// export it (009) and the fingerprint must not move with the code it checks.
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
function fnv1a32(text: string): number {
```

Prueba que lo cubriría: none: a comment. The header (lines 1-4) explains the fingerprints, not why the hash is duplicated instead of imported; a reader who "deduplicates" it by exporting the domain's hash would make the regression test blind to a change in that hash

#### F-020 (baja) — Las cabeceras de prueba citan `FR-nnn` sin decir de qué spec

`tests/unit/domain/experiment/assignment-regression.test.ts:1` · regla `axis-6-test-header-cites-an-fr-number-without-its-spec` · fuente `clarity:ambiguous-spec-reference`

Cita:

```ts
// FR-041 (ADR-024): the assignment is bit for bit the one of feature 007. The fingerprints were
```

Antes:

```ts
// FR-041 (ADR-024): the assignment is bit for bit the one of feature 007. The fingerprints were
```

Después:

```ts
// 009 FR-041 (ADR-024): the assignment is bit for bit the one of feature 007. The fingerprints were
```

Prueba que lo cubriría: none today. `FR-041` exists in specs 001, 002, 003, 005 and 009 with different meanings; the sibling tests/unit/domain/experiment/assignment.test.ts:1 cites `FR-002..FR-005` of spec 007 with the same scheme. Of the 90 test files whose header cites `FR-`/`SC-`, 4 name the feature; a governance test could require the spec number next to every `FR-`/`SC-` citation

#### F-022 (baja) — El mensaje de `EventTimestampOutOfRange` repite los números que `TIMESTAMP_TOLERANCE` posee

`src/domain/ingestion/errors.ts:19` · regla `axis-5-error-message-hardcodes-the-tolerance-the-constant-owns` · fuente `clarity:message-duplicates-constant`

Cita:

```ts
super(`The timestamp of event ${eventId} is out of tolerance (24 h in the past, 5 min in the future).`);
```

Antes:

```ts
export class EventTimestampOutOfRange extends DomainError {
  readonly code = "event-timestamp-out-of-range" as const;
  readonly module = MODULE;
  constructor(eventId: string) {
    super(`The timestamp of event ${eventId} is out of tolerance (24 h in the past, 5 min in the future).`);
  }
}
```

Después:

```ts
export class EventTimestampOutOfRange extends DomainError {
  readonly code = "event-timestamp-out-of-range" as const;
  readonly module = MODULE;
  constructor(eventId: EventId, tolerance: { pastMs: number; futureMs: number }) {
    super(`The timestamp of event ${eventId} is out of tolerance.`, {
      eventId,
      pastMs: tolerance.pastMs,
      futureMs: tolerance.futureMs,
    });
  }
}
// event-batch.ts:62 → fail(new EventTimestampOutOfRange(event.eventId, TIMESTAMP_TOLERANCE))
```

Prueba que lo cubriría: tests/unit/domain/ingestion/event-batch.test.ts: after "[invariant:event-timestamp-out-of-range] timestamp out of tolerance → rejected", assert `error.details` carries `pastMs`/`futureMs` equal to `TIMESTAMP_TOLERANCE`; today the numbers live in `TIMESTAMP_TOLERANCE` (event-batch.ts:18-19), in this message and in contracts/components/schemas/EventBatch.yaml:12, and only the first two are in the same module

#### F-024 (baja) — La prueba "nothing is recorded twice" sólo verifica contadores

`tests/integration/ingest-events.test.ts:58` · regla `axis-6-test-title-claims-nothing-recorded-twice-but-asserts-only-counters` · fuente `clarity:test-title-overclaims`

Cita:

```ts
it("duplicate event: resending the same batch → all `duplicate`, nothing is recorded twice (idempotency)", async () => {
  app = await withClock();
  await postEvents(app.app, batchOf(3, 1, { occurredAt: NOW }), { key: "key-a-1" });
  const res = await postEvents(app.app, batchOf(3, 1, { occurredAt: NOW }), { key: "key-a-1" });
  expect(res.statusCode).toBe(202);
  const body = json(res) as IngestResult;
  expect(body).toMatchObject({ accepted: 0, duplicates: 3 });
  expect(body.results.map((r) => r.status)).toEqual(["duplicate", "duplicate", "duplicate"]);
});
```

Antes:

```ts
    expect(body.results.map((r) => r.status)).toEqual(["duplicate", "duplicate", "duplicate"]);
  });
```

Después:

```ts
    expect(body.results.map((r) => r.status)).toEqual(["duplicate", "duplicate", "duplicate"]);
    // what "recorded" means since 011: the resend must not add a second decision for the session
    expect(await app.ports.decisions.bySession(asMerchantId("m_a"), asSessionId("ses_00000001"))).toHaveLength(1);
  });
```

Prueba que lo cubriría: the proposed assertion itself. spec 004 US2 scenario 3 (specs/004-protocolo-sdk-ingesta/spec.md:105) says "todos los eventos se reportan como duplicados y nada se registra dos veces"; the title repeats the claim, the body checks the counters only. `IngestBatchUseCase.execute` (src/application/ingestion/use-cases/ingest-batch.use-case.ts:65-67) claims the dedup and then asks the plane for a decision even when `accepted` is 0, so the assertion may fail — which is the point: the test today cannot tell (noted for fases 2 and 4)

#### F-025 (baja) — `expire` se llama dos veces sin decir por qué en `memory-event-dedup.ts`

`src/interface-adapters/gateways/ingestion/memory-event-dedup.ts:37` · regla `axis-2-expire-called-twice-without-saying-why` · fuente `clarity:unexplained-double-call`

Cita:

```ts
const seen = bucket(merchantId);
expire(seen, now);
const entered = new Set<EventId>();
for (const id of eventIds) {
  if (seen.has(id)) continue;
  seen.set(id, now);
  entered.add(id);
}
expire(seen, now);
```

Antes:

```ts
expire(seen, now);
const entered = new Set<EventId>();
for (const id of eventIds) {
  if (seen.has(id)) continue;
  seen.set(id, now);
  entered.add(id);
}
expire(seen, now);
```

Después:

```ts
expire(seen, now); // before: an id past its TTL must count as new
const entered = new Set<EventId>();
for (const id of eventIds) {
  if (seen.has(id)) continue;
  seen.set(id, now);
  entered.add(id);
}
expire(seen, now); // after: the batch may have pushed the bucket past maxIds
```

Prueba que lo cubriría: tests/unit/gateways/memory-event-dedup.test.ts pins the TTL and the cap ("time window: after 24 h the id comes in again", "size window: past N ids per merchant, the oldest are forgotten") but not the second call: the full mutation run (trabajo/gates/mutation-full-summary.json) reports `memory-event-dedup.ts:44: Survived: ;` — removing it changes nothing a test observes, because the next `claim` expires first anyway. A test that claims `maxIds + 1` ids in one batch and inspects the bucket size (or a `size()` on the port for tests) would kill it and document why the call exists

#### F-027 (baja) — `TruthFreshness.catalog` sólo puede valer `"fresh"`

`src/application/catalog/services/product-truth.service.ts:16` · regla `axis-4-freshness-field-typed-as-a-single-literal` · fuente `clarity:constant-field`

Cita:

```ts
export interface TruthFreshness {
  catalog: "fresh";
  stockAndPrice: Freshness;
}
```

Antes:

```ts
export interface TruthFreshness {
  catalog: "fresh";
  stockAndPrice: Freshness;
}
// …
return { kind: "known-product", product, freshness: { catalog: "fresh", stockAndPrice }, ageMs };
```

Después:

```ts
// a known truth is fresh by definition (beyond the catalogue budget the kind is `unknown`/`stale`)
// …
return { kind: "known-product", product, stockAndPrice, ageMs };
```

Prueba que lo cubriría: none: a type. The only reader is src/application/decision/services/decision.service.ts:242 (`found.freshness.stockAndPrice`); nothing reads `catalog`, which can only ever be "fresh" — a stale catalogue returns `{ kind: "unknown", reason: "stale" }` (line 65). `TruthFreshness` and `Freshness` are among the exported types nobody imports (gates/modulo-catalog.json, dead-code)

#### F-028 (baja) — El parámetro `received` de `CatalogOutOfOrder` es el `capturedAt` entrante

`src/domain/catalog/errors.ts:35` · regla `axis-1-parameter-named-received-holds-the-incoming-capturedAt` · fuente `clarity:misleading-name`

Cita:

```ts
  constructor(current: Date, received: Date) {
    super(
      `The current snapshot was captured at ${current.toISOString()}; this one at ${received.toISOString()}.`,
    );
```

Antes:

```ts
  constructor(current: Date, received: Date) {
```

Después:

```ts
  constructor(currentCapturedAt: Date, incomingCapturedAt: Date) {
```

Prueba que lo cubriría: none: a name. The caller passes `snapshot.capturedAt` (src/application/catalog/use-cases/upsert-catalog-snapshot.use-case.ts:69) and the snapshot has a distinct `receivedAt`; `received` reads as that other instant

#### F-029 (baja) — Cuatro comentarios citan features no construidas por un número que se mueve

`src/application/catalog/policies/freshness.ts:3` · regla `axis-7-comments-name-planned-features-by-a-number-that-moves` · fuente `clarity:planned-feature-number-in-comment`

Cita:

```ts
// minutes. Published in the description of upsertCatalogSnapshot; per merchant with feature 014.
```

Antes:

```ts
// minutes. Published in the description of upsertCatalogSnapshot; per merchant with feature 014.
```

Después:

```ts
// minutes. Published in the description of upsertCatalogSnapshot; per merchant once the
// configuration API exists (contracts/api-map.yaml, `putFlags`/`createExperiment`).
```

Prueba que lo cubriría: none: comments. Four comments in src/ cite a feature that is not built yet by its number — here and src/application/decision/ports/policy-directory.ts:3 ("feature 014"), src/domain/shared-kernel/intervention.ts:19 and src/domain/selection/candidate.ts:5 ("feature 015"). The audit took number 014 (decision of the owner, specs/014-auditoria-integral/), so the roadmap numbers move and these four go stale the way F-017 already did; naming the operation or the ADR does not move

#### F-032 (baja) — `(D-B)` sin decir que es una decisión de producto de 03 §6

`src/domain/commercial/commercial-policy.ts:264` · regla `axis-2-comment-cites-a-product-decision-by-a-label-without-its-source` · fuente `clarity:cryptic-reference`

Cita:

```ts
 * confirmed an inferred barrier (D-B), at the lowest otherwise.
```

Antes:

```ts
 * confirmed an inferred barrier (D-B), at the lowest otherwise.
```

Después:

```ts
 * confirmed an inferred barrier (03-alcance-mvp.md §6, D-B), at the lowest otherwise.
```

Prueba que lo cubriría: none: a comment. `D-B` is a product decision of 03 §6 (specs/012-plano-de-decision-ii/spec.md:143 "cierra la decisión de producto D-B (03 §6)"); the file header cites 01 §4.5 and 03 §4.8 only, so the label cannot be resolved from the code

#### F-034 (baja) — `SESSION_WINDOW` promete ser igual a `DEDUP_WINDOW` sin que nada lo ate

`src/application/decision/policies/session-window.ts:2` · regla `axis-7-comment-ties-two-windows-that-no-code-or-test-ties` · fuente `clarity:coupled-constants-not-linked`

Cita:

```ts
// The same figures as the deduplication window (ADR-024): a session older than a day, or beyond
// the budget, starts over. Declared here so any store applies the same window.
```

Antes:

```ts
const SESSION_TTL_HOURS = 24;
const SESSION_MAX = 100_000;

/** 24 h since the last batch, or 100,000 sessions per merchant, whichever comes first. */
export const SESSION_WINDOW: SessionWindow = { ttlMs: hours(SESSION_TTL_HOURS), maxSessions: SESSION_MAX };
```

Después:

```ts
// either derive it (the decision module may import the ingestion module by its index, CONTEXT_MAP):
export const SESSION_WINDOW: SessionWindow = { ttlMs: DEDUP_WINDOW.ttlMs, maxSessions: DEDUP_WINDOW.maxIds };
// or drop the claim from the comment and let each window be its own decision
```

Prueba que lo cubriría: tests/unit/domain/decision/session-state.test.ts or a governance test: `expect(SESSION_WINDOW).toEqual({ ttlMs: DEDUP_WINDOW.ttlMs, maxSessions: DEDUP_WINDOW.maxIds })` — today nothing fails when one of the two changes, although this comment and src/domain/decision/session-state.ts:3-4 ("with the window of the deduplication") promise they move together

#### F-035 (baja) — `triggerOf` recibe `string` donde circulan `Barrier`

`src/application/decision/services/decision.service.ts:187` · regla `axis-4-barrier-parameters-widened-to-string` · fuente `clarity:widened-parameter-type`

Cita:

```ts
function triggerOf(inferred: string | undefined, selected: string | undefined): Trigger {
```

Antes:

```ts
function triggerOf(inferred: string | undefined, selected: string | undefined): Trigger {
```

Después:

```ts
function triggerOf(inferred: Barrier | undefined, selected: Barrier | undefined): Trigger {
```

Prueba que lo cubriría: none: a type. Both call-site arguments are `Barrier | undefined` (`settled.barrier`, `barrier` at line 133); `string` accepts any text and hides that the function reasons about barriers

#### F-037 (baja) — `Order.rehydrate` usado como constructor para adjuntar lo derivado

`src/application/outcomes/use-cases/notify-order.use-case.ts:86` · regla `axis-4-rehydrate-used-as-a-builder-to-attach-derived-facts` · fuente `clarity:rehydrate-as-builder`

Cita:

```ts
const order = Order.rehydrate({ ...built.value.record(), correlation, redemption });
```

Antes:

```ts
const built = Order.of(facts);
if (!built.ok) return fail(built.error);
// …
const order = Order.rehydrate({ ...built.value.record(), correlation, redemption });
```

Después:

```ts
    const built = Order.of(facts);
    if (!built.ok) return fail(built.error);
    // …
    const order = built.value.correlated(correlation, redemption);
// src/domain/outcomes/order.ts, next to `withReturn`:
  /** The same order, with what OPE derived when it recorded it (decided once, ADR-028). */
  correlated(correlation: Correlation | undefined, redemption: IncentiveRedemption | undefined): Order {
    return new Order({ ...this.record(), correlation, redemption });
  }
```

Prueba que lo cubriría: tests/unit/domain/outcomes/order.test.ts would take the new method next to `withReturn`; tests/unit/application/outcomes/notify-order.test.ts keeps covering the flow. `rehydrate` is documented as "An order a ledger recorded: its facts are not re-judged" (order.ts:115); here it is the only way the use case has to add `correlation` and `redemption` to a freshly built order, while `withReturn` (order.ts:125) shows the domain's own idiom for "the same order, plus"

#### F-039 (baja) — `FACTS` del parser replica la unión del dominio sin control de completitud

`src/composition/condition-config.ts:57` · regla `transversal-ocp-fact-list-of-the-parser-replicates-the-domain-union-unchecked` · fuente `clarity:replica-without-completeness-check`

Cita:

```ts
const FACTS = [
  "eventCount",
  "dwellSeconds",
  "sequence",
  "productAttribute",
  "returnedToProduct",
  "variantAvailable",
  "sessionAddedToCart",
  "sessionEnteredCheckout",
] as const;
type Fact = (typeof FACTS)[number];
```

Antes:

```ts
] as const;
type Fact = (typeof FACTS)[number];
```

Después:

```ts
] as const satisfies readonly FactCondition["fact"][];
type Fact = (typeof FACTS)[number];
// a fact the domain knows and the parser does not is a compile error, not a silent "must be one of"
type MissingFact = Exclude<FactCondition["fact"], Fact>;
const missing: MissingFact[] = []; // stays `never[]` while the two lists agree
```

Prueba que lo cubriría: none today. A fact added to `FactCondition` (src/domain/barrier/condition.ts:35) is caught by the two exhaustive switches of the domain, but the parser keeps rejecting it at line 141 (`oneOf(…, FACTS, …)`) with "must be one of …" and nothing tells the author; tests/types/*.test-d.ts is where the completeness assertion belongs

#### F-040 (baja) — `NotifyOrderUseCase` recibe todo `DecisionLedger` para una sola consulta

`src/application/outcomes/use-cases/notify-order.use-case.ts:54` · regla `transversal-isp-use-case-receives-the-whole-decision-ledger-for-one-query` · fuente `clarity:wider-port-than-needed`

Cita:

```ts
export interface NotifyOrderDependencies {
  clock: Clock;
  orders: OrderLedger;
  decisions: DecisionLedger;
  corroborations: CorroborationLedger;
  logger: Logger;
}
```

Antes:

```ts
decisions: DecisionLedger;
```

Después:

```ts
/** What the ledger knows of a session (ADR-028): the only question the correlation asks. */
decisions: Pick<DecisionLedger, "bySession">;
```

Prueba que lo cubriría: none: a type. The use case calls `decisions.bySession` (line 82) and nothing else; `record` and `find` travel with it. ADR-028 decided the query lives in the ledger's port (src/application/ledger/ports/decision-ledger.ts:2-3), so the module boundary is right; the dependency just says more than it uses, and a fake in tests/unit/application/outcomes/notify-order.test.ts must implement three methods to feed one

#### F-041 (baja) — El slice de puertos de `ingestion` hereda los puertos de infraestructura del plano

`src/composition/modules/ingestion.ts:10` · regla `transversal-isp-a-module-slice-inherits-the-infrastructure-ports-of-the-modules-it-calls` · fuente `clarity:transitive-port-slice`

Cita:

```ts
export interface IngestionPorts extends DecisionPorts {
  clock: Clock;
  logger: Logger;
  eventDedup: EventDedup;
}
```

Antes:

```ts
// ingestion needs the plane, so its slice is the plane's slice, which is the experiment's, the catalogue's, the barrier's and part of the ledger's:
export interface IngestionPorts extends DecisionPorts { … }
// src/composition/modules/decision.ts:29-34
export interface DecisionPorts
  extends ExperimentPorts, CatalogPorts, BarrierPorts, Pick<LedgerPorts, "decisions" | "decisionIds"> { … }
// and the services cross modules through helpers: assignmentServiceOf(ports), productTruthOf(ports), decisionPlaneOf(ports)
```

Después:

```ts
// a module may also provide what other modules need, and a consumer names only that:
export interface IngestionPorts {
  clock: Clock;
  logger: Logger;
  eventDedup: EventDedup;
  decisionPlane: DecisionPlane; // provided by the decision module, bound in the profile like any port
}
// src/composition/wiring.ts: `Module` returns `{ handlers?, security?, cors?, provides? }`, and `wireModules` binds `provides` before the consumers run (order = MODULES)
```

Prueba que lo cubriría: none: a design. Today `ingestionModule` compiles only against a `Ports` that has `sessions`, `visitors`, `policies`, `inference`, `catalog`, `experiments`, `assignments`, `decisions` and `decisionIds`, none of which it reads itself (it passes `ports` to `decisionPlaneOf`). CLAUDE.md § Anillos y módulos promises "el módulo declara su slice de puertos" and the slice is honest, only transitive; the cost shows in tests (tests/unit/composition/profile.test.ts) and in what a profile must provide to exercise ingestion alone

#### Cuadro por módulo

Ejes: 1 nombres · 2 comentarios · 3 tamaño y forma · 4 tipos · 5 errores · 6 pruebas como documentación · 7 documentación ↔ código (`specs/014-auditoria-integral/contracts/rubrica.md`). En negrita la severidad alta; entre paréntesis, la segunda o posterior ubicación de un hallazgo anclado en otro alcance. Sin puntuación: el cuadro lista, no califica.

| Alcance         | 1             | 2             | 3                 | 4             | 5             | 6             | 7                 |
| --------------- | ------------- | ------------- | ----------------- | ------------- | ------------- | ------------- | ----------------- |
| shared-kernel   | F-004         | F-001         | sin hallazgos     | F-003         | sin hallazgos | sin hallazgos | F-005             |
| system          | sin hallazgos | sin hallazgos | sin hallazgos     | sin hallazgos | sin hallazgos | F-006         | sin hallazgos     |
| merchant        | sin hallazgos | F-008         | sin hallazgos     | sin hallazgos | **F-007**     | sin hallazgos | sin hallazgos     |
| http-compartido | sin hallazgos | sin hallazgos | F-009             | sin hallazgos | sin hallazgos | sin hallazgos | sin hallazgos     |
| infrastructure  | sin hallazgos | F-011         | F-012, F-013      | (F-003 2ª)    | sin hallazgos | sin hallazgos | sin hallazgos     |
| composition     | sin hallazgos | sin hallazgos | sin hallazgos     | F-039, F-041  | (F-007 2ª)    | sin hallazgos | F-014, F-015      |
| experiment      | sin hallazgos | F-016, F-019  | sin hallazgos     | F-018         | sin hallazgos | F-020         | F-017             |
| ingestion       | sin hallazgos | F-025         | F-021             | sin hallazgos | F-022         | F-023, F-024  | sin hallazgos     |
| catalog         | F-028         | sin hallazgos | F-026, (F-021 2ª) | F-027         | (F-022 2ª)    | sin hallazgos | F-029             |
| barrier         | sin hallazgos | sin hallazgos | F-030             | sin hallazgos | (F-022 3ª)    | sin hallazgos | sin hallazgos     |
| selection       | sin hallazgos | sin hallazgos | sin hallazgos     | F-038         | sin hallazgos | sin hallazgos | (F-029 2ª)        |
| commercial      | sin hallazgos | F-032         | sin hallazgos     | F-031         | sin hallazgos | sin hallazgos | sin hallazgos     |
| decision        | sin hallazgos | sin hallazgos | F-033             | F-035         | (F-022 4ª/5ª) | sin hallazgos | F-034, (F-029 3ª) |
| ledger          | sin hallazgos | F-036         | (F-021 3ª)        | sin hallazgos | sin hallazgos | sin hallazgos | sin hallazgos     |
| outcomes        | sin hallazgos | sin hallazgos | sin hallazgos     | F-037, F-040  | (F-022 6ª)    | sin hallazgos | sin hallazgos     |

Refutados en esta fase: F-002 (`src/application/shared-kernel/decorators/logged-use-case.ts:19`), F-010 (`src/interface-adapters/http/boundary.ts:12`), F-042 (`src/application/decision/services/decision.service.ts:134`) — motivos en §5.

### 3.B Robustez

Fase 2 (handoff §5.B: fail-closed en cada borde, concurrencia y crecimiento en memoria, relojes, `throw` que deberían ser resultados, S-01/S-05/S-06, supuestos de instancia única). 6 hallazgos confirmados (`trabajo/hallazgos/fase-2.json`, verificados): 2 de severidad alta, 1 media, 3 baja; 2 refutados (F-049, F-050; motivo en §5).

**Lo que se verificó y está bien** (se cita para que el estado global no lo olvide):

- Bordes tipados: todo error de negocio llega a HTTP por `toProblem` (`type` del código, status y título del catálogo, `Retry-After` por código); un `date-time` mal formado lo rechaza Ajv con `ajv-formats` antes del handler (400), y la guarda `instantOf` sólo cubre el error de programación; un `throw` dentro de un handler es `internal-error` 500 (`build-server.ts:354`, `:411`). Todas las escrituras a ledgers devuelven `Result<…, LedgerUnavailable>` (asignación, decisión, exposición, orden, corroboración) y los tres caminos de degradación están probados (`tests/helpers/unavailable-ledgers.ts`): ingesta → `NO_OP` `ledger-unavailable` 202; exposición y outcomes → 503 con `Retry-After`.
- Relojes: cinco tolerancias de +5 min (eventos, catálogo, órdenes, corroboraciones, firma ±5) y 24 h hacia atrás en eventos, consistentes entre sí y con el contrato; `02` no fija cifras. Un `capturedAt` o `confirmedAt` muy viejo se acepta y falla cerrado por frescura (`unknown`/`stale`).
- Concurrencia en memoria: `memoryOrderLedger` decide primero/repetido/conflicto en una sección síncrona y lo prueba con dos notificaciones simultáneas; `NotifyReturnUseCase` lee, construye y escribe, pero el puerto decide atómicamente y la orden no cambia entre lecturas.
- Cuerpos grandes: `keepRawBodies` guarda los bytes en un `WeakMap` por request (se liberan con él) y el HMAC va sobre esos bytes en el security handler, antes de validar el body.
- `throw` en `domain/` y `application/`: seis, todos errores de programación según CLAUDE.md (defaults que no construyen, lote vacío que el contrato prohíbe, registro corrupto del ledger); ninguno en `application/`. F-050 lo refuta con un riesgo para §6.
- S-05 y S-06: F-042 (fase 1) y F-049 refutan que `DecisionService` decida o transporte lo que sería del dominio; queda como riesgo de tamaño para 014/015. S-06 es F-012 (fase 1, baja): ocho motivos de cambio en `build-server.ts`, y en esta fase el mismo archivo ancla F-045.

**Lo que no está bien** se concentra en dos hechos que hoy no se ven en el perfil local y aparecen con la primera dependencia real (017): los puertos de lectura no tienen canal de fallo (F-043) y los dos planos corren en el mismo event loop (F-045).

#### F-043 (alta) — Los puertos de lectura sólo pueden fallar lanzando: un store caído termina en 500, no en `NO_OP`

`src/application/ingestion/ports/event-dedup.ts:7` · regla `robustez-read-ports-can-only-fail-by-throwing` · fuente `constitution#II. Fail-closed`

Cita:

```ts
  claim(merchantId: MerchantId, eventIds: readonly EventId[]): Promise<ReadonlySet<EventId>>;
```

Antes:

```ts
// every read the pipeline makes has no failure channel; a store that is down can only throw, and the
// application may not catch (ope/no-generic-catch-in-application), so the request ends in 500 `internal-error`:
  claim(merchantId: MerchantId, eventIds: readonly EventId[]): Promise<ReadonlySet<EventId>>;            // ingestion
  load(merchantId: MerchantId, sessionId: SessionId): Promise<SessionState | undefined>;                  // decision (session, visitor)
  policiesFor(merchantId: MerchantId): Promise<MerchantPolicies>;                                          // decision
  activeFor(merchantId: MerchantId): Promise<Experiment | undefined>;                                     // experiment
  find(merchantId: MerchantId, experimentId: ExperimentId, visitorId: VisitorId): Promise<Assignment | undefined>; // experiment
  current(merchantId: MerchantId): Promise<CatalogSnapshot | undefined>;                                  // catalog
  find(merchantId: MerchantId, decisionId: DecisionId): Promise<Decision | undefined>;                    // ledger (exposure)
  bySession(merchantId: MerchantId, sessionId: SessionId): Promise<readonly Decision[]>;                  // ledger (orders)
```

Después:

```ts
// the same channel the writes have (ADR-021): the store answers or says it cannot, and the caller fails closed
  claim(merchantId: MerchantId, eventIds: readonly EventId[]): Promise<Result<ReadonlySet<EventId>, LedgerUnavailable>>;
// IngestBatchUseCase / DecisionService: a `fail` on a read degrades to NO_OP `ledger-unavailable` (202) as a failed write does today;
// ConfirmExposureUseCase / NotifyOrderUseCase: 503 with Retry-After, as their writes do today.
// (`LedgerUnavailable` or a kernel `StoreUnavailable`; the NO_OP reason catalogue is a string with a pattern, so a new reason is compatible)
```

Prueba que lo cubriría: tests/helpers/unavailable-ledgers.ts already fakes writes that answer `unavailable` (ADR-021 §6); the same helper with reads that answer `unavailable` — `claim`, `load`, `policiesFor`, `activeFor`, `current`, `find`, `bySession` — would prove that ingest answers 202 NO_OP `ledger-unavailable`, exposure 503 and orders 503. Today no such test exists because no such answer exists: on the local profile the memory gateways never fail, so the gap is latent; it becomes real with the store the 017 puts behind these ports, and ADR-021 promises that store "sin tocar dominio ni aplicación", which these signatures do not allow

#### F-045 (alta) — Los dos planos comparten un solo event loop: un snapshot de 6 MiB detiene la ingesta 140 ms

`src/infrastructure/http/build-server.ts:181` · regla `robustez-both-planes-share-one-event-loop` · fuente `constitution#IV. Dos caminos, dos garantías`

Cita:

```ts
const app = Fastify({ bodyLimit: BODY_LIMIT_BYTES, ...(loggerInstance ? { loggerInstance } : {}) });
keepRawBodies(app);
```

Antes:

```ts
// one Fastify instance serves every consumer: the SDK's ingest and exposure (decision plane) next to the
// platform's catalogue, orders, returns (measurement plane). Their work is synchronous on the same thread:
// the raw-body parser (parseAs: "buffer") + JSON.parse + Ajv over up to BODY_LIMIT_MIB = 32 MiB, the HMAC over
// the raw bytes (createHmac, gateways/merchant/node-message-authenticator.ts:8) and CatalogSnapshot.of over
// every variant. Measured on the local profile (tests/integration/catalog-size.test.ts): a pilot-sized
// snapshot of 5 000 × 10 variants, 6.0 MiB, takes 140 ms in one synchronous stretch; an ingest request
// that arrives meanwhile waits the whole stretch (its own p95 is 1.3 ms, tests/integration/ingest-latency.test.ts).
```

Después:

```ts
// the planes are two deployments of the same code: MODULES is a parameter of bootstrap (it already is:
// `bootstrap(config, { modules? })`), and the local profile keeps them together while a `decision` profile
// serves the `ingest`/`decision` tags and a `measurement` profile the `outcomes` tag, each with its own
// bodyLimit (50 events vs a snapshot). Until then, the stall is a written limit: 01 §9 style, with the
// measured figure, and `bodyLimit` per route (Fastify `routeOptions.bodyLimit`) so the SDK route never
// accepts more than a batch of 50 events needs.
```

Prueba que lo cubriría: none today. A test that starts the server (tests/helpers/test-app.ts with a listening socket) and fires one `PUT /v1/catalog` of the pilot size while a client measures `POST /v1/events` latency would show the ingest p99 jumping from ~1 ms to ≥ the snapshot's synchronous time; `npm run test:load` (autocannon, informative) could take a catalogue writer as a second scenario. Constitution IV: the decision plane is "síncrono, acotado" and the measurement plane "MUST NOT compartir el presupuesto de latencia del plano de decisión"; today they share the event loop and nothing — ADR, profile header, quickstart — says so. The global `bodyLimit` of 32 MiB reaches `POST /v1/events` too, whose credential lives in the merchant's page (revisited in fase 3, seguridad)

#### F-044 (media) — `CatalogStore.replace` no puede decir "no disponible" y `PUT /v1/catalog` no declara 503

`src/application/catalog/ports/catalog-store.ts:9` · regla `robustez-catalog-write-has-no-unavailable-answer-and-the-contract-no-503` · fuente `guide#Notas operativas del contrato`

Cita:

```ts
  /** Replaces the current snapshot and records its `receivedAt` among the receipts. */
  replace(merchantId: MerchantId, snapshot: CatalogSnapshot): Promise<void>;
```

Antes:

```ts
  replace(merchantId: MerchantId, snapshot: CatalogSnapshot): Promise<void>;
// contracts/paths/catalog.yaml: responses 200, 201, 400, 401, 403, 409, 422, 500 — no 503
```

Después:

```ts
  replace(merchantId: MerchantId, snapshot: CatalogSnapshot): Promise<Result<void, LedgerUnavailable>>;
// UpsertCatalogSnapshotUseCase: `if (!written.ok) return fail(written.error)` → 503 `ledger-unavailable` with Retry-After,
// as orders, returns and corroborations answer the same platform consumer (contracts/paths/orders.yaml:74)
```

Prueba que lo cubriría: tests/unit/application/catalog/upsert-catalog-snapshot.use-case.test.ts with a store whose `replace` answers `unavailable` (tests/helpers/unavailable-ledgers.ts pattern) expecting `{ ok: false, error: { code: "ledger-unavailable" } }`, and tests/integration/catalog.test.ts expecting 503 + `Retry-After`. CLAUDE.md § Notas operativas fixes for the platform consumer that "Todo record() devuelve Result<…, LedgerUnavailable> ⇒ 503 con Retry-After"; the catalog is the fourth operation of that consumer and the only one whose write cannot say so — the platform cannot tell a snapshot that was not kept from a bug

#### F-046 (baja) — El presupuesto por sesión es un leer-modificar-escribir entre `await`s; atómico hoy por accidente

`src/application/decision/services/decision.service.ts:89` · regla `robustez-session-budget-is-a-read-modify-write-across-awaits` · fuente `clarity:unwritten-atomicity-assumption`

Cita:

```ts
const remembered = await memory.recall(whose, now);
const session = remembered.session.absorb(Signals.of(batch.events), now);
```

Antes:

```ts
    const remembered = await memory.recall(whose, now);
    // … five awaits later (assignment, policies, truth, inference, recorder) …
    await memory.remember(whose, decision.isIntervention() ? { session: session.withIntervention(now), … } : { session });
```

Después:

```ts
// either the budget check moves next to the write, as OrderLedger does for orders (01 §6: no await between
// the check and the write): `SessionStateStore.saveIfUnchanged(…, expected)` or a per-session lock the
// store owns; or the assumption is written where it holds: memory-session-state-store.ts:4 already says
// "the plane always loads a session before it saves it" — add "and one batch of a session at a time:
// the local profile gives that for free (Promise.resolve resolves before the next request is read)".
```

Prueba que lo cubriría: tests/integration/decision-plane.test.ts has "one intervention per session" with sequential batches; the interleaved case (two batches of the same session in flight, budgets of 1, cooldown > 0) cannot be written today because with memory ports the whole `decide()` runs in one microtask chain and the second request is not even parsed until the first answered — which is exactly the unwritten assumption. Constitution IV declares single-instance guarantees and leaves exactly-once out, so this is not a violation; it is a lost update waiting for the first port with real I/O (017): two batches of one session then read `interventions: 0` both, both intervene, both write `1`

#### F-047 (baja) — Los ledgers en memoria crecen sin límite y nada lo dice (S-01)

`src/interface-adapters/gateways/ledger/memory-decision-ledger.ts:9` · regla `robustez-s01-memory-ledgers-grow-without-bound-and-nothing-says-it` · fuente `clarity:unstated-profile-limit`

Cita:

```ts
const decisions = new Map<string, Decision>();
const sessions = new Map<string, Decision[]>();
```

Antes:

```ts
// In-memory decision ledger. Composite key merchant + decision: a decision of another merchant
// does not exist for whoever asks. A secondary index merchant + session serves `bySession`.
```

Después:

```ts
// In-memory decision ledger. Composite key merchant + decision: a decision of another merchant
// does not exist for whoever asks. A secondary index merchant + session serves `bySession`.
// Unbounded by design: it stands in for the durable ledger (01 §9) on the local profile, so nothing
// is pruned and `record` copies the session's array; not a profile for traffic (ADR-018, 017).
```

Prueba que lo cubriría: none: a comment (or one paragraph in ADR-018 / profiles/local.ts). S-01 of the handoff, confirmed as stated: the five memory ledgers (`memoryDecisionLedger`, `memoryOrderLedger`, `memoryCorroborationLedger`, `memoryAssignmentLedger`, `memoryExposureLedger`) never prune while the three hot-state gateways do (SESSION_WINDOW, VISITOR_WINDOW, DEDUP_WINDOW); 01 §9 guarantees durability, so the memory ledgers stand in for a database and growing is what a database does — but neither ADR-018 (the profile), ADR-021 ("En memoria la aceptación es inmediata") nor the file says that the local profile is not meant to hold a day of traffic

#### F-048 (baja) — La tolerancia de reloj de 5 minutos está declarada cuatro veces

`src/application/merchant/policies/signature-window.ts:4` · regla `robustez-five-minute-clock-skew-declared-four-times` · fuente `clarity:duplicate-policy-value`

Cita:

```ts
const SIGNATURE_WINDOW_MINUTES = 5;
export const SIGNATURE_WINDOW_MS = minutes(SIGNATURE_WINDOW_MINUTES);
```

Antes:

```ts
// merchant/policies/signature-window.ts:4   SIGNATURE_WINDOW_MINUTES = 5
// domain/ingestion/event-batch.ts:19          TOLERANCE_FUTURE_MINUTES = 5
// domain/catalog/catalog-snapshot.ts:51       CAPTURE_TOLERANCE_MINUTES = 5
// domain/outcomes/order.ts:53                 CONFIRMATION_TOLERANCE_MINUTES = 5
```

Después:

```ts
// src/domain/shared-kernel/time.ts — one fact: how far ahead of OPE's clock a client's clock may be
export const CLOCK_SKEW_TOLERANCE_MS = minutes(5);
// the four sites read it; the signature window keeps its own name if its symmetry (± 5 min) is a separate decision
```

Prueba que lo cubriría: tests/unit/domain/ingestion/event-batch.test.ts:71 ("the tolerance is the one the contract publishes") and its siblings pin each value separately; one test on the kernel constant plus the contract text (`x-invariants` of EventBatch, CatalogSnapshot, Order, ADR-029) would keep the four in step. Consistent with each other and with 02 today (02 fixes no figure); they can only drift apart because they are four numbers

### 3.C Escalabilidad y camino a la 017

Fase 3, dimensión C (handoff §5.C, sin ampliar). Sin hallazgos propios: lo que la 017 necesita saber está en §3.B (F-043, F-044, F-045, F-046, F-047) y en §6. Lo verificado:

- **Puertos aptos para Postgres sin tocar casos de uso**: todo puerto devuelve `Promise`; todo `record` devuelve `Result<…, LedgerUnavailable>` salvo `CatalogStore.replace` (F-044); ningún caso de uso depende de recibir la misma instancia que guardó — `NotifyOrderUseCase` responde con la orden que el puerto devuelve (`kept`), `Order`, `CatalogSnapshot`, `SessionState` y `VisitorState` son inmutables (`readonly`, arreglos copiados). Lo que sí falta es el canal de fallo de las lecturas (F-043).
- **Costo del camino crítico**: `Signals.of` es O(eventos) y `merge` O(claves del vocabulario); `BarrierRules.infer` O(reglas × profundidad); `QualityGate.judgeAll` O(candidatos × claims), tres o menos por barrera; `FactContext` se construye una vez por decisión. `bySession` devuelve la sesión entera y `Correlation.of` / `lastGranted` la recorren una vez (O(n), n = lotes de la sesión); el único O(n²) es del perfil en memoria (`memoryDecisionLedger.record` copia el arreglo de la sesión, F-047). Medido hoy: ingesta p50 0,67 ms, p95 1,28 ms con `inject`; brazos CONTROL 0,66 / TREATMENT 0,83 ms.
- **Tiempo de desarrollo**: F-055 (§3.E) — 147 s de pared, 522 s de CPU repartidos; la mutación completa tomó 57 min (99,15 %).

### 3.D Seguridad

Fase 3, dimensión D (handoff §5.D, sin ampliar). Lo verificado y bien: los logs llevan `merchantId`, `orderId`, `decisionId`, `experimentId`, brazos sólo en `assignment-drift` (sin visitante), nombre y duración del caso de uso; nunca request, cuerpo, headers ni IP (`request-logging.ts` reemplaza el serializador de Fastify y redacta todo header; `tests/integration/logging-privacy.test.ts` lo prueba en cinco casos). Los `detail` de Problem Details interpolan `eventId`, `productId`, `variantId`, `orderId` y SKU — identificadores que 01 §10.2 registra — y nunca `details`. Los ejemplos del contrato no contienen datos personales. La rotación de secretos tiene su ventana de gracia ("uno o dos" activos, ADR-029 §1). La deuda declarada (S-12) coincide con el código: alias `typescript` → `@typescript/typescript6@6.0.2` con `overrides` para openapi-typescript, `patches/@stryker-mutator+vitest-runner+10.0.0.patch` presente y `oas3-schema: "off"` con motivo en `contracts/.spectral.yaml`.

Lo que no: la credencial de plataforma es alcanzable desde un navegador porque CORS deriva sus headers de todos los esquemas (F-051, alta), y tres observaciones de menor fuente (F-053, F-057, F-058).

#### F-051 (alta) — CORS anuncia a los navegadores el header de la credencial de plataforma ("sin CORS", ADR-025 §5)

`src/infrastructure/http/build-server.ts:183` · regla `seguridad-cors-announces-the-platform-credential-header-to-browsers` · fuente `ADR-025`

Cita:

```ts
const credentialHeaders = Object.values(options.security ?? {}).map((scheme) => scheme.header);
if (options.cors) await registerCors(app, options.cors, credentialHeaders);
```

Antes:

```ts
// every wired scheme, browser or not, becomes an allowed preflight header:
const credentialHeaders = Object.values(options.security ?? {}).map((scheme) => scheme.header);
// probe (startTestApp, OPTIONS from a registered origin announcing x-ope-platform-key):
// POST /v1/orders  204  allow-origin https://a.example | allow-headers content-type, x-ope-ingest-key, x-ope-platform-key | methods POST
// POST /v1/returns 204  (same)
// PUT  /v1/catalog 204  (same; the browser then blocks PUT because methods is ["POST"] — orders and returns are POST)
```

Después:

```ts
// the scheme says who it is for; CORS derives from the browser ones only
export interface SecurityScheme {
  handler: SecurityHandler;
  header: string;
  consumer: "browser" | "server";
}
// build-server.ts
const credentialHeaders = Object.values(options.security ?? {})
  .filter((scheme) => scheme.consumer === "browser")
  .map((scheme) => scheme.header);
// modules/merchant.ts: ingestKey → "browser", platformKey → "server"
```

Prueba que lo cubriría: tests/integration/cors.test.ts: a preflight from a registered origin announcing `x-ope-platform-key` (and `x-ope-timestamp`/`x-ope-signature`) must not list it in `access-control-allow-headers`; today the file asserts the ingest header is present (line 33) and nothing about the platform one. ADR-025 §5 decides `platformKey` "sólo servidor a servidor (sin CORS)" and spec 010 FR-021 repeats it; ADR-025 §7 makes CORS derive its headers from "los esquemas registrados" and the implementation took every scheme, so a page on any registered origin can send `POST /v1/orders` and `POST /v1/returns` with the platform key from the browser (the key is secret, so this is a defence the ADR decided and the code does not provide; with `platformSecrets` configured the signature headers are not allowed and the request fails, without them it succeeds)

#### F-053 (baja) — `ownsPlatformKey` compara la credencial secreta con `includes` (S-10)

`src/domain/merchant/merchant.ts:91` · regla `seguridad-s10-secret-credential-compared-with-includes` · fuente `clarity:non-constant-time-secret-compare`

Cita:

```ts
  ownsPlatformKey(key: string): boolean {
    return key !== "" && this.platformKeys.includes(key);
  }
```

Antes:

```ts
return key !== "" && this.platformKeys.includes(key);
```

Después:

```ts
return key !== "" && this.platformKeys.some((own) => constantTimeEquals(own, key));
// `constantTimeEquals` in the domain shared-kernel (pure: length check, then XOR over every code unit, no early exit),
// the same primitive `PlatformSignature.matches` already needs; `owns` (ingest key, public) may keep `includes`
```

Prueba que lo cubriría: tests/unit/domain/merchant/merchant.test.ts: `ownsPlatformKey` with a key that shares a long prefix with a real one must take the same path as a key that differs in the first character (a property test on the primitive, not a timing test). ADR-029:13 calls `platformKey` "una clave secreta servidor a servidor" and its §3 decides constant-time comparison for the signature; the key that authenticates the same requests — alone, when the merchant has no `platformSecrets` — is compared with `includes` (V8 string equality: length, then bytes with early exit), and the directory scans merchants with it (config-merchant-directory.ts:10). Over HTTP the leak is not measurable in practice; the inconsistency is with the ADR's own standard

#### F-057 (baja) — La credencial pública llega al `bodyLimit` global de 32 MiB

`src/infrastructure/http/build-server.ts:150` · regla `seguridad-the-public-credential-reaches-the-global-body-limit` · fuente `clarity:public-credential-reaches-the-global-body-limit`

Cita:

```ts
const BODY_LIMIT_BYTES = BODY_LIMIT_MIB * BYTES_PER_KIB * BYTES_PER_KIB;
```

Antes:

```ts
  const app = Fastify({ bodyLimit: BODY_LIMIT_BYTES, … });   // 32 MiB for every route, ADR-025: "no hay límite por operación"
```

Después:

```ts
// the content-type parser already sees the request before buffering (keepRawBodies): cap by path there
  app.addContentTypeParser(JSON_CONTENT_TYPE, { parseAs: "buffer", bodyLimit: limitFor(request.url) }, …)
// or two Fastify instances (F-045): the SDK's with a batch-sized limit (50 events ≈ tens of KiB), the platform's with 32 MiB
```

Prueba que lo cubriría: tests/integration/ingest-events.test.ts: a `POST /v1/events` body of, say, 1 MiB must be refused with 413 before it is parsed (today it is buffered, `JSON.parse`d and only then rejected by Ajv for `maxItems: 50`). ADR-025 decided the global limit on the premise that openapi-backend routes with one handler and "no hay límite por operación"; the premise holds for routes, not for the parser, which receives the request. The ingest credential is public by design (ADR-014: "todo lo que lleva es público"), so anyone can spend the decision plane's event loop on 32 MiB of JSON per request; the cost is the one F-045 measured (fase 2) and the mitigation is the same

#### F-058 (baja) — El replay dentro de la ventana lo absorbe la idempotencia y ADR-029 no lo dice (S-11)

`docs/adr/029-firma-de-plataforma.md:26` · regla `seguridad-s11-replay-inside-the-window-is-absorbed-by-idempotency-and-unstated` · fuente `clarity:unstated-replay-defense`

Cita:

```ts
3. **Ventana** de ±300 s contra el reloj del servidor; comparación en tiempo constante; se
   acepta cualquiera de los secretos activos.
```

Antes:

```ts
3. **Ventana** de ±300 s contra el reloj del servidor; comparación en tiempo constante; se
   acepta cualquiera de los secretos activos.
```

Después:

```ts
3. **Ventana** de ±300 s contra el reloj del servidor; comparación en tiempo constante; se
   acepta cualquiera de los secretos activos. Un replay dentro de la ventana es posible por
   diseño y lo absorbe la idempotencia: orden y devolución repetidas responden `200` sin
   segundo efecto; un snapshot repetido con el mismo `capturedAt` responde `200` y uno más
   viejo `422 catalog-out-of-order`. Sin nonce: el efecto de un replay es siempre nulo.
```

Prueba que lo cubriría: tests/integration/platform-signature.test.ts: replaying the exact signed request (same timestamp, same body) inside the window must answer 200 for orders/returns and 200 or 422 for the catalogue, never a second record — provable today, unwritten in the ADR (S-11 of the handoff: verified, no exploitable window; the one effect of a replay is the same idempotent answer). Rotation: "uno o dos" secrets active at once is the grace window, and it is written (ADR-029 §1)

### 3.E Calidad de las pruebas

Fase 3, dimensión E (handoff §5.E). Lo verificado y bien: las excepciones de mutación de `decision.service.ts` (4, no 5) y de `notify-order.ts` y `cors.ts` son mutantes equivalentes o inalcanzables y quedan acotadas a su línea en el reporte completo; las réplicas contrato ↔ código con prueba son problem types, capacidades, motivos `NO_OP`, barreras, anclajes, vocabulario de eventos, `STEPS` (candidatos) e `INCENTIVE_KINDS`; `OrderStatus` no tiene prueba de réplica pero el compilador la hace en un sentido (`order.status()` se asigna al enum generado); `REDEMPTION_VERDICTS` no está en el contrato. Determinismo: las 15 pruebas de integración con reloj fijo pasan `occurredAt` explícito; los ids aleatorios sólo se comparan por patrón. Las pruebas de latencia son gates (p95 < 50 ms); sólo `test:load` es informativa, como pide la constitución IV (F-060 refutado). CONTROL se prueba de punta a punta con un experimento 50/50 propio (F-061 refutado).

Lo que no: los `Stryker restore` que no restauran (F-052, media) y tres proposiciones de menor fuente (F-054, F-055, F-056). Sobrevivientes de la mutación completa (8, `trabajo/gates/mutation-full-summary.json`): `decision.service.ts:137` (spread de clave opcional, equivalente), `build-server.ts:140` (recorte de la query en `instance`, sin prueba con `?`), `build-server.ts:337` (log vacío), `cors.ts:33` (`strictPreflight: true` → `false`: ninguna prueba manda un preflight malformado), `build-server.ts:387` (la ruta raíz `/` sin el comodín: nada la pide), `memory-event-dedup.ts:23/26/44` (bordes de la ventana y la segunda llamada a `expire`, F-025); sin cobertura: `build-server.ts:411` (catch-all defensivo). Ninguno es un defecto del producto; los de `cors.ts:33` y `memory-event-dedup.ts:23/26` son pruebas que faltan en el borde.

#### F-052 (media) — Un `Stryker restore` después del `return` no restaura: tres archivos silencian mutantes hasta el final

`src/infrastructure/http/build-server.ts:121` · regla `pruebas-stryker-restore-after-return-does-not-restore` · fuente `guide#Gates de calidad`

Cita:

```ts
  // Stryker disable ConditionalExpression,LogicalOperator: openapi-backend only stores handler objects and the boolean `authorized` here; the guard is defensive and its mutants are equivalent
  return Object.entries(results).filter(
    (entry): entry is [string, Record<string, unknown>] => typeof entry[1] === "object" && entry[1] !== null,
  );
  // Stryker restore ConditionalExpression,LogicalOperator
}
```

Antes:

```ts
  // Stryker disable ConditionalExpression,LogicalOperator: …
  return Object.entries(results).filter(…);
  // Stryker restore ConditionalExpression,LogicalOperator   ← after the last statement of the block: attached to nothing
```

Después:

```ts
  // Stryker disable next-line ConditionalExpression,LogicalOperator: … (one statement, one line form)
  return Object.entries(results).filter(…);
// same in src/domain/barrier/condition.ts:172-179 and src/domain/barrier/signals.ts:113-122: the `// Stryker restore` sits after the
// `return undefined` of the last `case`; move it before the closing brace of the switch's parent, or use `next-line` on each case group
```

Prueba que lo cubriría: the full mutation report (reports/mutation/report.json; `trabajo/gates/mutation-full-summary.json`) is the proof: every `Ignored` mutant carries the reason of the disable that silenced it, and the reason of line 117 appears on 40 mutants of `build-server.ts` from line 119 to 421 — `registerSecurity` (226: `if (error instanceof SecurityError)`), the declared-status check (302-303), the content type of errors (319-320), the log of a handler that throws (337), `send` headers (364), the Fastify error hook (396-398), the wiring of security (421). In `condition.ts` the reason of line 172 reaches `#ref` at 184 and 187 — the vocabulary check itself (`this.#types.includes(ref.type)`, `subtypes?.includes(ref.subtype)`) — and in `signals.ts` the reason of 113 reaches `combine` at 134. A `disable`/`restore` pair whose restore is the last thing in a block silences the rest of the file; `test:mutation` on a PR that touches those lines reports nothing. CLAUDE.md § Gates de calidad admits only the `next-line` form with a reason

#### F-054 (baja) — `test:contract` nunca autentica a la plataforma: tres operaciones sólo se prueban hasta el 401 (S-09)

`scripts/test-contract.mjs:53` · regla `pruebas-s09-the-contract-test-never-authenticates-the-platform` · fuente `clarity:contract-test-never-authenticates-the-platform`

Cita:

```ts
      "-H",
      `X-OPE-Ingest-Key: ${CONTRACT_MERCHANT.ingestKeys[0] ?? ""}`,
```

Antes:

```ts
      "-H",
      `X-OPE-Ingest-Key: ${CONTRACT_MERCHANT.ingestKeys[0] ?? ""}`,
```

Después:

```ts
      "-H", `X-OPE-Ingest-Key: ${CONTRACT_MERCHANT.ingestKeys[0] ?? ""}`,
      "-H", `X-OPE-Platform-Key: ${CONTRACT_MERCHANT.platformKeys[0] ?? ""}`,
// (a merchant without `platformSecrets`, so no signature is needed; or a Schemathesis hook that signs)
```

Prueba que lo cubriría: `npm run test:contract` itself: today its output says "401 Unauthorized (3 operations): POST /v1/orders, POST /v1/returns, PUT /v1/catalog" (trabajo/gates/global-test-contract.txt:58-61), so three of the seven built operations are fuzzed only up to the credential. The "schema validation mismatch" of S-09 has two causes and neither is a contract stricter than the server: those three operations answer 401 to everything, and `POST /v1/events` / `POST /v1/exposures` reject most generated bodies through `x-invariants` the schema cannot express (random `visitorId` per event ⇒ 422 `session-visitor-mismatch`; random `decisionId` ⇒ 422 `exposure-decision-unknown`; random `occurredAt` outside 24 h/5 min ⇒ 422), by design (ADR-007)

#### F-055 (baja) — Tres archivos de prueba que ejecutan herramientas son el 54 % del tiempo de la suite

`tests/audit/audit.test.ts:1` · regla `pruebas-tool-driving-tests-dominate-the-default-suite` · fuente `clarity:slow-tests-in-the-default-suite`

Cita:

```ts
// US7 (FR-060, FR-064, FR-066): the auditing skill's deterministic half. run-gates reports the
```

Antes:

```ts
// vitest.config: one project; `npm test` runs everything, including the tests that shell out to eslint, knip, jscpd,
// dependency-cruiser and redocly over fixtures (tests/audit, tests/governance/quality, tests/unit/contract-docs)
```

Después:

```ts
// vitest.config: projects `fast` (unit, integration, contract rules) and `tools` (audit, quality, contract-docs);
// `npm test` runs `fast`, CI runs both; and tests/integration/* start the app once per file (`beforeAll`) with
// fresh in-memory ports per test instead of `startTestApp()` inside every `it`
```

Prueba que lo cubriría: measurement of 2026-09-19 (vitest JSON reporter over the whole suite, 1004 tests, 147 s wall, 522 s of file time on the workers): tests/audit/audit.test.ts 148 s (14 tests), tests/unit/contract-docs.test.ts 78 s (2), tests/governance/quality.test.ts 58 s (4) — three files are 54 % of the CPU time; the 22 integration files take 162 s for 172 tests (0.94 s per test, one `bootstrap` each); the 75 unit files take 90 s for 599 tests. The handoff asks whether the suite scales as a project cost; nothing written fixes a budget, so this is a proposal, not a defect

#### F-056 (baja) — `eventOf` toma el reloj real por defecto bajo un reloj fijo

`tests/helpers/test-app.ts:142` · regla `pruebas-event-helper-defaults-to-the-real-clock-under-a-fixed-one` · fuente `clarity:helper-default-is-a-trap`

Cita:

```ts
    occurredAt: new Date().toISOString(),
```

Antes:

```ts
    occurredAt: new Date().toISOString(),
```

Después:

```ts
    occurredAt: NOW, // the same instant `fixedClock` defaults to, exported by the helper; a test that fixes another clock passes its own
```

Prueba que lo cubriría: none today. Every one of the 15 integration files that fixes the clock passes `occurredAt` explicitly (checked file by file), which is how the trap is avoided after it bit twice in 013 (handoff §5.E); the helper still defaults to the process clock, so the next test with `fixedClock(NOW)` and a bare `eventOf(n)` gets 422 `event-timestamp-out-of-range` when NOW is more than 5 min behind or 24 h ahead of the real date. `tests/unit/composition/wiring.test.ts:48` and `tests/integration/bootstrap.test.ts:73` use the real clock on purpose (start-up), which is fine

### 3.F Cumplimiento funcional

Fase 4: las 479 afirmaciones de `trabajo/afirmaciones.md` resueltas una por una (constitución, 01/02/03, FR/SC de las specs 001–013): 421 probadas (163 por la cabecera de la prueba que declara cubrir el requisito, 258 por prueba, gate o código señalado), 12 parciales, 1 huecos, 6 planificadas en features del mapa, 23 históricas (afirman sobre el cierre de su feature; hoy los gates están verdes), 1 superada (ADR-018), 1 fuera de alcance (Zona A) y 14 con hallazgo. Tres contradicciones con un DECIDIDO (`trabajo/hallazgos/fase-4.json`, verificadas): F-062, F-063, F-064.

Huecos sin hallazgo (no contradicen: faltan): A-028 (pérdida de `visitorId` no cuantificada), A-046 (logs sin `sessionId` ni motivo de `NO_OP`), A-049 (sin prueba única de punta a punta con adaptador), A-121 (peso del cliente sin medir), A-042 (carrito como superficie no modelado). Lo planificado (014 flags/kill switch/configuración por API; 016 portal, `NOT_AVAILABLE`, ITT; 017 durabilidad) se lista como tal en §4.

Marcadores (T246): decisiones tomadas en código que convendría marcar — la excepción de `incentive` frente a VII (F-062), el caso base push frente a X (F-063), el hook sin `arch` (F-064) y los porcentajes en el dominio (F-031) son `DECIDIDO` de hecho sin texto que lo diga; ninguna requiere un `ABIERTO`.

**Sospechas del handoff (S-01..S-12)**:

| S    | Veredicto                        | F-NNN / motivo                                                                                                                                                                                                                                                                                                                                        |
| ---- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-01 | confirmada                       | F-047 (baja): los ledgers en memoria no podan y nada lo dice; sustituto del durable de 01 §9                                                                                                                                                                                                                                                          |
| S-02 | confirmada como diseño           | `commercial-policy-blocked` inalcanzable hasta la 015 (F-042/F-049 refutados sobre el orquestador; `Stryker disable` en `decision.service.ts:222` con motivo); el motivo debe existir hoy: el catálogo de `NO_OP` es un string con patrón y el contrato lo publica para la 015                                                                        |
| S-03 | confirmada como diseño           | `IncentiveRedemption.of` cruza con la última decisión `INTERVENE` con incentivo, no con `EXPOSED` (`correlation.ts:83-97`); ADR-028 §5 lo decide así y 01 §5 no exige la exposición para la redención; un incentivo decidido y no mostrado da `not-applied`, que es informativo. Sin hallazgo; conviene decirlo en la nota `mecanismo-de-correlacion` |
| S-04 | refutada                         | 02 §5.1: "el vínculo lo establece la plataforma"; `Correlation.of` exige además que el merchant haya decidido en esa sesión (`bySession` no vacío), lo que 01 §5 pide; nada más lo requiere                                                                                                                                                           |
| S-05 | refutada                         | F-042 y F-049 refutados; tamaño → §6                                                                                                                                                                                                                                                                                                                  |
| S-06 | confirmada                       | F-012 (baja); F-045 en el mismo archivo                                                                                                                                                                                                                                                                                                               |
| S-07 | confirmada como convención local | `                                                                                                                                                                                                                                                                                                                                                     | undefined`explícito en`outcomes` (`OrderFacts`, `NotifyOrderRequest`) frente a claves omitidas en el resto; sin regla escrita; no genera hallazgo (fase 1 no encontró una lectura peor); propuesta al dueño: fijarla en CLAUDE.md § Tipado en un sentido |
| S-08 | refutada                         | `Return` en `order.ts` por el ciclo (documentado en el archivo y en el quickstart 013); `Corroboration` clase por una regla (la guarda de reloj) según ADR-024 ("clase si hay reglas")                                                                                                                                                                |
| S-09 | refutada                         | F-059 refutado; causa: `x-invariants` (ADR-007) y tres operaciones sin credencial de plataforma en el runner (F-054)                                                                                                                                                                                                                                  |
| S-10 | confirmada                       | F-053 (baja)                                                                                                                                                                                                                                                                                                                                          |
| S-11 | refutada                         | sin ventana explotable; F-058 (baja) pide escribirlo en ADR-029                                                                                                                                                                                                                                                                                       |
| S-12 | refutada                         | deuda declarada = código                                                                                                                                                                                                                                                                                                                              |

#### F-062 (alta) — La notificación de orden lleva `incentive`, un campo que la constitución VII y 01 §10.3 no admiten

`contracts/components/schemas/Order.yaml:28` · regla `funcional-order-notification-carries-a-field-constitution-vii-closes-out` · fuente `constitution#VII. OPE observa comportamiento, no personas`

Cita:

```ts
  incentive:
    $ref: ./Incentive.yaml
```

Antes:

```ts
# constitution VII: "El contrato del conector de órdenes MUST acotarse a: identificador de orden, monto, moneda,
# ítems con SKU y cantidad, fecha y el identificador de OPE. Campos adicionales se rechazan."
# 01 §10.3 lists the same six; Order.yaml declares a seventh:
  incentive:
    $ref: ./Incentive.yaml
```

Después:

```ts
# either the constitution (v1.3.0) and 01 §10.3 admit "y el incentivo aplicado (kind, value), que no es un dato del comprador",
# citing ADR-028 §5–6 — or the field leaves the order and the redemption is measured another way (016).
# The Constitution Check of specs/013-outcomes-ordenes-y-devoluciones/plan.md:65 passed VII listing `incentive?` "(01 §10.3)",
# which does not list it: that row is where the gap should have surfaced.
```

Prueba que lo cubriría: none: a documentation decision. The field carries no buyer data (`{ kind: percent, value }`) and ADR-028 §5 decides the redemption is "un dato, no una validación" — a reasonable extension, but the constitution's list is closed ("Campos adicionales se rechazan") and prevails over ADRs (CLAUDE.md § Fuentes de verdad). The refutation "VII is about personal data and this is not" is the amendment that has to be written, not assumed

#### F-063 (alta) — El puerto de plataforma de cuatro operaciones y los adaptadores del principio X no existen; se construyó push sin enmendar

`.specify/memory/constitution.md:179` · regla `funcional-the-platform-port-of-principle-x-is-not-what-was-built` · fuente `constitution#X. Puertos en los dos bordes`

Cita:

```ts
- El **puerto de plataforma** tiene exactamente cuatro operaciones: `obtenerCatalogo`,
  `obtenerStockYPrecio`, `alConfirmarOrden`, `alRegistrarDevolucion`. El núcleo depende del
  puerto y MUST NOT saber si del otro lado hay Magento, VTEX o un adaptador de prueba.
- El **adaptador genérico** (catálogo por REST/archivo + notificación HTTP de orden) y el
  **adaptador de prueba** existen desde el día uno;
```

Antes:

```ts
# built (ADR-025, ADR-028): the platform pushes — PUT /v1/catalog, POST /v1/orders, POST /v1/returns — into the
# consumer `platform`; the core depends on CatalogStore / OrderLedger, not on a PlatformPort; no adapter (generic
# or test) exists as code; pull adapters are "operaciones posteriores del mapa (V3)" (ADR-025:60).
# specs/010-catalogo-y-stock/plan.md § Constitution Check has no row for X; specs/013 neither.
```

Después:

```ts
# either principle X is amended (v1.3.0): "el caso base es que la plataforma empuja (ADR-025); el puerto de cuatro
# operaciones y los adaptadores genérico y de prueba son la V3 del mapa" — or the port and the adapters are
# scheduled as a feature. Either way, every Constitution Check evaluates the ten principles, not a subset.
```

Prueba que lo cubriría: none: a decision. What exists: three inbound operations with the platform credential (`contracts/api-map.yaml` consumer `platform`), no `PlatformPort` interface in `src/application/**/ports/`, no adapter module; `tests/` has no end-to-end run through an adapter (constitution § Flujo de desarrollo asks for "una prueba end-to-end … con el adaptador de prueba", see A-049). The push design is sound and 02 §6.2 half-supports it ("notificación HTTP de orden"), but the constitution's wording is pull (`obtener…`) and "desde el día uno", and nothing amended it

#### F-064 (alta) — La verificación de arquitectura no corre en el pre-commit que la spec 002 FR-041 exige

`lefthook.yml:1` · regla `funcional-spec-002-fr-041-arch-must-run-in-the-pre-commit-check` · fuente `spec:002#FR-041`

Cita:

```ts
# Pre-commit hook (ADR-011): format and lint on staged files, full typecheck.
```

Antes:

```ts
# lefthook.yml runs format, lint, typecheck (tests/hooks/lefthook.test.ts "does not run contract:check or the tests");
# spec 002 FR-041: the architecture check "MUST correr en el chequeo previo a commit y en integración continua";
# spec 003 FR-040 later fixed the hook to format + lint + typecheck without naming arch, and nothing amended 002.
```

Después:

```ts
# either `npm run arch` joins the hook (it takes seconds; dependency-cruiser over src/) — or spec 002 FR-041 and
# specs/002/quickstart.md record that 003 FR-040 narrowed the hook and arch runs in CI and in `quality` only.
```

Prueba que lo cubriría: tests/hooks/lefthook.test.ts would assert the `arch` command in the hook (today it asserts the three commands). Low consequence — `npm run arch` runs in CI (`ci.yml:47`) and inside `npm run quality` — but a MUST of an approved spec that the code stopped meeting without a written amendment

## 4. Matriz de cumplimiento

### 4.1 Constitución I–X

| id    | principio                          | estado      | afirmación                                                                                                     | evidencia                                                                                                                                                                                                                                             |
| ----- | ---------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-001 | `constitution#I`                   | probado     | Cada autoridad vive en su propio módulo con interfaz explícita y sin depender de las demás salvo por el contr… | ✓ módulos `barrier`, `catalog`, `selection`, `commercial`, `experiment` con puertos propios (`CONTEXT_MAP`, `tests/architecture/architecture.test.ts`); el orquestador transporta `InferenceContext`/`CommercialInput`                                |
| A-002 | `constitution#I`                   | probado     | El orquestador se limita a armar contexto e invocar autoridades en orden; no infiere barreras, no rankea cand… | ✓ `decision.service.ts` sólo arma contexto e invoca (F-042/F-049 refutados); `tests/unit/application/decision/decision.service.test.ts` "assignment → session → truth → inference → record"                                                           |
| A-003 | `constitution#I`                   | probado     | La política comercial es la única autoridad que emite el veredicto final; ninguna otra fuerza una intervención | ✓ `CommercialPolicy.verdict` única salida `intervene`; `tests/unit/domain/commercial/verdict.test.ts` (12 casos); `decision.service.test.ts` "CONTROL records the selection too"                                                                      |
| A-004 | `constitution#I`                   | probado     | Composition root único; ningún módulo instancia infraestructura ni importa clientes concretos fuera de él      | ✓ `npm run arch` (`nobody-imports-composition`, `composition-wires-by-module`, `profiles-compose-modules`) y `tests/architecture/shape.test.ts` "instantiates npm packages only in composition, infrastructure and gateways"                          |
| A-005 | `constitution#II`                  | hallazgo    | Todo paso del pipeline puede terminar en NO_OP con motivo explícito y registrado; NO_OP no es excepción        | parcial: NO_OP con motivo en cada paso (`no-op-reasons.yaml`, `decision-plane.test.ts`, `ledger-unavailable.test.ts`); una lectura de un store caído no puede terminar en NO_OP → F-043                                                               |
| A-006 | `constitution#II`                  | probado     | El stock es guardia, no claim: nunca se afirma disponibilidad ni cantidades                                    | ✓ `available` booleano sin cantidades (`CatalogVariant.yaml`, `catalog-snapshot.ts:24`); `quality-gate.test.ts` `variant-unavailable`; `product-truth.service.test.ts`                                                                                |
| A-007 | `constitution#II`                  | probado     | Un claim inventado o contradictorio invalida el mensaje entero (UNACCEPTABLE); el quality gate es puro y no s… | ✓ `QualityGate.judge` puro, primer claim sin soporte rechaza; `tests/unit/domain/selection/quality-gate.test.ts` por tabla; `commercial-policy.test.ts` "with an empty profile the gate rejects every claim"                                          |
| A-008 | `constitution#II`                  | probado     | Sin configuración de margen la política bloquea todo candidato con componente económico; sin ledger la interv… | ✓ `margin-missing` (`commercial-policy.ts:227`, `verdict.test.ts`); ledger caído ⇒ NO_OP `ledger-unavailable` (`tests/integration/ledger-unavailable.test.ts`)                                                                                        |
| A-009 | `constitution#II`                  | parcial     | El perfil de datos se mide, no se declara: nivel efectivo = mínimo entre configurado y observado; degrada solo | parcial: nivel observado `observedSyncLevel` (`sync-level.test.ts`, degrada solo); el mínimo con el nivel configurado es de la 014 (ADR-025 §4) → planificado 014                                                                                     |
| A-010 | `constitution#III`                 | probado     | Asignación CONTROL/TREATMENT determinista y estable por visitorId, sin estado compartido, registrada al asign… | ✓ `Experiment.assign` pura (`assignment.test.ts`, regresión de huella); registro al asignar con el primer lote aceptado (`tests/integration/assignment.test.ts`)                                                                                      |
| A-011 | `constitution#III`                 | probado     | CONTROL atraviesa el mismo pipeline; la política resuelve siempre NO_OP; toda diferencia de comportamiento en… | ✓ `tests/integration/assignment.test.ts` "CONTROL runs the whole pipeline"; `decision.service.test.ts` "CONTROL goes through the same inference"; latencia por brazo (`ingest-latency.test.ts`)                                                       |
| A-012 | `constitution#III`                 | probado     | El aprendizaje no realimenta la decisión durante el experimento                                                | ✓ sin aprendizaje en runtime: reglas fijas por configuración (`BarrierRules`), sin modelo; ADR-026                                                                                                                                                    |
| A-013 | `constitution#III`                 | probado     | La asignación experimental no es un feature flag: no comparten mecanismo                                       | ✓ experimentos en `experiments[]`, flags inexistentes (014); mecanismos distintos por diseño (ADR-022)                                                                                                                                                |
| A-014 | `constitution#III`                 | probado     | La configuración del merchant se versiona y cada decisión del ledger estampa la versión con la que se tomó     | ✓ `policyVersion`/`commercialPolicyVersion` en cada decisión (`decision.service.test.ts` "the ledger keeps the selection… commercial version"; `isolation.test.ts:215` "each ledger stamps its own version")                                          |
| A-015 | `constitution#III`                 | probado     | La observabilidad es un observador puro: no modifica una decisión                                              | ✓ `LoggedUseCase` envuelve sin tocar la respuesta (`logged-use-case.test.ts`); `request-logging.ts` sólo serializa                                                                                                                                    |
| A-016 | `constitution#III`                 | parcial     | Cinco estados de la cadena de evidencia explícitos; ninguno se infiere del anterior; PENDING_CORRELATION / NO… | parcial: ASSIGNED/EXPOSED/VERIFIED_ORDER/ATTRIBUTED_ORDER/RETURNED explícitos (`OrderStatus`, `Exposure`, `Assignment`; `orders.test.ts`, `returns.test.ts`); `NOT_AVAILABLE` no existe en código ni contrato → planificado 016 (lecturas del portal) |
| A-017 | `constitution#IV`                  | hallazgo    | Plano de decisión síncrono, acotado, sin I/O de red saliente ni escrituras bloqueantes; objetivo < 150 ms med… | parcial: sin red ni escritura bloqueante en el camino (`arch` `domain-is-pure`/`application-is-pure`, puertos `Promise.resolve`); p95 < 50 ms como gate (`ingest-latency.test.ts`); el event loop se comparte con la medición → F-045                 |
| A-018 | `constitution#IV`                  | hallazgo    | Plano de medición asíncrono, durable, auditable; no comparte presupuesto de latencia                           | F-045: el plano de medición comparte el event loop (140 ms por snapshot medidos); durable y auditable → planificado 017                                                                                                                               |
| A-019 | `constitution#IV`                  | planificado | Redis es estado caliente con expiración, no fuente durable; PostgreSQL es la fuente durable                    | planificado 017: hoy todo en memoria (perfil local, ADR-018); las ventanas de estado caliente existen (`SESSION_WINDOW`, `VISITOR_WINDOW`)                                                                                                            |
| A-020 | `constitution#IV`                  | probado     | Una sola instancia del plano de decisión; las garantías se declaran como de instancia única                    | ✓ declarado (01 §9); en código sin nombrarse (§6 del informe, F-046/F-047)                                                                                                                                                                            |
| A-021 | `constitution#V`                   | probado     | merchantId se deriva siempre de la credencial; nunca del body, query ni path salvo la ruta de admin (ADR-020)  | ✓ `merchantOf(req)` desde la credencial; regla `ope-no-merchant-id-in-request` (fixtures path/query/header/cookie/body); `isolation.test.ts:114`                                                                                                      |
| A-022 | `constitution#V`                   | probado     | merchantId forma parte de toda frontera de datos (clave o predicado de cada consulta y escritura)              | ✓ todos los gateways en memoria con clave compuesta `merchantId/…` (`memory-*.ts`); `isolation.test.ts` (11 casos)                                                                                                                                    |
| A-023 | `constitution#V`                   | probado     | Clave de ingesta por merchant, rotable y distinta de las credenciales del portal                               | ✓ `ingestKeys` 1–2 (`Merchant.of`, `config.test.ts`), rotación por dos claves; credenciales del portal aún no existen (016)                                                                                                                           |
| A-024 | `constitution#V`                   | probado     | Toda feature que toca persistencia o API incluye pruebas de contaminación cruzada entre merchants              | ✓ `tests/integration/isolation.test.ts` amplía por feature (dedup, decisiones, exposiciones, orígenes, credenciales, asignaciones, políticas, catálogo, outcomes)                                                                                     |
| A-025 | `constitution#V`                   | probado     | No hay estado global compartido entre merchants en proceso                                                     | ✓ un `Map` por merchant en cada gateway; `configPolicyDirectory`/`configExperimentDirectory` por merchant; `isolation.test.ts`                                                                                                                        |
| A-026 | `constitution#VI`                  | probado     | Cuatro identidades con un propósito cada una; orderId es la única identidad de idempotencia de compra; eventI… | ✓ ids marcados (`ids.ts` por módulo); `orderId` clave de `memoryOrderLedger`; `eventId` sólo dedup (`memory-event-dedup.test.ts`)                                                                                                                     |
| A-027 | `constitution#VI`                  | probado     | Chequeo y registro de una orden ya procesada sin operación asíncrona intermedia                                | ✓ `memoryOrderLedger.record` sección síncrona; `memory-order-ledger.test.ts` "two simultaneous notifications… one record"                                                                                                                             |
| A-028 | `constitution#VI`                  | hueco       | La pérdida de visitorId produce un visitante nuevo: se cuantifica y reporta, no se compensa con inferencias    | hueco: un `visitorId` nuevo es un visitante nuevo por construcción, pero nada lo cuantifica ni reporta → planificado 016                                                                                                                              |
| A-029 | `constitution#VII`                 | probado     | El contrato de evento es una lista blanca; campos no declarados se rechazan con error ruidoso, no se limpian   | ✓ `additionalProperties: false` (regla `ope-request-closed-schema`); `ingest-events.test.ts` "undeclared field… 400 with the exact pointer", "page.email → 400"                                                                                       |
| A-030 | `constitution#VII`                 | probado     | Nunca se registran nombre, email, teléfono, dirección, formularios, pago, documentos, grabación, IP persistid… | ✓ regla `ope-no-pii` (`pii-denylist.json`); `logging-privacy.test.ts` (sin IP, headers, cuerpo); `request-logging.ts`                                                                                                                                 |
| A-031 | `constitution#VII`                 | hallazgo    | El conector de órdenes se acota a orderId, monto, moneda, ítems (SKU, cantidad), fecha e identificador de OPE… | F-062: `Order` acepta además `incentive` (ADR-028 §6) que la constitución VII y 01 §10.3 no listan; el resto cumple (`additionalProperties: false`, `orders.test.ts`)                                                                                 |
| A-032 | `constitution#VII`                 | probado     | La frase autorizada es 'OPE no almacena información identificatoria'; nunca 'no maneja datos personales'       | ✓ prosa: `contracts/paths/events.yaml:16`, CLAUDE.md; sin cifra ni frase prohibida en el repo (grep)                                                                                                                                                  |
| A-033 | `constitution#VIII`                | probado     | Cero llamadas a modelos de lenguaje en el runtime; los mensajes son curados y versionados                      | ✓ sin dependencia ni llamada a LLM (`package.json`, `arch` `domain-is-pure`); mensajes `msg_<barrera>_<anclaje>_<escalón>_v0` (`candidate.ts`) hasta la 015                                                                                           |
| A-034 | `constitution#IX`                  | probado     | Toda cifra se reconstruye desde el ledger; el ledger es append-only; Decision guarda barrera, evidencia, cand… | ✓ `DecisionInference`/`DecisionSelection`/`experiment` en cada decisión (`decision.service.test.ts` "the ledger keeps the selection… (constitution IX)"); órdenes con correlación y redención (`order.test.ts`); append-only en memoria (sin borrado) |
| A-035 | `constitution#X`                   | hallazgo    | El puerto de plataforma tiene exactamente cuatro operaciones y el núcleo no sabe qué plataforma hay detrás     | F-063: no existe un puerto de plataforma de cuatro operaciones; el caso base construido es push (`PUT /v1/catalog`, `POST /v1/orders`, `POST /v1/returns`) sin evaluar X en el Constitution Check de la 010                                           |
| A-036 | `constitution#X`                   | hallazgo    | Adaptador genérico y adaptador de prueba desde el día uno; Magento 2 primer adaptador real; VTEX documental    | F-063: adaptador genérico y de prueba no existen como código; Magento/VTEX → planificado (mapa V3)                                                                                                                                                    |
| A-037 | `constitution#X`                   | probado     | Lo que varía por merchant es configuración versionada, no código                                               | ✓ configuración por merchant en `OPE_MERCHANTS` (experimentos, políticas, perfil); versionada por `version` (ADR-026/027); catálogo de mensajes/flags → planificado 014/015                                                                           |
| A-038 | `constitution#X`                   | probado     | Mecanismo A es la única fuente autoritativa de atribución; B corrobora; C nunca es autoridad                   | ✓ `Correlation.of` sólo por A (`sessionId` de la plataforma + `bySession`); B evidencia (`corroborate-order.use-case.ts`); C inexistente (`orders.test.ts`, `order-corroborations.test.ts`)                                                           |
| A-039 | `constitution#Contrato de datos`   | hallazgo    | Porcentajes 0–100 sólo en el borde; tasas 0–1 adentro; la normalización ocurre una vez en el borde             | parcial: `treatmentShare` 0–1 con conversión en `config.ts:199`; la política comercial guarda porcentajes adentro → F-031                                                                                                                             |
| A-040 | `constitution#Contrato de datos`   | probado     | Frescura por merchant: un dato más viejo que su presupuesto se trata como ausente                              | ✓ `FRESHNESS_BUDGET` 36 h / 15 min; `product-truth.service.test.ts` (`stale` ⇒ `unknown`); por merchant → planificado 014                                                                                                                             |
| A-041 | `constitution#Contrato de datos`   | probado     | Exactamente tres barreras (talle_calce, precio_valor, cambios_devoluciones)                                    | ✓ `BARRIERS = [fit, price, returns]` con réplica (`tests/unit/barriers.test.ts`); `BarrierRules.of` rechaza otra (`barrier-rules.test.ts`)                                                                                                            |
| A-042 | `constitution#Contrato de datos`   | parcial     | Superficies: ficha entra; carrito construido con activación pendiente; home, listado y checkout fuera          | parcial: `PageType` incluye `product                                                                                                                                                                                                                  | listing | cart | checkout | other`y`focus()`sólo decide sobre`product` (`event-batch.test.ts` "no product page (listing only) → undefined"); carrito con activación pendiente no está modelado como superficie |
| A-043 | `constitution#Contrato de datos`   | parcial     | PENDING_CORRELATION y NOT_AVAILABLE son valores de primera clase, nunca null ni 0                              | parcial: `PENDING_CORRELATION` valor de primera clase (`OrderStatus`, `orders.test.ts`); `NOT_AVAILABLE` → planificado 016                                                                                                                            |
| A-044 | `constitution#Stack`               | probado     | TypeScript strict; sin any salvo en fronteras encapsuladas; un módulo por autoridad; DI explícita; compositio… | ✓ `tsconfig` strict, `no-explicit-any`/`no-unsafe-*` (`tests/lint/lint.test.ts`), DI manual en `composition/` (`wiring.test.ts`, `profile.test.ts`), sin singletons (`bootstrap` construye por llamada)                                               |
| A-045 | `constitution#Stack`               | probado     | Tipos y validadores de runtime se generan desde el contrato, nunca a mano en paralelo                          | ✓ `contract:types` + `contract-types-check.test.ts`; Ajv desde el bundle en runtime (`build-server.ts`); réplicas con prueba (problem types, capacidades, motivos, barreras, anclajes, eventos)                                                       |
| A-046 | `constitution#Stack`               | parcial     | Logs estructurados con merchantId, sessionId, decisionId; latencia por percentil; tasa y motivo de NO_OP       | parcial: logs estructurados con `merchantId`/`decisionId`/`orderId` y caso de uso + duración; sin `sessionId`, sin tasa ni motivo de NO_OP en logs, latencia por percentil sólo en pruebas → planificado 016 (observabilidad)                         |
| A-047 | `constitution#Stack`               | planificado | Kill switch global por merchant, efectivo sin deploy (014 planificada)                                         | planificado 014 (`putFlags` en el mapa)                                                                                                                                                                                                               |
| A-048 | `constitution#Flujo de desarrollo` | probado     | Cada autoridad tiene pruebas unitarias como función pura; cada endpoint pruebas de contrato contra el OpenAPI  | ✓ autoridades como funciones puras con pruebas unitarias (`tests/unit/domain/{barrier,selection,commercial,decision,experiment}`); contrato contra OpenAPI: `npm run test:contract` (Schemathesis) y `validateResult` en runtime                      |
| A-049 | `constitution#Flujo de desarrollo` | parcial     | Existe una prueba end-to-end evento → decisión → exposición → orden → atribución con el adaptador de prueba    | parcial: evento → decisión → exposición (`assignment.test.ts`, `confirm-exposure.test.ts`) y orden → atribución (`orders.test.ts`) en pruebas separadas; no hay una prueba única de punta a punta con un adaptador de prueba (F-063)                  |
| A-050 | `constitution#Flujo de desarrollo` | probado     | Las pruebas de contaminación cruzada corren en cada build                                                      | ✓ `isolation.test.ts` en `npm test` (CI `checks`, `.github/workflows/ci.yml:49`)                                                                                                                                                                      |
| A-051 | `constitution#Flujo de desarrollo` | probado     | Nada se afirma como funcionando sin evidencia ejecutable; marcadores contables; sin cifras vivas en prosa      | ✓ `check:markers` (0 abiertos, 2 propuestos); quickstarts con tablas fechadas; CLAUDE.md § Documentación viva; excepciones: F-014/F-015 (prosa detrás del código)                                                                                     |

### 4.2 Criterios de aceptación de 03 §10

| id    | estado           | criterio                                                                                                                                     | evidencia                                                                              |
| ----- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A-089 | probado          | Criterio 2: las señales de §4.1 llegan al backend, deduplicadas y aisladas por merchant                                                      | ✓ `ingest-events.test.ts` (20 tipos, dedup) e `isolation.test.ts` "deduplication"      |
| A-090 | probado          | Criterio 3: cada visitante recibe asignación determinista y estable, registrada al asignar                                                   | ✓ = A-010                                                                              |
| A-091 | probado          | Criterio 4: el pipeline resuelve intervención o NO_OP para las tres barreras dentro del presupuesto de latencia, medido por percentil        | ✓ tres barreras en `Inference.confidences`; p95 < 50 ms (`ingest-latency.test.ts`)     |
| A-092 | probado          | Criterio 5: las intervenciones se renderizan en los anclajes acordados y la exposición se confirma desde el navegador (backend: confirmExpo… | ✓ backend: `confirmExposure` (`confirm-exposure.test.ts`); render en anclajes = Zona A |
| A-093 | probado          | Criterio 6: una orden confirmada llega desde la plataforma, se correlaciona y queda VERIFIED_ORDER y, con correlación verificable, ATTRIBUT… | ✓ `orders.test.ts` (`PENDING_CORRELATION` / `ATTRIBUTED_ORDER`)                        |
| A-094 | parcial          | Criterio 7: flags por merchant, configuración estampada en cada decisión del ledger, kill switch sin deploy (014)                            | parcial: versión estampada ✓ (A-014); flags y kill switch → planificado 014            |
| A-095 | parcial          | Criterio 8: el perfil de datos efectivo se mide y degrada solo                                                                               | parcial: = A-009                                                                       |
| A-096 | probado          | Criterio 9: cualquier cifra del reporte se reconstruye desde el ledger hasta el evento                                                       | ✓ = A-034 (reconstrucción posible; lectura del portal → 016)                           |
| A-097 | planificado      | Criterio 10: el portal muestra salud operativa y evolución del tramo (016)                                                                   | planificado 016                                                                        |
| A-098 | probado          | Criterio 11: el aislamiento por merchant está probado contra contaminación cruzada                                                           | ✓ = A-024                                                                              |
| A-099 | fuera de alcance | Criterio 1: tag y SDK (Zona A, fuera de este backend: se declara)                                                                            | fuera de alcance (Zona A)                                                              |

### 4.3 Documentos del MVP

| id    | sección       | estado      | afirmación                                                                                                     | evidencia                                                                                                                                                                                                                                       |
| ----- | ------------- | ----------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-052 | `mvp:01#4`    | probado     | Cinco pasos en orden fijo coordinados por el orquestador; cada paso puede terminar en NO_OP y eso es un resul… | ✓ `decision.service.ts:1-6` orden fijo; NO_OP por paso (`decision-plane.test.ts`: `page-context-incomplete`, `barrier-unclear`, `evidence-missing`, `control-arm`, `no-active-experiment`)                                                      |
| A-053 | `mvp:01#4.1`  | probado     | Asignación determinista y estable por visitante, sin estado compartido, registrada al asignar; CONTROL atravi… | ✓ = A-010/A-011                                                                                                                                                                                                                                 |
| A-054 | `mvp:01#4.2`  | probado     | Una barrera dominante entre exactamente tres (talle/calce, precio/valor, cambios/devoluciones); sin umbral su… | ✓ `DecisionPolicy.barrierVerdict` (umbral, prioridad; `barrier-verdict.test.ts`); sin umbral ⇒ `barrier-unclear` (`decision-plane.test.ts`)                                                                                                     |
| A-055 | `mvp:01#4.3`  | probado     | Evidencia a nivel de variante exacta; el stock es guardia, no claim; la escasez numérica queda fuera; dato du… | ✓ verdad por variante (`ProductTruthService.lookup`); guardia booleana; sin escasez (`Claim` sin `scarcity`, `candidates.test.ts`); viejo ⇒ `unknown/stale` (`product-truth.service.test.ts`)                                                   |
| A-056 | `mvp:01#4.4`  | probado     | Mensajes curados y versionados; el quality gate es puro; un claim inventado invalida el mensaje entero; una b… | ✓ mensajes versionados `msg_…_v0` (015 trae el catálogo); gate puro (`quality-gate.test.ts`); una barrera por candidato (`CANDIDATES`)                                                                                                          |
| A-057 | `mvp:01#4.5`  | probado     | La política comercial es el último filtro y única autoridad del veredicto: techo del merchant, consciente de … | ✓ `CommercialPolicy.verdict` (techo, margen, riesgo, alta intención, presupuestos; `verdict.test.ts`, `commercial-policy.test.ts` integración)                                                                                                  |
| A-058 | `mvp:01#4.6`  | hallazgo    | Objetivo < 150 ms como objetivo de diseño, no SLA; ninguna llamada de red ni escritura bloqueante en el camin… | `PROPUESTO` en el origen: medido p95 < 50 ms (`ingest-latency.test.ts`), sin red (arch), caché caliente (`CatalogStore`, `PolicyDirectory`); F-045 sobre el event loop compartido                                                               |
| A-059 | `mvp:01#4.7`  | probado     | Degradación: backend no responde ⇒ el SDK calla; sin Redis ⇒ tiende a NO_OP; catálogo ausente ⇒ NO_OP; margen… | ✓ catálogo ausente ⇒ `evidence-missing` (`decision.service.test.ts` "no catalogue"); margen ausente ⇒ `margin-missing`; ledger caído ⇒ `ledger-unavailable` (`ledger-unavailable.test.ts`); Redis no existe (017); el SDK callando es de Zona A |
| A-060 | `mvp:01#4.8`  | probado     | Cero llamadas a modelos de lenguaje en el runtime; los usos son offline y pre-generados                        | ✓ = A-033                                                                                                                                                                                                                                       |
| A-061 | `mvp:01#5`    | parcial     | Cinco estados de la cadena de evidencia (ASSIGNED, EXPOSED, VERIFIED_ORDER, ATTRIBUTED_ORDER, RETURNED); ning… | parcial: cinco estados con registros propios (`Assignment`, `Exposure`, `Order.status()`, `Return`); ninguno inferido (`Correlation.of` sólo con decisiones); `NOT_AVAILABLE` → 016                                                             |
| A-062 | `mvp:01#5.2`  | parcial     | Estados explícitos de desconocimiento: PENDING_CORRELATION y NOT_AVAILABLE, visibles, nunca cero               | parcial: = A-043                                                                                                                                                                                                                                |
| A-063 | `mvp:01#5.3`  | planificado | El titular económico es Incremental Contribution por ITT, con intervalo de confianza, tamaño de grupos y esta… | planificado 016                                                                                                                                                                                                                                 |
| A-064 | `mvp:01#6`    | probado     | eventId dedup de ingesta; sessionId agrupa y expira; visitorId estabilidad de asignación y memoria; orderId i… | ✓ dedup por `eventId` (`memory-event-dedup.test.ts`); sesión con ventana 24 h (`memory-session-state-store.test.ts`); `visitorId` en asignación y `VisitorState`; `orderId` idempotencia (`memory-order-ledger.test.ts`)                        |
| A-065 | `mvp:01#6`    | probado     | orderId es la única identidad válida para idempotencia de compra; chequeo y registro sin operación asíncrona … | ✓ = A-027; pérdida de `visitorId` = visitante nuevo por construcción (sin cuantificar, A-028)                                                                                                                                                   |
| A-066 | `mvp:01#9`    | planificado | Se garantiza durabilidad (017), idempotencia de orden con orderId, recuperación tras reinicio graceful, orden… | planificado 017 (durabilidad, recuperación tras reinicio); idempotencia por `orderId` ✓; reconstrucción desde el ledger ✓ (A-034); orden de escritura por merchant → 017                                                                        |
| A-067 | `mvp:01#9`    | probado     | Una sola instancia del plano de decisión                                                                       | ✓ = A-020                                                                                                                                                                                                                                       |
| A-068 | `mvp:01#10.1` | probado     | OPE observa comportamiento, no personas: aplica a todo el producto                                             | ✓ = A-029/A-030                                                                                                                                                                                                                                 |
| A-069 | `mvp:01#10.2` | probado     | Se registra: ids propios, página/producto/variante, interacción y momento, estado derivado, decisiones/exposi… | ✓ lo registrado coincide (`Event`, `DecisionFacts`, `Order`, configuración); `logging-privacy.test.ts`                                                                                                                                          |
| A-070 | `mvp:01#10.3` | hallazgo    | Lista blanca en el contrato de evento; la ingesta rechaza (no limpia) campos no declarados; el conector de ór… | F-062 (campo `incentive` en la orden); lista blanca y rechazo ruidoso ✓ (A-029)                                                                                                                                                                 |
| A-071 | `mvp:01#10.4` | probado     | Decir 'OPE no almacena información identificatoria'; no decir 'no maneja datos personales'                     | ✓ = A-032                                                                                                                                                                                                                                       |
| A-072 | `mvp:01#10.5` | probado     | El histórico de devoluciones sólo con clave seudónima del merchant; el principio gana sobre la funcionalidad;… | ✓ riesgo de devolución por comportamiento en sesión (`returnRisk` condición, `default-commercial-policy.ts:24-29`); histórico por clave seudónima → planificado (D-C, ADR-010)                                                                  |
| A-073 | `mvp:01#10.7` | probado     | merchantId siempre de la credencial; clave de ingesta rotable y distinta de las del portal; merchant en toda … | ✓ = A-021/A-023/A-024                                                                                                                                                                                                                           |
| A-074 | `mvp:02#4`    | probado     | Ingesta periódica del catálogo completo más refresco de alta frecuencia de stock y precio                      | `PROPUESTO` en el origen: snapshot completo por push (ADR-025); refresco parcial de stock/precio → mapa V3                                                                                                                                      |
| A-075 | `mvp:02#4`    | probado     | Nunca se consulta a la plataforma dentro del camino crítico; el motor de evidencia lee de caché caliente y fa… | ✓ `ProductTruthService` lee `CatalogStore` (caché caliente); `arch` prohíbe red en dominio/aplicación; `stale` ⇒ `unknown` (`product-truth.service.test.ts`)                                                                                    |
| A-076 | `mvp:02#4`    | probado     | El stock es guardia, no claim; perfil de datos por nivel (0–3) que se mide y degrada solo                      | ✓ = A-006/A-009 (nivel 0–2 observado; 3 nunca con snapshots)                                                                                                                                                                                    |
| A-077 | `mvp:02#5.1`  | probado     | Mecanismo A: la plataforma notifica servidor a servidor con el identificador de sesión de OPE adjuntado al cr… | ✓ mecanismo A: `POST /v1/orders` con `sessionId` (`orders.test.ts`); B: `POST /v1/orders/corroborations` desde el navegador con `ingestKey` (`order-corroborations.test.ts`)                                                                    |
| A-078 | `mvp:02#5.2`  | probado     | A autoritativo, B corroboración y disparador, C nunca autoridad; toda orden entra como VERIFIED_ORDER y sólo … | ✓ `Correlation.of` sólo con A; B nunca atribuye (`order-corroborations.test.ts` "never creates nor attributes"); toda orden `VERIFIED_ORDER` → `ATTRIBUTED_ORDER` sólo con correlación (`orders.test.ts`)                                       |
| A-079 | `mvp:02#5.2`  | planificado | Sólo B ⇒ medición degradada si la pérdida de confirmaciones es equivalente entre brazos; sólo C ⇒ sin afirmac… | planificado 016 (análisis de cobertura A/B por brazo)                                                                                                                                                                                           |
| A-080 | `mvp:02#5.4`  | probado     | La devolución se vincula al orderId ya presente en el ledger; llega con días de retraso (plano asíncrono)      | ✓ `POST /v1/returns` por `orderId` existente (`returns.test.ts`, `order-unknown`); sin restricción de retraso                                                                                                                                   |
| A-081 | `mvp:02#6.1`  | hallazgo    | Un puerto de plataforma con cuatro operaciones (obtenerCatalogo, obtenerStockYPrecio, alConfirmarOrden, alReg… | F-063 (puerto de cuatro operaciones no existe; caso base push)                                                                                                                                                                                  |
| A-082 | `mvp:02#6.2`  | hallazgo    | El adaptador genérico (catálogo por REST/archivo + notificación HTTP de orden) es la implementación de refere… | F-063 (adaptador genérico como código no existe; la plataforma empuja por HTTP)                                                                                                                                                                 |
| A-083 | `mvp:03#4.5`  | probado     | Evidencia permitida: política de cambios/devoluciones, atributos autorizados, datos de calce del merchant, pr… | ✓ `Claim` = returns-policy, fit-data, current-price, availability, incentive, product-attribute:<key>; sin escasez ni prueba social (`candidates.test.ts`, `quality-gate.test.ts`)                                                              |
| A-084 | `mvp:03#4.7`  | probado     | Memoria de sesión (secuencia, estado, cooldown, fatiga) y memoria entre sesiones del mismo visitante entran; … | ✓ `SessionState` (señales, intervenciones, cooldown) y `VisitorState` (fatiga entre sesiones) (`session-state.test.ts`, `visitor-state.test.ts`, `verdict.test.ts` cooldown/fatiga); riesgo por comportamiento (`returnRisk`)                   |
| A-085 | `mvp:03#4.8`  | probado     | Escalera información → reaseguro → reducción de incertidumbre → evidencia → incentivo; con precio dominante e… | ✓ `STEPS` información → reaseguro → incertidumbre → evidencia → incentivo; precio con incentivo directo (`#directIncentive`); techo y escalera (`commercial-policy.test.ts`, `verdict.test.ts`)                                                 |
| A-086 | `mvp:03#4.8`  | probado     | Ante abandono de carrito sin señal previa la respuesta es reaseguro, con prioridad baja                        | ✓ `fallbackBarrier` + `startOf` reaseguro (`verdict.test.ts` "an abandonment without a signal answers with the reassurance step itself (03 §4.8)")                                                                                              |
| A-087 | `mvp:03#4.11` | probado     | Registra ids propios, producto/variante, interacciones, barrera y decisión, orden (número, monto, ítems), con… | ✓ = A-069/A-030                                                                                                                                                                                                                                 |
| A-088 | `mvp:03#6`    | probado     | D-E evidencia limitada a catálogo y configuración; D-B abandono actúa sobre la barrera detectada, incentivo s… | ✓ D-E: evidencia = catálogo + perfil del merchant; D-B: `startOf`/`#directIncentive` (`verdict.test.ts` "the direct route is only for price"); D-C: histórico → planificado (ADR-010)                                                           |

### 4.4 Specs 001–013

La evidencia "por cabecera" es la prueba cuya cabecera declara cubrir el requisito (el repo cita `FR`/`SC` en cada archivo de prueba); F-020 anota que 86 de 90 cabeceras no dicen de qué spec. Lo "histórico" afirma sobre el cierre de su feature y hoy se sostiene en los gates de §2.1.

#### 001-api-contract-toolchain — 42 afirmaciones: 28 probado, 13 probado por cabecera, 1 parcial

| id    | requisito | estado               | afirmación                                                                                 | evidencia                                                                                                                                                                       |
| ----- | --------- | -------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-100 | `FR-001`  | probado              | El contrato MUST estar en OpenAPI 3.1, dividido en múltiples archivos bajo `contracts/` (… | ✓ `contracts/{openapi.yaml,paths/,components/,webhooks/,examples/}` unidos por `$ref`; `contract:bundle` en `global-contract-check.txt`                                         |
| A-101 | `FR-002`  | probado              | La verificación MUST producir un contrato empaquetado en un solo archivo, que es el artef… | ✓ `contracts/dist/openapi.yaml` (derivado) consumido por tipos, docs y Schemathesis (`contract-types-check.test.ts`, `contract-docs.test.ts`, `scripts/test-contract.mjs`)      |
| A-102 | `FR-003`  | probado              | El contrato MUST declarar su versión con semántica mayor.menor.parche en `info.version`, … | ✓ `info.version: 1.2.0`; regla `ope-path-version-prefix` con fixture (`rules.test.ts`)                                                                                          |
| A-103 | `FR-004`  | probado              | El contrato MUST declarar un catálogo cerrado de etiquetas (`tags`) y toda operación MUST… | ✓ reglas `ope-tags-closed-catalog`, `ope-operation-single-tag` con fixture                                                                                                      |
| A-104 | `FR-005`  | probado              | El contrato MUST definir un esquema reutilizable de Problem Details conforme a RFC 9457 (… | ✓ `contracts/components/schemas/ProblemDetails.yaml`; regla `ope-error-response-problem-details`                                                                                |
| A-105 | `FR-006`  | probado              | El contrato MUST incluir la operación `getHealth` (`GET /v1/health`, tag `system`), sin a… | ✓ `contracts/paths/health.yaml`; `tests/unit/health.test.ts`, `tests/integration/server.test.ts`                                                                                |
| A-106 | `FR-010`  | probado              | Un único comando MUST ejecutar toda la verificación del contrato y terminar con código di… | ✓ `npm run contract:check` (exit 0, `global-contract-check.txt`); cada regla falla con su fixture (`rules.test.ts`)                                                             |
| A-107 | `FR-011`  | probado              | La verificación MUST fallar ante violaciones de estilo y estructura de OpenAPI (referenci… | ✓ Redocly (`redocly.test.ts`) + reglas heredadas de Spectral (`path-params`, `oas3-unused-component`); `oas3-schema` apagada con motivo (S-12)                                  |
| A-108 | `FR-012`  | probado              | La verificación MUST fallar si una operación carece de `operationId`, `summary`, `descrip… | ✓ fixtures `operation-operationId`, `operation-operationId-unique`, `ope-operation-summary`, `operation-description`, `operation-tags`, `ope-operation-id-camel-case`           |
| A-109 | `FR-013`  | probado              | La verificación MUST fallar si una propiedad de esquema carece de `description`.           | ✓ fixture `ope-property-description`                                                                                                                                            |
| A-110 | `FR-014`  | probado              | La verificación MUST fallar si un request body o una respuesta `2xx` con cuerpo carece de… | ✓ fixtures `ope-request-example`, `ope-success-response-example`                                                                                                                |
| A-111 | `FR-015`  | probado              | La verificación MUST fallar si un esquema usado como request body (o cualquier objeto ani… | ✓ fixtures `ope-request-closed-schema` (+ `.union`)                                                                                                                             |
| A-112 | `FR-016`  | probado              | La verificación MUST fallar si cualquier esquema, parámetro o header declara una propieda… | ✓ fixtures `ope-no-pii`, `ope-no-pii.parameter`                                                                                                                                 |
| A-113 | `FR-017`  | probado              | La verificación MUST fallar si `merchantId` (sin distinguir mayúsculas ni separadores) ap… | ✓ fixtures `ope-no-merchant-id-in-request.{path,query,header,cookie,body,admin-body}`; `rules.test.ts:86`                                                                       |
| A-114 | `FR-018`  | probado              | La verificación MUST fallar si una respuesta `4xx` o `5xx` no usa el tipo de contenido `a… | ✓ fixtures `ope-error-response-problem-details` (+ `.component`)                                                                                                                |
| A-115 | `FR-019`  | probado              | La verificación MUST fallar si una operación no declara `500`; si una operación autentica… | ✓ fixtures `ope-required-error-responses.{500,401,400-422}`                                                                                                                     |
| A-116 | `FR-020`  | probado por cabecera | La verificación MUST comparar el contrato empaquetado con el de la rama principal y falla… | ✓ cabecera: `contract-diff/diff.test.ts`                                                                                                                                        |
| A-117 | `FR-021`  | probado              | Cada violación reportada MUST indicar regla, archivo y posición, y una frase que explique… | ✓ `rules.test.ts:74` "fails on its rule, with file and position"; mensajes por regla en `contracts/.spectral.yaml`                                                              |
| A-118 | `FR-030`  | probado              | Un comando MUST generar los tipos de request/response de todas las operaciones a partir d… | ✓ `npm run contract:types` → `src/interface-adapters/http/generated/api.d.ts`; determinismo: `contract-types-check.test.ts`                                                     |
| A-119 | `FR-031`  | probado              | La verificación MUST fallar si los tipos commiteados difieren de la regeneración.          | ✓ `contract:types:check` dentro de `contract:check`; `contract-types-check.test.ts` "fails when the file was edited by hand"                                                    |
| A-120 | `FR-032`  | probado por cabecera | Un comando MUST generar documentación navegable estática desde el contrato empaquetado, y… | ✓ cabecera: `unit/contract-docs.test.ts`                                                                                                                                        |
| A-121 | `FR-033`  | parcial              | El repositorio MUST proveer un cliente HTTP tipado para consumidores (SDK, portal) deriva… | parcial: cliente tipado `src/interface-adapters/http/client.ts` con `tests/types/client.test-d.ts`; el presupuesto de peso no se mide en ninguna prueba                         |
| A-122 | `FR-040`  | probado por cabecera | El servidor MUST cargar el contrato al arrancar y rehusarse a arrancar si el contrato no … | ✓ cabecera: `integration/server.test.ts`                                                                                                                                        |
| A-123 | `FR-041`  | probado por cabecera | El servidor MUST rutear cada request al manejador registrado bajo el `operationId` corres… | ✓ cabecera: `integration/server.test.ts`                                                                                                                                        |
| A-124 | `FR-042`  | probado por cabecera | El servidor MUST validar parámetros, headers y cuerpo del request contra el contrato ante… | ✓ cabecera: `integration/server.test.ts`                                                                                                                                        |
| A-125 | `FR-043`  | probado por cabecera | El servidor MUST validar la respuesta del manejador contra el contrato antes de enviarla;… | ✓ cabecera: `integration/server.test.ts`                                                                                                                                        |
| A-126 | `FR-044`  | probado por cabecera | El servidor MUST responder `404` Problem Details ante rutas no declaradas, `405` ante mét… | ✓ cabecera: `integration/server.test.ts`                                                                                                                                        |
| A-127 | `FR-045`  | probado por cabecera | El servidor MUST responder `500` con Problem Details genérico ante excepciones no control… | ✓ cabecera: `integration/server.test.ts`                                                                                                                                        |
| A-128 | `FR-046`  | probado por cabecera | Los manejadores MUST recibir y devolver los tipos generados; un manejador con tipo de res… | ✓ cabecera: `integration/server.test.ts` · quickstart: · Tipos de manejador (FR-046) y cliente (SC-007) · BUILT / TESTED · npm run typecheck exit 0 con tests/types/*.test-d.ts |
| A-129 | `FR-047`  | probado por cabecera | El manejador de `getHealth` MUST estar implementado y responder conforme al contrato.      | ✓ cabecera: `integration/server.test.ts`                                                                                                                                        |
| A-130 | `FR-050`  | probado              | El repositorio MUST incluir pruebas unitarias del manejador de `getHealth` y pruebas de i… | ✓ `tests/unit/health.test.ts`, `tests/integration/server.test.ts`                                                                                                               |
| A-131 | `FR-051`  | probado              | El repositorio MUST incluir pruebas de contrato generadas automáticamente desde el contra… | ✓ `npm run test:contract` (`global-test-contract.txt`, 2433 casos)                                                                                                              |
| A-132 | `FR-052`  | probado              | El repositorio MUST incluir una prueba que ejercite cada regla de verificación del contra… | ✓ `rules.test.ts:56` "there is one fixture per custom rule"                                                                                                                     |
| A-133 | `FR-060`  | probado              | Un flujo de integración continua MUST ejecutar, en cada cambio propuesto: verificación de… | ✓ `.github/workflows/ci.yml` (`tests/hooks/ci.test.ts`): contract:check, format, lint, build, typecheck, arch, quality, test, test:contract, release-check, mutación            |
| A-134 | `FR-061`  | probado              | El repositorio MUST documentar en su guía para agentes los comandos y el orden de trabajo… | ✓ CLAUDE.md § Flujo de trabajo y § Comandos                                                                                                                                     |
| A-135 | `SC-001`  | probado              | Cada una de las reglas FR-012 a FR-020 tiene una prueba que demuestra que un contrato que… | quickstart: · Contrato multi-archivo + 13 reglas ope-* + heredadas · BUILT / TESTED · npm run contract:check exit 0 en **9 s** (SC-0                                            |
| A-136 | `SC-002`  | probado              | Un agente que agrega una operación que viola una regla recibe la falla en menos de 30 seg… | quickstart: · Contrato multi-archivo + 13 reglas ope-* + heredadas · BUILT / TESTED · npm run contract:check exit 0 en **9 s** (SC-0                                            |
| A-137 | `SC-003`  | probado              | `GET /v1/health` responde conforme al contrato en el servidor real, en el mock y en la do… | quickstart: · SC-003 (texto de la operación sólo en contracts/) · TESTED · grep -r "Estado del servicio" fuera de contracts/, docs/,                                            |
| A-138 | `SC-004`  | probado              | La verificación completa (contrato + compatibilidad + tipos + compilación + pruebas) corr… | quickstart: · CI (.github/workflows/ci.yml) · BUILT · Sin ejecución todavía: no hay push. SC-004 (< 5 min) queda por verificar en el                                            |
| A-139 | `SC-005`  | probado por cabecera | Ninguna ruta puede servirse sin estar en el contrato: una prueba lo demuestra intentando … | ✓ cabecera: `integration/server.test.ts`                                                                                                                                        |
| A-140 | `SC-006`  | probado por cabecera | Dos generaciones consecutivas de tipos y de documentación sobre el mismo contrato produce… | ✓ cabecera: `unit/contract-docs.test.ts` · quickstart: · Tipos generados y drift · BUILT / TESTED · contract:types dos veces → git status limpio (SC-006); tests/unit/contract- |
| A-141 | `SC-007`  | probado por cabecera | Un consumidor puede hacer un request tipado a `getHealth` con el cliente generado, y un u… | ✓ cabecera: `types/client.test-d.ts` · quickstart: · Tipos de manejador (FR-046) y cliente (SC-007) · BUILT / TESTED · npm run typecheck exit 0 con tests/types/*.test-d.ts     |

#### 002-gobernanza-contrato-codigo — 28 afirmaciones: 24 probado, 3 histórico, 1 probado por cabecera

| id    | requisito | estado               | afirmación                                                                                 | evidencia                                                                                                                                                                                                                                          |
| ----- | --------- | -------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-142 | `FR-001`  | probado              | El contrato MUST permitir declarar invariantes sobre un esquema o una operación, cada una… | ✓ `x-invariants` en `EventBatch.yaml`, `CatalogSnapshot.yaml`, `Order.yaml`, operaciones; regla `ope-invariants`                                                                                                                                   |
| A-143 | `FR-002`  | probado              | La verificación MUST fallar si una invariante carece de alguno de los cuatro campos, si s… | ✓ fixtures `ope-invariants.{missing-field,unknown-type,status-mismatch,generic}`                                                                                                                                                                   |
| A-144 | `FR-003`  | probado              | La verificación MUST fallar si una invariante declarada no tiene una prueba del servidor … | ✓ `check:invariant-tests` (`tests/governance/invariant-tests.test.ts` "fails naming the missing marker")                                                                                                                                           |
| A-145 | `FR-004`  | probado              | La verificación MUST fallar si una operación declara una respuesta `422` cuyo ejemplo o d… | ✓ fixtures `ope-no-generic-422.{generic-example,undeclared}`                                                                                                                                                                                       |
| A-146 | `FR-005`  | histórico            | La verificación MUST listar, con el contrato actual, cero invariantes sin fallar.          | histórico (con el contrato de la 002); hoy `contract:check` lista las invariantes declaradas sin fallar                                                                                                                                            |
| A-147 | `FR-010`  | probado              | El repositorio MUST tener un glosario con una nota por término, con término en castellano… | ✓ `docs/dominio/*.md` con frontmatter es/en/fuente/estado; `check:glossary`                                                                                                                                                                        |
| A-148 | `FR-011`  | probado              | La verificación MUST fallar si un segmento de ruta o un título de esquema del contrato no… | ✓ `tests/governance/glossary.test.ts` "fails on a contract noun without a note", singular/plural y PascalCase                                                                                                                                      |
| A-149 | `FR-012`  | probado              | La verificación MUST fallar si una nota carece de fuente o la fuente no existe.            | ✓ `glossary.test.ts` "fails on a note without a source", "nonexistent source"                                                                                                                                                                      |
| A-150 | `FR-013`  | probado              | La verificación MUST fallar si una nota no se usa en el contrato y no declara `uso: dispo… | ✓ `glossary.test.ts` "unused note that does not declare `uso`"                                                                                                                                                                                     |
| A-151 | `FR-014`  | probado              | La lista de vocabulario técnico MUST vivir en un solo lugar y ser ampliable.               | ✓ `scripts/language-denylist.json` (idioma) y la lista técnica del glosario en `scripts/check-glossary.mjs` (única)                                                                                                                                |
| A-152 | `FR-020`  | probado              | El repositorio MUST tener un registro de decisiones numerado (`ADR-NNN`) con estado, fech… | ✓ `docs/adr/001..029` con frontmatter (`tests/governance/adrs.test.ts`); `check:adrs` en `contract:check`                                                                                                                                          |
| A-153 | `FR-021`  | probado              | La verificación MUST fallar si cualquier documento del repo cita un `ADR-NNN` que no exis… | ✓ `adrs.test.ts` "fails on a citation to a nonexistent ADR, with file and line"                                                                                                                                                                    |
| A-154 | `FR-022`  | probado              | Un comando MUST listar todos los marcadores `ABIERTO`, `PROPUESTO` y `PLACEHOLDER` presen… | ✓ `check:markers` (`tests/governance/markers.test.ts`)                                                                                                                                                                                             |
| A-155 | `FR-023`  | probado              | Un comando de puerta de release MUST fallar si queda al menos un `ABIERTO` o `PLACEHOLDER… | ✓ `release-check` (`markers.test.ts` "`PROPUESTO` does not block… `ABIERTO` and `PLACEHOLDER`… block in strict mode")                                                                                                                              |
| A-156 | `FR-024`  | probado              | La guía de agentes MUST prohibir cifras sobre el estado del sistema en prosa viva y nombr… | ✓ CLAUDE.md § Documentación viva ("Sin cifras de estado en prosa viva", nombra `contract:check`, `npm test`, `check:markers`)                                                                                                                      |
| A-157 | `FR-030`  | probado por cabecera | La verificación MUST fallar si un media type de request o respuesta lleva el esquema inli… | ✓ cabecera: `contract-rules/redocly.test.ts`                                                                                                                                                                                                       |
| A-158 | `FR-031`  | probado              | La verificación MUST fallar si una operación con seguridad no vacía no declara una lista … | ✓ fixtures `ope-required-capabilities.{missing,empty,public,foreign,bad-format,inherited}`                                                                                                                                                         |
| A-159 | `FR-040`  | probado              | El código MUST organizarse en cuatro capas con dirección de dependencia fija: dominio (no… | ✓ ADR-006/ADR-013; `.dependency-cruiser.cjs` (`domain-is-pure`, `domain-inward`, `application-inward`, `application-is-pure`, `adapters-inward`, `infrastructure-inward`)                                                                          |
| A-160 | `FR-041`  | probado              | Una verificación ejecutable MUST fallar ante cualquier import que viole FR-040, nombrando… | ✓ `npm run arch` (`tests/architecture/architecture.test.ts` "every rule catches the violation of its fixture"); en CI (`ci.yml:47`); el pre-commit no lo corre (lefthook: format, lint, typecheck) → parcial respecto de "chequeo previo a commit" |
| A-161 | `FR-042`  | histórico            | El código de la 001 MUST reubicarse en esas capas sin cambiar comportamiento: toda prueba… | histórico (SC-003 de la 002): suite de la 001 sin cambiar aserciones; hoy `server.test.ts` sigue verde                                                                                                                                             |
| A-162 | `FR-050`  | probado              | Cada regla nueva (FR-002, FR-003, FR-004, FR-011, FR-012, FR-013, FR-021, FR-023, FR-030,… | ✓ fixtures por regla (`rules.test.ts:56`; `governance/*.test.ts`; `architecture.test.ts`)                                                                                                                                                          |
| A-163 | `FR-051`  | probado              | Todas las verificaciones nuevas MUST integrarse al comando único de verificación del cont… | ✓ `contract:check` encadena `check:invariant-tests`, `check:glossary`, `check:adrs`, `check:markers`, `check:api-map`, `check:language`; CI las corre                                                                                              |
| A-164 | `SC-001`  | probado              | El 100 % de las reglas nuevas tiene una prueba que demuestra la falla ante la violación (… | ✓ = A-162                                                                                                                                                                                                                                          |
| A-165 | `SC-002`  | probado              | La verificación completa del contrato (la de la 001 más las nuevas) sigue corriendo local… | quickstart: · contract:check con las cuatro verificaciones nuevas · BUILT / TESTED · exit 0 en **12 s** (SC-002 < 30 s): Invariantes                                                                                                               |
| A-166 | `SC-003`  | probado              | Toda la suite de la 001 pasa sin modificar ninguna aserción tras la reubicación en capas;… | quickstart: · Sin cambio de comportamiento (SC-003) · TESTED · suite de la 001 sin tocar aserciones; curl 200/400/404/405 idénticos                                                                                                                |
| A-167 | `SC-004`  | probado              | Un agente nuevo puede encontrar cualquier decisión transversal de la 001 en el registro d… | quickstart: · SC-004 (decisiones de la 001 localizables) · TESTED · docs/adr/001..005 con fuente: specs/001/research.md; el research                                                                                                               |
| A-168 | `SC-005`  | probado              | El comando de listado de marcadores devuelve cero bloqueantes sobre el estado de esta fea… | quickstart: · release-check · BUILT / TESTED · exit 0 (SC-005) ·                                                                                                                                                                                   |
| A-169 | `SC-006`  | histórico            | Con el contrato actual, el glosario contiene sólo los términos que el contrato usa (`heal… | histórico; hoy `check:glossary` pasa (`global-contract-check.txt`) y `health` es vocabulario técnico                                                                                                                                               |

#### 003-calidad-de-codigo — 20 afirmaciones: 19 probado, 1 histórico

| id    | requisito | estado    | afirmación                                                                                 | evidencia                                                                                                                                                                                                  |
| ----- | --------- | --------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-170 | `FR-001`  | probado   | Un comando MUST analizar `src/`, `tests/`, `scripts/` y las funciones custom del contrato… | ✓ `tests/lint/lint.test.ts` (`no-explicit-any`, `no-unsafe-*`, `no-floating-promises`, `no-non-null-assertion`, `switch-exhaustiveness-check`, …) sobre `src/`, `tests/`, `scripts/` (`eslint.config.mjs`) |
| A-171 | `FR-002`  | probado   | Toda excepción a una regla MUST ser inline, en la línea afectada, con un motivo escrito; … | ✓ `lint.test.ts` "unused-disable.ts fails" y `ts-expect-error-without-description`; `Lint exceptions: 0` (`global-lint-exceptions.txt`)                                                                    |
| A-172 | `FR-003`  | probado   | El comando MUST informar la cantidad de excepciones vigentes.                              | ✓ `npm run lint` imprime `Lint exceptions: N` (`global-lint-exceptions.txt`)                                                                                                                               |
| A-173 | `FR-004`  | probado   | El lint MUST NOT contener reglas de formato; el formato es de una sola herramienta.        | ✓ `eslint-config-prettier` en `eslint.config.mjs`; `format.test.ts` ".prettierignore holds the single list"                                                                                                |
| A-174 | `FR-010`  | probado   | Un comando MUST formatear TypeScript, JavaScript, JSON, YAML y Markdown según una única c… | ✓ `npm run format` / `format:check` (`tests/format/format.test.ts`)                                                                                                                                        |
| A-175 | `FR-011`  | probado   | Los archivos generados y los fixtures con violaciones deliberadas MUST quedar excluidos, … | ✓ `.prettierignore` (`format.test.ts` "single list of exclusions")                                                                                                                                         |
| A-176 | `FR-012`  | probado   | El formato MUST ser idempotente y normalizar el fin de línea a LF.                         | ✓ `format.test.ts` "a second pass is idempotent"; `.prettierrc.json` `endOfLine: lf`                                                                                                                       |
| A-177 | `FR-020`  | probado   | Los scripts de `scripts/` y las funciones de `contracts/rules/functions/` MUST verificars… | ✓ `tsconfig.scripts.json` con `checkJs` (`tests/typecheck/typecheck.test.ts` "a nonexistent property in a script fails"); `npm run typecheck` encadena ambos                                               |
| A-178 | `FR-021`  | probado   | Las utilidades compartidas de esos scripts MUST tener sus firmas anotadas para que los co… | ✓ JSDoc en `scripts/*.mjs` exportados (`typecheck.test.ts`); CLAUDE.md § Tipado                                                                                                                            |
| A-179 | `FR-030`  | probado   | La configuración del compilador MUST exigir acceso explícito a index signatures, imports … | ✓ `tsconfig.json` (`noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`, `erasableSyntaxOnly`); `typecheck.test.ts` "hardened compiler"                                                            |
| A-180 | `FR-040`  | probado   | Un hook de pre-commit MUST correr formato y lint sobre los archivos staged y el typecheck… | ✓ `lefthook.yml` (`tests/hooks/lefthook.test.ts` "format, lint and typecheck… only on staged files… does not run contract:check or the tests")                                                             |
| A-181 | `FR-041`  | probado   | El repositorio MUST tener `.editorconfig` coherente con el formateador.                    | ✓ `.editorconfig` presente (coherencia con Prettier no probada)                                                                                                                                            |
| A-182 | `FR-050`  | probado   | `lint` y `format:check` MUST correr en integración continua y figurar en la guía de agent… | ✓ `ci.yml:43-44` (`ci.test.ts`); CLAUDE.md § Comandos                                                                                                                                                      |
| A-183 | `FR-051`  | probado   | Cada regla o verificación nombrada en FR-001, FR-002, FR-010, FR-020 y FR-030 MUST tener … | ✓ `lint.test.ts`, `format.test.ts`, `typecheck.test.ts` con fixtures                                                                                                                                       |
| A-184 | `FR-052`  | histórico | Toda la suite existente MUST pasar sin modificar aserciones; el servidor responde igual.   | histórico; hoy la suite pasa (1004/1004)                                                                                                                                                                   |
| A-185 | `SC-001`  | probado   | El 100 % de las reglas y verificaciones de FR-051 tiene un caso que la viola y una prueba… | ✓ = A-183                                                                                                                                                                                                  |
| A-186 | `SC-002`  | probado   | `lint`, `format:check` y `typecheck` juntos corren localmente en menos de 60 segundos sob… | quickstart: · format:check + lint + typecheck · BUILT / TESTED · exit 0 en **14 s** (SC-002 < 60 s); Excepciones de lint: 0 (SC-003)                                                                       |
| A-187 | `SC-003`  | probado   | El código existente pasa el lint con cero excepciones no justificadas; las justificadas e… | quickstart: · format:check + lint + typecheck · BUILT / TESTED · exit 0 en **14 s** (SC-002 < 60 s); Excepciones de lint: 0 (SC-003)                                                                       |
| A-188 | `SC-004`  | probado   | Toda la suite anterior pasa sin modificar aserciones; los escenarios manuales de la 001 (… | quickstart: · Sin cambio de comportamiento (SC-004) · TESTED · suite anterior sin tocar aserciones; test:contract 9/9; arch 0 violac                                                                       |
| A-189 | `SC-005`  | probado   | Un agente nuevo que clona el repo e instala dependencias tiene formato, lint, typecheck y… | ✓ `postinstall: patch-package`; lefthook instala el hook en su propio postinstall; sin pasos manuales en CLAUDE.md                                                                                         |

#### 004-protocolo-sdk-ingesta — 29 afirmaciones: 8 probado, 19 probado por cabecera, 1 histórico, 1 superado

| id    | requisito | estado               | afirmación                                                                                 | evidencia                                                                                                                                                                                                                  |
| ----- | --------- | -------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-190 | `FR-001`  | probado              | El código MUST organizarse en anillos con dirección de dependencia fija hacia adentro: do… | ✓ = A-159                                                                                                                                                                                                                  |
| A-191 | `FR-002`  | probado              | Dentro de cada anillo el código MUST agruparse por módulo del sistema (`shared-kernel`, `… | ✓ `CONTEXT_MAP` con 12 módulos; `modules-only-via-index` (`architecture.test.ts`)                                                                                                                                          |
| A-192 | `FR-003`  | probado por cabecera | La composición MUST ser un contenedor tipado de puertos con perfiles (memoria ahora; prod… | ✓ cabecera: `integration/bootstrap.test.ts`                                                                                                                                                                                |
| A-193 | `FR-004`  | probado              | La verificación de arquitectura MUST cubrir anillos y módulos, con un fixture por regla, … | ✓ `architecture.test.ts` (fixture por regla); en CI (`ci.yml:47`); no en el pre-commit → parcial (= A-160)                                                                                                                 |
| A-194 | `FR-005`  | probado por cabecera | La reorganización MUST mantener la operación existente y toda la suite anterior sin modif… | ✓ cabecera: `integration/bootstrap.test.ts`                                                                                                                                                                                |
| A-195 | `FR-010`  | probado por cabecera | El contrato MUST declarar la operación de ingesta de lotes, autenticada con la credencial… | ✓ cabecera: `integration/ingest-key.test.ts`                                                                                                                                                                               |
| A-196 | `FR-011`  | probado por cabecera | El contrato de evento MUST ser una lista blanca cerrada: tipo (exactamente los de 03 §4.1… | ✓ cabecera: `integration/ingest-events.test.ts`                                                                                                                                                                            |
| A-197 | `FR-012`  | probado por cabecera | La ingesta MUST rechazar el lote completo ante cualquier violación del contrato, nombrand… | ✓ cabecera: `integration/ingest-events.test.ts`                                                                                                                                                                            |
| A-198 | `FR-013`  | probado por cabecera | La ingesta MUST deduplicar por `eventId` dentro del merchant: un evento repetido se repor… | ✓ cabecera: `integration/ingest-events.test.ts` · F-024 ("nada se registra dos veces" sin prueba que lo mire; un reenvío vuelve a decidir)                                                                                 |
| A-199 | `FR-014`  | probado por cabecera | La respuesta MUST informar, por evento, si entró o era duplicado, y el total.              | ✓ cabecera: `integration/ingest-events.test.ts`                                                                                                                                                                            |
| A-200 | `FR-015`  | probado por cabecera | El tamaño máximo de lote y la tolerancia de instante (pasado/futuro) MUST estar declarado… | ✓ cabecera: `integration/ingest-events.test.ts`                                                                                                                                                                            |
| A-201 | `FR-016`  | probado por cabecera | Ningún dato fuera de la lista blanca MUST registrarse ni escribirse en logs; la dirección… | ✓ cabecera: `integration/ingest-events.test.ts`                                                                                                                                                                            |
| A-202 | `FR-017`  | probado por cabecera | Las credenciales de ingesta MUST resolverse a través de un puerto del módulo `merchant`, … | ✓ cabecera: `integration/ingest-key.test.ts`                                                                                                                                                                               |
| A-203 | `FR-020`  | probado por cabecera | Toda respuesta de ingesta aceptada MUST incluir una decisión con identificador único, res… | ✓ cabecera: `integration/ingest-events.test.ts`, `unit/domain/ledger/decision.test.ts`                                                                                                                                     |
| A-204 | `FR-021`  | probado por cabecera | Una decisión MUST registrarse en el ledger (puerto, implementación en memoria) al emitirs… | ✓ cabecera: `integration/ingest-events.test.ts`, `unit/domain/ledger/decision.test.ts`                                                                                                                                     |
| A-205 | `FR-030`  | probado por cabecera | El contrato MUST declarar la operación de confirmación de exposición (`decisionId`, `sess… | ✓ cabecera: `integration/confirm-exposure.test.ts`                                                                                                                                                                         |
| A-206 | `FR-031`  | probado por cabecera | Una exposición MUST registrarse como `EXPOSED` sólo si la decisión existe para ese mercha… | ✓ cabecera: `integration/confirm-exposure.test.ts`                                                                                                                                                                         |
| A-207 | `FR-040`  | probado              | El backend MUST responder a las peticiones previas de autorización del navegador aceptand… | ✓ `tests/integration/cors.test.ts` (7 casos); F-051 sobre el header de plataforma                                                                                                                                          |
| A-208 | `FR-050`  | probado por cabecera | Las pruebas MUST demostrar aislamiento entre merchants en: deduplicación, visibilidad de … | ✓ cabecera: `integration/confirm-exposure.test.ts`, `integration/isolation.test.ts` · quickstart: · 2026-09-16 · Aislamiento entre merchants (FR-050) · TESTED · tests/integration/isolation.test.ts (dedup, decisiones, e |
| A-209 | `FR-051`  | probado              | Todo sustantivo nuevo del contrato MUST tener su nota en el glosario con fuente antes de … | ✓ `check:glossary` en `contract:check`; notas `evento`, `sesion`, `visitante`, `exposicion`, `decision` en `docs/dominio/`                                                                                                 |
| A-210 | `FR-052`  | probado              | Toda regla no expresable por esquema MUST declararse como invariante con su tipo propio y… | ✓ `x-invariants` `session-visitor-mismatch`, `event-timestamp-out-of-range`, `exposure-decision-unknown`, `exposure-of-no-op` con `[invariant:<slug>]` (`check:invariant-tests`)                                           |
| A-211 | `FR-053`  | probado por cabecera | La latencia de la ingesta MUST medirse por percentil en las pruebas (p50/p95) sobre el pe… | ✓ cabecera: `integration/ingest-latency.test.ts`                                                                                                                                                                           |
| A-212 | `SC-001`  | histórico            | Toda la suite de las features 001–003 pasa sin modificar aserciones tras la reorganizació… | histórico; `server.test.ts` sigue verde                                                                                                                                                                                    |
| A-213 | `SC-002`  | probado              | Cada regla de anillo y de módulo tiene un fixture que la viola y una prueba que confirma … | ✓ `architecture.test.ts`; duración: `npm run arch` dentro de `quality` (26 s en total)                                                                                                                                     |
| A-214 | `SC-003`  | probado por cabecera | Un lote válido de 20 eventos se acepta con p95 por debajo de 50 ms en el perfil en memori… | ✓ cabecera: `integration/ingest-latency.test.ts` · quickstart: · 2026-09-16 · Latencia de ingesta (SC-003) · TESTED · 200 lotes × 20 eventos vía inject: p50 = 0,55 ms, p95 = 0,87 ms,                                     |
| A-215 | `SC-004`  | probado por cabecera | El 100 % de los tipos de evento de 03 §4.1 está en el contrato, y un evento con un campo … | ✓ citado en: `integration/ingest-latency.test.ts`                                                                                                                                                                          |
| A-216 | `SC-005`  | probado por cabecera | Ninguna prueba de aislamiento (FR-050) permite que un merchant vea, duplique o confirme a… | ✓ cabecera: `integration/isolation.test.ts`                                                                                                                                                                                |
| A-217 | `SC-006`  | superado             | El equipo del SDK puede desarrollar contra `npm run contract:mock` las tres operaciones (… | superado (ADR-018): sin mock; el SDK desarrolla contra `npm run dev` (perfil en memoria)                                                                                                                                   |
| A-218 | `SC-007`  | probado              | `release-check` en verde: sin marcadores bloqueantes; el protocolo de decisión queda `PRO… | ✓ `check:markers`: 0 abiertos, 2 propuestos (ADR-020); el protocolo de la 004 ya no está `PROPUESTO`                                                                                                                       |

#### 005-auditoria-calidad — 39 afirmaciones: 23 probado, 9 probado por cabecera, 6 histórico, 1 parcial

| id    | requisito | estado               | afirmación                                                                                 | evidencia                                                                                                                                                                                                                           |
| ----- | --------- | -------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-219 | `FR-001`  | probado              | Todo texto legible por un desarrollador o por un consumidor de la API MUST estar en inglé… | ✓ `check:language` (`tests/governance/language.test.ts`); `Language exceptions: 0` (`global-contract-check.txt`)                                                                                                                    |
| A-220 | `FR-002`  | probado por cabecera | Una verificación MUST fallar ante texto en español en el alcance de FR-001, nombrando arc… | ✓ cabecera: `governance/language.test.ts`                                                                                                                                                                                           |
| A-221 | `FR-003`  | probado por cabecera | Una excepción MUST declararse en la línea afectada con motivo escrito; sin motivo MUST fa… | ✓ cabecera: `governance/language.test.ts`                                                                                                                                                                                           |
| A-222 | `FR-004`  | probado por cabecera | Los artefactos generados y los fixtures con español deliberado MUST quedar excluidos en l… | ✓ cabecera: `governance/language.test.ts`                                                                                                                                                                                           |
| A-223 | `FR-005`  | histórico            | Todo el texto existente en el alcance de FR-001 MUST migrarse en esta feature; las descri… | histórico (migración al cierre de la 005); hoy `check:language` en verde y `contract:diff` compatible                                                                                                                               |
| A-224 | `FR-006`  | probado              | La regla de idioma y su motivo MUST registrarse como decisión transversal y en la guía de… | ✓ ADR-015; CLAUDE.md § Idioma                                                                                                                                                                                                       |
| A-225 | `FR-010`  | probado              | El lint MUST fallar ante una función con complejidad cognitiva mayor que 15, anidamiento … | ✓ `eslint.config.mjs:23-29` (`sonarjs/cognitive-complexity` 15, `max-depth` 3, `max-params` 4, `max-lines-per-function` 60, apagada en `tests/`); fixture `max-lines-per-function.ts` (`lint.test.ts`)                              |
| A-226 | `FR-011`  | probado              | El lint MUST fallar ante funciones idénticas, ramas idénticas de un condicional, condicio… | ✓ `eslint.config.mjs:31-34` (`sonarjs/no-identical-functions`, `no-duplicated-branches`, `no-collapsible-if`, …); F-021/F-030/F-033 sobre lo que la regla no ve entre archivos                                                      |
| A-227 | `FR-012`  | probado              | El lint MUST fallar ante un número literal distinto de 0, 1 y −1 en código de producción;… | ✓ `@typescript-eslint/no-magic-numbers` sólo en `src/` con 0/1/−1 e índices (`lint.test.ts` "0, 1, -1 and array indexes", "allowed under tests/"); F-013 sobre `detectObjects: false`                                               |
| A-228 | `FR-013`  | probado              | Cada límite numérico de configuración MUST llevar al lado su justificación.                | ✓ `lint.test.ts` "every numeric threshold in eslint.config.mjs has a reason next to it (FR-013)"                                                                                                                                    |
| A-229 | `FR-020`  | probado por cabecera | Una verificación MUST fallar ante fragmentos estructuralmente iguales de al menos 5 línea… | ✓ cabecera: `governance/duplication.test.ts`                                                                                                                                                                                        |
| A-230 | `FR-021`  | probado por cabecera | Una verificación MUST fallar ante archivos de producción sin importador, exports sin uso … | ✓ cabecera: `governance/dead-code.test.ts`                                                                                                                                                                                          |
| A-231 | `FR-030`  | probado por cabecera | Una verificación MUST analizar por mutación sólo las líneas de producción introducidas o … | ✓ cabecera: `governance/mutation-diff.test.ts`                                                                                                                                                                                      |
| A-232 | `FR-031`  | probado por cabecera | Un análisis de mutación sobre el repositorio completo MUST correr de forma programada e i… | ✓ cabecera: `governance/mutation-diff.test.ts`                                                                                                                                                                                      |
| A-233 | `FR-032`  | probado por cabecera | Archivos sin lógica (tipos, constantes, punto de composición, generados) MUST quedar fuer… | ✓ cabecera: `governance/mutation-diff.test.ts`                                                                                                                                                                                      |
| A-234 | `FR-033`  | probado por cabecera | Sin líneas de producción en el cambio, o sin base de comparación, la verificación MUST pa… | ✓ cabecera: `governance/mutation-diff.test.ts`                                                                                                                                                                                      |
| A-235 | `FR-040`  | probado              | La prueba de arquitectura MUST fallar ante un archivo de dominio o de aplicación de más d… | ✓ `tests/architecture/shape.test.ts` (≤ 300 líneas, un controller por `operationId`, `new` de npm sólo en composición/infraestructura/gateways, `import()` calculado, carácter de control, condición sobre `config.<campo>`)        |
| A-236 | `FR-041`  | probado              | Cada regla de FR-040 y la regla existente de importación por API pública de módulo MUST t… | ✓ `shape.test.ts` con fixture por regla ("a domain file over the limit is reported", "a missing controller… reported", "a controller building an npm client is reported", "the module public-API rule keeps its fixture (FR-041)")  |
| A-237 | `FR-050`  | probado              | Un único comando MUST ejecutar todas las verificaciones nuevas y fallar ante la primera r… | ✓ `npm run quality` (`tests/governance/quality.test.ts` "stops at the first red gate and reports which one"); en CI (`ci.yml:48`); CLAUDE.md § Comandos                                                                             |
| A-238 | `FR-051`  | probado              | Cada regla o verificación de FR-002, FR-010, FR-011, FR-012, FR-020, FR-021, FR-030 y FR-… | ✓ = A-225..A-236 más `tests/typecheck`, `tests/governance/{duplication,dead-code,language}.test.ts`                                                                                                                                 |
| A-239 | `FR-052`  | histórico            | El código existente MUST pasar todas las verificaciones al cierre, con cero excepciones s… | histórico; hoy `quality` exit 0 con `Lint exceptions: 0` (`global-quality.txt`)                                                                                                                                                     |
| A-240 | `FR-060`  | probado              | Un procedimiento invocable sobre un módulo, un directorio o el cambio contra la rama prin… | ✓ `.claude/skills/auditing-architecture/scripts/run-gates.mjs` (`--module`, `--dir`, `--diff`; `tests/audit/audit.test.ts` "run-gates.mjs on the eval fixtures"); esta auditoría lo usó en 15 alcances                              |
| A-241 | `FR-061`  | probado              | Los criterios de diseño (una responsabilidad por módulo, dependencia sólo de abstraccione… | ✓ `.claude/skills/auditing-architecture/references/criterios-diseno.md` (SRP, DIP, LSP, ISP, OCP, DRY con fuente y qué ve un gate)                                                                                                  |
| A-242 | `FR-062`  | probado              | Cada hallazgo MUST traer archivo y línea, regla violada con fuente, evidencia, severidad … | ✓ `references/formato-hallazgo.md` + `audit-finding.schema.json` (`file`, `line`, `rule.source`, `severity` por fuente, `evidence`, `proposal`); `verify-finding.mjs` rechaza severidad ≠ fuente (`audit.test.ts`)                  |
| A-243 | `FR-063`  | probado              | Cada hallazgo de diseño MUST pasar una segunda revisión que intenta refutarlo; sólo los c… | ✓ `references/refutacion.md`; esta auditoría refutó 11 hallazgos (§5)                                                                                                                                                               |
| A-244 | `FR-064`  | probado              | Antes de emitirse, cada hallazgo MUST verificarse mecánicamente: archivo y línea existen,… | ✓ `verify-finding.mjs` (`audit.test.ts` "rejects a line beyond the file, a nonexistent file and an unknown ADR")                                                                                                                    |
| A-245 | `FR-065`  | probado              | El estado global MUST derivarse de una regla fija (gate rojo o hallazgo Alto ⇒ Rechazado;… | ✓ SKILL.md § Paso 7 (regla fija, sin puntuación); este informe §7                                                                                                                                                                   |
| A-246 | `FR-066`  | probado              | Tres escenarios de evaluación con fixtures (controller que instancia infraestructura; dos… | ✓ `evals/{controller-instantiates-infra,identical-domain-functions,empty-catch,…}` (9 escenarios) con `expected.json` y fixtures en `tests/audit/fixtures/` (`audit.test.ts` "accepts every expected.json of the evals")            |
| A-247 | `FR-070`  | probado              | El compilador que ejecuta `build` y `typecheck` MUST ser la versión mayor vigente de Type… | ✓ `tests/typecheck/compiler-version.test.ts` "`tsc` is TypeScript 7", "package.json declares the side-by-side alias" (ADR-017)                                                                                                      |
| A-248 | `FR-071`  | histórico            | Los diagnósticos nuevos del compilador vigente sobre código existente MUST corregirse en … | histórico; hoy `typecheck` exit 0 con TS 7 (`global-typecheck.txt`)                                                                                                                                                                 |
| A-249 | `FR-072`  | histórico            | Toda dependencia declarada MUST estar en su última versión publicada al cierre, o llevar … | histórico (al cierre de la 005); hoy `npm outdated` lista 7 paquetes con parche/menor pendiente (`@redocly/cli`, `@types/node` 22 por Node 22, `eslint`, `jscpd`, `knip`, `openapi-backend`, `prettier`) sin nota en `package.json` |
| A-250 | `SC-001`  | probado              | El 100 % de las reglas y verificaciones de FR-051 tiene un caso que la viola y una prueba… | ✓ = A-238                                                                                                                                                                                                                           |
| A-251 | `SC-002`  | probado              | Al cierre, la verificación de idioma pasa sobre todo el alcance de FR-001 con cero excepc… | ✓ `check:language` 0 excepciones hoy; búsqueda manual del cierre: histórica                                                                                                                                                         |
| A-252 | `SC-003`  | probado              | El comando de calidad completo corre localmente en menos de 3 minutos sobre el estado de … | ✓ `npm run quality` en 26 s (medido 2026-09-19); mutación aparte                                                                                                                                                                    |
| A-253 | `SC-004`  | histórico            | Toda la suite anterior pasa; las únicas aserciones modificadas son las que afirman sobre … | histórico; suite 1004/1004 hoy                                                                                                                                                                                                      |
| A-254 | `SC-005`  | probado              | Los tres escenarios de evaluación producen su hallazgo esperado en tres ejecuciones conse… | ✓ `evals/RESULTS.md` (corridas fechadas); `audit.test.ts` determinista en cada `npm test`                                                                                                                                           |
| A-255 | `SC-006`  | probado              | El 100 % de los hallazgos de un reporte de auditoría resuelve a archivo, línea y regla ex… | ✓ `verify-finding.mjs` sobre las cuatro fases de esta auditoría: 64/64 hallazgos resuelven archivo, línea y fuente                                                                                                                  |
| A-256 | `SC-007`  | histórico            | El contrato traducido pasa la comparación de compatibilidad contra la versión publicada s… | histórico; `contract:diff` verde hoy (`global-contract-check.txt`)                                                                                                                                                                  |
| A-257 | `SC-008`  | parcial              | `tsc --version` reporta la versión mayor vigente de TypeScript, y el 100 % de las depende… | parcial: `tsc --version` 7.x (`compiler-version.test.ts`); dependencias: ver A-249                                                                                                                                                  |

#### 006-mapa-del-contrato — 24 afirmaciones: 18 probado, 4 probado por cabecera, 2 histórico

| id    | requisito | estado               | afirmación                                                                                 | evidencia                                                                                                                                                                                                                                                                                    |
| ----- | --------- | -------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-258 | `FR-001`  | probado              | MUST existir un mapa del contrato, en un archivo gobernado del directorio del contrato, c… | ✓ `contracts/api-map.yaml` (`check:api-map`, `tests/governance/api-map.test.ts` "the real map and the real contract are coherent")                                                                                                                                                           |
| A-259 | `FR-002`  | probado              | El mapa MUST cubrir toda la superficie que los documentos del MVP implican para el backen… | ✓ mapa con 23 operaciones para SDK, plataforma, portal y admin (`api-map.test.ts` "passes on a coherent map and reports the count per status"); cobertura frente a los documentos: `check:api-map` compara fuentes `mvp:` cuando los documentos están ("without the MVP documents it warns") |
| A-260 | `FR-003`  | probado por cabecera | Un chequeo MUST fallar si el contrato declara una operación ausente del mapa, si el mapa … | ✓ cabecera: `governance/api-map.test.ts`                                                                                                                                                                                                                                                     |
| A-261 | `FR-004`  | probado por cabecera | El chequeo MUST correr dentro de `contract:check` y en CI, e informar el conteo por estad… | ✓ cabecera: `governance/api-map.test.ts`                                                                                                                                                                                                                                                     |
| A-262 | `FR-005`  | probado              | La documentación publicada del contrato MUST mostrar las operaciones planeadas como tales… | ✓ `scripts/contract-docs.mjs` "Planned surface" desde el mapa (`contract-docs.test.ts`); el servidor no las sirve (`assertEveryOperationWired` sólo sobre el contrato)                                                                                                                       |
| A-263 | `FR-010`  | probado              | El contrato MUST declarar un esquema de seguridad por consumidor: SDK (credencial pública… | ✓ `securitySchemes` `ingestKey`, `platformKey` en la raíz; `portalSession`, `adminToken` como archivos sin referencia (ADR-020); regla `ope-consumer-security`                                                                                                                               |
| A-264 | `FR-011`  | probado              | Una decisión escrita MUST fijar, por consumidor: dónde viaja la credencial, qué identific… | ✓ ADR-020 (tabla por consumidor); ADR-029 (rotación de secretos)                                                                                                                                                                                                                             |
| A-265 | `FR-012`  | probado              | Una regla del ruleset MUST exigir que el esquema de seguridad de una operación sea el que… | ✓ regla `ope-consumer-security` con fixtures `.public`, `.two-requirements`                                                                                                                                                                                                                  |
| A-266 | `FR-013`  | probado              | Las capacidades requeridas MUST provenir de un catálogo cerrado por consumidor (archivo g… | ✓ `consumers.<x>.capabilities` en `api-map.yaml`; regla `ope-required-capabilities` (`.foreign`, `.bad-format`); réplica `CONSUMER_CAPABILITIES` (`tests/unit/http/capabilities.test.ts`)                                                                                                    |
| A-267 | `FR-020`  | probado              | Una decisión escrita MUST fijar la convención de idempotencia de las notificaciones servi… | ✓ ADR-020 § idempotencia; `x-idempotency { key, first, repeat }`                                                                                                                                                                                                                             |
| A-268 | `FR-021`  | probado              | Una regla del ruleset MUST exigir que toda operación con tag `outcomes` declare su clave … | ✓ regla `ope-outcomes-idempotency` con fixtures `.key`, `.codes`, `.conflict`                                                                                                                                                                                                                |
| A-269 | `FR-030`  | probado              | El contrato MUST definir esquemas reutilizables para paginar (parámetros y envoltorio de … | ✓ `components/parameters/{cursor,limit,from,to}.yaml`, `components/schemas/Page.yaml` (sin referencia hasta el portal, ADR-020)                                                                                                                                                              |
| A-270 | `FR-031`  | probado              | Una regla del ruleset MUST exigir que toda operación de lectura que devuelva una colecció… | ✓ regla `ope-collection-pagination` con fixtures `.params`, `.envelope`                                                                                                                                                                                                                      |
| A-271 | `FR-040`  | probado por cabecera | Los estados del mapa MUST ser un conjunto cerrado: planeada, construida, depreciada, reti… | ✓ cabecera: `governance/api-map.test.ts`                                                                                                                                                                                                                                                     |
| A-272 | `FR-041`  | probado por cabecera | Una operación depreciada MUST llevar la marca de depreciación en el contrato y el estado … | ✓ cabecera: `governance/api-map.test.ts`                                                                                                                                                                                                                                                     |
| A-273 | `FR-050`  | probado              | Toda regla nueva del ruleset MUST tener su fixture que la viola y su caso de prueba, como… | ✓ `rules.test.ts:56` (un fixture por regla `ope-*`)                                                                                                                                                                                                                                          |
| A-274 | `FR-051`  | probado              | Todo sustantivo nuevo que el mapa introduzca (los de las operaciones planeadas) MUST tene… | ✓ `check:glossary` con `uso: pendiente` para sustantivos de operaciones planeadas (`glossary.test.ts` "passes if the unused note declares `uso: pendiente`")                                                                                                                                 |
| A-275 | `FR-052`  | probado              | La guía de agentes MUST incorporar el mapa al flujo: antes de cambiar el contrato, la ope… | ✓ CLAUDE.md § Flujo de trabajo paso 0 (ADR-019)                                                                                                                                                                                                                                              |
| A-276 | `FR-053`  | histórico            | Esta feature MUST NOT agregar código de servidor ni cambiar el comportamiento de las oper… | histórico; sin cambios de servidor en la 006 (`git log 006`), Schemathesis verde hoy                                                                                                                                                                                                         |
| A-277 | `SC-001`  | probado              | El 100 % de las operaciones que los documentos del MVP implican para el backend tiene ent… | ✓ = A-259; 7 built de 23 (`check:api-map`)                                                                                                                                                                                                                                                   |
| A-278 | `SC-002`  | probado              | Agregar una operación al contrato sin entrada en el mapa, o cambiarle el tag o el esquema… | ✓ `api-map.test.ts` (mapa ↔ contrato en ambos sentidos; tag y esquema por consumidor con `ope-consumer-security`)                                                                                                                                                                            |
| A-279 | `SC-003`  | probado              | Cada convención (autenticación por consumidor, capacidades, idempotencia, paginación, cic… | ✓ ADR-019 (ciclo de vida), ADR-020 (autenticación, capacidades, idempotencia, paginación) con sus reglas `ope-*`                                                                                                                                                                             |
| A-280 | `SC-004`  | probado              | Un integrador puede responder, sólo con la documentación publicada, qué operaciones exist… | ✓ `contract:docs` con la superficie planeada y los esquemas de seguridad por consumidor (`contract-docs.test.ts` "autocontenido")                                                                                                                                                            |
| A-281 | `SC-005`  | histórico            | `contract:check`, `release-check` y la suite completa pasan; las tres operaciones constru… | histórico; gates verdes hoy                                                                                                                                                                                                                                                                  |

#### 007-asignacion-experimental — 31 afirmaciones: 6 probado, 24 probado por cabecera, 1 histórico

| id    | requisito | estado               | afirmación                                                                                 | evidencia                                                                                                                                                  |
| ----- | --------- | -------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-282 | `FR-001`  | probado              | Cada merchant MUST poder tener como máximo un experimento activo, definido por configurac… | ✓ `config.ts:182` "must have at most one active experiment" (`config.test.ts`); F-007 sobre dónde vive la regla                                            |
| A-283 | `FR-002`  | probado por cabecera | La asignación de un visitante a un brazo MUST ser una función pura de merchant, experimen… | ✓ cabecera: `unit/domain/experiment/assignment.test.ts`                                                                                                    |
| A-284 | `FR-003`  | probado por cabecera | Sobre una muestra grande de visitantes distintos, la proporción asignada a TREATMENT MUST… | ✓ cabecera: `unit/domain/experiment/assignment.test.ts`                                                                                                    |
| A-285 | `FR-004`  | probado por cabecera | Las asignaciones de dos merchants para el mismo visitante MUST ser independientes; las de… | ✓ cabecera: `unit/domain/experiment/assignment.test.ts`                                                                                                    |
| A-286 | `FR-005`  | probado por cabecera | La semilla y el reparto de un experimento MUST NOT poder modificarse: un cambio es un exp… | ✓ cabecera: `unit/domain/experiment/assignment.test.ts`                                                                                                    |
| A-287 | `FR-010`  | probado por cabecera | La asignación MUST registrarse en el ledger en el momento en que ocurre —el primer lote a… | ✓ cabecera: `integration/assignment.test.ts`                                                                                                               |
| A-288 | `FR-011`  | probado por cabecera | Registrar la misma asignación otra vez MUST ser idempotente: una sola asignación por merc… | ✓ cabecera: `integration/assignment.test.ts`                                                                                                               |
| A-289 | `FR-012`  | probado por cabecera | Un lote rechazado (contrato o invariante) MUST NOT producir asignación.                    | ✓ cabecera: `integration/assignment.test.ts`                                                                                                               |
| A-290 | `FR-013`  | probado por cabecera | Las asignaciones MUST ser consultables por merchant, experimento y visitante a través de … | ✓ cabecera: `integration/assignment.test.ts`                                                                                                               |
| A-291 | `FR-020`  | probado por cabecera | Toda decisión MUST registrar el brazo y el identificador del experimento del visitante, a… | ✓ cabecera: `integration/assignment.test.ts`                                                                                                               |
| A-292 | `FR-021`  | probado por cabecera | Un visitante de CONTROL MUST atravesar el mismo pipeline que uno de TREATMENT y resolver … | ✓ cabecera: `integration/assignment.test.ts`                                                                                                               |
| A-293 | `FR-022`  | probado por cabecera | Sin experimento activo, la decisión MUST ser `NO_OP` con el motivo "sin experimento activ… | ✓ cabecera: `integration/assignment.test.ts`                                                                                                               |
| A-294 | `FR-023`  | probado por cabecera | El brazo y el identificador del experimento MUST NOT aparecer como campos en ninguna resp… | ✓ cabecera: `integration/assignment.test.ts`                                                                                                               |
| A-295 | `FR-024`  | probado por cabecera | La resolución de la asignación MUST NOT agregar I/O de red ni escritura bloqueante al cam… | ✓ cabecera: `integration/assignment.test.ts`                                                                                                               |
| A-296 | `FR-030`  | probado por cabecera | Una decisión de arquitectura MUST fijar, antes de la persistencia real, que toda escritur… | ✓ cabecera: `integration/ledger-unavailable.test.ts`                                                                                                       |
| A-297 | `FR-031`  | probado por cabecera | Ante un ledger no disponible, el orquestador MUST fallar cerrado: `NO_OP` con el motivo "… | ✓ cabecera: `integration/ledger-unavailable.test.ts`                                                                                                       |
| A-298 | `FR-032`  | probado por cabecera | La implementación en memoria MUST cumplir el contrato del puerto (aceptar siempre); el ca… | ✓ cabecera: `integration/ledger-unavailable.test.ts`                                                                                                       |
| A-299 | `FR-033`  | probado              | El motivo "ledger no disponible" y el motivo "brazo de control" y "sin experimento activo… | ✓ `contracts/no-op-reasons.yaml` + réplica (`tests/unit/no-op-reasons.test.ts`); `contract:diff` compatible (`global-contract-check.txt`)                  |
| A-300 | `FR-040`  | probado              | MUST existir una prueba de carga con comando propio, fuera de la suite corriente, que lev… | ✓ `npm run test:load` (`scripts/test-load.mjs`, autocannon), fuera de la suite                                                                             |
| A-301 | `FR-041`  | probado por cabecera | Las cifras obtenidas MUST registrarse en el quickstart de la feature con fecha y máquina,… | ✓ cabecera: `unit/domain/experiment/assignment-regression.test.ts`                                                                                         |
| A-302 | `FR-050`  | probado por cabecera | Las pruebas MUST demostrar aislamiento entre merchants (mismo visitante, dos merchants; a… | ✓ cabecera: `integration/isolation.test.ts`                                                                                                                |
| A-303 | `FR-051`  | probado              | Todo sustantivo nuevo MUST tener su nota en el glosario con fuente: experimento, asignaci… | ✓ `docs/dominio/{experimento,asignacion,brazo,grupo-de-control,grupo-de-tratamiento,intencion-de-tratar}.md`; `check:glossary`                             |
| A-304 | `FR-052`  | probado              | Las propiedades de la asignación (determinismo, estabilidad, reparto, independencia) y de… | ✓ `tests/unit/domain/experiment/assignment.test.ts` (determinismo, reparto, independencia, estabilidad); `memory-assignment-ledger.test.ts` (idempotencia) |
| A-305 | `FR-053`  | probado por cabecera | La suite anterior MUST seguir pasando sin modificar aserciones.                            | ✓ citado en: `integration/ingest-latency.test.ts`                                                                                                          |
| A-306 | `SC-001`  | probado por cabecera | Un millón de asignaciones repetidas del mismo visitante dan un millón de veces el mismo b… | ✓ cabecera: `unit/domain/experiment/assignment.test.ts`                                                                                                    |
| A-307 | `SC-002`  | probado por cabecera | Tras cualquier secuencia de lotes de un visitante, el ledger tiene exactamente una asigna… | ✓ cabecera: `integration/assignment.test.ts`                                                                                                               |
| A-308 | `SC-003`  | probado por cabecera | Ninguna respuesta HTTP de la suite de integración contiene un campo con el brazo ni el id… | ✓ cabecera: `integration/assignment.test.ts`                                                                                                               |
| A-309 | `SC-004`  | probado por cabecera | Con el ledger no disponible, el 100 % de los lotes válidos recibe `NO_OP` con motivo "led… | ✓ citado en: `integration/ingest-latency.test.ts`                                                                                                          |
| A-310 | `SC-005`  | probado por cabecera | La latencia de la ingesta con asignación no supera en más de 10 % la medida en la 004 (p9… | ✓ cabecera: `integration/isolation.test.ts`                                                                                                                |
| A-311 | `SC-006`  | probado              | La prueba de carga corre con un comando, reporta las cinco cifras y termina con éxito; la… | ✓ quickstart 007 § prueba de carga con las cifras del 2026-09-17 (histórico)                                                                               |
| A-312 | `SC-007`  | histórico            | `release-check` en verde; la suite de las features 001–006 pasa sin modificar aserciones;… | histórico; `release-check` y `check:glossary` en verde hoy                                                                                                 |

#### 008-casos-de-uso-y-errores — 26 afirmaciones: 21 probado, 2 probado por cabecera, 3 histórico

| id    | requisito | estado               | afirmación                                                                                 | evidencia                                                                                                                                       |
| ----- | --------- | -------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A-313 | `FR-001`  | probado              | MUST existir un contrato común de caso de uso: una interfaz genérica con un único método … | ✓ `UseCase<I, O>` en `application/shared-kernel/use-case.ts`; regla `ope/use-case-shape` (`lint.test.ts`)                                       |
| A-314 | `FR-002`  | probado              | Todo caso de uso MUST ser una clase con sufijo `UseCase`, en la carpeta de casos de uso d… | ✓ regla `ope/use-case-shape` (fixture `use-cases/use-case-shape.ts`)                                                                            |
| A-315 | `FR-003`  | probado              | Lo que un caso de uso necesita para operar MUST llegar por el constructor como un único o… | ✓ regla `ope/dependencies-are-interfaces` (fixture)                                                                                             |
| A-316 | `FR-004`  | probado              | El número de campos de una interfaz de dependencias MUST tener un límite declarado y veri… | ✓ límite 6 en `scripts/lint/dependencies-are-interfaces.mjs` con fixture                                                                        |
| A-317 | `FR-005`  | probado              | Los controllers HTTP MUST recibir los casos de uso por su contrato y limitarse a traducir… | ✓ controllers reciben `UseCase<…>` y traducen (fase 1, T183); `controllers-no-gateways`                                                         |
| A-318 | `FR-010`  | probado              | Un caso de uso MUST NOT importar ni invocar a otro caso de uso; la verificación de arquit… | ✓ `use-cases-no-use-cases` (`architecture.test.ts`)                                                                                             |
| A-319 | `FR-011`  | probado              | La lógica compartida entre casos de uso que necesita puertos MUST ser un servicio de apli… | ✓ `AssignmentService`, `ProductTruthService`, `DecisionRecorder`, `StateService` en `services/`                                                 |
| A-320 | `FR-012`  | probado              | Un servicio de aplicación MUST NOT importar casos de uso.                                  | ✓ `services-no-use-cases` (`architecture.test.ts`)                                                                                              |
| A-321 | `FR-020`  | probado              | MUST existir una raíz común de errores de negocio en el núcleo compartido del dominio: un… | ✓ `DomainError` en `domain/shared-kernel/errors.ts` (`errors.test.ts`)                                                                          |
| A-322 | `FR-021`  | probado              | Cada módulo MUST definir sus errores en un archivo de errores de su dominio, como clases … | ✓ `errors.ts` por módulo; regla `ope/domain-error-shape`; `error-codes.test.ts` "an error declares the module of the folder"                    |
| A-323 | `FR-022`  | probado              | El tipo de resultado MUST cerrarse sobre la raíz (`Result<T, E extends                     | ✓ `Result<T, E extends DomainError>` (`result.ts`)                                                                                              |
| A-324 | `FR-023`  | probado              | Los errores de negocio MUST devolverse, nunca lanzarse; un `throw` de una instancia de la… | ✓ reglas `ope/no-throw-domain-error`, `ope/no-generic-catch-in-application` (fixtures)                                                          |
| A-325 | `FR-024`  | probado              | Los códigos MUST ser únicos entre módulos y cada uno MUST existir en el catálogo de tipos… | ✓ `tests/unit/domain/error-codes.test.ts` "every code of every module exists in the catalogue with its status, and codes are unique"            |
| A-326 | `FR-025`  | probado              | Los errores existentes MUST migrar: invariantes del lote y de la exposición, ledger no di… | ✓ `LedgerUnavailable` del módulo `ledger` devuelto en `Result` (`ledger-unavailable.test.ts`); invariantes como errores de `ingestion`/`ledger` |
| A-327 | `FR-030`  | probado por cabecera | El adaptador HTTP MUST exponer una única función que convierte cualquier error de la raíz… | ✓ cabecera: `unit/http/to-problem.test.ts`                                                                                                      |
| A-328 | `FR-031`  | histórico            | Las respuestas HTTP de las operaciones construidas MUST NOT cambiar (mismos status, tipos… | histórico; Schemathesis 2433/2433 hoy                                                                                                           |
| A-329 | `FR-040`  | probado por cabecera | MUST existir un decorador de registro operativo que envuelve cualquier caso de uso y regi… | ✓ cabecera: `unit/application/shared-kernel/logged-use-case.test.ts`                                                                            |
| A-330 | `FR-050`  | probado              | Toda regla nueva (arquitectura o lint) MUST tener fixture que la viola y prueba.           | ✓ = A-314..A-324 (fixtures en `tests/lint/fixtures/as-src`, `tests/architecture/fixtures`)                                                      |
| A-331 | `FR-051`  | probado              | Una decisión de arquitectura MUST registrar el contrato, la separación caso de uso / serv… | ✓ ADR-023; CLAUDE.md § Cómo se escribe un caso de uso                                                                                           |
| A-332 | `FR-052`  | histórico            | La migración MUST NOT cambiar comportamiento: la suite de 001–007 pasa sin modificar aser… | histórico; suite verde                                                                                                                          |
| A-333 | `SC-001`  | probado              | El 100 % de los casos de uso (los cinco actuales) son clases `*UseCase` con el contrato c… | ✓ siete casos de uso hoy, todos `*UseCase` con `Dependencies` (`lint` verde, `use-cases-no-use-cases`)                                          |
| A-334 | `SC-002`  | probado              | Cada regla nueva tiene al menos un fixture que la viola y falla en la primera corrida (su… | ✓ = A-330                                                                                                                                       |
| A-335 | `SC-003`  | probado              | Los códigos de error de dominio son únicos y el 100 % existe en el catálogo con su status… | ✓ = A-325                                                                                                                                       |
| A-336 | `SC-004`  | histórico            | Las pruebas de integración y Schemathesis de 004–007 pasan sin cambios en aserciones ni e… | histórico; verde hoy                                                                                                                            |
| A-337 | `SC-005`  | probado              | Un caso de uso nuevo se escribe siguiendo la guía en un solo archivo de aplicación más su… | ✓ CLAUDE.md § Cómo se escribe un caso de uso; `toProblem` genérico (`to-problem.test.ts`)                                                       |
| A-338 | `SC-006`  | probado              | `quality`, `test:mutation` y `release-check` en verde.                                     | ✓ `global-quality.txt`, mutación 99,15 %, `release-check` exit 0                                                                                |

#### 009-dominio-rico — 21 afirmaciones: 16 probado, 2 hallazgo, 2 histórico, 1 probado por cabecera

| id    | requisito | estado               | afirmación                                                                                 | evidencia                                                                                                                                                                             |
| ----- | --------- | -------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-339 | `FR-001`  | probado              | `EventBatch`, `Decision`, `Experiment` y `Merchant` MUST ser clases con constructor priva… | ✓ `EventBatch`, `Decision`, `Experiment`, `Merchant` con `of`/`rehydrate` y constructor privado (`event-batch.test.ts`, `decision.test.ts`, `experiment.test.ts`, `merchant.test.ts`) |
| A-340 | `FR-002`  | probado              | `EventBatch.of` MUST hacer cumplir las invariantes publicadas en el contrato: misma sesió… | ✓ `event-batch.test.ts` `[invariant:session-visitor-mismatch]`, `[invariant:event-timestamp-out-of-range]`, bordes de la tolerancia                                                   |
| A-341 | `FR-003`  | probado              | `Decision` MUST ser una unión discriminada por `outcome`: `NO_OP` con `reason` del catálo… | ✓ `NoOpDecision                                                                                                                                                                       | InterveneDecision` (`decision.test.ts`; `rehydrate` rechaza registros corruptos) |
| A-342 | `FR-004`  | probado              | `Experiment` MUST guardar el reparto como tasa 0–1 (`treatmentShare`), MUST rechazar tasa… | ✓ `experiment.test.ts` (`invalid-treatment-share`, `invalid-seed`); `assignment-regression.test.ts` (huella de la 007)                                                                |
| A-343 | `FR-005`  | probado              | `Merchant` MUST exponer `owns(key)` y `allowsOrigin(origin)`; los orígenes MUST ser un va… | ✓ `merchant.test.ts` (`owns`, `allowsOrigin`, `Origin.parse`)                                                                                                                         |
| A-344 | `FR-006`  | probado              | Los valores sin reglas (`Exposure`, `Assignment`, identificadores marcados, `Arm`, `Servi… | ✓ `Exposure`, `Assignment`, ids, `Arm`, `ServiceHealth` son tipos (fase 1)                                                                                                            |
| A-345 | `FR-010`  | probado              | `src/domain/` MUST NOT exportar funciones sueltas; excepciones declaradas en la regla: lo… | ✓ regla `ope/domain-no-loose-functions` (fixture `loose-function.ts`)                                                                                                                 |
| A-346 | `FR-011`  | probado              | Los casos de uso y servicios MUST invocar el comportamiento por su dueño (`experiment.ass… | ✓ fase 1 T183: ningún caso de uso reimplementa una regla; `experiment.assign`, `merchant.allowsOrigin`, `decision.isIntervention()` invocados por su dueño                            |
| A-347 | `FR-020`  | hallazgo             | La configuración y los gateways de configuración MUST construir entidades por su fábrica … | parcial: `config.ts` construye por fábrica y traduce a `ConfigError` (`config.test.ts`), pero juzga invariantes del dueño → F-007                                                     |
| A-348 | `FR-021`  | probado              | La guarda de instantes no parseables MUST vivir en la traducción DTO → dominio del adapta… | ✓ `instantOf` en controllers/`boundary.ts` (`tests/unit/http/instant-guard.test.ts`); F-021 sobre las copias                                                                          |
| A-349 | `FR-030`  | probado              | La ventana de deduplicación MUST declararse en el módulo de ingesta de la aplicación y en… | ✓ `DEDUP_WINDOW` en `application/ingestion/policies/dedup-window.ts`; `memoryEventDedup(clock, window)` la recibe                                                                     |
| A-350 | `FR-031`  | probado              | Toda operación de todo puerto MUST devolver `Promise`; ningún puerto MUST admitir respues… | ✓ todos los puertos devuelven `Promise` (fase 3, T201)                                                                                                                                |
| A-351 | `FR-040`  | histórico            | El contrato HTTP y el mapa MUST NOT cambiar; las respuestas de las operaciones construida… | histórico; contrato sin cambios en la 009 (`git log contracts/`), Schemathesis verde hoy                                                                                              |
| A-352 | `FR-041`  | probado por cabecera | La asignación experimental MUST ser bit a bit la misma que en la 007 (prueba de regresión… | ✓ citado en: `unit/domain/experiment/assignment-regression.test.ts`                                                                                                                   |
| A-353 | `FR-042`  | probado              | Una decisión de arquitectura MUST registrar el criterio (qué es clase, qué es tipo, fábri… | ✓ ADR-024; CLAUDE.md § Cómo se escribe una entidad                                                                                                                                    |
| A-354 | `SC-001`  | probado              | El 100 % de los conceptos con invariantes (`EventBatch`, `Decision`, `Experiment`, `Merch… | ✓ constructores privados (`private constructor`) en las cuatro clases; sin `new` fuera (grep)                                                                                         |
| A-355 | `SC-002`  | hallazgo             | Cero reglas de negocio en gateways y configuración: los gateways de configuración sólo tr… | parcial: gateways sólo traducen (T183); `config.ts` juzga invariantes de merchants/experimentos → F-007                                                                               |
| A-356 | `SC-003`  | probado              | 100 000 visitantes de la muestra de la 007 reciben el mismo brazo que antes del refactor.  | ✓ `assignment-regression.test.ts` (huellas 50/20/80 % de 100 000 visitantes)                                                                                                          |
| A-357 | `SC-004`  | histórico            | Pruebas de integración y Schemathesis de 004–008 pasan sin cambios en aserciones; el cont… | histórico; verde hoy                                                                                                                                                                  |
| A-358 | `SC-005`  | probado              | `quality`, `test:mutation` y `release-check` en verde.                                     | ✓ = A-338                                                                                                                                                                             |
| A-359 | `SC-006`  | probado              | Una entidad nueva se escribe siguiendo la guía en un archivo de dominio (clase + errores)… | ✓ CLAUDE.md § Cómo se escribe una entidad; `CatalogSnapshot`/`Order` (010/013) siguieron el patrón                                                                                    |

#### 010-catalogo-y-stock — 25 afirmaciones: 15 probado por cabecera, 8 probado, 1 hallazgo, 1 histórico

| id    | requisito | estado               | afirmación                                                                                 | evidencia                                                                                                                                                                            |
| ----- | --------- | -------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A-360 | `FR-001`  | probado por cabecera | El sistema MUST aceptar por merchant un snapshot completo del catálogo con productos (ide… | ✓ cabecera: `integration/catalog.test.ts`                                                                                                                                            |
| A-361 | `FR-002`  | probado por cabecera | Un snapshot MUST cumplir por construcción: toda variante referencia un producto del mismo… | ✓ cabecera: `integration/catalog.test.ts`                                                                                                                                            |
| A-362 | `FR-003`  | probado por cabecera | El upsert MUST reemplazar el snapshot vigente del merchant por completo y MUST ser idempo… | ✓ cabecera: `integration/catalog.test.ts`                                                                                                                                            |
| A-363 | `FR-004`  | probado por cabecera | El sistema MUST NOT almacenar ni exponer cantidades de stock: la disponibilidad es un boo… | ✓ cabecera: `integration/catalog.test.ts`                                                                                                                                            |
| A-364 | `FR-005`  | probado por cabecera | MUST existir una consulta de verdad de producto por merchant, producto y variante que dev… | ✓ cabecera: `integration/catalog.test.ts`                                                                                                                                            |
| A-365 | `FR-006`  | probado por cabecera | Los presupuestos de frescura MUST ser políticas de aplicación publicadas y distintas por … | ✓ cabecera: `integration/catalog.test.ts`                                                                                                                                            |
| A-366 | `FR-007`  | probado por cabecera | La consulta de verdad MUST leer de la caché caliente y MUST NOT tocar ninguna plataforma … | ✓ cabecera: `integration/catalog.test.ts`                                                                                                                                            |
| A-367 | `FR-010`  | probado por cabecera | El sistema MUST derivar por merchant el nivel de sincronización observado (0–3) a partir … | ✓ cabecera: `unit/application/catalog/sync-level.test.ts`                                                                                                                            |
| A-368 | `FR-011`  | probado              | El nivel observado MUST informarse en la respuesta del upsert y MUST poder consultarse po… | ✓ `observedSyncLevel` en `CatalogSummary` (`catalog.test.ts`) y `ProductTruthService.syncLevel` (`product-truth.service.test.ts`)                                                    |
| A-369 | `FR-020`  | probado por cabecera | `upsertCatalogSnapshot` (`PUT /v1/catalog`) MUST pasar de `planned` a `built` en el mapa,… | ✓ cabecera: `integration/catalog.test.ts`                                                                                                                                            |
| A-370 | `FR-021`  | probado por cabecera | `platformKey` MUST decidirse y construirse: clave por merchant (una o dos, rotación) conf… | ✓ cabecera: `integration/security-capabilities.test.ts`                                                                                                                              |
| A-371 | `FR-022`  | probado por cabecera | El servidor MUST verificar `x-required-capabilities` de toda operación autenticada contra… | ✓ cabecera: `integration/security-capabilities.test.ts`                                                                                                                              |
| A-372 | `FR-023`  | hallazgo             | Con el segundo esquema de seguridad, cada esquema MUST declarar su header en el cableado,… | parcial: `SecurityScheme { handler, header }` y log redactado ✓ (`logging-privacy.test.ts`); CORS deriva de todos los esquemas → F-051                                               |
| A-373 | `FR-024`  | probado por cabecera | La respuesta del upsert MUST devolver el resumen: productos, variantes, instante de recep… | ✓ cabecera: `integration/catalog.test.ts`                                                                                                                                            |
| A-374 | `FR-030`  | probado              | El snapshot de un merchant MUST NOT ser visible ni reemplazable desde otro; el mismo `pro… | ✓ `isolation.test.ts:373` "catalogue: the snapshot of A is invisible to B; the same productId in A and B are two products; B's platform key cannot touch A"                          |
| A-375 | `FR-031`  | probado por cabecera | Las claves de plataforma MUST NOT aparecer en logs ni en respuestas.                       | ✓ cabecera: `integration/security-capabilities.test.ts`                                                                                                                              |
| A-376 | `FR-040`  | probado              | Glosario: `catalogo` (snapshot), `disponibilidad`, `precio`, `frescura`, `perfil-de-datos… | ✓ `docs/dominio/{catalogo,disponibilidad,precio,frescura,perfil-de-datos,producto,variante}.md`; `check:glossary`                                                                    |
| A-377 | `FR-041`  | probado              | Una decisión de arquitectura MUST registrar: `platformKey` y la verificación de capacidad… | ✓ ADR-025                                                                                                                                                                            |
| A-378 | `FR-042`  | probado              | El módulo `catalog` MUST seguir ADR-023/024: aggregate `CatalogSnapshot` con fábrica y re… | ✓ `CatalogSnapshot.of/rehydrate`, `catalog/errors.ts`, `UpsertCatalogSnapshotUseCase` (`upsert-catalog-snapshot.use-case.test.ts`)                                                   |
| A-379 | `SC-001`  | probado              | Un snapshot válido se refleja en la verdad consultable en la misma operación (lectura inm… | ✓ `catalog.test.ts` "the truth is readable right after"                                                                                                                              |
| A-380 | `SC-002`  | probado              | El 100 % de las invariantes del snapshot tiene tipo de problema, `x-invariants` y prueba … | ✓ `catalog-duplicate-product-id`, `catalog-duplicate-variant-id`, `catalog-captured-in-future`, `catalog-out-of-order` con `x-invariants` y `[invariant:]` (`check:invariant-tests`) |
| A-381 | `SC-003`  | probado              | Con el reloj controlado, la frescura y el nivel observado responden exactamente según los… | ✓ `product-truth.service.test.ts` (15 min, 36 h con reloj controlado), `sync-level.test.ts`                                                                                          |
| A-382 | `SC-004`  | probado por cabecera | Un snapshot de 5 000 productos y 50 000 variantes se acepta en una sola operación en meno… | ✓ cabecera: `integration/catalog-size.test.ts`                                                                                                                                       |
| A-383 | `SC-005`  | probado por cabecera | La suite de aislamiento cubre catálogo y credenciales de plataforma; la de latencia de in… | ✓ cabecera: `integration/isolation.test.ts`                                                                                                                                          |
| A-384 | `SC-006`  | histórico            | `contract:check` en verde con el mapa en 4 built; `quality`, `test:mutation`, `test:contr… | histórico; gates verdes hoy; `check:markers` sin el `PROPUESTO` de `platformKey`                                                                                                     |

#### 011-plano-de-decision-i — 27 afirmaciones: 19 probado por cabecera, 7 probado, 1 histórico

| id    | requisito | estado               | afirmación                                                                                 | evidencia                                                                                                                                                                                                                               |
| ----- | --------- | -------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-385 | `FR-001`  | probado por cabecera | Por cada lote aceptado de un visitante asignado, el sistema MUST ejecutar en este orden: … | ✓ cabecera: `integration/decision-plane.test.ts`, `unit/application/decision/decision.service.test.ts`                                                                                                                                  |
| A-386 | `FR-002`  | probado por cabecera | La inferencia MUST ejecutarse y registrarse para ambos brazos; sólo TREATMENT puede recib… | ✓ cabecera: `integration/decision-plane.test.ts`, `unit/application/decision/decision.service.test.ts`                                                                                                                                  |
| A-387 | `FR-003`  | probado por cabecera | El motivo de `NO_OP` MUST ser uno del catálogo, con estos nuevos: `barrier-unclear`, `evi… | ✓ cabecera: `integration/decision-plane.test.ts`                                                                                                                                                                                        |
| A-388 | `FR-010`  | probado              | Las barreras MUST ser exactamente tres: `fit` (talle y calce), `price` (precio y valor), … | ✓ `BARRIERS` (`barriers.test.ts` réplica); `BarrierWithoutRules` exige regla por barrera (`barrier-rules.test.ts`)                                                                                                                      |
| A-389 | `FR-011`  | probado              | El vocabulario de hechos MUST ser cerrado y derivarse sólo de lo que OPE captura: conteo … | ✓ `Vocabulary.captured` desde `EVENT_TYPES`/`SUBTYPES`/`BLOCKS` (`condition.test.ts`, `barrier-rules.test.ts` `unknown-fact`)                                                                                                           |
| A-390 | `FR-012`  | probado por cabecera | La inferencia MUST producir, para cada barrera, una confianza 0–1 a partir de los pesos d… | ✓ cabecera: `unit/domain/barrier/barrier-rules.test.ts`                                                                                                                                                                                 |
| A-391 | `FR-013`  | probado por cabecera | La inferencia MUST ser una regla pura del dominio (sin puertos, sin reloj, sin aleatoried… | ✓ cabecera: `unit/application/barrier/rule-based-inference.test.ts`, `unit/domain/barrier/barrier-rules.test.ts`                                                                                                                        |
| A-392 | `FR-020`  | probado por cabecera | `DecisionPolicy` MUST contener: `version` (texto no vacío), reglas (`when`: condición; `t… | ✓ cabecera: `unit/domain/decision/decision-policy.test.ts`                                                                                                                                                                              |
| A-393 | `FR-021`  | probado por cabecera | Las condiciones MUST ser un álgebra cerrada: `all(...)`, `any(...)`, `not(...)` sobre pre… | ✓ cabecera: `unit/domain/barrier/condition.test.ts`                                                                                                                                                                                     |
| A-394 | `FR-022`  | probado por cabecera | La política MUST construirse por fábrica con las invariantes: hechos, subtipos, bloques y… | ✓ cabecera: `unit/domain/barrier/barrier-rules.test.ts`, `unit/domain/decision/decision-policy.test.ts`                                                                                                                                 |
| A-395 | `FR-023`  | probado por cabecera | Un merchant sin política MUST usar la política por defecto, cuya versión es `default-1`; … | ✓ cabecera: `unit/domain/decision/default-policy.test.ts`                                                                                                                                                                               |
| A-396 | `FR-024`  | probado              | Cambiar la política de un merchant MUST cambiar `version`; cada decisión MUST registrar `… | ✓ `DecisionInference` (policyVersion, confidences, matched, barrier, trigger, evidence) (`decision.service.test.ts` "INTERVENE with everything the ledger needs"); cambio de política ⇒ `version` (ADR-022, `config.test.ts`)           |
| A-397 | `FR-025`  | probado              | La política de un merchant MUST NOT afectar las decisiones de otro (aislamiento probado).  | ✓ `isolation.test.ts:215` "decision policy: A (threshold 0.9) and B (threshold 0.4) decide differently on the same session"                                                                                                             |
| A-398 | `FR-030`  | probado por cabecera | Antes de `INTERVENE`, el sistema MUST consultar la verdad de producto del producto y la v… | ✓ cabecera: `unit/application/decision/decision.service.test.ts`                                                                                                                                                                        |
| A-399 | `FR-031`  | probado por cabecera | La evidencia consultada (frescura por clase, disponibilidad) MUST registrarse en la decis… | ✓ cabecera: `unit/application/decision/decision.service.test.ts`                                                                                                                                                                        |
| A-400 | `FR-040`  | probado por cabecera | `INTERVENE` MUST llevar anclaje por barrera (`fit → size_selector`, `price →               | ✓ cabecera: `integration/decision-plane.test.ts`                                                                                                                                                                                        |
| A-401 | `FR-041`  | probado por cabecera | `confirmExposure` de una decisión del plano MUST responder `201` (cadena `DECIDED → EXPOS… | ✓ cabecera: `integration/decision-plane.test.ts`                                                                                                                                                                                        |
| A-402 | `FR-050`  | probado por cabecera | El sistema MUST mantener por merchant y sesión: agregó al carrito, entró al checkout, int… | ✓ cabecera: `integration/isolation.test.ts`, `unit/application/decision/decision.service.test.ts`, `unit/domain/decision/session-state.test.ts`, `unit/gateways/memory-session-state-store.test.ts`                                     |
| A-403 | `FR-060`  | probado              | El módulo `decision` MUST absorber el motivo provisional de `EventBatch` (`noOpReason()` … | ✓ `noOpReason` no existe en `src/` (grep); `Anchor`/`Intervention` en `shared-kernel/intervention.ts`                                                                                                                                   |
| A-404 | `FR-061`  | probado              | Sin operaciones ni schemas nuevos; `contracts/no-op-reasons.yaml` gana los motivos de FR-… | ✓ `no-op-reasons.yaml` con emisor y descripción; réplica `no-op-reasons.test.ts`; contrato sin operaciones nuevas en la 011 (`git log contracts/paths`)                                                                                 |
| A-405 | `FR-062`  | probado              | Glosario: `barrera`, `señal`, `evidencia`, `confianza`, `política de decisión`, `intenció… | ✓ `docs/dominio/{barrera,senal,evidencia,confianza,politica-de-decision,intencion}.md`; ADR-026                                                                                                                                         |
| A-406 | `SC-001`  | probado por cabecera | Con la política por defecto, los escenarios de las historias 1 y 2 producen exactamente l… | ✓ cabecera: `integration/decision-plane.test.ts`, `unit/domain/decision/barrier-verdict.test.ts` · quickstart: · DecisionPolicy.verdict — tabla de las historias 1 y 2 (SC-001) · tests/unit/domain/decision/verdict.test.ts · decisión |
| A-407 | `SC-002`  | probado por cabecera | La inferencia es determinista: 1 000 evaluaciones del mismo contexto dan el mismo veredic… | ✓ cabecera: `unit/domain/barrier/barrier-rules.test.ts` · quickstart: · BarrierRules.infer puro y determinista (1 000 evaluaciones, SC-002) · tests/unit/domain/barrier/barrier-rules.test.ts                                           |
| A-408 | `SC-003`  | probado por cabecera | Toda política inválida de un conjunto de al menos 8 casos (hecho, bloque, barrera, subtip… | ✓ cabecera: `unit/domain/barrier/barrier-rules.test.ts` · quickstart: · BarrierRules.of rechaza ≥ 8 políticas inválidas nombrando el campo (SC-003) · tests/unit/domain/barrier/barrier-rules.                                          |
| A-409 | `SC-004`  | probado por cabecera | El flujo completo ingesta → `INTERVENE` → `confirmExposure 201` pasa en integración, y la… | ✓ cabecera: `integration/decision-plane.test.ts` · quickstart: · Latencia de ingesta con inferencia activa (SC-004) · tests/integration/ingest-latency.test.ts · p95 ≤ 50 ms (umbral si                                                 |
| A-410 | `SC-005`  | probado por cabecera | Aislamiento: políticas y estado de sesión de A no afectan a B (suite de aislamiento ampli… | ✓ cabecera: `integration/isolation.test.ts` · quickstart: · Aislamiento: política de A vs B; sessionId igual en A y B (SC-005) · tests/integration/isolation.test.ts · decisiones                                                       |
| A-411 | `SC-006`  | histórico            | `contract:check`, `quality`, `test:mutation`, `test:contract`, `release-check` en verde; … | histórico; gates verdes hoy; `check:markers` sin los `PROPUESTO` de ADR-024                                                                                                                                                             |

#### 012-plano-de-decision-ii — 27 afirmaciones: 22 probado por cabecera, 4 probado, 1 histórico

| id    | requisito | estado               | afirmación                                                                                 | evidencia                                                                                                                                                                                                                      |
| ----- | --------- | -------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A-412 | `FR-001`  | probado por cabecera | El camino crítico MUST ejecutar, en este orden y sólo con barrera inferida: selección de … | ✓ citado en: `integration/decision-plane.test.ts`, `unit/application/decision/decision.service.test.ts`                                                                                                                        |
| A-413 | `FR-002`  | probado por cabecera | Selección + gate y política comercial MUST vivir en módulos propios; el orquestador sólo … | ✓ citado en: `unit/application/decision/decision.service.test.ts`                                                                                                                                                              |
| A-414 | `FR-003`  | probado por cabecera | Ambos brazos MUST atravesar selección, gate y política; CONTROL registra el resultado y r… | ✓ citado en: `integration/decision-plane.test.ts`                                                                                                                                                                              |
| A-415 | `FR-010`  | probado por cabecera | Los candidatos MUST ser un vocabulario cerrado de OPE por barrera, cada uno con `candidat… | ✓ cabecera: `unit/domain/selection/candidates.test.ts`                                                                                                                                                                         |
| A-416 | `FR-011`  | probado por cabecera | Todo candidato MUST hacer claims de una sola barrera y MUST NOT exponer estados ni scores… | ✓ cabecera: `unit/domain/selection/candidates.test.ts`                                                                                                                                                                         |
| A-417 | `FR-020`  | probado por cabecera | El gate MUST ser una función pura: candidato + evidencia + perfil del merchant ⇒ `accepta… | ✓ cabecera: `unit/domain/selection/quality-gate.test.ts`, `unit/no-op-reasons.test.ts`                                                                                                                                         |
| A-418 | `FR-021`  | probado por cabecera | Motivos de rechazo cerrados: `stale-price` (precio vigente sin stock/precio fresco), `no-… | ✓ cabecera: `unit/domain/selection/quality-gate.test.ts`                                                                                                                                                                       |
| A-419 | `FR-022`  | probado por cabecera | El perfil del merchant MUST declarar `returnsPolicy: boolean`, `fitData: boolean`, `autho… | ✓ cabecera: `unit/domain/selection/quality-gate.test.ts`                                                                                                                                                                       |
| A-420 | `FR-023`  | probado por cabecera | Sin ningún candidato aceptable ⇒ `NO_OP no-acceptable-candidate`; el gate MUST NOT relaja… | ✓ cabecera: `unit/domain/selection/quality-gate.test.ts`, `unit/gateways/config-policy-directory.test.ts`                                                                                                                      |
| A-421 | `FR-030`  | probado por cabecera | `CommercialPolicy` por merchant, versionada (`version`), con: `maxIncentivePercent` (0–10… | ✓ cabecera: `unit/domain/commercial/commercial-policy.test.ts`                                                                                                                                                                 |
| A-422 | `FR-031`  | probado por cabecera | Selección: el primer candidato aceptable del escalón más bajo; con barrera `price` y `dir… | ✓ citado en: `unit/application/decision/decision.service.test.ts`                                                                                                                                                              |
| A-423 | `FR-032`  | probado              | Bloqueos, en orden: alta intención (`high-intent`), cooldown o presupuesto por sesión (`s… | ✓ `verdict.test.ts` (orden fijo: `high-intent`, `session-budget-exhausted` incl. cooldown, `visitor-fatigue`, luego la elección); `commercial-policy.ts:172-177`                                                               |
| A-424 | `FR-033`  | probado              | El valor del incentivo MUST ser el primer escalón ≤ techo, y la respuesta MUST llevar `in… | ✓ `#incentiveValue` primer escalón (`verdict.test.ts`); `intervention.incentive { kind: percent, value }` (`commercial-policy.test.ts` integración)                                                                            |
| A-425 | `FR-034`  | probado              | La política de decisión de la 011 MUST perder `highIntent`, `abandonment` e `intervention… | ✓ `DecisionPolicyRecord` sin `highIntent`/`abandonment`/`interventionsPerSession` (`decision-policy.ts:23-29`); `decision-policy.test.ts` "reduced by feature 012"                                                             |
| A-426 | `FR-035`  | probado por cabecera | Política comercial por defecto (`commercial-default-1`): techo 10, escalones [5, 10], sin… | ✓ cabecera: `unit/domain/commercial/default-policy.test.ts`, `unit/gateways/config-policy-directory.test.ts`                                                                                                                   |
| A-427 | `FR-040`  | probado por cabecera | El sistema MUST contar intervenciones por merchant y visitante en una ventana de un día, … | ✓ cabecera: `unit/domain/decision/visitor-state.test.ts`, `unit/gateways/memory-visitor-state-store.test.ts`                                                                                                                   |
| A-428 | `FR-041`  | probado por cabecera | El estado de sesión MUST recordar el instante de la última intervención para el cooldown.  | ✓ citado en: `integration/decision-plane.test.ts`                                                                                                                                                                              |
| A-429 | `FR-050`  | probado por cabecera | Sin operaciones nuevas; `Intervention.incentive?` como adición compatible; motivos NO_OP … | ✓ cabecera: `integration/isolation.test.ts`                                                                                                                                                                                    |
| A-430 | `FR-051`  | probado por cabecera | La decisión MUST registrar `candidates[] { candidateId, step, verdict, reason? }`, `chose… | ✓ citado en: `integration/commercial-policy.test.ts`                                                                                                                                                                           |
| A-431 | `FR-052`  | probado              | Glosario: candidato, claim, quality gate, escalera del incentivo, política comercial, tec… | ✓ `docs/dominio/{candidato,claim,quality-gate,escalera-del-incentivo,politica-comercial,techo,margen,riesgo-de-devolucion,cooldown,fatiga}.md`; ADR-027                                                                        |
| A-432 | `FR-053`  | probado por cabecera | Aislamiento probado: política comercial y estado por visitante de A no afectan a B.        | ✓ citado en: `integration/ingest-latency.test.ts`                                                                                                                                                                              |
| A-433 | `SC-001`  | probado por cabecera | Los escenarios de las historias 1–3 dan el veredicto y motivo exactos (tabla, 100 %).      | ✓ cabecera: `unit/domain/commercial/verdict.test.ts`                                                                                                                                                                           |
| A-434 | `SC-002`  | probado por cabecera | El gate es puro y determinista: 1 000 evaluaciones del mismo candidato y evidencia dan el… | ✓ cabecera: `unit/domain/selection/quality-gate.test.ts` · quickstart: · Quality gate por tabla: cada claim aceptado y rechazado con su motivo; determinismo (SC-002) · tests/unit/domain/selec                                |
| A-435 | `SC-003`  | probado por cabecera | Toda política comercial inválida de ≥ 8 casos (techo fuera de rango, escalón > techo, esc… | ✓ cabecera: `unit/domain/commercial/commercial-policy.test.ts` · quickstart: · CommercialPolicy.of rechaza ≥ 8 casos inválidos nombrando el campo (SC-003) · tests/unit/domain/commercial/commercial-                          |
| A-436 | `SC-004`  | probado por cabecera | La suite de integración de la 011 pasa sin cambios de expectativa (mismo comportamiento p… | ✓ citado en: `integration/decision-plane.test.ts`, `integration/ingest-latency.test.ts` · quickstart: · Integración de la 011 (SC-004) · tests/integration/decision-plane.test.ts, decision-evidence.test.ts · mismos outcome/ |
| A-437 | `SC-005`  | probado por cabecera | p95 de ingesta ≤ 50 ms con las cinco autoridades activas.                                  | ✓ cabecera: `integration/isolation.test.ts` · quickstart: · Latencia con las cinco autoridades (SC-005) · tests/integration/ingest-latency.test.ts · p95 ≤ 50 ms ·                                                             |
| A-438 | `SC-006`  | histórico            | Aislamiento y gates (`quality`, `contract:check`, `test:mutation`, `test:contract`, `rele… | histórico; gates verdes hoy; `isolation.test.ts:303`                                                                                                                                                                           |

#### 013-outcomes-ordenes-y-devoluciones — 41 afirmaciones: 34 probado por cabecera, 6 probado, 1 histórico

| id    | requisito | estado               | afirmación                                                                                 | evidencia                                                                                                                                                                                                                 |
| ----- | --------- | -------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-439 | `FR-001`  | probado por cabecera | El ledger MUST distinguir, por orden y por merchant, los estados `VERIFIED_ORDER` (compra… | ✓ cabecera: `integration/orders.test.ts`                                                                                                                                                                                  |
| A-440 | `FR-002`  | probado por cabecera | La correlación MUST establecerse únicamente por el mecanismo A: `sessionId` en la notific… | ✓ cabecera: `integration/orders.test.ts`, `unit/application/outcomes/notify-order.test.ts`, `unit/domain/outcomes/correlation.test.ts`                                                                                    |
| A-441 | `FR-003`  | probado por cabecera | Una orden atribuida MUST guardar la asignación de la sesión (experimento y brazo) cuando … | ✓ cabecera: `integration/orders.test.ts`, `unit/application/outcomes/notify-order.test.ts`, `unit/domain/outcomes/correlation.test.ts`                                                                                    |
| A-442 | `FR-004`  | probado por cabecera | El estado de una orden MUST ser inmutable salvo por la devolución: una orden no pasa de p… | ✓ cabecera: `integration/orders.test.ts`, `unit/application/outcomes/notify-order.test.ts`                                                                                                                                |
| A-443 | `FR-005`  | probado por cabecera | El resultado causal MUST NOT ser un estado del ledger ni una respuesta de esta feature.    | ✓ cabecera: `integration/orders.test.ts`                                                                                                                                                                                  |
| A-444 | `FR-010`  | probado por cabecera | La plataforma MUST poder notificar una orden confirmada servidor a servidor con la creden… | ✓ cabecera: `integration/orders.test.ts`                                                                                                                                                                                  |
| A-445 | `FR-011`  | probado por cabecera | La notificación MUST llevar exactamente: `orderId`, monto y moneda, ítems (SKU y cantidad… | ✓ cabecera: `integration/orders.test.ts`, `unit/domain/outcomes/order.test.ts`                                                                                                                                            |
| A-446 | `FR-012`  | probado por cabecera | Ningún esquema de esta feature MUST admitir datos del comprador (nombre, email, teléfono,… | ✓ cabecera: `integration/orders.test.ts`                                                                                                                                                                                  |
| A-447 | `FR-013`  | probado por cabecera | La respuesta MUST decir el estado (`ATTRIBUTED_ORDER` o `PENDING_CORRELATION`) y el ident… | ✓ cabecera: `integration/orders.test.ts`                                                                                                                                                                                  |
| A-448 | `FR-014`  | probado por cabecera | `orderId` MUST ser único por merchant, no global; dos merchants pueden usar el mismo `ord… | ✓ cabecera: `integration/orders.test.ts`                                                                                                                                                                                  |
| A-449 | `FR-020`  | probado por cabecera | Órdenes y devoluciones MUST ser idempotentes por `orderId`: primera recepción `201`, repe… | ✓ cabecera: `integration/orders.test.ts`, `unit/application/outcomes/notify-order.test.ts`, `unit/domain/outcomes/order.test.ts`, `unit/gateways/memory-order-ledger.test.ts`                                             |
| A-450 | `FR-021`  | probado por cabecera | La igualdad de contenido MUST ser canónica: independiente del orden de claves y del forma… | ✓ cabecera: `integration/orders.test.ts`, `unit/domain/outcomes/order.test.ts`                                                                                                                                            |
| A-451 | `FR-022`  | probado por cabecera | El chequeo de existencia y el registro MUST ocurrir sin operación asíncrona intermedia (0… | ✓ cabecera: `integration/orders.test.ts`, `unit/gateways/memory-order-ledger.test.ts`                                                                                                                                     |
| A-452 | `FR-030`  | probado por cabecera | El SDK MUST poder corroborar una compra con la credencial de ingesta y la capacidad `orde… | ✓ cabecera: `integration/order-corroborations.test.ts`, `unit/application/outcomes/notify-return.test.ts`                                                                                                                 |
| A-453 | `FR-031`  | probado por cabecera | Una corroboración MUST registrarse como evidencia bajo el merchant de la credencial; MUST… | ✓ cabecera: `integration/order-corroborations.test.ts`, `unit/application/outcomes/notify-return.test.ts`                                                                                                                 |
| A-454 | `FR-032`  | probado por cabecera | Cuando existen la orden y la corroboración del mismo `orderId` y merchant, en cualquier o… | ✓ cabecera: `integration/order-corroborations.test.ts`, `unit/application/outcomes/notify-return.test.ts`                                                                                                                 |
| A-455 | `FR-033`  | probado por cabecera | La corroboración MUST responder `202` tanto la primera vez como repetida (un solo registr… | ✓ cabecera: `integration/order-corroborations.test.ts`, `unit/application/outcomes/notify-return.test.ts`                                                                                                                 |
| A-456 | `FR-035`  | probado por cabecera | La plataforma MUST poder notificar la devolución de una orden con la credencial de plataf… | ✓ cabecera: `integration/returns.test.ts`, `unit/application/outcomes/notify-return.test.ts`, `unit/domain/outcomes/return.test.ts`                                                                                       |
| A-457 | `FR-036`  | probado por cabecera | La devolución de un `orderId` desconocido para ese merchant MUST rechazarse con `422 orde… | ✓ cabecera: `integration/returns.test.ts`, `unit/application/outcomes/notify-return.test.ts`, `unit/domain/outcomes/return.test.ts`, `unit/gateways/memory-order-ledger.test.ts`                                          |
| A-458 | `FR-037`  | probado por cabecera | La orden devuelta MUST pasar a `RETURNED` conservando su correlación y asignación; la res… | ✓ cabecera: `integration/returns.test.ts`, `unit/application/outcomes/notify-return.test.ts`, `unit/domain/outcomes/return.test.ts`                                                                                       |
| A-459 | `FR-038`  | probado por cabecera | Una notificación de devolución por orden en el MVP (idempotente por `orderId`, FR-020); d… | ✓ cabecera: `integration/returns.test.ts`, `unit/application/outcomes/notify-return.test.ts`, `unit/domain/outcomes/return.test.ts`, `unit/gateways/memory-order-ledger.test.ts`                                          |
| A-460 | `FR-040`  | probado por cabecera | La notificación de orden MAY declarar el incentivo aplicado con la misma forma que el con… | ✓ cabecera: `integration/orders.test.ts`, `unit/domain/merchant/merchant.test.ts`                                                                                                                                         |
| A-461 | `FR-041`  | probado por cabecera | OPE MUST cruzar el incentivo declarado con la decisión de la sesión atribuida que lo conc… | ✓ cabecera: `integration/orders.test.ts`, `unit/application/outcomes/notify-order.test.ts`, `unit/domain/outcomes/correlation.test.ts`                                                                                    |
| A-462 | `FR-042`  | probado              | El `PROPUESTO` de la redención en el contrato MUST cerrarse: la mecánica del cupón en la … | ✓ `check:markers`: los dos `PROPUESTO` restantes son de ADR-020; `Incentive.yaml:7` dice "arrive with feature 014" (número que se mueve: 5ª ubicación de F-029, en el contrato publicado)                                 |
| A-463 | `FR-050`  | probado por cabecera | Cada merchant MAY configurar uno o dos secretos de firma junto a sus claves de plataforma… | ✓ cabecera: `integration/isolation.test.ts`, `integration/platform-signature.test.ts`, `unit/application/merchant/platform-signature.service.test.ts`, `unit/domain/merchant/platform-signature.test.ts`                  |
| A-464 | `FR-051`  | probado por cabecera | OPE MUST verificar firma e instante **antes** de validar el cuerpo y antes de cualquier c… | ✓ cabecera: `integration/platform-signature.test.ts`, `unit/application/merchant/platform-signature.service.test.ts`, `unit/domain/merchant/platform-signature.test.ts`                                                   |
| A-465 | `FR-052`  | probado por cabecera | Un merchant sin secreto MUST seguir autenticando sólo con la clave de plataforma (compati… | ✓ cabecera: `integration/platform-signature.test.ts`, `unit/application/merchant/platform-signature.service.test.ts`, `unit/domain/merchant/platform-signature.test.ts`                                                   |
| A-466 | `FR-053`  | probado por cabecera | El secreto MUST NOT aparecer en logs, respuestas ni errores; la firma y el instante se re… | ✓ cabecera: `integration/platform-signature.test.ts`, `unit/domain/merchant/platform-signature.test.ts`                                                                                                                   |
| A-467 | `FR-060`  | probado              | Órdenes, correlaciones, corroboraciones, devoluciones y redenciones MUST ser registros de… | ✓ `merchantId` en `Order`, `Corroboration`, claves compuestas de `memoryOrderLedger`/`memoryCorroborationLedger`; puertos `OrderLedger`/`CorroborationLedger`; `isolation.test.ts:408`                                    |
| A-468 | `FR-061`  | probado              | Todo registro MUST devolver disponibilidad o indisponibilidad, nunca lanzar; una notifica… | ✓ `Result<…, LedgerUnavailable>` en `record`/`recordReturn`/`corroborations.record`; 503 con `Retry-After` (`orders.test.ts`, `returns.test.ts`, `order-corroborations.test.ts` con ledgers falsos)                       |
| A-469 | `FR-070`  | probado              | `notifyOrder`, `corroborateOrder` y `notifyReturn` MUST pasar de `planned` a `built` en e… | ✓ `contracts/api-map.yaml` `built` para las tres (`check:api-map`, `tests/governance/api-map.test.ts` "the real map and the real contract are coherent")                                                                  |
| A-470 | `FR-071`  | probado              | Las reglas que el esquema no expresa (orden desconocida, ítems fuera de la orden, conflic… | ✓ `order-unknown`, `return-items-not-in-order`, `idempotency-conflict`, firma (`signature-*`) como tipos con `x-invariants` y `[invariant:]` (`check:invariant-tests`)                                                    |
| A-471 | `FR-072`  | probado              | Glosario: orden verificada, orden atribuida, correlación pendiente, corroboración, devolu… | ✓ `docs/dominio/{orden-verificada,orden-atribuida,correlacion-pendiente,corroboracion,devolucion,mecanismo-de-correlacion,firma-de-plataforma}.md`; ADR-028/029                                                           |
| A-472 | `FR-073`  | probado por cabecera | Aislamiento probado: una orden con `sessionId` de otro merchant no se atribuye; corrobora… | ✓ citado en: `integration/isolation.test.ts` · quickstart: · Aislamiento (FR-073) · tests/integration/isolation.test.ts (+) · sin cruce ·                                                                                 |
| A-473 | `SC-001`  | probado por cabecera | Los escenarios de las historias 1–5 dan el estado, el código y el registro exactos (tabla… | ✓ cabecera: `integration/orders.test.ts`, `unit/domain/outcomes/correlation.test.ts`, `unit/domain/outcomes/order.test.ts`                                                                                                |
| A-474 | `SC-002`  | probado por cabecera | 100 notificaciones repetidas de la misma orden (secuenciales y simultáneas) producen exac… | ✓ cabecera: `integration/orders.test.ts`, `unit/gateways/memory-order-ledger.test.ts`                                                                                                                                     |
| A-475 | `SC-003`  | probado por cabecera | Toda notificación con un campo fuera del contrato o con cualquiera de los datos personale… | ✓ cabecera: `integration/orders.test.ts` · quickstart: · PII: esquemas nuevos contra pii-denylist.json; additionalProperties: false (SC-003) · tests/contract-rules/*.test.ts (                                           |
| A-476 | `SC-004`  | probado por cabecera | Ninguna respuesta ni log de esta feature contiene brazo, experimento, visitante, secreto … | ✓ cabecera: `integration/orders.test.ts`, `integration/platform-signature.test.ts` · quickstart: · El DTO y los logs no llevan brazo, experimento, visitante, secreto ni firma (SC-004) · tests/integration/orders.test.t |
| A-477 | `SC-005`  | probado por cabecera | Con secreto configurado, ninguna notificación sin firma válida y en ventana se registra; … | ✓ cabecera: `integration/isolation.test.ts`, `integration/platform-signature.test.ts`                                                                                                                                     |
| A-478 | `SC-006`  | probado por cabecera | Una notificación de orden se responde en menos de 50 ms (p95) con el ledger en memoria; n… | ✓ cabecera: `integration/outcomes-latency.test.ts` · quickstart: · Latencia de notifyOrder (SC-006, informativa) · tests/integration/outcomes-latency.test.ts · p95 ≤ 50 ms ·                                             |
| A-479 | `SC-007`  | histórico            | Aislamiento entre merchants y gates (`quality`, `contract:check`, `test:mutation`, `test:… | histórico; gates verdes hoy; `isolation.test.ts:408`                                                                                                                                                                      |

## 5. Refutados (anexo)

(pendiente: fase 5)

## 6. Riesgos para la 014–017

Borrador de la fase 2 (se completa en las fases 3 y 5). Riesgo · dónde vive el supuesto · feature que lo absorbe.

| Riesgo                                                                                                                                                                                                            | `file:line` del supuesto                                                                                                                                       | Feature                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Un store de lectura caído (dedup, estado de sesión/visitante, políticas, experimentos, catálogo, ledger) produce 500 y no `NO_OP`/503; los puertos no pueden decir "no disponible" (F-043)                        | `src/application/ingestion/ports/event-dedup.ts:7` y los siete puertos listados en F-043                                                                       | 017                                     |
| El plano de medición (catálogo, órdenes, devoluciones) y el de decisión comparten el event loop: un snapshot detiene la ingesta el tiempo de su parseo, validación y HMAC (F-045)                                 | `src/infrastructure/http/build-server.ts:181` (una instancia de Fastify, `bodyLimit` global)                                                                   | 017 (despliegue)                        |
| Dos lotes de una sesión en vuelo con I/O real duplican una intervención o saltan el cooldown: el presupuesto se lee y escribe entre `await`s (F-046)                                                              | `src/application/decision/services/decision.service.ts:89-118`; `memory-session-state-store.ts:4` ("the plane always loads a session before it saves it")      | 017                                     |
| Los ledgers en memoria no podan (F-047): el perfil local no aguanta un día de tráfico y nada lo dice                                                                                                              | `memory-decision-ledger.ts:9`, `memory-order-ledger.ts:9`, `memory-corroboration-ledger.ts:8`, `memory-assignment-ledger.ts:13`, `memory-exposure-ledger.ts:7` | 017                                     |
| Un registro corrupto del ledger hace que `rehydrate` lance dentro de un caso de uso (500 en órdenes de esa sesión o en la exposición de esa decisión) (F-050, refutado como defecto)                              | `src/domain/ledger/decision.ts:125,129`                                                                                                                        | 017                                     |
| Configuración resuelta una vez al arrancar: experimentos, políticas y merchants cambian con reinicio; un cambio de semilla o reparto con un experimento activo se detecta sólo como `assignment-drift` en el log  | `config-experiment-directory.ts:2`, `config-policy-directory.ts:3`, `config-merchant-directory.ts`                                                             | 014 (configuración por API, hot reload) |
| El nivel de sincronización observado se deriva de recibos por proceso: tras un reinicio vuelve a 0 hasta que lleguen snapshots                                                                                    | `memory-catalog-store.ts:17`                                                                                                                                   | 017                                     |
| Supuesto de instancia única (constitución IV, 01 §9) escrito en ningún archivo de `src/`: dedup por proceso, secciones síncronas como atomicidad, estado de sesión sin CAS                                        | `memory-event-dedup.ts:8`, `memory-order-ledger.ts:2-3`, `decision.service.ts:89`, `profiles/local.ts:1-4`                                                     | 017                                     |
| `DecisionService` a 259/300 líneas con 4 `Stryker disable`: flags (014) y catálogo de mensajes (015) agregan contexto al orquestador                                                                              | `src/application/decision/services/decision.service.ts`                                                                                                        | 014, 015                                |
| CORS deriva sus headers de todos los esquemas: cada credencial nueva de un consumidor no navegador (`portalSession`, `adminToken`) queda anunciada a los navegadores hasta que se distinga por consumidor (F-051) | `src/infrastructure/http/build-server.ts:183`                                                                                                                  | 014, 016                                |
| `Stryker restore` que no restaura: los cambios en `build-server.ts`, `condition.ts` y `signals.ts` entran sin que la mutación mire sus condicionales (F-052)                                                      | `build-server.ts:121`, `condition.ts:179`, `signals.ts:122`                                                                                                    | toda feature                            |

## 7. Estado global

(pendiente: fase 5)
