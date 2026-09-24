# Feature Specification: El reparto no se ajusta en silencio

**Feature Branch**: `023-reparto-sin-ajuste-silencioso`

**Created**: 2026-09-24

**Status**: Draft

**Input**: Decisión del dueño del 2026-09-24, challengeando el comentario de
`Experiment.withinHoldout`: «¿podemos mejorarlo limitando a 2 decimales?». La medición de esa
pregunta encontró que el ajuste al balde más cercano ocurre en silencio y puede vaciar un
experimento entero.

## El problema, medido

El reparto de un experimento se resuelve en **baldes enteros**: la población se divide en cien
baldes de un centésimo y la tasa declarada se redondea al balde más cercano. El dominio, en
cambio, acepta **cualquier** tasa entre 0 y 1. Entonces una tasa más fina que un centésimo se
ajusta sin que nada lo diga:

| se declara  | reparte de verdad                |
| ----------- | -------------------------------- |
| `0.075`     | 8 %                              |
| `0.005`     | 1 %                              |
| **`0.004`** | **0 % — nadie va a tratamiento** |
| `0.999`     | 100 %                            |
| `0.12345`   | 12 %                             |

Un experimento abierto con `treatmentShare: 0.004` se crea, se activa, decide, y **no asigna a
nadie a tratamiento**: sin un error, sin un log, sin una diferencia visible en la respuesta. El
holdout tiene el mismo agujero: un `holdoutShare: 0.004` resuelve a cero baldes, así que se declara
un holdout y el sistema se comporta como si no hubiera ninguno.

Es la misma familia de falla que la feature 022 vino a sacar. La 022 eliminó la confusión entre
**dos unidades**; queda la confusión entre **la tasa declarada y la que el algoritmo puede
representar**.

Hoy el contrato **documenta** el ajuste en vez de prohibirlo: «The assignment resolves to whole
buckets of one hundredth, so a finer value takes the nearest bucket». Eso es una sorpresa
documentada, no una regla: quien manda `0.004` no ve ningún problema, y la descripción no evita el
daño.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - El reparto que se declara es el que ocurre (Priority: P1)

Quien opera abre un experimento declarando qué porción de los visitantes va a tratamiento. Si la
porción que declara no es una que el reparto pueda repartir, el sistema **se lo dice** en vez de
elegir otra por él. Vale tanto cuando abre el experimento por la API de administración como cuando
el experimento viene en la semilla del arranque.

**Why this priority**: es el agujero que puede vaciar un experimento entero. Un experimento que no
asigna a nadie no produce medición, y la constitución (III, «la medición precede») descansa en que
el reparto declarado sea el reparto que ocurre. Sin esta historia no hay feature.

**Independent Test**: se prueba sola abriendo experimentos con tasas más finas que un centésimo por
la API de administración y verificando que se rechazan nombrando el campo; y con las tasas de dos
decimales, verificando que se aceptan.

**Acceptance Scenarios**:

1. **Given** un operador con alcance sobre un merchant, **When** abre un experimento con un reparto
   de `0.004`, **Then** la operación se rechaza con un error que nombra el campo del reparto y dice
   la regla, y **no** queda ningún experimento abierto.
2. **Given** el mismo operador, **When** abre un experimento con un reparto de `0.075`, **Then** se
   rechaza igual: que el ajuste sea "pequeño" no lo hace aceptable, porque sigue siendo un reparto
   distinto del declarado.
3. **Given** el mismo operador, **When** abre un experimento con un reparto de `0.07`, **Then** se
   acepta, y el reparto efectivo es el declarado.
4. **Given** el mismo operador, **When** abre un experimento con un reparto de `0` o de `1`,
   **Then** se acepta: los dos son repartos que el sistema puede repartir exactamente.
5. **Given** una semilla de arranque cuyo experimento declara `0.004`, **When** el servidor
   arranca, **Then** se niega a arrancar nombrando el merchant, el experimento y el campo.

---

### User Story 2 - El holdout que se declara es el que ocurre (Priority: P2)

