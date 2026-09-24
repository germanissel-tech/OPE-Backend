---
numero: 035
titulo: Una sola unidad para las tasas
estado: aceptada
fecha: 2026-09-24
fuente: specs/022-tasas-de-punta-a-punta/research.md
---

# ADR-035 — Una sola unidad para las tasas

Enmienda a ADR-024 (forma de una entidad). Lo que ADR-024 decide sobre clases, tipos, fábricas y
estados ilegales sigue vigente; lo que cambia es la convención de tasas: **deja de haber dos
unidades**.

## Contexto

Hasta esta decisión el sistema tenía dos representaciones del mismo concepto: el porcentaje entero
0–100 en el borde (el contrato, la semilla, los defaults de tratamiento) y la tasa 0–1 adentro
(el dominio). La convención estaba escrita en `CLAUDE.md`: «Porcentajes 0–100 sólo en el borde;
adentro, tasas 0–1».

Lo que se midió en `021-plano-de-decoracion`, challengeando `composition/experiments-config.ts`:

- **Las dos representaciones eran el mismo tipo.** `treatmentPercent` y `treatmentShare` son
  `number`. `isRate` acepta 0..1 **inclusive**. Entonces un `treatmentPercent: 1` —uno por ciento—
  que llegara sin dividir producía `treatmentShare: 1`, que es **el cien por ciento**: compilaba,
  pasaba `isRate`, pasaba `Experiment.of`, pasaba los siete gates y las 1293 pruebas, y todos los
  visitantes iban a tratamiento sin que nada chillara. Lo mismo con `holdoutPercent: 1`, que es un
  holdout total, y con el `0`, que también es una tasa válida.
- **La conversión estaba repartida.** Cuatro nombres para el mismo 100 en tres anillos (`PERCENT`
  en cinco archivos, `PERCENT_PER_UNIT`, `PERCENT_BUCKETS`) y unos diez sitios de división o
  multiplicación en los dos sentidos.
- **La incoherencia que lo explica.** El repositorio marca `MerchantId` contra `SessionId` con
  tipos `Branded` para prevenir una confusión que casi no ocurre, y dejaba `rate` contra `percent`
  como `number` pelado — la única confusión numérica sobre la que había **escrito una convención**.

## Decisión

**El sistema habla en tasas 0..1 de punta a punta y no convierte formatos de porcentaje.** Toda
entrada y toda salida, incluido cualquier endpoint, recibe y entrega fracciones de 1. Cómo se
muestre un 5 % en un frontend, en un reporte o en un formulario no es problema del backend.

En consecuencia:

1. Los campos del contrato llevan el sufijo `Share` y son `number` con `minimum: 0` y `maximum: 1`
   (`treatmentShare`, `holdoutShare`, `maxIncentiveShare`, `incentiveLadderShare`, `marginShare`;
   los `cuts` de un experimento son fracciones de la muestra; `Incentive.value` es
   `exclusiveMinimum: 0`, `maximum: 1`).
2. No existe ninguna declaración del factor 100 como conversión. La única constante que vale 100 es
   `ASSIGNMENT_BUCKETS` (`domain/experiment/experiment.ts`), que **no es una conversión**: es la
   resolución del reparto —en cuántos baldes se divide la población—, valía 100 por coincidencia, y
   el día que el reparto quiera granularidad más fina ese número cambia y nada más cambia.
3. Ser entero deja de ser una regla: era una propiedad del porcentaje, no de la tasa. Las
   invariantes que lo exigían desaparecen; las que juzgan el rango son `isRate`.
4. `Experiment.withinHoldout` sigue comparando en baldes enteros, y no en tasas, por dos motivos
   escritos en el método: compara el reparto **efectivo** y no el declarado, y comparar tasas
   rechazaría pares complementarios legítimos, porque `1 - 0.93` es `0.06999999999999995` en punto
   flotante y un reparto de `0.07` se leería como mayor.

## Alternativas descartadas

**Un value object `Percent` en el `shared-kernel`** (clase con reglas: entero, 0..100, y la
conversión a tasa encapsulada). Era la propuesta original y resolvía el modo de falla: un `Percent`
no es un `number`, así que pasarlo donde se espera una tasa no compila. Se descartó porque resuelve
el síntoma conservando la causa: sigue habiendo dos unidades y una traducción entre ellas, sólo que
ahora con un guardián. Todo lector del contrato, todo consumidor y todo operador sigue teniendo que
saber en qué unidad habla cada campo.

**Un `Branded<number, "Percent">`.** Se descartó antes que la clase: un `number` marcado se
desmarca en cuanto se hace aritmética con él, así que la garantía dura hasta la primera operación.

**Dejar la convención y documentarla mejor.** La convención ya estaba escrita y el modo de falla
existía de todos modos. Una convención que el compilador no sostiene no es una garantía.

## Consecuencias

- El contrato cambia de forma incompatible en ocho campos. Entra con bump MINOR conservando el
  prefijo `/v1/` porque lleva `info.x-stability: building` y ningún merchant lo consume (ADR-003).
- La convención «porcentajes 0–100 sólo en el borde» deja de existir en `CLAUDE.md`, reemplazada por
  la regla de esta decisión.
- El caso que sostiene todo es una prueba: un reparto declarado como `0.01` reparte el uno por
  ciento y no el cien por ciento
  (`tests/unit/domain/experiment/assignment.test.ts`). Antes los dos eran el mismo `number`.
