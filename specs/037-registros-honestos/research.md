# Investigación — Registros honestos y lineamiento de persistencia

Fase 0 del plan. Seis preguntas; todas se responden leyendo el código del repo al 2026-10-02 y las
decisiones que ya están escritas. Las citas de línea son de ese día.

## R-01 — El inventario: qué registros tienen partes que son clases, y cuáles se guardan

La spec encontró tres entidades leyendo los gateways. El inventario se hizo al revés, desde el dominio:
toda clase exportada de `src/domain/`, y todo campo de un tipo o interfaz cuyo tipo es una de ellas.

**Campos de clase que viajan por un documento** (se escriben con `toDocument` y vuelven con
`fromDocument`):

| Dónde                                                  | Campo                                            | Clase                                                   | Quién lo lee del almacén                                          |
| ------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------- |
| `domain/outcomes/order.ts`, `OrderFacts`/`OrderRecord` | `total`; `correlation`, `redemption`, `returned` | `Money`; `Correlation`, `IncentiveRedemption`, `Return` | `sqlite-order-ledger.ts`, que hoy rehidrata las cuatro a mano     |
| `domain/merchant/merchant.ts`, `MerchantRecord`        | `origins`                                        | `Origin[]`                                              | `sqlite-merchant-store.ts`, con el tipo auxiliar `StoredMerchant` |
| `domain/catalog/catalog-snapshot.ts`, `Variant`        | `price`                                          | `Money`                                                 | `sqlite-catalog-store.ts`, que **no rehidrata nada**              |
| `domain/ingestion/event.ts`, `Event`                   | `price?`                                         | `Money`                                                 | `sqlite-event-log.ts`, que **no rehidrata nada**                  |

El cuarto es nuevo respecto de la spec. Un evento con precio se escribe en el registro de eventos
dentro de `RecordedEvent` y vuelve con `as RecordedEvent`; su precio vuelve plano. Ningún lector del
registro usa hoy ese precio —la reconstrucción del estado caliente lee tipos y señales—, así que es el
mismo caso que el catálogo: el tipo miente y nadie lo ha pisado.

**Campos de clase que no viajan por un documento** y por eso quedan fuera: `SessionStateRecord.signals`
(estado caliente, sólo en memoria, se reconstruye desde el registro y el ledger), `DecisionPolicyRecord.rules`,
`Condition.signals`, `CommercialPolicy.facts` y las partes de `EffectiveConfiguration` (se construyen al
resolver, desde datos planos que sí se guardan; ninguna se escribe como clase). `MerchantConfigurationVersion`
y `LevelVersion` guardan sólo datos planos y construyen `AnchorMap` y `AttributeLabels` cuando los piden.

**Las partes de las partes.** `CorrelationRecord`, `IncentiveRedemptionRecord` y `ReturnRecord` ya son
planos: `DecisionExperiment`, `Incentive`, `Granted` y `OrderItem` son tipos sin métodos. La conversión
del pedido termina en sus cuatro partes y no sigue bajando.

**Los catorce casts** de los gateways durables, por lo que apuntan: diez apuntan a registros sin partes de
clase (`DecisionRecord`, `ExperimentRecord`, `CorroborationRecord`, `LevelVersionRecord`,
`MerchantConfigurationVersionRecord`, `Exposure`, `Assignment`, `AdminEntry`, `AnchorDiagnostic`,
`UnmappedAttributeValue`) y dicen la verdad; los cuatro de la tabla mienten. Ninguno más.

**Decisión**: la feature alcanza a cuatro tipos, no a tres. FR-010 lo preveía.

## R-02 — Dónde va cada conversión: constructor, o declarar el dato plano

La spec deja dos formas válidas y ADR-024 dice cuándo corresponde cada una: **clase si hay reglas, tipo
si no**. La pregunta por tipo es si el dueño le aplica a esa parte alguna regla de su clase.

| Tipo                 | ¿Alguien usa un método de la parte?                                                                                                 | Forma elegida                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `Order`              | Sí: `Return.sameContentAs` decide si una devolución es repetida; `Correlation` e `IncentiveRedemption` tienen comportamiento propio | **Convierte en el constructor** |
| `Merchant`           | Sí: `Origin.equals` dentro de `allowsOrigin`, en el borde CORS de cada petición                                                     | **Convierte en el constructor** |
| `Variant` (catálogo) | No: el catálogo lee `amount` y `currency` para la huella del snapshot; la verdad de producto y la selección leen campos             | **Declara `MoneyRecord`**       |
| `Event` (ingesta)    | No: nadie lee el precio de un evento después de la ingesta                                                                          | **Declara `MoneyRecord`**       |