El holdout es la porción de tráfico que el merchant mantiene fuera de todo experimento, y el
reparto no puede tomarla. Si la porción declarada no es una que el sistema pueda apartar, se
rechaza en vez de ajustarse.

**Why this priority**: el daño es del mismo tipo pero menos grave — un holdout que resuelve a cero
no vacía la medición, la contamina. Y es independiente: se puede entregar antes o después de la
historia 1. Va segunda porque la primera es la que puede dejar un experimento sin datos.

**Independent Test**: se prueba sola publicando una configuración de merchant y unos defaults de
tratamiento con un holdout más fino que un centésimo, y verificando que los dos se rechazan
nombrando el campo.

**Acceptance Scenarios**:

1. **Given** un operador, **When** publica la configuración de un merchant con un holdout de
   `0.004`, **Then** se rechaza nombrando el campo del holdout, y la versión no se publica.
2. **Given** un operador, **When** cambia los defaults de tratamiento con un holdout de `0.004`,
   **Then** se rechaza igual.
3. **Given** un archivo del release cuyo holdout es `0.004`, **When** el servidor arranca, **Then**
   se niega a arrancar nombrando el nivel y el campo.
4. **Given** un holdout de `0.05`, **When** se publica, **Then** se acepta y el reparto se compara
   contra él como hasta ahora.

---

### User Story 3 - Ningún valor ya escrito queda escondido detrás de la regla (Priority: P3)

La regla empieza a rechazar valores que antes se aceptaban. Antes de que eso pase hay que saber si
algún valor ya escrito —en los archivos del release, en la configuración de desarrollo, en los
fixtures— es uno de los que la regla va a rechazar.

**Why this priority**: es la red de seguridad de las dos historias anteriores, no una capacidad
nueva. Si algo ya escrito viola la regla, el efecto es que el servidor deja de arrancar, y eso se
descubre en el arranque y no en una revisión.

**Independent Test**: se recorre cada tasa declarada en los archivos versionados y se comprueba que
resuelve exactamente a un balde; y se arranca el servidor con la configuración de desarrollo.

**Acceptance Scenarios**:

1. **Given** los archivos versionados del repositorio, **When** se revisa cada tasa que el reparto
   cuantiza, **Then** ninguna es más fina que un centésimo.
2. **Given** la configuración de desarrollo, **When** se arranca el servidor, **Then** arranca y
   responde.

---

### Edge Cases

- **El cero y el uno.** Los dos resuelven exactamente a un balde (ninguno y todos) y **se aceptan**.
  La regla es sobre la resolución, no sobre el rango: rechazar el 0 sería prohibir un experimento
  que no asigna a nadie a propósito, y rechazar el 1 sería prohibir uno sin control.
- **Ruido de la representación en punto flotante.** Un valor que difiere de un balde en lo que la
  representación de un número decimal introduce (del orden de `0.00000000000000004`) **se acepta**:
  es el mismo valor, escrito por un cliente que lo calculó. Lo que se rechaza es una tasa
  **materialmente** más fina, empezando por la mitad de un balde (`0.005`). Entre los dos casos hay
  catorce órdenes de magnitud, así que no hay zona gris.
- **Un valor que "parece" no alineado.** Diez de los ciento un valores de dos decimales no dividen
  exacto por un centésimo en punto flotante, `0.07` entre ellos. Los diez son legítimos y **se
  aceptan**: la regla se juzga contra el balde, no dividiendo.
- **Las tasas que nadie cuantiza no cambian.** Los cortes de un experimento y las tasas de la
  política comercial (techo, escalones, margen) siguen aceptando cualquier fracción: ningún
  algoritmo las resuelve a baldes, y exigirles la regla sería inventar una restricción sin motivo.
- **Un valor fuera de rango sigue siendo otro error.** `1.5` se rechaza por estar fuera de rango,
  como hoy, y el motivo que devuelve no se confunde con el de esta feature.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: El sistema MUST rechazar un reparto de experimento que no resuelva exactamente a uno
  de los baldes en los que divide la población, en vez de ajustarlo al más cercano.
