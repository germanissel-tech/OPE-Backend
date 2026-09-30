# Data model — El gate de mutación no informa números de otra corrida (035)

No hay entidades de dominio ni migraciones: la feature es una herramienta. Lo que sí hay son **tres formas
que ya existen** y una regla nueva entre ellas, y escribirlas acá es lo que evita que la implementación las
invente de nuevo.

## Las tres formas que ya existen

| Forma                 | Dónde vive                     | Qué le agrega esta feature                                                            |
| --------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| **La corrida**        | el código de salida de Stryker | **el instante en que arrancó**, que es lo único que le faltaba para ser identificable |
| **El reporte**        | `reports/mutation/report.json` | nada al archivo; se empieza a mirar su **fecha de modificación**                      |
| **Lo que se informa** | `emit(...)`, en dos formas     | nada a la forma: el campo `error` ya existe y ya se respeta aguas abajo               |

La tercera fila es el hallazgo de la fase 0 que más trabajo ahorra: `--json` ya emite `error`, y
`scripts/audit/gate-mutation.mjs` ya hace `fail(parsed.error)`. **Ningún consumidor cambia.**

## La regla nueva

Una función pura, exportada para que la prueba de gobernanza la llame sin lanzar procesos (research R-04).
Recibe lo que se sabe de la corrida y devuelve **el motivo por el que no hay veredicto**, o nada cuando lo
hay.

| Entrada              | Qué es                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| código de salida     | lo que devolvió Stryker. Distinto de 0 significa **no terminó** (ver la suposición de la spec) |
| instante de arranque | el milisegundo en que el script lanzó la corrida                                               |
| fecha del reporte    | la fecha de modificación del archivo, o nada si no existe                                      |

| Salida                          | Cuándo                                                                  |
| ------------------------------- | ----------------------------------------------------------------------- |
| «no terminó, código N»          | el código es distinto de 0. **El archivo no se mira** (FR-003)          |
| «no escribió reporte»           | código 0 y el archivo no existe. Es el mensaje que ya existe hoy        |
| «el reporte es de otra corrida» | código 0 y la fecha es **anterior** al arranque                         |
| nada                            | código 0 y la fecha es igual o posterior al arranque: **hay veredicto** |

**El borde, escrito una vez y verificado por una prueba**: la comparación es estricta. Un reporte escrito en
el mismo milisegundo que el arranque es de **esta** corrida (FR-005). El sesgo es deliberado y va hacia el
lado seguro, porque un gate que falla cuando no debe cuesta más que el defecto que arregla, y el margen real
es de minutos contra milisegundos.

## Qué no cambia de forma

- El reporte de Stryker: ni su nombre, ni su contenido, ni quién lo escribe.
- El archivo incremental: sobrevive a una corrida caída, y eso es correcto — guarda veredictos de mutantes
  que sí se juzgaron en corridas que sí terminaron.
- El cálculo de supervivientes, los ignorados fuera de rango y la guarda de «cero pruebas ejecutadas»: las
  tres siguen exactamente como están, y sus pruebas no cambian de expectativa.
- `--check-report`: su trabajo es mirar el último reporte, así que la frescura no le aplica (research R-01).
