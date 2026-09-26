# Data model — El ledger sobrevive a un reinicio (030)

No hay entidades nuevas: las que se guardan ya existen en el dominio y ya viajan por puertos. Lo que
esta feature agrega es **dónde viven** y **cómo se las vuelve a leer**.

## Lo que se vuelve durable, y por qué cada uno

| Entidad           | Puerto                | Lecturas que el puerto ya pide | Qué se pierde hoy en un reinicio                     |
| ----------------- | --------------------- | ------------------------------ | ---------------------------------------------------- |
| **Decisión**      | `DecisionLedger`      | por identificador · por sesión | el razonamiento entero del experimento               |
| **Exposición**    | `ExposureLedger`      | por decisión                   | qué se mostró de verdad, y su idempotencia           |
| **Orden**         | `OrderLedger`         | por identificador de orden     | la cifra económica y su devolución                   |
| **Corroboración** | `CorroborationLedger` | por orden                      | la evidencia que sostiene la atribución              |
| **Asignación**    | `AssignmentLedger`    | por visitante                  | en qué brazo cayó cada visitante                     |
| **Instantánea**   | `CatalogStore`        | la actual · los recibos        | la tienda deja de intervenir hasta que se republique |

**Las asignaciones importan más de lo que parece.** Sin ellas, un visitante que vuelve después de un
reinicio se reasigna, y la asignación es **estable por visitante** por diseño (ADR-022): reasignarlo
lo puede mover de brazo y contaminar la medición. Es el caso donde perder el registro no sólo borra
información: **cambia el comportamiento**.

## La forma en el almacén

Una tabla por entidad. En cada una, **columnas sólo para lo que se busca** —el merchant y la clave de
la lectura— y el registro completo como documento.

| Columna             | Por qué es columna                                               |
| ------------------- | ---------------------------------------------------------------- |
| merchant            | toda lectura lo toma; es la garantía de aislamiento (V)          |
| la clave de lectura | lo que el puerto busca: identificador, sesión, orden o visitante |
| el registro         | lo demás, tal como el dominio lo tiene                           |

**Por qué no se desarma cada entidad en columnas**: el ledger es **inmutable y append-only**, así que
no hay actualizaciones parciales que lo justifiquen; y desarmarlo obligaría a mantener dos formas del
mismo dominio, que es la duplicación que ADR-024 evita en el código. Lo que se lee tiene que ser
idéntico a lo que se escribió (FR-001), y eso es lo único que el plan promete sobre el formato.

## El esquema y su versión

- **Versionado en el repositorio** (FR-007): la forma de los datos se revisa en una PR como cualquier
  otro cambio.
- **El arranque se niega** si el esquema no es el que el código espera, y dice qué esperaba (FR-006).
  Es la misma regla que ya rige para la configuración y para la semilla: arrancar sobre algo que no se
  entiende es peor que no arrancar.
- **Sin migración de datos**: no hay nada en producción, así que la primera versión no convive con
  ninguna anterior.

## Lo que NO cambia

- **Ningún puerto cambia de forma.** Siguen devolviendo `Result` con su canal de fallo (ADR-021), y
  `LedgerUnavailable` sigue significando lo mismo.
- **Ninguna entidad del dominio cambia.** El ledger no gana campos por volverse durable (FR-011).
- **El estado de sesión y de visitante sigue en memoria**: es la feature siguiente del hito, y con ella
  viene la atomicidad del presupuesto.
- **La configuración, los merchants y los experimentos siguen reconstruyéndose de la semilla.**
