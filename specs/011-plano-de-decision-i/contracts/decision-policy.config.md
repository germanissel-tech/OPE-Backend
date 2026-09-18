# `OPE_MERCHANTS[i].decisionPolicy` — forma de la configuración

Opcional por merchant; ausente ⇒ política por defecto (`default-1`). La forma la valida
`composition/config.ts`; el vocabulario, los rangos y la permutación los validan
`BarrierRules.of` y `DecisionPolicy.of` (un `fail` es un `ConfigError` que nombra el campo).
La política es parte del experimento: cambiarla con un experimento activo es un experimento
nuevo (ADR-022, ADR-026) y `version` debe cambiar.

```json
{
  "merchantId": "m_sport",
  "ingestKeys": ["…"],
  "origins": ["https://sport.example"],
  "experiments": [
    { "experimentId": "exp_sport_1", "seed": "s1", "status": "active", "startedAt": "2026-09-01T00:00:00Z" }
  ],
  "decisionPolicy": {
    "version": "sport-2",
    "threshold": 0.6,
    "readingSeconds": 5,
    "weights": { "strong": 0.4, "supporting": 0.2 },
    "priority": ["returns", "fit", "price"],
    "highIntent": "from-checkout",
    "abandonment": "reassure-returns",
    "interventionsPerSession": 1,
    "evidence": { "freshStockAndPrice": ["price"], "availableVariant": ["fit"] },
    "rules": [
      {
        "id": "fit.size-selector-twice",
        "barrier": "fit",
        "strength": "strong",
        "when": {
          "all": [
            { "fact": "eventCount", "type": "size_selector_interacted", "min": 2 },
            { "not": { "fact": "sessionAddedToCart" } }
          ]
        }
      },
      {
        "id": "fit.size-guide-read",
        "barrier": "fit",
        "strength": "strong",
        "when": { "fact": "dwellSeconds", "block": "size_guide" }
      },
      {
        "id": "returns.cart-then-policies",
        "barrier": "returns",
        "strength": "strong",
        "when": {
          "fact": "sequence",
          "first": { "type": "added_to_cart" },
          "then": { "type": "block_dwelled", "subtype": "policies" }
        }
      },
      {
        "id": "price.cta-approached",
        "barrier": "price",
        "strength": "supporting",
        "weight": 0.25,
        "when": { "fact": "eventCount", "type": "cta_approached", "min": 1 }
      }
    ]
  }
}
```

| Campo                                                      | Forma (`config.ts`)                         | Regla (dominio)                                                    |
| ---------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| `version`                                                  | string                                      | no vacía                                                           |
| `threshold`                                                | number                                      | 0–1                                                                |
| `readingSeconds`                                           | number (default 5)                          | ≥ 0                                                                |
| `weights.strong` / `weights.supporting`                    | number (default 0.4 / 0.2)                  | 0–1                                                                |
| `priority`                                                 | string[]                                    | permutación exacta de `fit, price, returns`                        |
| `highIntent`                                               | `from-cart` \| `from-checkout` \| `never`   | —                                                                  |
| `abandonment`                                              | `nothing` \| `reassure-returns`             | —                                                                  |
| `interventionsPerSession`                                  | number                                      | entero ≥ 1                                                         |
| `evidence.freshStockAndPrice`, `evidence.availableVariant` | string[]                                    | ⊆ barreras                                                         |
| `rules[j].id`                                              | string                                      | no vacío, único                                                    |
| `rules[j].barrier`                                         | string                                      | ∈ barreras; toda barrera tiene ≥ 1 regla                           |
| `rules[j].strength`                                        | `strong` \| `supporting`                    | —                                                                  |
| `rules[j].weight`                                          | number, opcional                            | 0–1; reemplaza a `weights[strength]`                               |
| `rules[j].when`                                            | objeto `all`/`any`/`not`/`fact` (recursivo) | tipos, subtipos y bloques del vocabulario de `event.ts`; `min` ≥ 0 |

Predicados (`fact`): `eventCount { type, subtype?, min }`, `dwellSeconds { block, min? }`,
`sequence { first: { type, subtype? }, then: { type, subtype? } }`, `returnedToProduct`,
`productAttribute { key, value }`, `variantAvailable`, `sessionAddedToCart`,
`sessionEnteredCheckout`. Subtipos: `photo_interacted` (`zoom`, `navigate`), `block_dwelled`
(bloques), `cta_approached` (`hover`, `near`), `checkout_advanced` (pasos), `exit_signaled`
(señales de salida).