- **FR-002**: El rechazo MUST nombrar el campo del reparto y MUST declarar la regla en su mensaje,
  de modo que quien lo lea sepa qué valor sí serviría.
- **FR-003**: El rechazo del reparto MUST ser distinguible del rechazo por estar fuera de rango:
  son dos reglas distintas y un consumidor tiene que poder decir cuál violó.
- **FR-004**: El sistema MUST aplicar la misma regla al holdout de un merchant, en los tres lugares
  donde se declara: los defaults de tratamiento del release, la versión que publica el merchant y la
  semilla del arranque.
- **FR-005**: El sistema MUST rechazar antes de registrar: un experimento con un reparto inválido no
  queda abierto, y una configuración con un holdout inválido no se publica.
- **FR-006**: El sistema MUST negarse a arrancar cuando la semilla o un archivo del release declaren
  un valor que la regla rechaza, nombrando dónde está.
- **FR-007**: El sistema MUST aceptar los valores que sí resuelven a un balde, **incluidos** los que
  una división por un centésimo haría parecer no alineados, y los extremos 0 y 1.
- **FR-008**: El sistema MUST aceptar un valor que sólo difiera de un balde por el ruido de la
  representación de un decimal en punto flotante, tratándolo como ese balde.
- **FR-009**: El contrato MUST declarar la regla en vez de prometer el ajuste al balde más cercano,
  y MUST publicar el rechazo como uno de los resultados posibles de la operación.
- **FR-010**: La regla MUST conocerse en **un solo lugar**, el mismo que sabe en cuántos baldes se
  divide la población: si algún día el reparto quiere granularidad más fina, la regla lo sigue sin
  que nadie la edite.
- **FR-011**: El reparto, la comparación contra el holdout y el algoritmo de asignación MUST quedar
  exactamente como están: esta feature rechaza entradas, no cambia cómo se asigna.
- **FR-012**: Las tasas que ningún algoritmo cuantiza —los cortes de un experimento, el techo, los
  escalones y el margen de la política comercial— MUST seguir aceptando cualquier fracción válida.

### Key Entities

- **Reparto del experimento (`treatmentShare`)**: la porción de visitantes del merchant asignada a
  tratamiento. Lo declara quien abre el experimento y es inmutable. Es la tasa que el algoritmo de
  asignación cuantiza, y por eso la que esta feature restringe.
- **Holdout del merchant (`holdoutShare`)**: la porción de tráfico que queda fuera de todo
  experimento. Se declara en tres niveles y el reparto se compara contra ella en la misma unidad de
  baldes, y por eso está sujeta a la misma regla.
- **Resolución del reparto**: en cuántos baldes se divide la población (hoy cien, de un centésimo).
  No es una unidad de conversión ni una política: es la granularidad del algoritmo. Es lo que define
  qué tasas son declarables, y vive en un solo lugar.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Un reparto de `0.004`, `0.005`, `0.075`, `0.999` o `0.12345` se rechaza, y la
  respuesta nombra el campo y la regla. Ninguno de los cinco deja un experimento abierto.
- **SC-002**: Los **101** valores de dos decimales entre 0 y 1 se aceptan, recorridos por una
  prueba — incluidos los **10** que una división por un centésimo haría parecer no alineados
  (`0.07`, `0.14`, `0.28`, `0.29`, `0.47`, `0.56`, …). Cero rechazos falsos.
- **SC-003**: Un holdout de `0.004` se rechaza por los tres caminos de declaración, y con uno así en
  un archivo del release el servidor no arranca y dice dónde está.
- **SC-004**: La huella de la asignación de la feature 007 no cambia: los mismos visitantes reciben
  los mismos brazos. Es el juez de que el algoritmo no se movió.
- **SC-005**: La comparación del contrato contra la base reporta **sólo** la invariante nueva, el
  resultado nuevo de la operación y las descripciones: ningún campo agregado, quitado ni renombrado.
- **SC-006**: Un solo lugar del código sabe en cuántos baldes se divide la población; una búsqueda
  del número no lo encuentra en ningún otro.
