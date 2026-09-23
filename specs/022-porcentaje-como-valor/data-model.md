# Data model — El porcentaje es un valor con reglas (022)

No hay entidades nuevas. Lo que sigue es el modelo de **un valor** y de qué cambia alrededor de él.

## 1. Porcentaje

Lo que el exterior declara y lee: un entero de 0 a 100.

| Parte          | Qué es                                                                            |
| -------------- | --------------------------------------------------------------------------------- |
| el valor       | el entero, tal como entró y tal como sale                                         |
| a tasa         | la fracción 0..1 equivalente, que es con lo que razonan las reglas                |
| desde una tasa | el porcentaje entero más cercano, con el redondeo que hoy está escrito tres veces |

**Invariantes**

- **Sólo existe válido.** Su fábrica devuelve `Result`: un valor no entero, negativo o mayor que
  100 no produce un porcentaje, produce el error que nombra el campo.
- **No es un número.** Pasarlo donde se espera una tasa **no compila**, y ninguna aritmética lo
  convierte en uno por accidente. La única salida es pedirle la tasa.
- **La conversión vive acá, en las dos direcciones**, y en ningún otro lugar del repositorio.
- **Es inmutable**: convertir no modifica nada; devuelve.

## 2. Tasa

**No cambia.** Sigue siendo un `number` de 0 a 1, y el dominio sigue calculando con ella como hoy:
sumas de pesos, comparaciones contra umbrales, multiplicaciones.

**Invariantes**

- Sigue juzgándose con el predicado que ya existe, que no se toca.
- **No se envuelve.** Envolverla también sería simetría por simetría: la tasa se opera todo el
  tiempo y un valor envuelto obligaría a desenvolver y reenvolver en cada cuenta. El riesgo que la
  feature ataca es que un porcentaje pase por tasa, y eso se corta de un solo lado.

## 3. Los seis porcentajes

Todos pasan por la misma puerta:

| Concepto                                 | Dónde nace                                        |
| ---------------------------------------- | ------------------------------------------------- |
| reparto de tratamiento de un experimento | semilla y API de administración                   |
| holdout efectivo de un merchant          | defaults de tratamiento y configuración publicada |
| techo de incentivo                       | política comercial                                |
| escalera de incentivos (una lista)       | política comercial                                |
| margen (opcional)                        | política comercial                                |
| cortes de un experimento (una lista)     | semilla y API de administración                   |

**Invariantes**

- El que es **opcional** sigue siéndolo: ausente no es inválido.
- Los que son **listas** se construyen elemento por elemento, y el error nombra el índice que
  ofende, como hoy.
- Los **cortes** entran como porcentajes, pero su regla de orden —estrictamente crecientes por
  encima de cero— **se queda en el experimento**: es una regla del experimento, no del porcentaje.

## 4. Desde dónde es un porcentaje

Ésta es la decisión que sostiene todo lo demás.

| Tramo                                        | Tipo                      |
| -------------------------------------------- | ------------------------- |
| el JSON o el cuerpo de la petición           | un número crudo           |
| lo que el lector de la entrada produce       | **un porcentaje**         |
| lo que la fábrica del dominio recibe         | **un porcentaje**         |
| lo que la entidad guarda y con lo que razona | una tasa                  |
| lo que el DTO devuelve                       | un número crudo, otra vez |

**Invariantes**

- El número crudo existe **sólo en los dos extremos**: donde se lee y donde se escribe.
- Entre medio no hay ningún tramo donde un porcentaje y una tasa sean el mismo tipo. Ése es el
  tramo donde hoy vive el modo de falla.
- Juzgar 0..100 en el lector **no** lo convierte en juez de reglas de negocio: es la definición de
  lo que un porcentaje es. El rango de negocio —el reparto no puede tomar el holdout— sigue en la
  entidad.

## 5. La granularidad del reparto

**No es el factor de conversión, aunque hoy valga lo mismo.**

|                  |                                                                                |
| ---------------- | ------------------------------------------------------------------------------ |
| qué es           | en cuántas cubetas se divide la población para asignar un visitante            |
| cuánto vale hoy  | 100, o sea cubetas de 1 %                                                      |
| por qué se queda | el día que el reparto quiera más resolución, este número cambia y el factor no |

**Invariantes**

- Cambia de nombre a uno que diga lo que es. El nombre actual es la causa de la confusión.
- El uso que **sí** era una conversión —pasar una tasa a porcentaje para compararla contra el
  holdout— se va a la clase; el que elige la cubeta de un visitante se queda.
- **El algoritmo de asignación no se toca.** El fingerprint de regresión de la feature 007 es el
  juez de que sigue dando lo mismo.

## 6. El vocabulario de estados de un experimento

**Sin cambios de significado**: los mismos tres estados.

| Antes                                                                                     | Después                                                   |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| el dominio declara el tipo; el composition root vuelve a listar los literales en un array | el dominio declara **el array** y el tipo se deriva de él |

**Invariantes**

- Una sola declaración. Agregar un estado es agregarlo ahí y todo lo demás se entera.
- El idioma es el que el kernel ya usa para las barreras, los anclajes y los motivos de `NO_OP`.
- El mensaje que rechaza un estado desconocido lista los estados **que existen en ese momento**, no
  una copia de los que existían cuando se escribió.

## 7. Lo que queda escrito, no arreglado

La forma de un identificador de experimento: la entrada de la semilla admite más que lo que el
sistema acuña.

**Invariante**: la diferencia queda **registrada con su motivo** —la semilla acepta identificadores
que vienen de otro lado— o, si al escribirlo resulta que no hay motivo, se unifican. Lo que no
queda es como está: una regla huérfana en el composition root y una identidad que no valida nada.
