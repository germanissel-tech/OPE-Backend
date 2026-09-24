---
paths:
  - "src/domain/**"
---

# Cómo se escribe una entidad (ADR-024, verificado por `lint`)

- **Clase si hay reglas, tipo si no.** Un concepto con invariantes o comportamiento
  (`EventBatch`, `Decision`, `Experiment`, `Merchant`, `Origin`) es una clase en
  `src/domain/<módulo>/<concepto>.ts` con `private constructor`, `static of(...)` que devuelve
  `Result<T, E>` con los errores de su `errors.ts` (si tenés la instancia, es válida) y
  `static rehydrate(record)` que reconstruye desde datos ya registrados **sin** reevaluar las
  reglas de creación. Un valor sin reglas (`Exposure`, `Assignment`, ids, `Arm`, `ServiceHealth`)
  sigue siendo un tipo; no se envuelve por uniformidad.
- **Las reglas viven con su dueño y se invocan por su nombre**: `experiment.assign(visitorId)`,
  `merchant.allowsOrigin(origin)`, `decision.isIntervention()`, `batch.noOpReason()`. Un caso de
  uso o servicio no reimplementa una regla del dominio. `src/domain/` no exporta funciones
  sueltas (`ope/domain-no-loose-functions`); la excepción declarada son las primitivas del
  `shared-kernel` (`ok`/`fail`, `seconds`/`minutes`/`hours`) y los constructores de identidad
  de cada módulo (`ids.ts`).
- **Estados ilegales irrepresentables**: `Decision` es `NoOpDecision | InterveneDecision`
  (discriminada por `outcome`; `NO_OP` lleva un `NoOpReason` del catálogo, `INTERVENE` su
  intervención). Fábricas `NoOpDecision.of` / `InterveneDecision.of`; `DecisionBase.rehydrate`.
- **Las invariantes se validan en su dueño; nadie las esquiva.** `composition/config.ts` parsea
  la forma del JSON y construye por fábrica; un `fail` es un `ConfigError` que nombra el campo
  (`merchants[i].experiments[j].treatmentShare`, `merchants[i].origins[k]`). Los gateways
  reciben entidades, nunca registros crudos. Los errores de configuración son `DomainError` y
  figuran en el catálogo de problemas aunque ningún endpoint los emita.
- **Una sola unidad para las tasas (ADR-035)**: toda tasa es una fracción de 1, en el contrato, en
  la semilla, en los niveles del release y en el dominio. No hay porcentajes 0–100 en ninguna parte y
  el backend **no convierte formatos**: recibe fracciones y entrega fracciones
  (`treatmentShare`, `holdoutShare`, `maxIncentiveShare`, `incentiveLadderShare`, `marginShare`,
  los `cuts` de un experimento, `Incentive.value`). Cómo se muestre un 5 % en un frontend o en un
  reporte no es problema del backend. `isRate`/`isCount` del `shared-kernel` juzgan los números;
  ser entero no es una regla de ninguna tasa. La única constante que vale 100 es
  `ASSIGNMENT_BUCKETS` (`domain/experiment/`) y **no es una conversión**: es la resolución del
  reparto, y el día que quiera ser más fina ese número cambia y nada más cambia.
  **Y sólo las tasas que el reparto puede repartir** (ADR-035, enmienda de la feature 023): una tasa
  que algo cuantiza tiene que ser **exactamente** la que su balde representa, y si no lo es se
  rechaza nombrándola en vez de ajustarse en silencio — `0.004` repartía a nadie. Lo juzga
  `Experiment.handsOut(share)`, el dueño de la resolución, y alcanza a los dos campos que pasan por
  `bucketsOf`: `treatmentShare` (`422 treatment-share-too-fine`) y `holdoutShare`
  (`invalid-configuration-value`). Los `cuts` y las tres tasas comerciales **no**: nadie las
  cuantiza. La regla no se escribe con `multipleOf` ni con un epsilon; los dos están medidos y
  descartados en el ADR.
- **Políticas publicadas en el contrato**: el gateway las recibe, no las decide. La ventana de
  deduplicación es un valor del nivel de plataforma que la composición le pasa
  (`memoryEventDedup(clock, platform.dedupWindow)`); su directorio de políticas en aplicación
  desapareció con la constitución XI (ADR-031, feature 017) y esta línea decía lo contrario que
  la convención de los tres niveles.
- **Todo puerto devuelve `Promise`**; los gateways en memoria devuelven `Promise.resolve(...)`.
- La guarda de instantes no parseables (`NaN`) vive en la traducción DTO → dominio del
  controller (error de programación), no en el dominio.