- **SC-007**: Las tasas de la política comercial y los cortes de un experimento siguen aceptando una
  fracción de tres o más decimales, verificado por prueba: la feature no se derramó.
- **SC-008**: La cadena completa de calidad queda verde y ninguna aserción de comportamiento
  preexistente cambia, salvo las que declaran aceptable un valor que la regla ahora rechaza — y esas
  se enumeran, una por una, en el cierre.

## Assumptions

- **El rechazo lleva su propio motivo, distinto del de fuera de rango.** El catálogo de errores ya
  tiene uno para el reparto fuera de rango, cuyo título dice «out of range»; usarlo para `0.075`
  mentiría, porque `0.075` está perfectamente en rango. Se asume un motivo propio. La alternativa
  —ampliar el existente a «no es un reparto válido» y distinguir por el mensaje— pierde la
  información en el título, que es lo que un consumidor lee primero.
- **La regla se expresa contra el balde, no dividiendo.** Medido: la comprobación de "múltiplo de un
  centésimo" por división rechaza 10 de los 101 valores legítimos, `0.07` incluido. La regla se
  juzga con el mismo redondeo que ya usa la asignación.
- **La regla vive con el reparto, no en el kernel compartido.** La resolución del reparto es del
  experimento, y el módulo que juzga el holdout ya tiene permiso para leer del experimento, así que
  no hace falta mover nada al kernel. El plan lo verifica antes de escribir código.
- **El cambio del contrato es incompatible y entra sin versión mayor.** Estrecha lo que se aceptaba,
  así que la comparación lo va a reportar como incompatible; entra con incremento menor conservando
  el prefijo actual mientras el contrato siga marcado en construcción (ADR-003). El plan confirma
  que la marca sigue ahí antes de empezar; si no está, la feature se replantea.
- **Ninguna tasa ya escrita en el repositorio viola la regla.** Se asume por inspección de los
  valores actuales (todos de uno o dos decimales) y se verifica valor por valor en la historia 3. Si
  apareciera una, se corrige en esa historia y se dice cuál era.
- **Nadie consume el contrato todavía.** Ningún merchant está integrado, así que estrechar la
  entrada no rompe a nadie hoy. Ésa es exactamente la ventana en la que conviene hacerlo.

## Out of Scope

- **Los cortes de un experimento.** Son fracciones de la muestra objetivo y **nadie los cuantiza**:
  hoy se guardan y se publican, y ningún algoritmo los convierte a baldes. Exigirles la regla sería
  inventar una restricción sin un algoritmo que la pida. Se revisa cuando se construya la lectura de
  resultados por cortes.
- **Las tasas de la política comercial** (techo del incentivo, escalones de la escalera, margen).
  Tampoco se cuantizan: el incentivo sale con la tasa declarada. La regla es de lo que resuelve a
  baldes, no de toda tasa.
- **Cambiar el algoritmo de asignación, la resolución del reparto o la comparación contra el
  holdout.** Lo medido dice que la comparación en baldes es correcta porque el balde es lo que
  efectivamente pasa; cuantizadas, comparar en baldes y comparar tasas coinciden en los 10 201 pares
  de valores de dos decimales.
- **Unificar dónde se lee la forma de una entrada** (los lectores de la aplicación contra los del
  composition root). Sigue pendiente de su propia discusión.
- **Avisar de un experimento que no asigna a nadie por otro motivo** (un experimento cerrado, un
  merchant apagado). Esta feature es sobre el valor declarado, no sobre el estado.

## Constraints

- Commits en español, uno por historia; sin push hasta que el dueño lo pida; sin merge sin el dueño.
- La rama sale de `022-tasas-de-punta-a-punta`, que a su vez sale de `021-plano-de-decoracion` y
  `020-grafo-de-composicion`; ninguna de las tres está en `main` al abrir esta feature.
- La decisión se registra como enmienda de ADR-035 (una sola unidad para las tasas) o como ADR
  nuevo; lo decide el plan. ADR-022 (asignación) y ADR-024 (dominio rico) se citan.
