# Data model — El backend habla en tasas (022)

No hay entidades nuevas ni valores nuevos. Lo que sigue es qué queda, qué deja de existir y qué se
queda con otro nombre.

## 1. La tasa

Un número de 0 a 1. **La única forma en que el sistema expresa una parte de un todo**, hacia adentro
y hacia afuera.

|                |                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------- |
| qué es         | una fracción, 0 a 1 inclusive                                                                 |
| quién la juzga | el predicado que ya existe, sin cambios                                                       |
| dónde aparece  | en el contrato, en los archivos de configuración, en la semilla, en las entidades, en los DTO |

**Invariantes**

- **No tiene competencia.** No existe ninguna otra representación del mismo número en ninguna
  parte del sistema.
- **No se convierte.** Entra como tasa y sale como tasa; no hay punto donde cambie de unidad.
- Sigue siendo un número, no un objeto: el dominio la opera —suma pesos con tope, compara contra
  umbrales, multiplica— como hasta ahora.

**Por qué no se envuelve en un valor con reglas**: se evaluó y se descartó (research R-02). Envolver
protegía contra confundir dos representaciones; sin dos representaciones no hay qué confundir, y el
costo —~110 sitios y aritmética por métodos, parte de ella en el camino crítico— compraría muy
poco.

## 2. Lo que deja de existir

| Qué                                                                            | Dónde estaba                                    |
| ------------------------------------------------------------------------------ | ----------------------------------------------- |
| El factor de conversión                                                        | cuatro declaraciones, tres anillos              |
| El juicio "esto es un porcentaje válido"                                       | tres escrituras con tres severidades            |
| El mensaje de error de un porcentaje inválido                                  | duplicado palabra por palabra entre dos módulos |
| Las conversiones, en los dos sentidos                                          | ~10 sitios                                      |
| El mapa que traducía el nombre de una tasa al nombre de su campo de porcentaje | existía sólo porque había dos vocabularios      |

**Invariante**: después del cambio, buscar el factor en el repositorio no encuentra nada, **salvo**
la granularidad del reparto, que se llama distinto y dice por qué.

## 3. La granularidad del reparto

**Se queda.** Es en cuántas cubetas se divide la población para asignar un visitante.

|                  |                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| qué es           | la resolución del reparto: hoy cien cubetas, o sea centésimos                                       |
| qué **no** es    | un factor de conversión, aunque hoy valga lo mismo                                                  |
| por qué se queda | el día que el reparto quiera más resolución, este número cambia y no hay nada más que cambie con él |

**Invariantes**

- Cambia de nombre a uno que diga lo que es. Dejarla llamándose "porcentaje" dentro de una feature
  que elimina los porcentajes sería sembrar la próxima confusión.
- Lleva su motivo escrito al lado.
- **El algoritmo que la usa no se toca**: los mismos visitantes obtienen los mismos brazos.
- La comparación del reparto contra el holdout, que hoy pasa por enteros, se reescribe en tasas y
  **tiene que dar el mismo veredicto**.

## 4. Los ocho campos del contrato

Todos cambian de unidad y de nombre; ninguno cambia de significado.

| Concepto                                 | Dónde se declara                                  | Dónde se lee               |
| ---------------------------------------- | ------------------------------------------------- | -------------------------- |
| reparto de tratamiento de un experimento | al abrirlo                                        | al leerlo                  |
| cortes de un experimento (una lista)     | al abrirlo                                        | al leerlo                  |
| holdout de un merchant                   | defaults de tratamiento y configuración declarada | configuración efectiva     |
| techo de incentivo                       | política comercial                                | configuración efectiva     |
| escalera de incentivos (una lista)       | política comercial                                | configuración efectiva     |
| margen (opcional)                        | política comercial                                | configuración efectiva     |
| valor de un incentivo concedido          | —                                                 | decisión que el SDK recibe |

**Invariantes**

- El **opcional** sigue siéndolo: ausente no es inválido.
- Las **listas** se juzgan elemento por elemento y el error nombra el índice, como hoy.
- Los **cortes** siguen teniendo su regla propia —estrictamente crecientes por encima de cero—, que
  es del experimento y no de la unidad.
- El **mínimo del incentivo** se expresa en la unidad nueva sin cambiar lo que significa. Escribirlo
  mal sería cometer, en el contrato, el error que la feature elimina.

## 5. Lo que el contrato promete sobre la precisión

Hoy los enteros imponen pasos de un centésimo. Con tasas, el contrato **no restringe** la
precisión y **declara a qué resuelve el sistema**.

**Invariantes**

- Un valor más fino que la granularidad del reparto se acepta y se resuelve a la cubeta más
  cercana; la descripción del campo lo dice.
- Es **más permisivo que hoy**: un valor que antes no se podía declarar ahora se puede, y produce el
  reparto más cercano. Es un cambio de comportamiento chico y está nombrado.

## 6. El vocabulario de estados de un experimento

**Sin cambios de significado**: los mismos tres estados.

| Antes                                                                         | Después                                                     |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| el dominio declara el tipo; el composition root vuelve a listar los literales | el dominio declara **la lista** y el tipo se deriva de ella |

**Invariantes**

- Una sola declaración. Agregar un estado es agregarlo ahí, y todo lo demás se entera.
- Es el idioma que el kernel ya usa para las barreras, los anclajes y los motivos de `NO_OP`.
- El mensaje que rechaza un estado desconocido lista los que existen **en ese momento**.

## 7. Lo que queda escrito, no arreglado

La forma de un identificador de experimento: la semilla admite más que lo que el sistema acuña.

**Invariante**: la diferencia queda **registrada con su motivo** —la semilla acepta identificadores
que vienen de otro lado— o, si al escribirlo resulta que no hay motivo, se unifican. Lo que no queda
es como está.