**Por qué no convertir en los cuatro, por uniformidad.** `Variant` y `Event` son tipos, no entidades: no
tienen constructor donde poner la conversión, y envolverlos en una clase para eso es exactamente lo
que ADR-024 prohíbe («no se envuelve por uniformidad»). Y hay un costo real en uno de los dos: el
catálogo se construye en cada lectura del despliegue durable (R-05).

**Por qué no declarar plano en los cuatro.** Porque en pedido y merchant las reglas se usan, y un tipo
plano obligaría a cada lector a rehidratar en el sitio de uso: es mover el problema del gateway al
servicio, no resolverlo.

**Lo que esto le hace a los controllers.** Tres sitios envuelven hoy un dato validado por el contrato
en `Money.rehydrate` para entregarlo a un tipo que declaraba la clase: el catálogo
(`upsert-catalog-snapshot.ts`), la ingesta (`ingest-events.ts`) y la notificación de pedido
(`notify-order.ts`). Con el registro plano, el dato del contrato ya tiene la forma: los tres dejan de
envolver. En el pedido es el constructor quien convierte; en los otros dos nadie, y es correcto.

**Decisión**: constructor en `Order` y `Merchant`; `MoneyRecord` en `Variant.price` y `Event.price`.

## R-03 — Qué pasa con lo que ya construye entidades pasando clases

Hay 63 sitios fuera del dominio que construyen o rehidratan estas entidades, casi todos en pruebas,
y hoy pasan instancias. **Ninguno cambia**, por tipado estructural: una instancia de `Money` tiene
`amount` y `currency`, así que cumple con `MoneyRecord`; un `Origin` tiene `value`, así que cumple con
`OriginRecord`. El compilador acepta la instancia donde el registro pide el dato plano.

Dos consecuencias que hay que verificar y no suponer:

- **La conversión tiene que ser idempotente.** `Money.rehydrate(money)` construye un `Money` nuevo con
  los mismos datos; `Origin.rehydrate(origin.value)` igual. Una copia de la entidad (`withReturn`,
  `rotated`, `deactivated`) pasa por `record()` y por el constructor, y vuelve a convertir partes que ya
  eran clases. El resultado es igual por valor, que es lo único que un objeto de valor promete.
  FR-005 lo exige y la prueba unitaria lo fija.
- **Lo que se escribe no cambia.** `record()` devuelve las instancias, `toDocument` las serializa por
  sus campos, y el texto es el mismo que hoy. Un almacén escrito antes de la feature se lee con ella.
  **No hay migración.**

El costo de convertir en cada copia es una asignación por parte en operaciones de administración
(merchant) y de la plataforma (pedido). Ninguna está en el camino de decisión.

## R-04 — Cómo se demuestra que «un campo sin conversión no compila»

El repo ya tiene la convención: `tests/types/*.test-d.ts`, archivos que `npm run typecheck` compila y
nadie ejecuta, con `@ts-expect-error` **con descripción** (el lint rechaza uno sin ella). Es como se
fijó que un `Claim` no es una cadena suelta.

`tests/types/records.test-d.ts` fija dos cosas: que un `MoneyRecord` no es asignable a `Money` (y un
`OriginRecord` a `Origin`), que es la propiedad de la que depende toda la protección; y que un
`OrderRecord` leído plano se acepta en `Order.rehydrate` tal cual, que es lo que hace verdadero el cast
del gateway.

Lo que **no** se puede fijar con un archivo de tipos es «agregar un campo nuevo falla»: no hay forma de
escribir un campo que no existe. Lo que se fija es la propiedad que lo garantiza, y el razonamiento
queda en el ADR: un campo `nuevo: XRecord` en el registro y `readonly nuevo: X` en la clase no compilan
hasta que el constructor escriba `X.rehydrate(record.nuevo)`.

**Decisión**: archivo de tipos nuevo, con la convención existente.

## R-05 — El catálogo en el camino de decisión

