# Implementation Plan: El gate de mutación no informa números de otra corrida

**Branch**: `035-mutacion-honesta` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/035-mutacion-honesta/spec.md`

## Summary

Cierra **D-31**. El gate de mutación lee el reporte que Stryker deja en disco sin preguntar de qué corrida
es; cuando la corrida no llega a juzgar, informa las cifras de la anterior. Pasó dos veces en la cadena de
cierre de la feature 034, y la segunda vez dijo «0 supervivientes».

El arreglo son **una función pura y dos llamadas**: una regla que recibe el código de salida de la corrida,
el instante en que arrancó y la fecha del reporte, y responde si hay veredicto o por qué no; y los dos
modos que corren Stryker preguntándosela antes de leer el reporte. El tercer modo —`--check-report`, cuyo
trabajo **es** mirar el último reporte— queda intacto, y eso es un hallazgo de la fase 0 y no un olvido.

## Technical Context

**Language/Version**: JavaScript de Node 24 (`.mjs`), verificado con `checkJs` y JSDoc en toda función
exportada (ADR-011, ADR-012). No hay TypeScript en `scripts/`.

**Primary Dependencies**: ninguna nueva. `node:fs` para la fecha del archivo, que el script ya importa.

**Storage**: N/A. El único archivo en juego es `reports/mutation/report.json`, que Stryker escribe.

**Testing**: Vitest, proyecto `tools` (`tests/governance/mutation-diff.test.ts`), llamando funciones
exportadas puras — el idioma que ese archivo ya usa.

**Target Platform**: la cadena de calidad local y CI (Linux). El fechado tiene que tolerar la resolución de
fechas de los dos.

**Project Type**: herramienta del repositorio. Cero cambios en `src/`, cero en el contrato.

**Performance Goals**: N/A. La regla nueva es una comparación de números; lo que cuesta minutos es Stryker,
que no cambia.

**Constraints**: la salida del camino feliz **idéntica** a la de hoy, en las dos formas (FR-007). El modo
`--check-report` sin cambios (FR-008).

**Scale/Scope**: un archivo de `scripts/`, un archivo de `tests/governance/`. Tres casos nuevos de prueba.

## Constitution Check

_Constitución **v1.4.4**. Se evalúan los once principios; los que no aplican se marcan como tales._

| Principio                                           | Veredicto                                  | Por qué                                                                                                                                                                                                                                              |
| --------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**                    | ➖ no aplica                               | No hay módulos ni autoridades de dominio en juego: es una herramienta del repositorio.                                                                                                                                                               |
| **II. Fail-closed**                                 | ✅ cumple, **y es la forma del arreglo**   | Ante la ausencia de veredicto el gate falla y lo dice, en vez de informar el veredicto de otra corrida. La ausencia de información no se rellena con información vieja.                                                                              |
| **III. La medición precede y no se contamina**      | ✅ cumple                                  | No cambia qué se mide. Cambia que una medición que no ocurrió deja de presentarse como una que sí.                                                                                                                                                   |
| **IV. Dos caminos, dos garantías**                  | ➖ no aplica                               | Nada de esto corre en runtime: es una herramienta de desarrollo y de CI.                                                                                                                                                                             |
| **V. Aislamiento por merchant**                     | ➖ no aplica                               | No hay datos de merchant en juego.                                                                                                                                                                                                                   |
| **VI. Identidad explícita, idempotencia explícita** | ✅ cumple, en su versión de herramienta    | La feature le da a una corrida lo único que le faltaba para ser identificable: **cuándo arrancó**. Es la misma idea —una cosa se identifica antes de razonar sobre ella— aplicada al gate.                                                           |
| **VII. OPE observa comportamiento, no personas**    | ➖ no aplica                               | Ningún dato personal, ninguna observación.                                                                                                                                                                                                           |
| **VIII. Cero modelos de lenguaje en runtime**       | ➖ no aplica                               | Ninguna inferencia, ningún modelo.                                                                                                                                                                                                                   |
| **IX. Nada entra al reporte sin trazabilidad**      | ✅ cumple, **y es el principio que sirve** | El principio es sobre el reporte del producto, y su equivalente acá es exacto: ninguna cifra entra a la salida del gate sin que el gate la haya producido. Hoy podía entrar una cifra sin trazabilidad a ninguna corrida.                            |
| **X. Puertos en los dos bordes**                    | ➖ no aplica                               | No hay puertos ni adaptadores: `scripts/` es una herramienta, fuera de los anillos (ADR-013).                                                                                                                                                        |
| **XI. Ninguna política vive en el código**          | ✅ cumple                                  | No se agrega ningún valor de comportamiento. El único número nuevo es el instante de arranque, que es un hecho de la corrida y no una política; los umbrales y tiempos de espera siguen donde están, con su motivo (ADR-016, `stryker.config.json`). |

**Veredicto**: pasa, **sin excepciones**. Y vale registrar por qué el Governance de la constitución no
objeta la complejidad añadida: la pregunta es «¿contribuye a producir un número confiable de contribución
incremental?», y esto es literalmente eso — un gate que informa cifras que no produjo es un número no
confiable en la cadena que sostiene todo lo demás.

## Project Structure

### Documentation (this feature)

```text
specs/035-mutacion-honesta/
├── plan.md              # Este archivo
├── research.md          # Fase 0: cinco preguntas, y una cambia el diseño obvio
├── data-model.md        # Fase 1: las tres formas en juego y la regla como tabla
├── quickstart.md        # Fase 1: cómo se verifica, incluido provocar una corrida caída
├── checklists/
│   └── requirements.md  # Calidad de la spec
└── tasks.md             # Fase 2 (`/speckit-tasks`)
```

### Source Code (repository root)

```text
scripts/
└── mutation-diff.mjs          # la regla nueva (exportada) y las dos llamadas

