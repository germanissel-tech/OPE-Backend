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
  `markdown-heading`, `gate-rule`, `criteria-section`); ruta del documento de criterios; ruta de
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
- **Empaquetado**: un plugin de Claude Code (`plugins/auditable-architecture/`, con
  `.claude-plugin/plugin.json` versionado) cuyo fuente vive en este repositorio y un
  marketplace mínimo en la raíz. Este repo lo habilita por `.claude/settings.json`; otro
  proyecto lo instala desde este repo o con `--plugin-dir`. La copia en
  `.claude/skills/auditing-architecture/` **se reemplaza**: el método existe en un solo lugar y
  las nueve evaluaciones existentes —con sus `expected.json` sin cambio— son la prueba de que
  el reemplazo no pierde nada.
- **Acondicionamiento**: una segunda skill del mismo plugin (`conditioning-project`) inspecciona
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
- **Repositorio propio para el plugin desde el inicio**: la CI de este repo dependería de un
  checkout externo o de una copia fijada que diverge. Extraerlo cuando madure es mover el
  directorio y cambiar la fuente del marketplace.
- **Copia fijada de la skill además del plugin**: dos fuentes del mismo método.
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
