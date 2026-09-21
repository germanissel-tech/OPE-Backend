# Contrato — Los tres niveles de configuración y el código (US2) (R-03, R-04, R-09)

## Archivos del release

`config/platform.json`:

```json
{
  "version": "platform-1",
  "dedupWindow": { "ttlMs": 86400000, "maxIds": 100000 },
  "clockSkewToleranceMs": 300000,
  "sessionWindowMs": 86400000,
  "visitorWindowMs": 86400000,
  "signatureWindowMs": 300000,
  "rotationGraceMaxMs": 604800000,
  "anchorDiagnosticsKept": 200
}
```

`config/treatment-defaults.json`:

```json
{
  "version": "defaults-1",
  "freshness": { "catalogMs": 129600000, "stockAndPriceMs": 900000 },
  "syncLevel": {
    "receiptsKept": 8,
    "noDataAfterMs": 129600000,
    "minutesLevelMaxAgeMs": 3600000,
    "minutesLevelMedianIntervalMs": 900000,
    "minutesLevelMinReceipts": 3
  },
  "decisionPolicy": { "version": "default-1", "...": "el contenido actual de default-policy.ts" },
  "commercialPolicy": {
    "version": "commercial-default-1",
    "...": "el contenido actual de default-commercial-policy.ts"
  },
  "evidenceProfile": {},
  "surfaces": ["product", "cart"],
  "barriers": ["fit", "price", "returns"],
  "syncStrategy": { "catalog": "push", "stockAndPrice": "push", "orders": "push", "returns": "push" },
  "locales": { "supported": [] }
}
```

Los valores son **los de hoy**: el comportamiento observable no cambia (todas las pruebas de
integración existentes siguen verdes sin tocar sus expectativas). Los milisegundos se escriben
como números; el kernel sigue exportando `seconds`/`minutes`/`hours` para las pruebas.

## Qué sale del código

| Hoy                                                                                   | Va a                                              | Quién lo lee después                                                                                            |
| ------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `application/catalog/policies/freshness.ts` (`FRESHNESS_BUDGET`)                      | defaults `freshness`                              | `ProductTruthService` por `CatalogPolicies.freshnessFor(merchantId)`                                            |
| `application/catalog/policies/sync-level.ts` (umbrales, `RECEIPTS_KEPT`)              | defaults `syncLevel`                              | `ProductTruthService`/`CatalogStore` por `CatalogPolicies.syncLevelRulesFor` (el algoritmo de la mediana queda) |
| `application/ingestion/policies/dedup-window.ts` (`DEDUP_WINDOW`)                     | plataforma `dedupWindow`                          | `memoryEventDedup` recibe la ventana por `IngestionPolicies` en la composición                                  |
| `application/decision/policies/{session,visitor}-window.ts`                           | plataforma                                        | los state stores reciben la ventana en la composición                                                           |
| `application/merchant/policies/signature-window.ts`                                   | plataforma `signatureWindowMs`                    | `DefaultPlatformSignatureVerifier`                                                                              |
| `domain/shared-kernel/time.ts` `CLOCK_SKEW_TOLERANCE_MS`                              | plataforma `clockSkewToleranceMs`                 | `Order.of` y `EventBatch.of` reciben la tolerancia como argumento (regla del dominio con el valor de fuera)     |
| `domain/decision/default-policy.ts`, `domain/commercial/default-commercial-policy.ts` | defaults                                          | el servicio de configuración construye las políticas con las fábricas                                           |
| `composition/config.ts` (`DEFAULT_TREATMENT_PERCENT`)                                 | se elimina: la semilla y la API exigen el reparto | —                                                                                                               |

Lo que queda en `src/`: invariantes (`isRate`, escaleras, techos), algoritmos (FNV-1a,
buckets, mediana), literales del contrato (`BARRIERS`, `ANCHORS`, `CANDIDATES`, motivos) y
constantes de la plataforma que no son política (puertos, señales, headers, `bodyLimit`
del servidor — que es de despliegue, no de tratamiento). El gate `no-magic-numbers` y
`ope/no-magic-strings` siguen; una prueba de gobernanza (`tests/governance/behaviour-constants.test.ts`)
verifica que los archivos de la tabla ya no existen y que ninguna constante con esos nombres
vuelve a `src/`.

## Resolución

`EffectiveConfiguration` = para cada campo de `TreatmentDefaults`: el valor declarado en la
versión vigente del merchant si existe, si no el default; más `anchors` del merchant (sin
default) y los valores de plataforma. `versions = { platform, defaults, merchant? }`.
Se recalcula en `publish` e `import`; el servicio la guarda por merchant en memoria y la
sirve a los puertos de lectura sin `await` real (`Promise.resolve`).

## Lo que la decisión registra

`DecisionFacts.configuration = versions`; `DecisionFacts.phase = "calibration"` cuando el
experimento abierto está `calibrating`. El DTO `Decision` del SDK **no cambia**.

## Validación en la construcción del release

`tests/unit/configuration/release-levels.test.ts` (proyecto `fast`, corre en CI): carga los
dos archivos reales por el gateway, exige que `PlatformConfiguration.of` y
`TreatmentDefaults.of` devuelvan `ok`, y que `barriers ⊆ BARRIERS`, los candidatos y claims
de las políticas ∈ `CANDIDATES`, los motivos ∈ catálogo, `syncStrategy` ∈ `SyncMode`, y que
`decisionPolicy.version` y `commercialPolicy.version` no cambien sin cambiar `version` del
archivo (fingerprint del contenido guardado en la prueba, como la regresión de la 007).
