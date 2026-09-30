# Feature Specification: El gate de mutación no informa números de otra corrida

**Feature Branch**: `035-mutacion-honesta`

**Created**: 2026-09-30

**Status**: Draft

**Input**: Descripción del dueño, 2026-09-30, cerrando **D-31** con la evidencia de las dos corridas
caídas de la feature 034.

## Por qué existe

El gate de mutación corre Stryker y después lee el reporte JSON que Stryker deja en disco. Cuando la
corrida **no llega a juzgar**, ese archivo es el de la corrida **anterior**, y el gate informa esas cifras
como si fueran de ésta.

Pasó dos veces en la cadena de cierre de la feature 034, las dos verificadas:

1. La corrida inicial pasó el tiempo que Stryker da por defecto. El gate imprimió `3 mutant(s) survived`
   señalando líneas que una reestructuración de ese mismo día había borrado.
2. Un hook de siembra pasó su tiempo dentro del sandbox instrumentado. El gate imprimió
   **`0 mutant(s) survived`** — el número que quien corre el gate está esperando ver.

**Lo que salva a esto de ser grave, y hay que decirlo para no exagerar el problema**: el veredicto no fue
verde. El gate mira el código de salida de Stryker y falla igual; `exit=1` las dos veces. No hay riesgo de
que un cambio entre con mutantes vivos. Lo que hay es un mensaje que dice el motivo equivocado, sobre una
corrida de doce minutos que se lee por su última línea.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Una corrida que no terminó no informa cifras (Priority: P1)

Quien corre el gate de mutación y la corrida se cae —por un tiempo de espera, por una configuración
inválida, por un runner que murió— lee que **la corrida no terminó**, con el código con que salió, y no
lee ningún número. Sin cifras que interpretar, la única acción posible es la correcta: mirar la salida de
Stryker, que ya está en la terminal.

**Why this priority**: es el defecto que D-31 registra y el caso que se vio dos veces. Sin esto, la línea
final del gate puede afirmar lo contrario de lo que pasó.

**Independent Test**: se provoca una salida distinta de 0 de la corrida con un reporte previo en disco y
se comprueba que lo informado nombra la corrida caída y no contiene cifras de mutantes.

**Acceptance Scenarios**:

1. **Given** un reporte de una corrida anterior en disco, **When** la corrida termina con un código
   distinto de 0, **Then** lo informado dice que la corrida no terminó, con su código, y no incluye
   ningún superviviente ni ningún conteo.
2. **Given** esa misma situación, **When** se mira el resultado del gate, **Then** el gate falla, como
   falla hoy: lo que cambia es lo que dice, no su veredicto.
3. **Given** una corrida que sí termina, **When** se informa el resultado, **Then** informa exactamente
   lo que informa hoy: los supervivientes con su archivo y su línea, o que todos murieron.

---

### User Story 2 - Un reporte que no es de esta corrida se reconoce como tal (Priority: P2)

Quien corre el gate nunca recibe números que el gate no produjo, **aunque la corrida diga que terminó
bien**. Si el reporte que hay en disco es anterior al momento en que arrancó la corrida, es de otra
corrida y el gate lo dice en lugar de leerlo.

**Why this priority**: la historia 1 cierra el caso que apareció; ésta cierra la clase. La causa raíz no
es el código de salida, es confiar en un archivo en disco sin preguntar de qué corrida es — y hay más de
una forma de que un archivo viejo sobreviva a una corrida que no lo reescribió.

**Independent Test**: se deja un reporte con fecha anterior al arranque de la corrida, se hace que la
corrida termine con código 0 sin reescribirlo, y se comprueba que lo informado nombra el reporte viejo.

**Acceptance Scenarios**:

1. **Given** un reporte cuya fecha de modificación es anterior al arranque de la corrida, **When** la
   corrida termina con código 0, **Then** lo informado dice que el reporte no es de esta corrida y el
   gate falla.
2. **Given** un reporte escrito durante la corrida, **When** la corrida termina con código 0, **Then** se
   informa su contenido con normalidad.

---

### User Story 3 - La barrida informativa tampoco miente (Priority: P3)

Quien corre la barrida completa —la que mutila todo y cuyos supervivientes son informativos— recibe el
mismo trato: si la corrida no terminó o el reporte no es de ella, lo informado lo dice y el resultado no
es un éxito.

**Why this priority**: es la ruta que hoy está **peor** que la del gate, porque descarta el código de
salida por completo y puede informar cifras viejas terminando con éxito. Es P3 porque sus cifras no
bloquean ningún cambio: nadie decide con ellas en el momento, se leen como tendencia.

**Independent Test**: se provoca una corrida caída en el modo informativo y se comprueba que el resultado
no es un éxito y que no informa cifras.

**Acceptance Scenarios**:

1. **Given** el modo informativo, **When** la corrida termina con un código distinto de 0, **Then** lo
   informado dice que no terminó y el resultado no es un éxito.

---

### Edge Cases

- **No hay reporte en disco.** Ya está cubierto hoy y se conserva: el gate dice que la corrida no escribió
  reporte. Lo que esta feature agrega es el caso más engañoso, que es que **sí** haya uno.
- **El gate decide no correr nada** (el cambio no toca código que se mutile): sigue informando que se
  salteó, sin cifras y sin fallar. Una corrida que no ocurrió no es una corrida caída.
- **La corrida termina bien y no hay supervivientes**: el camino feliz, que es el que no tiene que cambiar
  de forma. Quien lee el gate todos los días lo reconoce por esa línea.
