# Research — El backend habla en tasas, adentro y afuera (022)

Medido sobre `022-tasas-de-punta-a-punta`. Cada decisión cita la evidencia; lo descartado dice por
qué. **R-00 a R-09 son del recorrido**: el alcance se reformuló dos veces y la evidencia de las
versiones anteriores se conserva porque es lo que explica la decisión final.

## R-00 — Hoy no hay defecto vivo

Revisé los cuatro caminos por los que un porcentaje se convierte en tasa y **los cuatro dividen**.
No hay hoy ninguna entrada que produzca una tasa equivocada:

- `experiments-config.ts` sólo verifica que el valor sea entero, pero uno fuera de rango lo atrapa
  `isRate` después de dividir (`150 / 100 = 1.5`, rechazado).
- Los cortes de un experimento parecían tener un agujero —`isCut` no verifica el límite inferior—
  pero `offendingCut` arranca con `previous = 0` y exige `cut > previous`, así que un corte
  negativo se rechaza igual.

Lo que se ataca es **un modo de falla latente más duplicación real**, no un bug en producción. El
latente es serio —un 1 leído como tasa es 100 %, y `isRate` lo acepta— pero requiere que alguien
saque o mueva una división. Decirlo de otra manera sería vender la feature más caro de lo que vale.

## R-01 — La evidencia que decidió todo: la misma regla, tres veces, tres severidades

No es sólo el factor repetido. Es el juicio:

| Dónde                                          | Qué verifica                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| `domain/configuration/policy-inputs.ts:49`     | `isPercent`: entero **y** 0..100, con su mensaje                      |
| `domain/configuration/treatment-values.ts:149` | lo mismo, **escrito de nuevo en línea**, con el mismo mensaje literal |
| `composition/experiments-config.ts:50`         | **sólo** entero; el rango lo atrapa `isRate` después                  |

Tres lecturas distintas de "esto es un porcentaje válido", y el mensaje de error duplicado palabra
por palabra entre dos módulos del dominio. Cuatro nombres para el factor: `PERCENT` (cinco sitios,
tres anillos), `PERCENT_PER_UNIT`, `PERCENT_BUCKETS`.

Ningún gate lo ve: `ope/no-magic-numbers` se conforma con que cada 100 tenga un nombre —que es
justo por qué hay cuatro— y jscpd necesita cinco líneas para reportar un clon.

## R-02 — Las dos formulaciones descartadas

**Primera: un valor `Percent` con reglas** (entero 0..100, con su conversión encapsulada).
Descartada: mejora el modo de falla pero **institucionaliza las dos representaciones**, y las hace
viajar por dos anillos. Además no alcanzaba sola — si el valor llega como número crudo del JSON,
olvidarse de convertir sigue compilando; había que tiparlo desde el lector, o sea meter el
porcentaje más adentro todavía.

**Segunda: una sola representación adentro**, con el porcentaje tipado sólo en los anillos que leen
y escriben el exterior, y una regla de forma que le impidiera entrar. Mejor: el dominio adelgazaba
en vez de tipar más. Descartada porque **seguía habiendo una conversión**, y una conversión es algo
que se puede olvidar.

**Tercera y adoptada: no hay dos formas.** No se puede equivocar una conversión que no existe.

Un dato que hace falta para entender por qué la primera era peor de lo que parecía: **el porcentaje
ya llega al dominio hoy**. `PolicyInput` es una clase de `domain/configuration/` que recibe
`maxIncentivePercent` y lo divide adentro, y `TreatmentValues` hace lo mismo con el holdout. Tiparlo
no lo metía más adentro: le ponía nombre donde ya estaba. Sacarlo es lo que corresponde.

## R-03 — La superficie del contrato

**7 esquemas, 55 menciones, 8 campos.**

| Esquema                                                                        | Campos                                                           |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `CommercialPolicy`, `CommercialPolicyDeclared`                                 | `maxIncentivePercent`, `incentiveLadderPercent`, `marginPercent` |
| `EffectiveConfiguration`, `TreatmentDefaults`, `MerchantConfigurationDeclared` | `holdoutPercent`                                                 |
| `Experiment`, `ExperimentCreate`                                               | `treatmentPercent`, `cuts`                                       |
| `Incentive`                                                                    | `value` (entero, mínimo 1, máximo 100)                           |

**Los nombres correctos ya existen adentro**: `treatmentShare`, `holdoutShare`,
`maxIncentiveShare`, `incentiveLadderShare`, `marginShare`. El contrato adopta el vocabulario del
dominio, que es una ganancia aparte: **un solo vocabulario de punta a punta**.

## R-04 — El cambio es incompatible, y ésta es la ventana

`info.version: 1.4.0`, `info.x-stability: building`. ADR-003: mientras la marca esté —ningún
merchant consume el contrato— un cambio incompatible entra con **bump MINOR**, conserva el prefijo
`/v1/`, `contract:diff` lo reporta y lo acepta, y `release-check` avisa. La marca se quita antes del
primer piloto.

**Decisión**: `info.version` a `1.5.0`, prefijo intacto, y el diff reportado se acepta como lo que
es. Hacerlo después sería con merchants adentro.

## R-05 — La precisión que el contrato admite (FR-008)

Hoy los enteros 0..100 imponen pasos de 1 %. Con fracciones, ¿el contrato acepta `0.153`?