- La huella de la asignación no cambió: la prueba de regresión de la 007 pasa sin tocarle una cifra.
- `CommercialPolicyInput` pasa a ser un alias de `CommercialPolicyRecord`. Se escribían dos veces
  porque diferían en la unidad, y ya no difieren en nada.
- El riesgo de la migración de datos es el `1`: `treatmentShare: 1` es el cien por ciento y
  `holdoutShare: 1` es un holdout total, y los dos pasan toda la validación. Los seis valores de
  `config/` se revisaron de uno en uno y no con una regla.

---

## Enmienda (2026-09-24, feature 023) — y sólo las tasas que el reparto puede repartir

La decisión de arriba sacó la ambigüedad de **unidad**. Medir una pregunta del dueño
—«¿podemos mejorarlo limitando a 2 decimales?»— dejó a la vista que quedaba una segunda, de la
misma familia: **la ambigüedad de representabilidad**.

### Lo que quedaba

`Experiment.assign` resuelve el reparto a baldes enteros, pero el dominio aceptaba cualquier tasa
0..1, así que una tasa más fina que un centésimo se ajustaba al balde más cercano **sin decirlo**.
Medido:

| se declara  | reparte de verdad                |
| ----------- | -------------------------------- |
| `0.075`     | 8 %                              |
| `0.005`     | 1 %                              |
| **`0.004`** | **0 % — nadie va a tratamiento** |
| `0.999`     | 100 %                            |

Un experimento abierto con `treatmentShare: 0.004` se creaba, se activaba, decidía y no asignaba a
nadie: sin error, sin log, sin diferencia visible. El holdout tenía el mismo agujero, y un
`holdoutShare: 0.004` apartaba a nadie mientras el merchant creía lo contrario.

El contrato **documentaba** el ajuste («a finer value takes the nearest bucket»), que es una
sorpresa documentada y no una regla: quien mandaba `0.004` no veía ningún problema.

### La decisión

**Una tasa que algo cuantiza tiene que ser exactamente la que su balde representa**, y si no lo es,
se rechaza nombrándola. La regla es `Experiment.handsOut(share)`
—`bucketsOf(share) / ASSIGNMENT_BUCKETS === share`—, un método estático que vive junto al número que
define la resolución; el reparto la aplica en `Experiment.of` (`422 treatment-share-too-fine`, tipo
propio del catálogo) y el holdout en `TreatmentValues.judge` (`invalid-configuration-value`
apuntando a `holdoutShare`).

Alcanza a **dos** campos, `treatmentShare` y `holdoutShare`, que son los dos únicos que pasan por
`bucketsOf`. Los cortes de un experimento y las tres tasas de la política comercial (techo,
escalones, margen) **no** quedan sujetos: nadie los cuantiza, y exigirles la regla sería inventar
una restricción sin un algoritmo que la pida — un margen de `0.375` es perfectamente representable.
Hay una prueba de eso, porque sin ella el próximo lector extiende la regla «por coherencia».

### Las alternativas descartadas, con su medición

**`multipleOf: 0.01` en el esquema.** Rechaza **diez de los ciento un** valores legítimos, `0.07`
entre ellos, porque `0.07 / 0.01` es `7.000000000000001` en punto flotante (también `0.14`, `0.28`,
`0.29`, `0.47`, `0.56`). Que la regla no sea expresable en JSON Schema es exactamente el motivo por
el que es una `x-invariants` y no una restricción de esquema (ADR-007).

**Un epsilon** (`abs(share * 100 - round(share * 100)) < 1e-9`). Funciona sobre los 101 valores,
pero pone **un segundo número** al lado de `ASSIGNMENT_BUCKETS` que también decide qué se acepta, y
los dos habría que mantenerlos de acuerdo a mano. La constitución XI mira ese número con razón. La
ida y vuelta no introduce ninguno y sigue sola a la resolución.

**Aceptar el ruido de punto flotante.** La spec de la 023 lo pedía (FR-008) y el plan lo descartó:
aceptar que `0.1 + 0.2` valga por `0.3` **es** ajustar en silencio, que es lo que esta decisión
elimina. Y ese ruido no llega por la red: un número JSON es un literal decimal que se lee al valor
más cercano, así que `0.07`, `0.070000000000000007` y `7/100` son el mismo número y los tres se
aceptan. El único ruido que sobrevive viene de una suma hecha por el cliente, y ahí rechazar es
mejor servicio que ajustar.

### Consecuencias

- El contrato estrecha lo que acepta en un campo. Entra con bump MINOR conservando `/v1/` por la
  marca de construcción (ADR-003), y `info.version` va a `1.6.0`.
- **`oasdiff` no ve este estrechamiento**, porque no está escrito en ninguna palabra clave del
  esquema: reporta «no breaking changes» para este delta. El bump de versión es un acto deliberado,
  no algo que la herramienta pueda exigir. Vale para toda regla que viva en `x-invariants`.
- `rehydrate` no re-juzga, como fija ADR-024: la regla es de creación y un endurecimiento posterior
  no invalida hechos ya registrados.
- El mapa de `composition/seed-errors.ts` necesita su entrada para que el arranque nombre el campo y
  no el experimento entero. Su `satisfies` garantiza que ningún código se renombre en silencio, pero
  no que estén todos.