- **Un reporte escrito por una corrida concurrente**: fuera de alcance como observación práctica —el gate
  no se corre dos veces a la vez en la misma copia de trabajo— pero el fechado lo trata igual, porque
  compara contra el arranque de **esta** corrida.
- **Relojes y sistemas de archivos con poca resolución en la fecha**: el fechado tiene que tolerar que la
  fecha del reporte y el arranque de la corrida caigan en el mismo instante; un reporte escrito "al mismo
  tiempo" es de esta corrida.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Cuando la corrida de mutación termina con un código distinto de 0, el gate MUST informar que
  la corrida no terminó, incluyendo ese código, y MUST NOT informar supervivientes ni conteos.
- **FR-002**: En esa situación el gate MUST fallar, igual que hoy: la feature cambia lo que se dice, no el
  veredicto.
- **FR-003**: El gate MUST NOT leer el reporte cuando la corrida no terminó: un número que no se produjo
  no se informa ni se calcula.
- **FR-004**: El gate MUST reconocer como ajeno un reporte cuya fecha de modificación sea anterior al
  momento en que arrancó la corrida, informarlo y fallar, cualquiera sea el código de salida.
- **FR-005**: Un reporte escrito en el mismo instante en que arrancó la corrida MUST tratarse como de esta
  corrida, para que la resolución del sistema de archivos no produzca fallos falsos.
- **FR-006**: El modo informativo MUST recibir el mismo trato que el bloqueante en los dos casos
  anteriores, y su resultado MUST NOT ser un éxito cuando la corrida no terminó.
- **FR-007**: El camino feliz MUST informar exactamente lo que informa hoy, en el mismo formato: los
  supervivientes con archivo, línea y motivo, o que todos murieron; y en su forma para máquinas, los mismos
  campos.
- **FR-008**: Los otros caminos del gate que hoy no corren Stryker —el que sólo revisa el último reporte y
  el que se saltea porque no hay nada que mutilar— MUST seguir comportándose como hoy.
- **FR-009**: Las pruebas de gobernanza del gate MUST cubrir los tres casos nuevos: corrida caída, reporte
  ajeno con código 0, y camino feliz.

### Key Entities

- **Corrida de mutación**: una ejecución de la herramienta. Termina o no termina; sólo si termina hay
  veredicto. Su identidad para esta feature es el instante en que arrancó.
- **Reporte**: el archivo con el resultado de una corrida. Tiene contenido y tiene **fecha**, y hasta ahora
  el gate leía lo primero sin mirar lo segundo.
- **Veredicto**: lo que el gate informa. Puede ser "todos murieron", "sobrevivieron éstos" o —lo que esta
  feature agrega— "no hubo veredicto".

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: **Ninguna salida del gate contiene una cifra de mutantes que el gate no produjo en esa
  ejecución.** Verificable provocando las dos situaciones —corrida caída y reporte ajeno— con un reporte
  previo en disco, y comprobando que lo informado no las menciona.
- **SC-002**: En las dos situaciones, quien lee **sólo la última línea** de la salida entiende que no hay
  veredicto. Es el criterio que nace del caso real: la corrida dura minutos y se lee por el final.
- **SC-003**: El veredicto no cambia en ningún caso que hoy ya decide bien: lo que hoy falla sigue
  fallando y lo que hoy pasa sigue pasando, verificado con las pruebas de gobernanza existentes sin
  cambiarlas de expectativa.
- **SC-004**: La salida del camino feliz es idéntica a la de hoy, en las dos formas —para una persona y
  para una máquina—, verificado sobre una corrida real del gate.
- **SC-005**: Las tres situaciones nuevas quedan cubiertas por pruebas que fallan si el arreglo se
  revierte, y el cambio pasa la cadena de calidad completa del repositorio.

## Assumptions

- **Un código de salida distinto de 0 significa que la corrida no terminó**, nunca "sobrevivieron
  mutantes". Verificado: la configuración no fija un umbral que rompa, y el veredicto se lee del reporte
  porque la herramienta no lo ofrece en su línea de comandos. Si algún día se fijara ese umbral, esta
  suposición deja de valer y el gate tendría que distinguir los dos códigos — queda dicho acá para que se
  note.
- **La salida de la herramienta ya es visible** para quien corre el gate: se hereda la consola. El gate no
  necesita capturar ni repetir el error; le alcanza con no tapar lo que ya está a la vista.
- **La fecha del archivo es suficiente** para saber si el reporte es de esta corrida, dado que el gate no
  se ejecuta dos veces a la vez sobre la misma copia de trabajo.
- El resto del gate —qué se mutila, qué cuenta como superviviente, las excepciones en línea, los tiempos de
  espera— **no se toca**. Los tiempos se ajustaron en la feature 034 con su motivo escrito, y el veredicto
  es materia de ADR-016.

## Fuera de alcance, con su motivo

- **D-32** (un bucle de peticiones inyectadas agota el heap): otra deuda, cuyo primer paso es un
  diagnóstico y cuyo resultado se desconoce. No se mezcla con un arreglo de alcance cerrado.
- **Los tiempos de espera** de la corrida y de la suite de mutación: ya ajustados en la feature 034.
- **Qué cuenta como superviviente** y los mutadores excluidos: un cambio ahí es un cambio de ADR-016.
- **Que el gate explique _por qué_ se cayó la corrida** más allá del código de salida: la salida de la
  herramienta ya lo dice, y repetirla sería mantener dos versiones del mismo mensaje.
