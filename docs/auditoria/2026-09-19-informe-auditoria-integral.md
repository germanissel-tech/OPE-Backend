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

(pendiente: fase 4)

## 4. Matriz de cumplimiento

### 4.1 Constitución I–X

(pendiente: fase 4)

### 4.2 Criterios de aceptación de 03 §10

(pendiente: fase 4)

### 4.3 Documentos del MVP

(pendiente: fase 4)

### 4.4 Specs 001–013

(pendiente: fase 4)

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
