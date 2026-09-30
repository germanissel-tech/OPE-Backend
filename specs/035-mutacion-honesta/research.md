# Research — El gate de mutación no informa números de otra corrida (035)

Cinco preguntas. Las respuestas salen de leer `scripts/mutation-diff.mjs`,
`tests/governance/mutation-diff.test.ts`, `scripts/audit/gate-mutation.mjs` y `scripts/lib.mjs`, y **una
de ellas cambia el diseño** que la spec daba por obvio: el fechado del reporte no puede vivir donde
parecía.

---

## R-01 — Dónde se lee el veredicto hoy, y por qué `--check-report` queda afuera

El script tiene **tres** caminos y sólo dos corren Stryker:

| Camino                | Corre Stryker | Qué hace con el reporte                                                                     |
| --------------------- | ------------- | ------------------------------------------------------------------------------------------- |
| bloqueante (el gate)  | sí            | lee el reporte y calcula supervivientes; hoy lo hace **antes** de mirar el código de salida |
| informativo (`--all`) | sí            | lee el reporte; hoy **descarta** el código de salida por completo                           |
| `--check-report`      | **no**        | lee el **último** reporte a propósito: su trabajo es revisarlo                              |

**Decisión**: la comprobación de frescura **no va en `readReport()`**, que es lo que la spec sugería sin
decirlo. Si fuera ahí, `--check-report` —cuyo único trabajo es mirar el último reporte, y que corre en
`release-check`— empezaría a fallar siempre, porque ese reporte es por definición de otra corrida.

**Consecuencia de diseño**: la frescura es una propiedad de **una corrida**, no del archivo. Va donde se
corre Stryker, junto al código de salida, y las dos preguntas se contestan en el mismo lugar.

**Alternativa descartada**: un parámetro en `readReport()` (`readReport({ freshSince })`). Pone la
decisión en el lector y deja que el llamador se olvide de pasarlo, que es exactamente la clase de olvido
que esta feature trata.

---

## R-02 — Qué identifica a una corrida, y dónde está el borde del fechado

Una corrida no tiene identificador: Stryker no escribe uno en el reporte. Lo que sí hay es **el instante
en que arrancó**, que el script conoce porque es él quien la lanza, y **la fecha de modificación del
reporte**, que el sistema de archivos da.

**Decisión**: se toma el instante antes de lanzar Stryker y se compara contra la fecha del reporte. Un
reporte cuya fecha es **anterior** a ese instante es de otra corrida.

**El borde, que FR-005 fija**: la comparación es estricta —`mtime < arranque` es viejo—, así que un
reporte escrito en el mismo milisegundo cuenta como de esta corrida. No es una precaución teórica: las
fechas de archivo no tienen la misma resolución en todos los sistemas de archivos, y un gate que falle
porque dos instantes cayeron juntos sería peor que el defecto que arregla. El margen real es enorme (una
corrida dura minutos), así que el sesgo elegido es el seguro: ante la duda, **es de esta corrida**.

**Descartado**: comparar por contenido (un hash del reporte anterior). Cuesta leer y hashear el archivo
dos veces y no responde la pregunta — dos corridas que juzgan lo mismo escriben el mismo contenido, y
entonces un reporte legítimo se vería como repetido.

---

## R-03 — Las dos rutas no están igual de mal, y la informativa está peor

- **Bloqueante**: `const status = runStryker(...)` y `failed = error !== null || status !== 0 || findings.length > 0`.
  El código de salida **sí** se mira, y por eso las dos corridas caídas de la feature 034 fallaron
  (`exit=1` las dos veces). El defecto es que los supervivientes se calculan y se emiten antes.
- **Informativa** (`--all`): `runStryker([...])` **sin capturar el valor**. Una corrida caída ahí informa
  cifras viejas y **sale 0**.

**Decisión**: las dos pasan por la misma función, y el modo informativo deja de ser un éxito cuando la
corrida no terminó. Sus supervivientes siguen siendo informativos —eso no cambia— pero «no hubo corrida»
no es un resultado informativo, es la ausencia de uno.

---

## R-04 — Cómo se prueba sin correr Stryker doce minutos

`tests/governance/mutation-diff.test.ts` importa el módulo y llama **funciones exportadas puras**:
`mutableFilter`, `rangesFromDiff`, `decide`, `guardZeroTests`, `survivors`, `ignoredOutsideDisable`. Ese es
el idioma del archivo y la razón de que el script tenga esa forma.

**Decisión**: la regla nueva es **una función exportada pura** que recibe los tres datos de la corrida
—código de salida, instante de arranque, fecha del reporte— y devuelve el motivo por el que no hay
veredicto, o nada. La prueba la llama con valores; no lanza procesos, no toca el disco y corre en
milisegundos.

Lo que eso implica y conviene decir: la prueba fija **la regla**, no el cableado. Que los dos modos la
llamen es una línea en cada uno, y lo que lo verifica es la corrida real del gate (el quickstart) más el
hecho de que `--json` ya se consume en la cadena de auditoría (R-05).

**Descartado**: una prueba que lance el script con un Stryker falso (un ejecutable de mentira en el PATH).
Verifica el cableado además de la regla, y cuesta un fixture ejecutable por caso más un PATH manipulado en
Windows; el rendimiento no es el problema, la fragilidad sí.

---

## R-05 — Qué no puede cambiar de la salida, y quién ya sabe leer un error

Para una persona, `emit` imprime los findings uno por línea y **después** el error por `stderr`. Con cero
findings, el error es la última línea — que es exactamente lo que SC-002 pide, y no hace falta cambiar
`emit` para conseguirlo: **hace falta no emitir findings**, que es lo que la feature hace.

Para una máquina, `--json` emite `{ gate, mode, status, findings, error? }`. Y el consumidor que importa
—`scripts/audit/gate-mutation.mjs`, el adaptador del gate en la auditoría de arquitectura— ya hace:

```js
if (parsed.error !== undefined) fail(parsed.error);
```

**Hallazgo**: el campo por el que se informa esto **ya existe y ya se respeta aguas abajo**. El gate nunca
lo usó para este caso, nada más. Ningún consumidor cambia, y el mensaje nuevo llega hasta el reporte de
auditoría por el camino que ya estaba.

**Lo que se conserva literal**: el camino feliz. `test:mutation — every mutant died.` y
`test:mutation — N mutant(s) survived.` con sus líneas `archivo:línea: mensaje`. Quien lee el gate todos los
días lo reconoce por esas líneas, y cambiarlas sería el costo escondido de un arreglo que nadie pidió.

---

## Lo que esta feature deja como estaba, con su motivo

- **Los tiempos de espera** (`dryRunTimeoutMinutes`, `hookTimeout` de la suite de mutación): se ajustaron
  en la feature 034 con su medición fechada al lado. Esta feature es sobre lo que el gate **dice** cuando
  una corrida se cae, no sobre hacer que no se caiga.
- **El veredicto**: qué cuenta como superviviente, `ignoreStatic`, los mutadores excluidos y las
  excepciones en línea son materia de **ADR-016** y no se tocan.
- **El archivo incremental**: no se borra ni se invalida cuando una corrida se cae. Es correcto que
  sobreviva —guarda veredictos de mutantes que sí se juzgaron en corridas que sí terminaron— y tocarlo
  sería tirar trabajo bueno por un fallo ajeno.