`ProductTruth` pide `store.current(merchantId)` en cada decisión que consulta evidencia de producto. En
el despliegue durable eso es una lectura del almacén y un `JSON.parse` del snapshot entero, en cada
decisión: es un costo que ya existe y que esta feature no toca. Convertir el precio de cada variante
agregaría una asignación por variante **sobre** ese costo, en cada lectura.

R-02 ya decidió no convertir porque nadie aplica una regla de `Money` a ese precio. Lo que esta pregunta
agrega es que la alternativa no era neutra: declarar plano es la forma que cuesta cero y además la
honesta. La medición de latencia de ingesta de `tests/durability/ingest-latency.test.ts` corre igual
como confirmación de SC-005, en la misma máquina y la misma corrida, y lo esperable es que no muestre
diferencia alguna.

**Lo que cambia en la prueba de durabilidad del catálogo.** El escenario de la spec pedía que un precio
leído «responda a `equals`». Con el dato plano, el caso nuevo afirma lo que la feature promete: que el
precio **vuelve** con sus dos campos y que `Money.rehydrate(variant.price).equals(...)` contesta
verdadero, que es exactamente lo que haría cualquier consumidor futuro que necesite la regla. Hoy ese
caso no existe; con el código actual pasaría también, y eso está bien: lo que lo hace valer es que el
tipo que declara `variant.price` ya no promete más de lo que hay.

**Decisión**: `Variant.price: MoneyRecord`, sin conversión; SC-005 como confirmación.

## R-06 — Qué dice la documentación hoy, y qué tiene que decir

- **ADR nuevo, `043`.** No hay ADR que diga qué es `SqlStore`. ADR-038 dice por qué la escritura queda
  en el camino crítico; ADR-042 dice que el turno «desaparece con PostgreSQL» pero no por qué la
  abstracción no se comparte. Lo que la evaluación estableció y ningún ADR dice son las cuatro
  decisiones de FR-014, y las cuatro abstracciones descartadas de FR-015. Cita a ADR-021, ADR-024,
  ADR-038, ADR-041 y ADR-042 sin reemplazar ninguno. Su `fuente` es esta spec y este research.
- **`.claude/rules/gateway-durable.md`.** El cuarto punto dice hoy «al leer, toda clase anidada se
  rehidrata» y señala el gateway de pedidos como ejemplo. Pasa a decir que la entidad vuelve sola de su
  registro con `rehydrate` sobre el documento, que el gateway no nombra ninguna parte, y que si una
  parte vuelve plana el defecto está en el registro de la entidad, no en el gateway. Gana una sección
  nueva, «Qué no se abstrae», con las cuatro abstracciones y el motivo de una línea cada una.
- **`.claude/rules/entidad.md`.** El primer punto gana una viñeta: cómo declara un registro una parte
  que es una clase (su registro plano), dónde va la conversión (el constructor), y que guardar sólo
  datos planos y construir al pedirlos es la otra forma válida, con `MerchantConfigurationVersion` como
  ejemplo.
- **`scripts/instructions-policy.json`.** La sección nueva de la regla de gateways tiene que
  declararse con su clase (normativa), o `check:instructions` falla. La regla de entidades no gana
  sección.
- **`docs/deudas.md`.** Tres entradas, con su fila y su historia al final como pide el registro:
  **D-33**, una lectura durable que falla responde `500 internal-error` en vez de `503` con reintento
  (fuera de esta feature: toca el contrato y casi todos los casos de uso); **D-21 ampliada**, no una
  deuda nueva, con lo que PostgreSQL tiene que resolver y hoy no está listado; **D-34**, los dos
  almacenes de versiones son copia literal y lo que la cierra es un tercero.

**Decisión**: lo anterior, tal cual. Ninguna sección de `CLAUDE.md` cambia: los punteros a las dos
reglas ya existen y siguen siendo ciertos.

## Lo que esta investigación deja anotado

- **El inventario manda sobre la spec**: cuatro tipos y no tres, y FR-010 existía para eso.
- **Dos formas, no una**, y la regla de entidades las nombra a las dos para que la próxima entidad no
  convierta por uniformidad lo que nadie usa.
- **Nada de esta feature necesita medir para decidir.** La medición de SC-005 confirma una decisión que
  ya está tomada por lectura del código.
