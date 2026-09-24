# Research — El reparto no se ajusta en silencio (023)

Todo lo de acá se midió en la rama `023-reparto-sin-ajuste-silencioso`, que sale de
`022-tasas-de-punta-a-punta` (`1aba666`). Cada decisión cita la evidencia que la sostiene y qué se
descartó.

---

## R-01 — Cómo se juzga que una tasa es declarable

**Decisión**: la tasa es declarable si y sólo si **vuelve a ser ella misma después de pasar por su
balde**: `bucketsOf(share) / ASSIGNMENT_BUCKETS === share`. Sin epsilon y **sin ningún número
nuevo**.

**Evidencia**. Tres candidatos, medidos sobre los 101 valores de dos decimales (tanto calculados
como parseados desde literales JSON, que es como llegan por la red) y sobre los cinco casos que la
feature quiere rechazar:

| forma de juzgar                                | acepta de 101 | rechaza `0.004/0.005/0.075/0.999/0.12345` | número nuevo |
| ---------------------------------------------- | ------------- | ----------------------------------------- | ------------ |
| `multipleOf: 0.01` en el esquema (división)    | **91**        | sí                                        | sí (`0.01`)  |
| `abs(share * 100 - round(share * 100)) < 1e-9` | 101           | sí                                        | sí (`1e-9`)  |
| **ida y vuelta por el balde**                  | **101**       | sí                                        | **no**       |

La división falsa-rechaza diez valores legítimos —`0.07`, `0.14`, `0.28`, `0.29`, `0.47`, `0.56`,
…— porque `0.07 / 0.01` es `7.000000000000001`. Queda descartada para el esquema y para el código.

El epsilon funciona, pero **introduce una constante de comportamiento** que habría que nombrar y
justificar, y que la constitución XI mira con razón: un número en `src/` que decide qué se acepta.
La ida y vuelta no introduce ninguno: reutiliza `ASSIGNMENT_BUCKETS` y `bucketsOf`, que ya existen y
que ya son los que saben cuál es la resolución. Eso satisface FR-010 sin esfuerzo: si mañana el
reparto quiere mil baldes, la regla lo sigue sola.

**Contradice FR-008 de la spec, y con evidencia.** FR-008 pedía aceptar un valor que difiera de un
balde por el ruido de la representación en punto flotante. La ida y vuelta lo **rechaza**:
`0.1 + 0.2` da `0.30000000000000004`, que es un doble distinto del de `0.3`. Se descarta FR-008 por
tres motivos:

1. **Aceptar el ruido es ajustar en silencio**, que es exactamente lo que esta feature vino a
   eliminar. `0.30000000000000004` se convertiría calladamente en 30 baldes: el mismo trato que
   `0.075` recibe hoy y que declaramos inaceptable.
2. **El ruido no llega por la red.** Un número JSON es un literal decimal que se parsea al doble más
   cercano: `0.07`, `0.070000000000000007` y `7/100` son **el mismo doble**, y los tres se aceptan.
   El único ruido que sobrevive viene de una suma (`0.1 + 0.2`) hecha por el cliente, no de escribir
   un decimal.
3. **El rechazo es mejor servicio que el ajuste.** Un cliente que suma mal se entera; uno al que se
   le ajusta el valor, no.

FR-008 se reemplaza en el plan por la regla de arriba, y la spec lo registra.

---

## R-02 — Dónde vive la regla

**Decisión**: un **método estático de `Experiment`**, junto a `ASSIGNMENT_BUCKETS` y `bucketsOf`.
Ni en el `shared-kernel` ni como función suelta del módulo.

**Evidencia**. La spec dejaba la pregunta entre el kernel y el módulo del experimento, y la
respuesta real es una tercera que ninguna de las dos contemplaba: `ope/domain-no-loose-functions`
(ADR-024) **prohíbe** exportar una función suelta desde `src/domain/`, y su allowlist son cinco
archivos del kernel (`result.ts`, `time.ts`, `rate.ts`, `compare.ts`) y los `ids.ts` de cada módulo.
Un `export const isDeclarableShare = …` en `domain/experiment/` no compila el lint. Así que:

