# Data model — fase 1 (039)

No hay entidades de dominio: la feature no toca `src/`. Lo que sí tiene estructura es **la clasificación de
las pruebas**, que es lo que el código nuevo lee y verifica. Esto es su forma.

## Las dos categorías de una prueba de durabilidad

|                             | Prueba de comportamiento                                                                                                                                       | Prueba de medición                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Qué afirma                  | una garantía: lo escrito se lee igual, la idempotencia es atómica, un merchant no ve a otro, un fallo degrada con motivo, el índice se usa, el turno se espera | una cifra contra un techo: percentil de latencia, tamaño de un snapshot, costo de un turno |
| De qué depende su resultado | del código                                                                                                                                                     | del código **y de la máquina**                                                             |
| Decide si un cambio entra   | **sí**                                                                                                                                                         | **no**                                                                                     |
| Quién la corre              | la verificación de todo cambio                                                                                                                                 | quien quiere el número                                                                     |
| Cuántas hay hoy             | 20 archivos, 193 casos                                                                                                                                         | 3 archivos, 4 casos (más 3 archivos del proyecto `fast`)                                   |

**La frontera, dicha en una regla**: si el resultado puede cambiar porque la máquina está ocupada, es una
medición. No es una cuestión de qué directorio ni de qué nombre: la prueba de la ventana de administración
vive en `tests/durability/` y mide; la del plan de consulta vive al lado y afirma que el índice se usa, que
es verdad o mentira independientemente del reloj.

## La declaración de mediciones

Una constante exportada de la configuración de pruebas. Cada entrada es una **ruta de archivo** —no un
glob— porque una ruta se puede verificar contra el disco y un glob sólo se puede volver a interpretar.

| Campo | Qué es                                             | Regla                             |
| ----- | -------------------------------------------------- | --------------------------------- |
| ruta  | el archivo de prueba, relativo a la raíz, en POSIX | MUST existir en el disco (FR-006) |

Su contenido de hoy, que es evidencia del estado y no la fuente —la fuente es la constante—:
`tests/integration/ingest-latency.test.ts`, `tests/integration/catalog-size.test.ts`,
`tests/integration/outcomes-latency.test.ts`, `tests/durability/ingest-latency.test.ts`,
`tests/durability/rebuild-latency.test.ts`, `tests/durability/admin-concurrency.test.ts`.

**Quién la lee**, y es la mitad que hace que valga:

| Lector                        | Para qué                                                        |
| ----------------------------- | --------------------------------------------------------------- |
| el proyecto de durabilidad    | excluirlas: lo que decide es comportamiento                     |
| el proyecto de mediciones     | incluirlas: es lo que corre quien quiere el número              |
| la configuración de mutación  | excluirlas, que es lo que hoy hace con una lista escrita a mano |
| la verificación de gobernanza | cruzarla contra el disco, en los dos sentidos                   |

## La verificación, en los dos sentidos

| Qué se compara                                                | Falla cuando                  | Mensaje                                               |
| ------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------- |
| cada archivo de `tests/durability/` contra las dos categorías | un archivo no está en ninguna | nombra el archivo, y dice las dos categorías posibles |
| cada ruta declarada como medición contra el disco             | la ruta no existe             | nombra la ruta: la declaración quedó vieja            |

Las dos direcciones hacen falta por la misma razón que en `check:instructions`: con sólo la primera, borrar
un archivo deja una declaración mintiendo; con sólo la segunda, agregar uno lo deja sin correr.

**Lo que esta verificación no hace**, y conviene no confundir: no juzga si una prueba está bien clasificada.
Que la del plan de consulta sea comportamiento y la de la ventana sea medición lo decide quien las escribe,
con la regla de la frontera; el gate comprueba que **alguien lo decidió**.

## Estados y transiciones

Un archivo de prueba de durabilidad tiene exactamente tres estados posibles, y uno de ellos rompe el build:

```
nuevo  ──┬──> comportamiento   (en el proyecto de durabilidad; decide)
         ├──> medición         (declarado; corre cuando alguien quiere el número)
         └──> sin clasificar   ──> el build falla nombrándolo
```

El tercer estado existe hoy y es invisible. Después de la feature existe por un instante: el que pasa entre
crear el archivo y correr los gates.
