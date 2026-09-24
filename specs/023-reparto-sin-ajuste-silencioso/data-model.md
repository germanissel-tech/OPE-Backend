# Data model — El reparto no se ajusta en silencio (023)

No hay entidades nuevas. Hay **una regla nueva** con dueño, **un error nuevo** y **dos campos** que
pasan a estar sujetos a ella.

## La regla: una tasa declarable

|                     |                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **Dónde vive**      | `Experiment`, como método estático, junto a `ASSIGNMENT_BUCKETS` y `bucketsOf` (R-02)     |
| **Qué dice**        | Una tasa es declarable si vuelve a ser ella misma después de pasar por su balde           |
| **Cómo se juzga**   | `bucketsOf(share) / ASSIGNMENT_BUCKETS === share` — sin epsilon y sin número nuevo (R-01) |
| **Quién la invoca** | `Experiment.of` para el reparto; `TreatmentValues.judge` para el holdout                  |
| **Qué no hace**     | No redondea, no ajusta, no sugiere. Responde sí o no                                      |

Es una regla de **creación**: `Experiment.rehydrate` no la evalúa (R-05, ADR-024).

### Qué acepta y qué rechaza

| entra                            | sale    | por qué                                                                    |
| -------------------------------- | ------- | -------------------------------------------------------------------------- |
| `0`                              | acepta  | cero baldes, exacto: un experimento que no asigna a nadie es legítimo      |
| `1`                              | acepta  | cien baldes, exacto: un experimento sin control es legítimo                |
| `0.07`                           | acepta  | siete baldes exactos, aunque `0.07 / 0.01` dé `7.000000000000001`          |
| los 101 valores de dos decimales | acepta  | verificado uno por uno, calculados y como literales JSON                   |
| `0.004`                          | rechaza | cero baldes: repartiría a nadie                                            |
| `0.005`                          | rechaza | un balde: repartiría el doble de lo declarado                              |
| `0.075`                          | rechaza | ocho baldes: repartiría más de lo declarado                                |
| `0.999`                          | rechaza | cien baldes: repartiría a todos                                            |
| `0.30000000000000004`            | rechaza | no es el mismo doble que `0.3`; aceptarlo sería ajustar en silencio (R-01) |

## El error nuevo

|               |                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------- |
| **Clase**     | en `src/domain/experiment/errors.ts`, extiende `DomainError`, entra en la unión del módulo     |
| **`code`**    | `treatment-share-too-fine`                                                                     |
| **`module`**  | `experiment`                                                                                   |
| **Catálogo**  | entrada nueva en `contracts/problem-types.yaml`, status `422`, título que dice la regla        |
| **`details`** | la tasa que se declaró; nunca una sugerencia de reemplazo (research, «lo que no se investigó») |
| **Prueba**    | `[invariant:treatment-share-too-fine]`, que `check:invariant-tests` exige                      |

No reemplaza a `invalid-treatment-share`, que sigue siendo el de fuera de rango (R-03).

## Los dos campos sujetos a la regla

### `treatmentShare` — el reparto del experimento

|                             |                                                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Quién lo juzga**          | `Experiment.of`, después del rango y antes que el resto                                                                            |
| **Por dónde entra**         | la API de administración (`createExperiment`) y la semilla (`OPE_MERCHANTS[i].experiments[]`)                                      |
| **Qué devuelve el rechazo** | `422 treatment-share-too-fine` por la API; un `ConfigError` que nombra `merchants[i].experiments[j].treatmentShare` en el arranque |
| **Invariante del contrato** | `x-invariants` sobre `ExperimentCreate`                                                                                            |

### `holdoutShare` — el holdout del merchant

|                             |                                                                                                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quién lo juzga**          | `TreatmentValues.judge`, junto a `isRate`                                                                                                                                                     |
| **Por dónde entra**         | `config/treatment-defaults.json`, la versión que publica el merchant, la semilla                                                                                                              |
| **Qué devuelve el rechazo** | `InvalidConfigurationValue("holdoutShare", …)` ⇒ `422 invalid-configuration-value`; un `ConfigError` que nombra `treatmentDefaults.holdoutShare` o `merchants[i].holdoutShare` en el arranque |
| **Invariante del contrato** | ninguna nueva: la configuración ya declara `invalid-configuration-value`                                                                                                                      |

## Lo que **no** queda sujeto a la regla

Ninguna otra tasa del sistema se cuantiza, así que ninguna la lleva (R-06):

| tasa                     | quién la consume               | por qué no                              |
| ------------------------ | ------------------------------ | --------------------------------------- |
| `cuts[]` del experimento | se guardan y se publican       | ningún algoritmo las convierte a baldes |
| `maxIncentiveShare`      | techo de la política comercial | se compara, no se cuantiza              |
| `incentiveLadderShare[]` | escalones                      | el escalón sale con la tasa declarada   |
| `marginShare`            | margen                         | se compara, no se cuantiza              |

Que un margen de `0.375` siga siendo válido **es** un criterio de éxito (SC-007): mide que la
feature no se derramó.

## Lo que no cambia

- El algoritmo de asignación (`Experiment.assign`) y su huella.
- `bucketsOf` y la comparación de `withinHoldout`, que se queda en baldes por lo medido en la 022.
- `ASSIGNMENT_BUCKETS`: el valor y el lugar donde vive.
- `isRate`, que sigue juzgando el rango de toda tasa del sistema.