- **En el kernel, junto a `isRate`**: pasaría el lint, pero el kernel tendría que saber en cuántos
  baldes se divide la población, y eso contradice a CLAUDE.md, que dice que ese número vive en
  `domain/experiment/` y es la resolución del reparto. Descartado: mueve el conocimiento al lugar
  equivocado para contentar a una regla.
- **Método estático de `Experiment`**: la regla vive con el concepto que la produce, como pide
  ADR-024 («las reglas viven con su dueño y se invocan por su nombre»), y el número no se mueve.
  Es lo que el repositorio ya hace con `Experiment.assign` y `Merchant.judgeOrigins`.

**El módulo de configuración puede llamarla.** `CONTEXT_MAP` ya lista `experiment` entre lo que
`configuration` puede importar, y `domain/experiment/` hoy sólo importa del `shared-kernel`, así que
el enlace no crea ningún ciclo. Verificado en `.dependency-cruiser.cjs` y en los imports actuales.

---

## R-03 — Qué motivo devuelve el rechazo

**Decisión**: un **slug propio** en el catálogo, `treatment-share-too-fine`, con su clase de error
en `domain/experiment/errors.ts`. No se amplía `invalid-treatment-share`.

**Evidencia**. `invalid-treatment-share` existe con el título «The treatment share of an experiment
is out of range». Usarlo para `0.075` **mentiría**: `0.075` está perfectamente en rango. El título
del catálogo es lo primero que un consumidor lee —antes que el `detail`— y es lo que aparece en la
documentación publicada; un título que no describe la falla es peor que no tenerlo.

Además son dos reglas con dos alcances distintos: el rango lo verifica el **esquema**
(`minimum: 0`, `maximum: 1` ⇒ 400 antes de llegar al dominio), y la nueva no se puede expresar en el
esquema (R-01), así que es **exactamente** el caso que ADR-007 llama `x-invariants` ⇒ 422. Mezclar
las dos en un slug juntaría un 400 y un 422 bajo el mismo nombre.

**El holdout no lleva slug propio.** Se rechaza con `invalid-configuration-value` apuntando a
`holdoutShare`, que es como se reporta **toda** invariante de configuración en el repositorio
(`InvalidConfigurationValue(pointer, problem)`). Inventarle uno rompería esa uniformidad a cambio de
nada: el puntero ya dice qué campo es y el mensaje dice la regla.

---

## R-04 — Cómo se expresa en el contrato

**Decisión**: `x-invariants` sobre el **esquema** `ExperimentCreate`, más un ejemplo en la respuesta
`422` y la descripción del campo reescrita. Ninguna palabra clave de JSON Schema.

**Evidencia**.

- La regla sólo involucra campos del propio esquema, así que va **sobre el esquema** y no sobre la
  operación (CLAUDE.md, notas del contrato). `ExperimentCreate.yaml` ya tiene un `x-invariants` con
  `invalid-experiment-cuts`, así que es agregar una entrada.
- `multipleOf: 0.01` queda descartado por R-01 (rechazaría `0.07`). No hay otra palabra clave de
  JSON Schema que exprese «resuelve exactamente a un balde», que es justamente el motivo por el que
  esto es una invariante y no una restricción de esquema.
- `ope-invariants` exige `type`, `status`, `rule` y `description`, y que el `type` sea un slug del
  catálogo con el mismo status. `ope-no-generic-422` exige que la `422` nombre su invariante:
  `ExperimentUnprocessable.yaml` tiene hoy **un** ejemplo (el de los cortes) y va a necesitar el
  nuevo. `check:invariant-tests` exige una prueba `[invariant:treatment-share-too-fine]`.
- **La descripción deja de prometer el ajuste.** Hoy dice «a finer value takes the nearest bucket»;
  eso pasa a decir la regla. Es la mitad del valor de la feature: quien lee el contrato tiene que
  saber qué puede declarar **antes** de mandarlo.