**Decisión: no se restringe en el esquema; se documenta a qué resuelve el sistema.**

- `multipleOf: 0.01` en JSON Schema es frágil con punto flotante: 0,07 no es exactamente
  representable en binario y los validadores difieren en cómo lo tratan. Una regla que a veces
  rechaza un valor legítimo es peor que ninguna.
- El sistema **ya redondea**: el reparto resuelve a cubetas enteras y el comentario que lo explica
  ya está escrito en el dominio. Documentarlo en la descripción del campo dice la verdad.
- **Es más permisivo que hoy**: un merchant podría declarar `0.153` y obtener el reparto de
  `0.15`. Es un cambio de comportamiento chico y hay que nombrarlo, no que aparezca solo.

## R-06 — El tipo de incentivo y su mínimo

`Incentive` declara `kind: [percent]` y `value: integer, minimum: 1, maximum: 100`.

**Decisión sobre el valor**: pasa a fracción, con mínimo `0.01` y máximo `1`. **Cuidado**: escribir
`minimum: 1` sería exactamente el error que esta feature elimina, redactado en el contrato.

**Decisión sobre el tipo**: `kind` describe **qué clase de incentivo** es —un descuento
proporcional, y no un monto fijo—, así que el concepto no cambia con la unidad y el vocabulario se
conserva. Lo que se ajusta es la descripción, para que `kind: percent` con `value: 0.15` no se lea
como "0,15 %". Cambiar el vocabulario sería un cambio de significado que esta feature no necesita.

## R-07 — La granularidad del reparto no es el factor

En `domain/experiment/experiment.ts` la misma constante se usa con **dos sentidos**:

```ts
const bucketsOf = (share) => Math.round(share * PERCENT_BUCKETS); // tasa → porcentaje
const bucket = fnv1a32(key) % PERCENT_BUCKETS; // la cubeta del visitante
```

La primera es una conversión y **desaparece**: con tasas de punta a punta, comparar el reparto
contra el holdout no necesita pasar por enteros. La segunda es la granularidad del reparto y **se
queda**, con nombre propio.

**Decisión**: la constante que se queda se renombra a algo que diga lo que es. Su nombre actual es
la causa de la confusión, y dejarla llamándose "porcentaje" en una feature que elimina los
porcentajes sería sembrar la próxima.

**Riesgo a vigilar**: `bucketsOf` participa de la comparación contra el holdout. Reescribirla en
tasas tiene que dar exactamente el mismo veredicto; la prueba de regresión de la feature 007 es el
juez, y **si cambia, se para**.

## R-08 — El vocabulario de estados de un experimento

`domain/experiment/experiment.ts:22` declara el tipo `ExperimentStatus` y
`composition/experiments-config.ts:13` vuelve a listar los tres literales en un array tipado
`readonly ExperimentStatus[]`. Ese tipo garantiza que cada elemento sea válido, **no que estén
todos**: un estado nuevo en el dominio no llegaría a la semilla y nada fallaría.

El repositorio ya tiene el idioma correcto en el kernel:

```ts
export const BARRIERS = ["fit", "price", "returns"] as const;
export type Barrier = (typeof BARRIERS)[number];
```

**Decisión**: `experiment` declara su array y deriva el tipo, igual que las barreras, los anclajes y
los motivos de `NO_OP`.

## R-09 — La forma del identificador de experimento

`asExperimentId` es un cast puro que no valida nada. La única regla sobre la forma vive en
composición (`^[A-Za-z0-9_-]{8,64}$`) y sólo se aplica a la semilla; el acuñador produce algo más
estricto (`exp_` + base32).

**Decisión**: registrar por qué son distintas, no unificarlas. La semilla acepta identificadores que
vienen de otro lado —una migración, un experimento que ya existía— y exigirle el formato del
acuñador la rompería sin ganancia. Si al escribir el motivo resulta que no hay motivo, se unifican.

## R-10 — Lo que se borra

Esta feature **quita más de lo que pone**:

|                        |                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Se borra               | `isPercent`, `PERCENT_PROBLEM`, `PERCENT` (×3), `PERCENT_PER_UNIT`                                                            |
| Se borran              | todas las conversiones, en los dos sentidos                                                                                   |
| Se borra               | el mapa que traduce el nombre de una tasa al nombre de su campo de porcentaje, que existía sólo porque había dos vocabularios |
| Queda                  | `isRate` como único juez, ya escrito y ya usado por cuatro módulos                                                            |
| Se queda y se renombra | la granularidad del reparto                                                                                                   |

No hay clase nueva, no hay puerto nuevo, no hay gate nuevo.

## R-11 — Qué prueba que no cambió nada salvo la unidad

- **La prueba de regresión de la asignación** (feature 007, con su fingerprint): mismos visitantes,
  mismos brazos. Es el único lugar donde esta feature podría alterar comportamiento sin que nadie
  lo note.
- Las pruebas de configuración (42 aserciones sobre rutas de campo) y las de políticas: los
  mensajes de error y los campos que nombran cambian **sólo** donde el campo se renombra.
- `contract:diff`: reporta incompatibles y los acepta por la marca de construcción. **Se espera que
  reporte**; lo que no puede aparecer es un cambio que no esté en la lista de los ocho campos.
- Las pruebas de contrato (Schemathesis) contra el servidor levantado, que recorren los esquemas
  nuevos.
