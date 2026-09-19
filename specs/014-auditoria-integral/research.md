# Research — Auditoría integral (014)

Decisiones de método. Cada una con qué se decidió, por qué y qué se descartó. Las de
organización las tomó el dueño antes de la spec (numeración 014, commits por fase, reporte por
fase, dudas una a una); acá se registran las que quedaban al método.

## R-01 — Fases y orden

- **Decisión (DECIDIDO)**: seis fases, 0 → 5, en el orden del plan. La fase 1 (lectura fina)
  va antes que la 4 (cumplimiento) porque leer el código con la rúbrica deja el mapa mental
  que la matriz de cumplimiento necesita para encontrar la prueba de cada afirmación; la 2
  (robustez) va antes que la 3 porque la lista de supuestos de instancia única alimenta las
  preguntas de escalabilidad.
- **Alternativa descartada**: empezar por F (cumplimiento) por ser lo que más pesa para el
  dueño. Se descartó porque sin la lectura previa cada afirmación exige buscar en frío y el
  costo total sube; el dueño puede reordenar al cierre de cualquier fase.
- **Estimación**: 11 sesiones (1 + 4 + 1 + 1 + 3 + 1); tres módulos por sesión en fase 1 es
  una estimación que la traza corrige.

## R-02 — Rúbrica de siete ejes con fuente citable

- **Decisión (DECIDIDO)**: los ejes y sus fuentes están en `contracts/rubrica.md`. La regla
  de oro: un hallazgo de lectura sólo entra si cita una regla escrita del repo; lo que no la
  tiene es `clarity:<slug>` y es `low`. Las secciones citables de `CLAUDE.md` (`guide#`) son
  las que existen en `8d12aa2`: "Anillos y módulos", "Cómo se escribe un caso de uso", "Cómo
  se escribe una entidad", "Gates de calidad", "Tipado", "Documentación viva", "Convenciones".
- **Por qué**: sin fuente, la lectura fina degenera en gusto; con fuente, el dueño puede
  discutir la regla, no al auditor.
- **Alternativa descartada**: una escala de legibilidad (1–5) por archivo. El handoff prohíbe
  puntuaciones y el dueño lo ratificó; el cuadro por módulo lista hallazgos por eje, no notas.

## R-03 — Fuente de un hallazgo funcional (documento del MVP o `FR`/`SC` de una spec)

- **Problema**: la gramática de `rule.source` del esquema de la skill
  (`audit-finding.schema.json`) admite `ADR-NNN`, `constitution#`, `guide#`, `lint:`, `arch:`,
  `shape:` y `clarity:`. Un hallazgo funcional cuya fuente es `01-arquitectura-mvp.md §5` o
  `specs/013/spec.md FR-014` no tiene cómo expresarse, y SC-001 exige que el 100 % de los
  hallazgos pase `verify-finding`.
- **Opciones**:
  1. Ampliar la gramática de la skill con `mvp:<01|02|03>#<sección>` (resuelve contra el
     encabezado del documento en `..`) y `spec:<NNN>#<FR-nnn|SC-nnn>` (resuelve contra la spec),
     ambas ⇒ `high` cuando la sección está DECIDIDA. Es un cambio chico en
     `audit-finding.schema.json`, `verify-finding.mjs` y `tests/audit/audit.test.ts`, en un
     commit previo a la fase 0. Contradice la Assumption "la skill se usa tal como está" y
     toca código de herramientas (no de producto).
  2. Usar como fuente el principio de la constitución que respalda la sección del MVP (casi
     todas las afirmaciones de 01/02/03 tienen uno) y poner la sección del documento y el
     `FR`/`SC` en `rule.id` y `evidence`. No toca la skill; pierde precisión en la fuente y
     deja sin fuente válida las afirmaciones que sólo viven en 02/03 o en una spec.
  3. Verificar los hallazgos funcionales con el esquema salvo `source`, y declararlo en el
     informe. Incumple SC-001 tal como está escrita.
- **Decisión (DECIDIDO por el dueño, 2026-09-19)**: opción 1. `mvp:<01|02|03>#<sección>`
  resuelve contra un encabezado del documento en `..` (`OPE_MVP_DOCS_DIR` lo redirige en las
  pruebas) y `spec:<NNN>#<FR-nnn|SC-nnn>` contra la spec; ambas imponen `high`. Sólo se cita una
  sección DECIDIDA: lo que contradice un `PROPUESTO`/`ABIERTO` es riesgo, no hallazgo. Commit
  previo a la fase 0 en esta rama (esquema, resolvers, prueba con fixture, referencias de la
  skill); `Assumptions` de la spec ajustada.

