# Research — El porcentaje es un valor con reglas (022)

Medido sobre `022-porcentaje-como-valor` en `d78de00`. Cada decisión cita la evidencia; lo
descartado dice por qué.

## R-00 — Corrección: hoy no hay defecto vivo

**Hay que decirlo antes que nada, porque la spec se puede leer mal.** Revisé los cuatro caminos por
los que un porcentaje se convierte en tasa y **los cuatro dividen**. No hay hoy ninguna entrada que
produzca una tasa equivocada:

- `experiments-config.ts` sólo verifica que el porcentaje sea entero, pero un valor fuera de rango
  lo atrapa `isRate` después de dividir (`150 / 100 = 1.5`, rechazado).
- Los cortes de un experimento parecían tener un agujero —`isCut` no verifica el límite inferior—
  pero `offendingCut` arranca con `previous = 0` y exige `cut > previous`, así que un corte
  negativo se rechaza igual. El comentario lo dice: _"the lower bound is the cut before it
  (none: 0)"_.

Entonces lo que esta feature ataca es **un modo de falla latente más duplicación real**, no un bug
en producción. El modo latente es serio —un porcentaje de 1 leído como tasa es 100 % de
tratamiento, y `isRate` lo acepta— pero requiere que alguien saque o mueva una división. Decirlo de
otra manera sería vender la feature más caro de lo que vale.

## R-01 — La pregunta central: ¿desde dónde es un porcentaje un `Percent`?

**Ésta decide si la feature cumple FR-002 o si es sólo deduplicación.**

Hoy un porcentaje llega como `number` crudo del JSON y **se convierte dentro del dominio**:

```ts
// domain/configuration/policy-inputs.ts
maxIncentiveShare: input.maxIncentivePercent / PERCENT,
```

Si `Percent` fuera una clase pero `input.maxIncentivePercent` siguiera siendo `number`, escribir
`maxIncentiveShare: input.maxIncentivePercent` —sin convertir— **seguiría compilando**. La clase no
sirve de nada si el valor no está tipado como porcentaje desde que existe.

Hay dos opciones y sólo una cumple la spec:

|         | Quién construye el `Percent`                                      | ¿Cumple FR-002? |
| ------- | ----------------------------------------------------------------- | --------------- |
| **(a)** | el lector de la entrada: el registro de entrada declara `Percent` | **sí**          |
| **(b)** | la fábrica del dominio, recibiendo `number`                       | **no**          |

**Decisión: (a).** El porcentaje es un `Percent` desde que entra, y `number` sólo vuelve a existir
del otro lado de `.rate()`.

**La objeción a (a)**: los lectores de `application/configuration/input/` dicen de sí mismos que
juzgan _la forma_ y que _"las vocabularios y los rangos son del dominio"_. Construir un `Percent`
implica juzgar 0..100 en el lector.

**Por qué no aplica**: 0..100 entero **no es un rango de negocio, es la definición de lo que un
porcentaje es**. El rango de negocio es "el reparto no puede tomar el holdout efectivo", y ése
sigue siendo del dominio, en `Experiment`. El lector no empieza a juzgar reglas: empieza a
construir el valor que el dominio define, que es lo que ya hace con todo lo demás.

## R-02 — Clase, no tipo marcado

La descripción del dueño lo argumenta y lo confirmo:

- Un `Branded<number, "Percent">` **es** un `number` para el compilador en cuanto se opera con él:
  `percent / 100` da `number`, `percent + 1` da `number`. La marca se pierde en la primera cuenta y
  hay que reponerla a mano. El valor que queremos proteger es justo el que más se opera.
- Una **clase no es un `number`**: pasarla donde se espera una tasa no compila, y no hay aritmética
  que la desarme. La única salida es `.rate()`.
- ADR-024 lo pide literalmente: _"clase si hay reglas, tipo si no"_. Un porcentaje tiene reglas
  (entero, 0..100) y comportamiento (convertirse en tasa, y volver con redondeo).
- Del lado de la tasa **no hay fricción**: las tasas siguen siendo `number` y el dominio sigue
  calculando como hoy. La clase sólo existe del lado del borde, que es donde los porcentajes viven.

**Alternativa descartada**: sólo unificar la constante y el predicado. Deduplica y no protege nada:
el modo de falla latente queda igual.

## R-03 — La misma regla está escrita tres veces, con tres severidades

No es sólo el factor: es el juicio.

| Dónde                                          | Qué verifica                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| `domain/configuration/policy-inputs.ts:49`     | `isPercent`: entero **y** 0..100, con su mensaje                      |
| `domain/configuration/treatment-values.ts:149` | lo mismo, **escrito de nuevo en línea**, con el mismo mensaje literal |
| `composition/experiments-config.ts:50`         | **sólo** entero; el rango lo atrapa `isRate` después                  |

Tres lecturas distintas de "esto es un porcentaje", y el mensaje de error duplicado palabra por
palabra en dos módulos. Eso es lo que la clase unifica, y es evidencia más fuerte que el factor
repetido.

## R-04 — `PERCENT_BUCKETS` no es el factor, aunque valga 100

En `domain/experiment/experiment.ts` la misma constante se usa con **dos sentidos**:

