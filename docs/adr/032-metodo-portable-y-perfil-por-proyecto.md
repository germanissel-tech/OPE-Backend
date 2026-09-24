---
numero: 32
titulo: Método portable y perfil por proyecto; README con inventario por directorio
estado: aceptada
fecha: 2026-09-21
fuente: specs/019-deudas-tecnicas/research.md
---

# ADR-032 — Método portable y perfil por proyecto; README con inventario por directorio

## Contexto

La skill de auditoría de arquitectura (`auditing-architecture`, feature 005) nació dentro de
este repositorio y creció con él: sus scripts importan `scripts/lib.mjs`,
`scripts/governance-lib.mjs`, `scripts/shape-rules.mjs` y `eslint.config.mjs`; tienen escritos
los nombres de los anillos, de los gates y de las rutas; conocen ocho clases de fuente de verdad
(`ADR-`, `constitution#`, `guide#`, `lint:`, `arch:`, `shape:`, `clarity:`, …) y dónde resuelve
cada una; sus criterios de diseño definen SOLID, DRY, claridad y errores en términos de este
repo; y cinco de sus nueve evaluaciones —con todos los fixtures— son de esta arquitectura. El
dueño lo señaló el 2026-09-21: una skill que no puede instalarse en otro proyecto no es una
skill, es un script del repo con otro nombre. Además, no existía ningún procedimiento para que
un proyecto nuevo o existente se **volviera** auditable: el perfil, los criterios y los
adaptadores se escribían a mano.

En la misma revisión apareció un patrón más general: las carpetas de primer nivel que no son
código (`config/`, `contracts/`, `generated/`, `patches/`, `scripts/`, …) no se explican solas.
La información existe —en `CLAUDE.md`, en varios ADR, en el README raíz— pero la carpeta no la
señala, `CLAUDE.md` creció como índice de todo, y una persona o un agente con contexto acotado
abre la carpeta primero.

## Decisión

### 1. Método portable, perfil por proyecto

- **La skill contiene sólo el método**: los siete pasos, el formato del hallazgo, la
  refutación, la verificación mecánica y el veredicto derivado. No importa ni lee por su ruta
  ningún archivo del proyecto que audita; una prueba de aislamiento lo verifica.
- **Todo lo del proyecto va en un perfil**, `audit.profile.json` en la raíz, con
  `profileVersion` entera: raíz del código; resolución de los alcances (`--module` por plantillas
  con `{name}`, `--diff` con su base e `include`); gates con su comando, su modo
  (`blocking | informative`) y sus alcances; clases de fuente de verdad con su prefijo, la
  severidad que imponen y un resolutor de un vocabulario **cerrado** (`file-glob`,
  `markdown-heading`, `text-in-file`, `gate-rule`, `criteria-section`); ruta del documento de criterios; ruta de
  las evaluaciones propias. Una versión que la skill no conoce se rechaza nombrando las dos; sin
  perfil, la skill dice qué falta y termina.
- **Los gates entregan hallazgos como datos** por un protocolo fijo (`findings-v1`): el
  adaptador recibe `--files-from <archivo>` y escribe `{ findings: [{ file, line, rule,
message }] }`; con `--list-rules` enumera sus reglas; salida distinta de cero = gate
  degradado, que no detiene a los demás y que, si es bloqueante, impide `approved`. Los
  adaptadores son del proyecto (`scripts/audit/gate-*.mjs`), no de la skill.
- **Evaluaciones**: las que sólo dependen de una clase de gate que cualquier proyecto puede
  tener viajan con la skill (`requires.json` con la regla que exigen); las que dependen de esta
  arquitectura se quedan en el repo (`tests/audit/evals/`) con sus fixtures. Los criterios de
  diseño del repo viven en `docs/auditoria/criterios-diseno.md`.
- **Empaquetado**: las dos skills viven en `.claude/skills/` del repositorio, como las de
  spec-kit —versionadas con el código, sin instalación global ni plugin— y llevarlas a otro
  proyecto es copiar los dos directorios (`conditioning-project` importa `profile.mjs` de
  `auditing-architecture`). La copia acoplada de `.claude/skills/auditing-architecture/` **se
  reemplaza** por la portable en el mismo lugar: el método existe en un solo lugar y las nueve
  evaluaciones existentes —con sus `expected.json` sin cambio— son la prueba de que el reemplazo
  no pierde nada. _Enmienda 2026-09-22_: la primera implementación las empaquetó como plugin de
  Claude Code (`plugins/`, marketplace en la raíz, habilitación por `.claude/settings.json`); el
  dueño lo rechazó porque el mecanismo de plugins registra el marketplace y el plugin fuera del
  repositorio (`~/.claude/plugins/`): una instalación global, que era justo lo que no quería.
- **Acondicionamiento**: una segunda skill (`conditioning-project`) inspecciona
  un repositorio, pregunta sólo lo que no detecta, escribe el perfil y los criterios prellenados
  con lo que la constitución y los ADR ya dicen (`PLACEHOLDER` donde el proyecto no decidió),
  deja pendiente cada gate sin adaptador, y corre un doctor que dice qué está listo, qué falta y
  el veredicto máximo que una auditoría podría emitir. Es idempotente y no pisa ediciones
  manuales. No inventa decisiones del dueño: sin constitución recomienda crearla.

