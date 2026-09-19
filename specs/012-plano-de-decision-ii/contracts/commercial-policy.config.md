# `OPE_MERCHANTS[i].commercialPolicy` y `evidenceProfile` — forma de la configuración

Ambos opcionales. Sin `commercialPolicy` ⇒ `commercial-default-1` (techo 10, escalones
[5, 10], sin margen ⇒ sin incentivos, incentivo directo en precio, riesgo de devolución = duda
de talle + lectura de políticas, alta intención desde checkout, abandono ⇒ reaseguro, 1 por
sesión, cooldown 0, 3 por visitante y día). Sin `evidenceProfile` ⇒ todo falso: ningún
candidato con claim pasa el gate (fail-closed).

```json
{
  "merchantId": "m_sport",
  "evidenceProfile": { "returnsPolicy": true, "fitData": false, "authorizedAttributes": ["material", "fit"] },
  "commercialPolicy": {
    "version": "sport-commercial-1",
    "maxIncentivePercent": 15,
    "incentiveLadderPercent": [5, 10, 15],
    "marginPercent": 40,
    "directIncentiveOnPrice": true,
    "returnRisk": {
      "all": [
        { "fact": "eventCount", "type": "size_selector_interacted", "min": 2 },
        { "fact": "dwellSeconds", "block": "policies" }
      ]
    },
    "highIntent": "from-checkout",
    "abandonment": "reassure-returns",
    "interventionsPerSession": 1,
    "cooldownSeconds": 0,
    "interventionsPerVisitorPerDay": 3
  }
}
```

| Campo                                  | Forma (`config.ts`)                        | Regla (dominio)                                     |
| -------------------------------------- | ------------------------------------------ | --------------------------------------------------- |
| `version`                              | string                                     | no vacía                                            |
| `maxIncentivePercent`                  | number                                     | entero 0–100                                        |
| `incentiveLadderPercent`               | number[]                                   | enteros estrictamente crecientes, cada uno 1..techo |
| `marginPercent`                        | number, opcional                           | 0–100; ausente ⇒ sin incentivos                     |
| `directIncentiveOnPrice`               | boolean                                    | —                                                   |
| `returnRisk`                           | condición (misma forma que `rules[].when`) | vocabulario cerrado de hechos                       |
| `highIntent`                           | `from-cart` \| `from-checkout` \| `never`  | —                                                   |
| `abandonment`                          | `nothing` \| `reassure-returns`            | —                                                   |
| `interventionsPerSession`              | number                                     | entero ≥ 1                                          |
| `cooldownSeconds`                      | number                                     | ≥ 0                                                 |
| `interventionsPerVisitorPerDay`        | number                                     | entero ≥ 1                                          |
| `evidenceProfile.returnsPolicy`        | boolean                                    | —                                                   |
| `evidenceProfile.fitData`              | boolean                                    | —                                                   |
| `evidenceProfile.authorizedAttributes` | string[]                                   | —                                                   |

`decisionPolicy` (011) pierde `highIntent`, `abandonment` e `interventionsPerSession`. Hoy el
parser ignora los campos que no conoce; la 012 rechaza esos tres en `decisionPolicy` con
`ConfigError` nombrando el campo, para que nadie crea que siguen vigentes ahí.