## R-04 — Traza: `tasks.md` + `avance.md`

- **Decisión (DECIDIDO)**: `tasks.md` es la traza de **qué** se hizo (una tarea por unidad
  de trabajo, marcada `[x]`); `docs/auditoria/trabajo/avance.md` es la traza de **cómo quedó**
  (dónde está cada salida, qué se leyó, próximo paso exacto, respuestas del dueño a dudas).
  Cada sesión empieza leyendo los dos; ninguna lectura ni comando se repite si ya figura.
- **Por qué dos archivos**: `tasks.md` es el formato del repo para trazar features y lo lee
  `check-prerequisites`; `avance.md` necesita prosa y rutas que no caben en una casilla.
- **Alternativa descartada**: un `HANDOFF.md` en la raíz — tiene otro significado en el repo
  (`CLAUDE.md` § "Si existe HANDOFF.md").

## R-05 — Qué significa "leer un módulo"

- **Decisión (DECIDIDO)**: para cada alcance, en este orden: (1) `run-gates.mjs --module` (o
  `--dir`) con salida a `trabajo/gates/`; (2) lectura completa de `src/domain/<m>/`,
  `src/application/<m>/`, `src/interface-adapters/gateways/<m>/`,
  `src/interface-adapters/http/controllers/<m>/` y de sus pruebas en `tests/`, archivo por
  archivo, aplicando los siete ejes; (3) contraste con la nota del glosario de cada sustantivo
  del módulo, los ADRs que lo citan, la spec y el quickstart de su feature; (4) hallazgos a
  `hallazgos/fase-1.json`, refutados, verificados. "Leído" = figura en `avance.md` con la lista
  de archivos.
- **Por qué el orden**: los gates primero para no reportar como cognitivo lo que ya es hecho;
  el contraste documental al final porque exige haber entendido el código.

## R-06 — Comandos largos

- **Decisión (DECIDIDO)**: `test:mutation -- --all` se lanza en segundo plano en la fase 0
  con su salida a `trabajo/gates/mutation-full.json`; la fase 3 lo usa. Si al llegar la fase 3
  no terminó o falló, se usa `reports/mutation/report.json` de la última rama y `avance.md`
  lo dice. `test:contract` requiere `npm run build` previo (gotcha del handoff): se corre en
  ese orden y se registra la versión de `dist/` (hash del commit).
- **Gates rotos por el entorno** (fixture ausente, herramienta no instalada): se registran tal
  cual, se corrige el entorno, se repite; nunca se reinterpretan (FR-004).

## R-07 — Extracción de afirmaciones DECIDIDAS

- **Decisión (DECIDIDO)**: en la fase 0 se recorren la constitución (I–X), 01 §4/§5/§6/§9/§10,
  02 §4/§5, 03 §4.5/§4.7/§4.8/§4.11/§6/§10 y los `FR`/`SC` de las specs 001–013, y cada
  enunciado con estado DECIDIDO (o principio MUST) pasa a `trabajo/afirmaciones.md` con id
  (`A-001`…), origen (documento y sección), texto abreviado y estado del documento. Los
  enunciados `PROPUESTO`/`ABIERTO` se listan aparte: no generan `high`.
- **Por qué antes de leer código**: la lista fija el alcance del cumplimiento antes de que la
  lectura sesgue qué se busca; y es contable (SC-003).
- **Atajo aceptado**: los `quickstart.md` de cada feature traen la tabla escenario → prueba y
  los desvíos conocidos; se usan como primera evidencia y se verifica que la prueba exista.

## R-08 — Marcadores en el informe

- **Decisión (DECIDIDO)**: `check:markers` recorre `docs/`; el informe **no** usa las palabras
  `ABIERTO` ni `PLACEHOLDER` (bloqueantes de `release-check`). Un hueco se dice "hueco"; una
  recomendación de marcar algo en el código o en un ADR se propone en el informe y la decide el
  dueño.

## R-09 — Anclaje y aislamiento del alcance

- **Decisión (DECIDIDO)**: la rama nace de `main` en `8d12aa2`; el código que se lee es el de
  ese commit porque la rama sólo toca `specs/014-…` y `docs/auditoria/` (SC-006, verificado
  con `git diff --stat main -- . ':!specs/014-auditoria-integral' ':!docs/auditoria'` vacío).
  Lo que llegue a `main` durante la auditoría no se audita; la traza lo dice.
- **Verificación de cierre**: `verify-finding.mjs` sobre cada `hallazgos/fase-N.json` al
  cerrar la fase y sobre el conjunto en la fase 5; el estado global se recalcula desde los
  JSON y se compara con el declarado (SC-004).