### 2. README con inventario por directorio de primer nivel

- Todo directorio de primer nivel que no es código ni dependencia lleva un `README.md` con una
  sección `## Inventario`: una tabla cuya primera columna es la entrada (`archivo` o `dir/`) y
  que dice qué es, si es fuente o derivada, quién la lee o la ejecuta y cómo se verifica. Un
  directorio puede exigir columnas propias (en `config/`, la variable de entorno y el momento de
  lectura; en `contracts/`, la tabla de extensiones `x-*`); una fila puede ser un patrón para
  entradas homogéneas (`NNN-<nombre>/` en `specs/`). Sin cifras de estado en prosa.
- **Una prueba lo mantiene igual al directorio** (`tests/docs/readmes.test.ts`): falla si falta
  el README, si una entrada de primer nivel no está nombrada o si el README nombra algo que no
  existe; enumera con `git ls-files`, así lo ignorado por git no cuenta. La misma suite verifica
  cabeceras: todo archivo generado cita el script que lo produce y ese script existe; todo
  parche declara `# Fix:` y `# Retire:`; todo script empieza con un comentario que dice qué hace.
- `CLAUDE.md` conserva lo **normativo** (qué falla el build, cómo se escribe cada cosa) y enlaza
  al README de cada directorio para lo **descriptivo**.

## Alternativas descartadas

- **Perfil en YAML o dentro de `package.json`**: JSON tiene esquema y validación en el editor;
  `package.json` ata la skill a Node.
- **Resolutor de fuente arbitrario (`command`)**: reintroduce código del proyecto en la skill
  por otra vía.
- **Plugin de Claude Code con marketplace**: implementado y descartado (enmienda 2026-09-22):
  el fuente vivía en el repo pero la habilitación registraba marketplace y plugin en el
  directorio global del usuario; una skill en `.claude/skills/` no necesita nada de eso.
- **Repositorio propio para las skills desde el inicio**: la CI de este repo dependería de un
  checkout externo o de una copia fijada que diverge.
- **Copia fijada de la skill además de la portable**: dos fuentes del mismo método.
- **Un README por carpeta sin prueba**: cinco README divergen en un mes; la prueba es lo que
  hace convención a la convención.

## Consecuencias

- Agregar un gate al repo es escribir su adaptador y una línea en el perfil; agregar una fuente
  de verdad es una línea en `sources[]`; la skill no cambia.
- Un proyecto nuevo se vuelve auditable con la skill de acondicionamiento en minutos, y sabe
  desde el primer doctor hasta dónde puede llegar una auditoría (sin fuentes de severidad alta
  no puede rechazar nada).
- Un directorio de primer nivel nuevo sin README falla la suite; un archivo generado con
  cabecera falsa, un parche sin condición de retiro o un script sin cabecera también.
- Feature 019, deudas D-01, D-02 y D-06; el detalle y la evidencia en
  `specs/019-deudas-tecnicas/research.md` (R-01..R-06).

## Enmienda (2026-09-24, feature 024) — el patrón se extiende a las instrucciones de los agentes

El patrón que este ADR estrenó para los README de directorio —**política declarada en un archivo,
funciones puras sobre texto, y verificación en los dos sentidos**— se aplica ahora a `CLAUDE.md`,
que es lo que un agente lee antes de tocar el repositorio.

### Por qué

Medido el 2026-09-24: el archivo pasó de 360 a 675 líneas en seis días (+88 %) en una serie
**monótona**, y de las 759 referencias que cita sólo las citas `ADR-NNN` y los marcadores tenían
gate. No estaba podrido —366 de 368 identificadores comprobables resolvían—, estaba exacto **por
disciplina de quien lo editaba**. La prueba de que la disciplina no alcanza: dos directorios
`policies/` que la feature 017 borró siguieron nombrados tres días y tres features, y una de esas
líneas además **contradecía** otra sección del mismo archivo.

### Qué se decide

1. **Un criterio de admisión.** Una sección es **normativa** si dice qué hacer —y no tiene otro
   hogar—, **descriptiva** si dice cómo es el sistema hoy —y su contenido vive en su ADR, en el
   contrato o en el README del directorio—, o **mixta** cuando tiene párrafos de las dos, y entonces
   **exige un motivo escrito**: nombra una deuda concreta, no es una forma de no decidir.
2. **La clase de cada sección se declara** en `scripts/instructions-policy.json`, y se verifica en
   los dos sentidos: una sección sin clase falla, y una clase para una sección que no existe
   también. Abrir una sección obliga a decidir.
3. **Tres formas de referencia, tres fuentes de verdad**: un identificador contra el contrato y el
   código (`check:identifiers`, que suma el archivo a su lista), una ruta contra el disco, un
   comando contra `package.json` en los dos sentidos.
