# Data model — cambios de modelo de la 015

Sólo lo que cambia de forma; el resto del dominio queda como la 009–013 lo dejó (ADR-024).

## `Merchant` (dominio `merchant`) — F-007, F-053

- `Merchant.of(input)` rechaza, en este orden, con errores del módulo (código del catálogo,
  ADR-023): `ingestKeys` vacío, con más de dos o con una clave vacía ⇒ `invalid-ingest-keys`
  (`details.index` cuando aplica); `origins` vacío ⇒ `invalid-origins`; un origen no parseable
  ⇒ `invalid-origin` (existente, `index`); `platformKeys` más de dos, vacío o igual a una clave
  de ingesta ⇒ `invalid-platform-keys` / `platform-key-collision` (existente); `platformSecrets`
  más de dos, vacío o igual a una clave ⇒ `invalid-platform-secrets` / `invalid-platform-secret`
  (existente). `rehydrate` no juzga.
- `ownsPlatformKey(key)` compara en tiempo constante (`constantTimeEquals`, shared-kernel);
  `owns(key)` (clave pública) no cambia.
- `config.ts` deja de contar claves y orígenes: parsea forma (arrays de strings) y traduce el
  `DomainError` a `ConfigError` con el campo (`merchants[i].ingestKeys`, `…origins[k]`).

## `Experiments` (dominio `experiment`, nuevo valor con reglas) — F-007

- `Experiments.of(records: readonly ExperimentRecord[]): Result<Experiments, ExperimentError>`:
  cada registro por `Experiment.of` (reglas existentes), ids únicos ⇒ `duplicate-experiment-id`
  (`details.index`), como máximo uno activo ⇒ `multiple-active-experiments` (`details.index`
  del segundo). `rehydrate(experiments)`. `active(): Experiment | undefined`, `all()`.
- `configExperimentDirectory` recibe `Experiments` por merchant y responde `active()`; el
  patrón de `experimentId` sigue siendo forma del contrato en `config.ts`.

## `CommercialPolicy` (dominio `commercial`) — F-031

| Campo (antes)              | Campo (después)          | Rango | Borde (config JSON → dominio) | Borde (dominio → DTO/ledger)                |
| -------------------------- | ------------------------ | ----- | ----------------------------- | ------------------------------------------- |
| `maxIncentivePercent`      | `maxIncentiveShare`      | 0–1   | `maxIncentivePercent / 100`   | —                                           |
| `incentiveLadderPercent[]` | `incentiveLadderShare[]` | 0–1   | `/ 100` cada uno              | `Incentive.value = Math.round(share * 100)` |
| `marginPercent?`           | `marginShare?`           | 0–1   | `/ 100`                       | —                                           |

- Invariantes de `of`: `version` no vacía; techo `isRate`; escalera estrictamente creciente,
  cada escalón `> 0` y `≤ techo` (en tasas; la resolución a entero se valida en el borde: el
  JSON exige enteros 0–100, forma); margen ausente o `isRate`; el resto sin cambio. Errores:
  mismos códigos, mensajes en términos de tasa.
- `DEFAULT_COMMERCIAL_POLICY`: `maxIncentiveShare: 0.1`, `incentiveLadderShare: [0.05, 0.1]`.
- `Incentive { kind: "percent", value: entero 0–100 }` (shared-kernel, DTO y ledger) no cambia.

## `Claim` (dominio `selection`) — F-038

`Claim = { kind: "returns-policy" } | { kind: "fit-data" } | { kind: "current-price" } |
{ kind: "availability" } | { kind: "incentive" } | { kind: "product-attribute"; key: string }`.
`CANDIDATES` se escribe con objetos; `QualityGate.#unsupported` agota `kind` sin `default`.

## `SecurityScheme` (adaptador HTTP) — F-051

`{ handler: SecurityHandler; header: string; consumer: "browser" | "server" }`. CORS deriva
sus headers de los esquemas `browser`. `modules/merchant.ts`: `ingestKey` → `browser`,
`platformKey` → `server`.

## `CatalogStore.replace` (puerto) — F-044

`replace(merchantId, snapshot): Promise<Result<void, LedgerUnavailable>>`; el caso de uso
devuelve `fail(LedgerUnavailable)` ⇒ `503` con `Retry-After` (`HEADERS_BY_CODE`).

## Shared-kernel — F-030, F-053, F-048

- `rate.ts`: `isRate(n)` (finito, 0 ≤ n ≤ 1), `isCount(n)` (finito, n ≥ 0).
- `compare.ts`: `constantTimeEquals(a: string, b: string): boolean`.
- `time.ts`: `CLOCK_SKEW_TOLERANCE_MS = minutes(5)`.

## Ventana acotada por merchant (gateways `shared-kernel`) — F-033

`windowedByMerchant<K, V>({ ttlMs, max }, touchedAt: (v: V) => number)` → `{ bucket(merchantId),
expire(entries, now) }`; `memory-event-dedup`, `memory-session-state-store` y
`memory-visitor-state-store` conservan su API de puerto.

## Cierre de hallazgos (`docs/auditoria/trabajo/hallazgos/fase-N.json`) — R-14

`closure?: { status: "resolved" | "absorbed-by" | "rejected"; by: string; feature: "015" }`
(`by`: hash del commit, `F-NNN` o motivo). Campo opcional en `audit-finding.schema.json`;
`verify-finding` lo ignora.