**No hay regla nueva de Spectral.** Se evaluó agregar una que verificara que todo campo de tasa
cuantizada declare la invariante; se descarta porque hay exactamente un campo así en el contrato y
una regla de ruleset para un caso es más maquinaria que el problema. Si aparece un segundo, se
reconsidera.

---

## R-05 — Qué pasa con lo ya registrado

**Decisión**: `Experiment.rehydrate` **no** re-juzga, como hasta ahora. La regla es de creación.

**Evidencia**. ADR-024 lo fija: «`rehydrate` reconstruye desde datos ya registrados sin reevaluar
las reglas de creación», y hay una prueba que lo sostiene. Un endurecimiento posterior no invalida
hechos pasados. Además hoy el almacén es en memoria, así que no hay ningún experimento persistido
que migrar; cuando llegue la persistencia, la decisión ya está tomada y escrita.

---

## R-06 — Qué entradas están sujetas a la regla

**Decisión**: exactamente dos, `treatmentShare` y `holdoutShare`. Ninguna otra tasa.

**Evidencia**. Se buscó todo consumidor de `bucketsOf` en `src/`: aparece dos veces, las dos en
`domain/experiment/experiment.ts` — el umbral de `assign` y los dos lados de `withinHoldout`. Nada
más del sistema cuantiza una tasa:

- **Los cortes** (`cuts`) se guardan y se publican; ningún código los convierte a baldes.
- **El techo, los escalones y el margen** de la política comercial salen con la tasa declarada
  (`#incentiveValue()` devuelve el escalón tal cual desde la feature 022).

Extender la regla a esas cinco sería inventar una restricción sin un algoritmo que la pida, y
además rompería configuraciones legítimas: un margen de `0.375` es perfectamente representable
porque nadie lo cuantiza.

---

## R-07 — Compatibilidad y versión

**Decisión**: entra con **incremento menor** (`1.5.0` → `1.6.0`) conservando el prefijo `/v1/`.

**Evidencia**. `contracts/openapi.yaml` declara hoy `version: 1.5.0` y `x-stability: building`
(verificado). ADR-003 y la constitución (v1.4.2, gate de superficie HTTP) admiten que un cambio
incompatible entre con incremento menor mientras esa marca esté: ningún merchant consume el
contrato. `contract:diff` lo va a reportar y aceptar, y `release-check` va a avisar; las dos cosas
son lo esperado.

El cambio **es** incompatible: estrecha lo que la operación aceptaba. No agrega, quita ni renombra
ningún campo, así que lo que `contract:diff` reporte se puede leer de un vistazo.

---

## R-08 — Dónde se registra la decisión

**Decisión**: **enmienda de ADR-035** (una sola unidad para las tasas). No un ADR nuevo.

**Evidencia y alternativa descartada**. ADR-035 responde «qué es una tasa en este sistema» y su
contexto es literalmente el modo de falla del que éste es la continuación: un valor declarado que
significa otra cosa y nada chilla. La 022 sacó la ambigüedad de **unidad**; ésta saca la de
**representabilidad**. Partirlas en dos ADR obligaría a leer dos documentos para saber qué se puede
declarar, que es la pregunta que un ADR de este tema tiene que contestar de una vez. ADR-022
(asignación) y ADR-024 (dominio rico) se citan desde la enmienda.

---

## Lo que no se investigó y por qué

- **Sugerir el valor más cercano en el mensaje de error** («`0.075` no es declarable; probá `0.08`»).
  Es tentador y es una decisión de producto: sugerir un valor es elegir por el operador, que es de
  lo que esta feature lo saca. El mensaje dice la regla y el operador elige. Si el uso demuestra que
  hace falta, es un cambio de una línea.
- **Un aviso cuando un experimento válido no asigna a nadie** (`treatmentShare: 0` declarado a
  propósito). Es otro problema —el estado, no el valor— y está fuera de alcance por la spec.