4. **El gate vive en `contract:check`, no en el proyecto `tools`.** Medido: `TOOLS_TRIGGERS` no
   incluye `CLAUDE.md` **ni `src/`**, y CI corre `test:scoped`. Una prueba en `tools` no habría
   corrido en el commit que movió el archivo que las instrucciones nombraban — el commit que el gate
   existe para atrapar. Del patrón de este ADR se toma la forma, no la casa.

### La frontera, escrita a propósito

El gate verifica que **lo nombrado exista**, no que lo escrito sea **cierto**. Un verde no dice que
el documento tenga razón. La mudanza encontró una afirmación falsa sobre algo que sí existe —una
lista de «componentes que ninguna operación usa» que incluía uno que se usa desde la feature 017— y
ningún gate podía atraparla. Eso lo verifica la revisión, y decirlo evita que el verde se lea como
más de lo que es.

### Consecuencias

- `CLAUDE.md` **bajó de líneas por primera vez**: 675 → 573. El número no es la meta —perseguirlo
  premia borrar cosas útiles—; que baje una vez es la señal de que el criterio se aplicó.
- Diez bloques descriptivos volvieron a su ADR, y lo que a cada uno le faltaba se agregó **antes** de
  borrarse, en commits separados. Dos oraciones **normativas** que estaban escondidas dentro de
  bloques descriptivos volvieron a donde se obedecen.
- Tres secciones quedan declaradas `mixed` con su motivo: separar sus párrafos es la deuda que esta
  feature deja nombrada en vez de esconder.

## Enmienda (2026-09-24, feature 025) — el núcleo se lee siempre; el resto carga cuando hace falta

La enmienda anterior le puso gate y criterio a las instrucciones de los agentes. Ésta las **parte**,
y el número que lo justifica no es nuestro.

### La fuente

La documentación oficial de Claude Code (`https://code.claude.com/docs/en/memory`, leída el
2026-09-24) fija el umbral en **menos de 200 líneas por archivo**, y da un motivo que pesa más que
el costo de contexto: **«Longer files consume more context and reduce adherence»** — un archivo más
largo **se obedece peor**. También da el criterio: **«Keep it to facts Claude should hold in every
session… If an entry is a multi-step procedure or only matters for one part of the codebase, move it
to a skill or a path-scoped rule instead.»**

Se cita la fuente a propósito, para que las doscientas líneas no se lean como una preferencia de
quien escribió este ADR.

### Lo que la fuente descarta, y era el arreglo obvio

Medido contra la documentación: **partir el archivo en importaciones (`@path`) o en reglas sin
acotar no cambia nada**, porque las dos cosas se expanden y entran al contexto al arrancar igual.
Lo único que saca carga del arranque es **acotar una regla a los archivos a los que se aplica**.

### Qué se decide

1. **Tres destinos y dos preguntas.** ¿Hace falta en **toda** sesión? Si sí, el núcleo. Si no, ¿es
   un procedimiento de varios pasos? Si sí, una skill; si no, una regla acotada en `.claude/rules/`.
   **Ser normativo no alcanza**: el flujo de trabajo hace falta siempre; cómo se escribe un caso de
   uso es igual de normativo y sólo hace falta en `src/application/`.
2. **De cada regla queda en el núcleo la línea que impide equivocarse** antes de que la regla
   llegue, porque una regla acotada entra cuando el agente **lee** un archivo de esa parte, y
   escribir el primero es cuando más se la necesita. Si una sección no se puede reducir a eso, no se
   mueve. Las seis que se movieron pasan porque su invariante la rechaza un gate en el acto:
   equivocarse cuesta un ciclo de gate, no una revisión.
3. **El límite vive en la política declarada**, no en el script (constitución XI), y **cuenta los
   punteros**: un núcleo que entra sólo porque no cuenta lo que carga no entra.
4. **Dos verificaciones nuevas**: toda regla declara a qué se aplica o por qué no —una regla sin
   acotar carga al arrancar y no ahorra nada—, y esa parte existe —una regla que nunca se puede
   activar es una regla muerta—.

### Consecuencias

- `CLAUDE.md` pasa de **573 a 194 líneas**. La serie completa: 360 → 675 → 573 → 194.
- Seis reglas acotadas al contrato, al código fuente, a la aplicación, al dominio, a las pruebas y a
  las evaluaciones. Ninguna línea de contenido se perdió; lo único consolidado fue la tabla de
  comandos, que duplicaba 26 de sus 30 filas con el inventario de `scripts/`.
- **El gate acepta que un comando esté documentado en dos lugares.** Pedirle al núcleo la lista
  completa era lo que hacía de esa tabla una segunda copia del inventario; lo que no puede pasar es
  un comando descrito en **ninguno**.
- **La clasificación mira desde el título.** Antes empezaba en el segundo nivel, así que el título
  del núcleo —que lleva la convención de idioma— nunca había tenido que clasificarse.
- Las tres verificaciones de gobernanza —identificadores, citas de decisiones y marcadores— alcanzan
  a las siete instrucciones, no sólo al núcleo.