```ts
const bucketsOf = (share) => Math.round(share * PERCENT_BUCKETS); // tasa → porcentaje
const bucket = fnv1a32(key) % PERCENT_BUCKETS; // la cubeta del visitante
```

La primera es una conversión y pasa a la clase. La segunda es **la granularidad del reparto** y se
queda: el día que el reparto quiera más resolución que 1 %, ese número cambia y el factor de
conversión no.

**Decisión**: se separan, y la constante que se queda cambia de nombre a uno que diga lo que es
(`ASSIGNMENT_BUCKETS` o equivalente), con su motivo en el comentario. El nombre actual es la causa
de la confusión.

## R-05 — Qué pasa con los cortes de un experimento

Son porcentajes de la muestra, juzgados por `isCut` contra `PERCENT_BUCKETS`.

**Decisión**: entran a `Percent` como cualquier otro. Lo que **no** entra es la regla "estrictamente
crecientes, empezando por encima de 0", que es del experimento y se queda en `offendingCut`.

Esto además aclara `isCut`, que hoy no verifica el límite inferior y se apoya en que el bucle lo
haga: con `Percent` el límite inferior es parte del valor y la regla del experimento queda reducida
a lo que de verdad es suya, el orden.

## R-06 — El borde exterior no cambia

El contrato declara porcentajes enteros 0–100 y **no se toca** (FR-010). Lo que cambia es de qué
tipo son adentro:

| Camino                              | Hoy                                   | Después                            |
| ----------------------------------- | ------------------------------------- | ---------------------------------- |
| API de administración → caso de uso | `req.body.treatmentPercent / PERCENT` | `Percent.of(...)` en el controller |
| Semilla → entidad                   | `Number(treatmentPercent) / PERCENT`  | el lector construye el `Percent`   |
| Defaults de tratamiento → valores   | `record.holdoutPercent / PERCENT`     | idem                               |
| Entidad → DTO                       | `Math.round(share * PERCENT)`         | `Percent.fromRate(share).value`    |

`contract:diff` tiene que dar cero. Es el juez de que esto quedó adentro.

## R-07 — Lo que los gates dicen de este cambio

- **`ope/domain-no-loose-functions`**: el dominio no exporta funciones sueltas. Una clase con
  `static of` / `static fromRate` cumple; un `rateOf(percent)` suelto necesitaría la excepción de
  las primitivas del kernel. Un motivo más para la clase.
- **`check:behaviour-constants`**: el factor 100 no es una constante de comportamiento —no gobierna
  una decisión, es la definición de la unidad— así que no lo alcanza. La granularidad del reparto
  **sí podría discutirse**; hoy no está en la lista y esta feature no la agrega.
- **`ope/no-magic-numbers`**: hoy se satisface con que cada 100 tenga un nombre, que es
  exactamente por qué hay cuatro nombres y ningún gate lo notó.
- **Mutación**: `Percent.of` y `Percent.fromRate` son código nuevo con condiciones; van a necesitar
  pruebas de sus bordes (0, 1, 100, 101, −1, no entero) o el gate las reclama. Es lo que queremos.

## R-08 — El vocabulario de estados (US2)

`domain/experiment/experiment.ts:22` declara el tipo y `composition/experiments-config.ts:13`
vuelve a listar los tres literales en un array tipado `readonly ExperimentStatus[]`. Ese tipo
garantiza que cada elemento sea válido, **no que estén todos**.

El repositorio ya tiene el idioma correcto, en el kernel:

```ts
export const BARRIERS = ["fit", "price", "returns"] as const;
export type Barrier = (typeof BARRIERS)[number];
```

**Decisión**: `experiment` declara su array y deriva el tipo, igual que las barreras, los anclajes y
los motivos de `NO_OP`. El predicado que hoy vive en composición se va con él o desaparece.

## R-09 — La forma del identificador (US3)

`asExperimentId` es un cast puro que no valida nada. La única regla sobre la forma vive en
composición (`^[A-Za-z0-9_-]{8,64}$`) y sólo se aplica a la semilla; el acuñador produce algo más
estricto (`exp_` + base32).

**Decisión**: registrar por qué son distintas, no unificarlas. La semilla acepta identificadores
que vienen de otro lado —una migración, un experimento que ya existía— y exigirle el formato del
acuñador la rompería sin ganancia. Lo que falta no es una regla: es el motivo escrito. Si al
escribirlo resulta que no hay motivo, entonces sí se unifican.

Es la salida que US3 admite explícitamente ("vive con la identidad, **o** se registra por qué no").

## R-10 — Qué prueba que no cambió nada

- `contract:diff` en cero.
- Las pruebas de configuración (`tests/unit/composition/config.test.ts`, 42 aserciones sobre rutas
  de campo) y las de políticas, sin tocar una aserción: los mensajes de error y los campos que
  nombran quedan iguales.
- Las pruebas del experimento y de la asignación: el reparto en cubetas no se toca, así que el
  fingerprint de regresión de la 007 tiene que seguir dando lo mismo.
- Las nuevas son el fixture de tipos y las pruebas de borde de la clase, incluido el caso que da
  nombre a la feature: **un porcentaje de 1 nunca produce la tasa 1**.
