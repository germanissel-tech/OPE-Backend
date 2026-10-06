# Research — fase 0 (039, la durabilidad se verifica en CI)

Cinco hallazgos. Los dos primeros resuelven lo que el checklist de la spec dejó abierto; el tercero
corrige una suposición que yo tenía; el cuarto encuentra algo que la feature no buscaba y el quinto dice qué
no hace falta construir.

---

## R-01 — La elección de suites por cambio **no** crece: la durabilidad se verifica aparte

**La pregunta**: `scripts/test-scope.mjs` elige hoy entre dos proyectos (`fast` siempre, `tools` cuando un
cambio toca una herramienta). ¿Crece a tres, o la durabilidad se verifica en otro lugar?

**Lo verificado**: el script elige por **disparadores de ruta** (`TOOLS_TRIGGERS`: `scripts/`, `.claude/`, …)
y su tipo de retorno es `("fast" | "tools")[]`. Para incluir la durabilidad habría que darle disparadores, y
los suyos serían `src/`, `migrations/`, `tests/durability/` — es decir, casi todo: de las últimas diez
features, **todas** tocaron `src/`. El código que elige costaría mantenimiento y no ahorraría nada.

**Decisión**: la durabilidad **no entra en esa elección**. Se verifica siempre, en un job propio de CI, y
`test-scope.mjs` queda como está — lo que la spec pide (FR-001: siempre, sin depender de qué cambió) es
exactamente lo contrario de elegir.

**Alternativa descartada**: `test:scoped --all` en el job. Corre los tres proyectos en una invocación de
Vitest, que es justo la combinación donde la prueba de la ventana de administración falló acá (los tres
proyectos compartiendo la máquina). Lo que decide tiene que correr la durabilidad **sola**.

---

## R-02 — Una lista de mediciones, y por qué el gate no es el mismo en los dos proyectos

**Lo verificado**: `vitest.mutation.config.ts` excluye **seis** archivos, escritos a mano, con un motivo que
es el mismo para los seis: miden (percentiles de latencia, el tamaño de un snapshot, el costo de un turno) y
«toman segundos por corrida y no matan nada que el resto no mate». Tres son del proyecto `fast`
(`integration/ingest-latency`, `integration/catalog-size`, `integration/outcomes-latency`) y tres del
proyecto `durability` (`durability/ingest-latency`, `durability/rebuild-latency`,
`durability/admin-concurrency`).

**Decisión**: la lista pasa a ser **una constante nombrada y exportada** —la declaración de mediciones de la
entidad de la spec— que la configuración de mutación importa en vez de repetir, igual que ya importa
`TOOL_SUITES`.

**Y la parte que parecía inconsistente, resuelta**: los tres del proyecto `fast` **siguen siendo gate** y los
tres de durabilidad **no**. No es una excepción arbitraria:

|                          | Las tres de `fast`                          | Las tres de `durability`                                                           |
| ------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Contra qué miden         | almacenes en memoria                        | un almacén de verdad, en disco                                                     |
| Qué cuestan              | segundos, dentro de un job que ya las corre | 43 s, en un job que hoy no existe                                                  |
| Historia en CI           | verdes desde la feature 004                 | **nunca corrieron en CI**                                                          |
| Qué pasaría al exigirlas | nada: ya se exigen                          | un techo calibrado contra el disco de esta máquina, exigido contra el de un runner |

Sacar las tres de `fast` del gate **reduciría** lo que hoy se verifica, y SC-005 lo prohíbe. Meter las tres de
durabilidad lo aumentaría con un techo que nadie midió donde va a correr. Así que la lista nombra qué **mide**
—que es lo que la mutación necesita saber— y el gate de cada proyecto se decide por separado, con esta tabla
como motivo.

---

## R-03 — `--exclude` de la línea de comandos no sirve, y el proyecto nuevo tampoco: la exclusión es del `include`

**Lo que yo suponía**: que bastaba con `vitest run --project durability --exclude <archivo>`.

**Lo verificado**: corrió los 23 archivos igual (`Test Files 23 passed`). En un proyecto de Vitest el
`include` del proyecto gana; `--exclude` de la línea de comandos no lo recorta.

**Decisión**: la separación vive en `vitest.config.ts`, donde los proyectos se declaran. El proyecto
`durability` pasa a **excluir** las mediciones, y un proyecto nuevo las incluye — dos proyectos sobre el
mismo directorio, cada uno con su `include`, que es como ya conviven `fast` y `tools` sobre `tests/`.

**Lo que esto obliga a cuidar**: `fileParallelism: false` y el resto de la configuración del proyecto
`durability` (timeouts, directorio temporal por archivo) tienen que valer igual para el proyecto de
mediciones — son dos vistas del mismo directorio, no dos regímenes. FR-009 lo exige y se verifica
construyendo los dos proyectos del mismo objeto de configuración.

---

## R-04 — `main` no tiene protección de rama: nada **impide** mergear en rojo

**Encontrado buscando cómo cumplir FR-003** («la verificación no se da por aprobada si la durabilidad no
terminó»): `GET /repos/.../branches/main/protection` responde **404**. No hay checks requeridos, no hay
revisión obligatoria; lo único que hay es que un job rojo pone el run rojo y que nosotros no mergeamos en
rojo.

**Lo que esto significa para la feature**: el job nuevo cumple FR-001, FR-002 y FR-008 por sí solo —se
ejecuta, se identifica y no depende de la mutación—, pero **FR-003 no lo puede cumplir el workflow**: un run
rojo no bloquea nada por sí mismo. Depende de una configuración del repositorio que esta feature no puede
decidir sola.

**Decisión**: la feature hace su parte y **lo abierto queda anotado como deuda** con su nombre, en vez de
quedar implícito en un requisito que el código no puede satisfacer. Habilitar checks requeridos es una
decisión del dueño sobre el repositorio (quién puede mergear, qué jobs son obligatorios, si `mutation` —que
tarda 20 min— se exige también), y se toma una vez para todos los jobs, no para éste.

---

## R-05 — Lo que la mutación hace con la durabilidad no se toca, y hay un motivo

El arranque de la mutación seguirá ejecutando la suite de durabilidad, porque lo necesita: sin ella, **todo
mutante de todo gateway durable sería un superviviente** — lo dice la configuración y lo decidió la
investigación de la feature 030 (R-06).

**Decisión**: esta feature no le quita nada a la mutación. Lo que cambia es que la cobertura de los gateways
durables deja de **depender** de eso (FR-008): si mañana la mutación cambiara de suite, el job nuevo sigue
verificando lo mismo. Los dos caminos ejecutan las mismas pruebas por razones distintas, y eso no es
duplicación: es que una herramienta necesita un arranque y un gate necesita un veredicto.