tests/governance/
└── mutation-diff.test.ts      # los tres casos nuevos, sobre la función exportada
```

**Structure Decision**: ningún archivo nuevo. La regla vive en el script que la usa, exportada para que la
prueba la llame — que es cómo ese script ya expone todo lo que se verifica (R-04). Un módulo aparte para
una función de cuatro líneas partiría en dos lo que se lee junto.

## Diseño

### La regla, como tabla

Tres datos de entrada y una salida: el motivo por el que **no** hay veredicto, o nada.

| Código de salida | Reporte en disco               | Respuesta                                                     |
| ---------------- | ------------------------------ | ------------------------------------------------------------- |
| distinto de 0    | cualquiera                     | la corrida no terminó, con su código                          |
| 0                | no existe                      | la corrida no escribió reporte (el mensaje que ya existe hoy) |
| 0                | fecha **anterior** al arranque | el reporte es de otra corrida                                 |
| 0                | fecha igual o posterior        | **hay veredicto**: se lee                                     |

El orden de las filas es el orden de las preguntas, y no es indistinto: con un código distinto de 0 no se
mira el archivo **para nada** (FR-003), porque un número que no se produjo no se calcula ni para
descartarlo.

### Dónde entra en cada modo

- **Bloqueante**: se toma el instante, se corre Stryker, se pregunta la regla. Si hay motivo:
  `emit({ status: "fail", findings: [], error: motivo })` y el gate falla. Si no, todo sigue como hoy.
- **Informativo (`--all`)**: lo mismo, y su resultado **deja de ser un éxito** cuando no hay veredicto. Sus
  supervivientes siguen siendo informativos; lo que no es informativo es la ausencia de corrida.
- **`--check-report`**: **no se toca**. Su trabajo es mirar el último reporte, así que la frescura no le
  aplica (R-01). Corre en `release-check` y tiene que seguir pasando.

### Por qué no hace falta tocar ningún consumidor

`--json` ya emite un campo `error`, y `scripts/audit/gate-mutation.mjs` ya hace `fail(parsed.error)`. El
mensaje nuevo llega al reporte de auditoría por el camino que ya estaba (R-05). Para una persona, `emit`
imprime el error **después** de los findings, así que con cero findings queda como última línea, que es lo
que SC-002 pide.

## Constitution Check — re-evaluación después del diseño

Sin cambios: los once principios igual que arriba, sin excepciones. El diseño agrega una cosa que el check
merece registrar: la regla se implementa como **función pura exportada**, lo que la pone bajo la misma
cobertura que el resto del script y evita la única forma en que este arreglo podría ser peor que el
defecto — un gate que falla cuando no debe, por un fechado demasiado estricto. FR-005 fija el sesgo seguro
y la prueba lo afirma.

## Riesgos

- **Un fechado que produzca fallos falsos** sería peor que el defecto: el gate corre en cada feature y un
  falso rojo en una corrida de doce minutos cuesta caro. Mitigado por la comparación estricta (FR-005) y
  por el margen real, que son minutos contra milisegundos.
- **Que `--check-report` se rompa sin que nadie lo note en el momento**: corre en `release-check`, al final
  de la cadena. Mitigado porque la fase 0 lo identificó y el plan lo declara intocado; el quickstart lo
  corre.
- **Que el camino feliz cambie de texto** y quien lee el gate todos los días pierda la línea que reconoce.
  Mitigado por FR-007 y por correr el gate de verdad en el quickstart, comparando la salida.
