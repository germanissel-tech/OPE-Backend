# Contrato — el valor `Percent`

Lo que se puede escribir con él y lo que tiene que respetar.

## 1. Construirlo

```ts
const percent = Percent.of(30); // Result<Percent, InvalidPercent>
```

- Devuelve `Result`, como toda fábrica del dominio (ADR-024): si tenés la instancia, es válida.
- Rechaza lo que no es un porcentaje: no entero, negativo, mayor que 100.
- El error nombra **el campo que lo declaró**, no el valor, para que el mensaje de configuración
  siga siendo el mismo que hoy.

## 2. Cruzarlo hacia adentro

```ts
CommercialPolicy.of({ maxIncentiveShare: maxIncentive.rate(), … });
```

`rate()` es **la única** salida hacia el mundo de las tasas. No hay otra conversión escrita en
ningún lado del repositorio.

## 3. Cruzarlo hacia afuera

```ts
treatmentPercent: Percent.fromRate(experiment.treatmentShare).value;
```

`fromRate` lleva el redondeo, que hoy está escrito tres veces con tres nombres. Nunca falla: toda
tasa 0..1 tiene un porcentaje entero más cercano.

## 4. Lo que no compila

```ts
CommercialPolicy.of({ maxIncentiveShare: maxIncentive }); // ✗ un Percent no es un number
Percent.of(experiment.treatmentShare); // ✗ una tasa no es un porcentaje
```

El primero es el modo de falla que la feature ataca: hoy compila, y si el valor es 0 o 1 pasa
también la validación de tasas.

## 5. Una lista de porcentajes

```ts
const ladder = Percent.all(input.incentiveLadderPercent); // Result<Percent[], InvalidPercent>
```

Se construyen todos o falla el primero que ofende, **nombrando su índice**, que es lo que el
mensaje de configuración dice hoy.

## 6. Dónde cruza cada borde

| Camino                                | Quién construye el porcentaje            | Quién lo convierte             |
| ------------------------------------- | ---------------------------------------- | ------------------------------ |
| API de administración → caso de uso   | el controller, del cuerpo de la petición | `rate()` al armar el request   |
| Semilla → entidad                     | el lector de la semilla                  | `rate()` al llamar la fábrica  |
| Defaults de tratamiento → valores     | el lector de los niveles                 | `rate()`                       |
| Configuración publicada → política    | el lector de lo declarado                | `rate()`                       |
| Entidad → DTO                         | —                                        | `fromRate()` en el presentador |
| Decisión → DTO del SDK (el incentivo) | —                                        | `fromRate()`                   |

**El número crudo existe sólo en los dos extremos.** Entre medio, un porcentaje es un `Percent`.

## 7. Lo que el valor **no** hace

|                              | Por qué                                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Aritmética entre porcentajes | Nadie la necesita: los porcentajes se declaran y se convierten. Sumar dos porcentajes es una pregunta del dominio que lo pida, no del valor. |
| Comparaciones                | Lo mismo; las comparaciones que existen —el reparto contra el holdout— son entre tasas y viven en el experimento.                            |
| Envolver la tasa             | La tasa se opera todo el tiempo; envolverla sería fricción sin ganancia. El riesgo se corta de un solo lado.                                 |

## 8. Lo que la forma prohíbe

| Prohibido                                               | Lo reporta                                 |
| ------------------------------------------------------- | ------------------------------------------ |
| Escribir el factor de conversión en cualquier otro lado | revisión; no queda ninguno al que copiarle |
| Pasar un porcentaje donde va una tasa, o al revés       | `typecheck`, con su fixture                |
| Un predicado propio de "esto es un porcentaje"          | revisión: la fábrica es la única puerta    |
| Confundir la granularidad del reparto con el factor     | el nombre, que pasa a decir lo que es      |
