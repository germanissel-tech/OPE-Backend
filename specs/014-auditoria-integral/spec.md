# Feature Specification: Auditoría integral de ingeniería de software del backend (001–013)

**Feature Branch**: `014-auditoria-integral`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "Auditoría integral de ingeniería de software del backend de OPE
(features 001–013, main en 8d12aa2), en modo lectura: no cambia código, contrato ni
documentación; produce un informe verificable. […] Intención del dueño (DECIDIDO): auditar
finamente la calidad del código —legible, mantenible, bien documentado— y el cumplimiento de
los requisitos funcionales. […] Organización (DECIDIDO): por fases, porque es un trabajo largo
que cruza varias sesiones. […] Trazabilidad: tasks.md es la traza […]"

## Contexto

Trece features construyeron el backend de OPE (Zona B del MVP) de cero, contract-first y por
spec → plan → tasks → implement, con gates deterministas (contrato, lint, arquitectura,
duplicación, código muerto, idioma, mutación) y una skill de auditoría mecánica por módulo
(`auditing-architecture`, feature 005). Al cierre de la 013 el autor dejó un handoff
(`docs/auditoria/2026-09-19-handoff-auditoria-integral.md`) que fija las reglas del juego de
una auditoría: modo lectura, hallazgos verificables (`file:line`, cita literal, fuente),
refutación antes de reportar, gates citados como hechos, sin puntuaciones, seis dimensiones,
doce sospechas y el formato del informe.

Esta feature es esa auditoría, con una intención que el handoff no pone en primer plano y el
dueño sí (DECIDIDO): **calidad fina del código** —legible, mantenible, bien documentado— y
**cumplimiento de los requisitos funcionales**. Por eso agrega a las dimensiones del handoff
una lectura archivo por archivo de todos los módulos con una rúbrica fija, y un contraste
explícito entre lo que la documentación dice y lo que el código hace. Escalabilidad y
seguridad se cubren con las preguntas del handoff, sin exploración extra.

Es también un trabajo largo que cruza varias sesiones. Por eso se organiza en fases con
cierre verificable, y la traza del avance es la misma que la de cualquier feature del repo:
`tasks.md`, una tarea por unidad de trabajo, marcada al cerrarse, y un commit por fase en la
rama de la feature. Nada llega a `main` sin que el dueño lo pida.

**Qué produce**: un informe (`docs/auditoria/2026-09-19-informe-auditoria-integral.md`) y sus
archivos de trabajo (`docs/auditoria/trabajo/`). **Qué no toca**: código, contrato, ADRs,
`CLAUDE.md`, specs anteriores; un hallazgo que pida un cambio se propone con `before/after`,
lo aplica otra feature.

Fuera de esta feature: aplicar cualquier corrección; auditar la POC (no es base de código);
proponer cambio de herramienta, framework o lenguaje; puntuaciones o "notas" numéricas;
auditar features no construidas (014–018 planificadas se mencionan sólo como destino de
riesgos).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - El dueño lee un hallazgo y puede verificarlo sin confiar en el auditor (Priority: P1)

El dueño del repositorio abre el informe, elige cualquier hallazgo y, con `file:line`, la cita
literal y la fuente (sección de la constitución, ADR, sección de `CLAUDE.md`, regla de lint o
arquitectura, o sección de un documento del MVP), lo comprueba por sí mismo en menos de dos
minutos. Cada hallazgo trae qué cambiar (`before/after`) y qué prueba lo cubriría. Lo que no
sobrevivió a la refutación está en un anexo con el motivo, para que el dueño vea qué se
descartó y por qué.

**Why this priority**: es lo que distingue una auditoría de una opinión; sin verificabilidad
el resto del informe no vale nada.

**Independent Test**: tomar diez hallazgos al azar del informe; los diez tienen archivo y
línea existentes, la cita coincide con el archivo, la fuente resuelve, y la severidad es la que
la fuente impone. El verificador mecánico de la skill (`verify-finding`) acepta el conjunto
completo.

**Acceptance Scenarios**:

1. **Given** un hallazgo del informe, **When** el dueño abre `file:line`, **Then** encuentra la
   cita literal y la regla citada existe donde el hallazgo dice.
2. **Given** un hallazgo con severidad `high`, **When** se lee su fuente, **Then** es una
   sección de la constitución, un ADR o un DECIDIDO de los documentos del MVP; nunca una
   convención ni un criterio de claridad.
3. **Given** un hallazgo propuesto que un ADR justifica o un gate ya lista, **When** se cierra el
   informe, **Then** está en el anexo de refutados con su refutación, no en la lista principal.
4. **Given** el conjunto de hallazgos confirmados, **When** se pasa por el verificador mecánico,
   **Then** ninguno es rechazado.

---

### User Story 2 - El dueño ve la calidad fina de cada módulo, eje por eje (Priority: P1)

El dueño quiere saber, módulo por módulo, si el código es legible, mantenible y está bien
documentado, no sólo si pasa los gates. Cada uno de los doce módulos (más infraestructura y
composición) se lee archivo por archivo con la misma rúbrica de siete ejes —nombres,
comentarios, tamaño y forma, tipos, errores, pruebas como documentación, documentación ↔
código— y el informe cierra con un cuadro por módulo que lista los hallazgos de cada eje.
Un comentario que describe una decisión que el código ya no toma, un ADR que dice una cosa y
el código hace otra, o un quickstart que documenta un comando que no existe, son hallazgos
con la línea del documento y la del código.

**Why this priority**: es la intención declarada del dueño; los gates ponen techos (tamaño,
complejidad, duplicación) pero no leen.

**Independent Test**: para un módulo elegido al azar, el informe tiene una entrada por cada
eje de la rúbrica (con hallazgos o con "sin hallazgos" y qué se leyó), y cada archivo del
módulo figura como leído en la traza.

**Acceptance Scenarios**:

1. **Given** un módulo, **When** se cierra su lectura, **Then** la traza lista todos sus
   archivos de dominio, aplicación, gateways y controllers como leídos, y el informe tiene sus
   siete ejes.
2. **Given** un comentario o documento que afirma algo que el código no hace, **When** se lee
   el módulo, **Then** hay un hallazgo con las dos líneas (documento y código) y la fuente es
   el documento que miente, con severidad según ese documento (ADR ⇒ `high`).
3. **Given** un hallazgo de claridad sin regla escrita, **When** se reporta, **Then** su
   severidad es `low` y no altera el estado global; el cuadro por módulo lo muestra igual.

---

### User Story 3 - El dueño sabe qué requisito funcional está probado y cuál no (Priority: P1)

Para cada afirmación DECIDIDA de la constitución (principios I–X), de los documentos del MVP
(01 §4/§5/§6/§9/§10, 02 §4/§5, 03 §4.5/§4.7/§4.8/§4.11/§6/§10) y de las specs de las features
001–013 (cada `FR-` y `SC-`), el informe dice qué prueba o gate la sostiene (con su ruta y
nombre) o declara el hueco. Las doce sospechas del handoff quedan confirmadas o refutadas,
cada una con evidencia.

**Why this priority**: es la otra mitad de la intención del dueño y lo que ninguna herramienta
mide.

**Independent Test**: la matriz de cumplimiento tiene una fila por principio de la
constitución y por criterio de aceptación de 03 §10, ninguna vacía; cada `FR`/`SC` de las
specs figura con evidencia o hueco; las doce sospechas tienen veredicto.

**Acceptance Scenarios**:

1. **Given** un principio de la constitución, **When** se lee su fila, **Then** cita una prueba
   o gate existente, o dice "hueco" con lo que faltaría probar.
2. **Given** un DECIDIDO de un documento del MVP que el código contradice, **When** se reporta,
   **Then** es un hallazgo `high` que cita la sección del documento y el `FR`/`SC` de la spec.
3. **Given** una sospecha del handoff, **When** se cierra el informe, **Then** tiene veredicto
   (confirmada, con hallazgo; o refutada, con motivo) y no queda como pregunta.

---

### User Story 4 - El trabajo se retoma en cualquier sesión sin repetir lo hecho (Priority: P2)

La auditoría dura varias sesiones. Cualquier sesión nueva empieza leyendo la traza y sabe
exactamente qué fase está abierta, qué módulos y documentos ya se leyeron, dónde está la
salida de cada comando y cuál es el próximo paso. Cada fase termina con un commit en la rama
de la feature; el informe crece por acumulación y nunca se reescribe desde cero.

**Why this priority**: sin esto el trabajo largo se pierde en los cortes de contexto o se
repite; es lo que el dueño pidió explícitamente ("persistido", "trazabilidad").

**Independent Test**: abrir la traza en cualquier momento y responder, sin leer otra cosa,
"¿qué está hecho, qué falta, cuál es el siguiente paso?"; la historia de la rama tiene un
commit por fase cerrada.

**Acceptance Scenarios**:

1. **Given** una sesión nueva, **When** lee la traza, **Then** identifica la fase abierta y la
   próxima unidad de trabajo sin repetir lecturas ni comandos ya registrados.
2. **Given** una fase cerrada, **When** se mira la rama, **Then** hay un commit con la sección
   del informe y los archivos de trabajo de esa fase.
3. **Given** una duda que cambia el alcance o el criterio, **When** surge, **Then** se plantea
   al dueño una por una y la respuesta queda registrada en la traza antes de seguir.

---

### User Story 5 - El dueño obtiene un estado global derivado por regla, no por gusto (Priority: P2)

El informe termina con un estado —`rejected`, `changes-required` o `approved`— derivado
mecánicamente de los gates y de la severidad de los hallazgos confirmados, y con una lista de
riesgos que hoy no son defecto pero lo serán para las features 014–017 (memoria, instancia
única, tiempos de CI), cada uno con la feature que debería absorberlo.

**Why this priority**: el estado es lo que el dueño usa para decidir; debe ser reproducible a
partir del informe mismo.

**Independent Test**: recalcular el estado global aplicando la regla fija a los gates y a los
hallazgos confirmados del informe da el mismo resultado que el informe declara.

**Acceptance Scenarios**:

1. **Given** algún gate bloqueante en rojo o algún hallazgo confirmado `high`, **Then** el
   estado es `rejected`; **Given** ninguno `high` y alguno `medium`, **Then**
   `changes-required`; **Given** sólo `low` o nada, **Then** `approved`.
2. **Given** un riesgo para 014–017, **When** se lista, **Then** tiene `file:line` de dónde
   vive el supuesto y la feature que lo absorbe.

---

### Edge Cases

- Un documento del MVP no se puede leer (sesión sin acceso al directorio padre): la fase de
  cumplimiento lo declara en "qué no se pudo verificar" y no asume su contenido.
- Un gate falla por el entorno (herramienta ausente, build desactualizado) y no por el código:
  se registra tal cual con su causa, se corrige el entorno y se vuelve a correr; nunca se
  reinterpreta.
- Un hallazgo depende de una sección de un documento que dice `PROPUESTO` o `ABIERTO`: no es
  `high`; se reporta como riesgo o con fuente `guide#`/`clarity:` según corresponda.
- La mutación completa tarda más que una sesión: la fase que la necesita usa el último reporte
  disponible y la traza dice cuál.
- Dos fases producen el mismo hallazgo: el cierre lo deduplica conservando el `id` de la
  primera y citando la segunda.
- El código cambia en `main` durante la auditoría: la auditoría se ancla a `8d12aa2`; lo que
  llegue después no se audita y la traza lo dice.
- Un hallazgo pide cambiar código: se propone con `before/after`; esta feature no lo aplica.

## Requirements _(mandatory)_

### Functional Requirements

**Reglas del juego (del handoff, DECIDIDO)**

- **FR-001**: La auditoría MUST anclarse a `main` en `8d12aa2` y MUST NOT modificar código,
  contrato, ADRs, `CLAUDE.md` ni specs anteriores; sus únicos artefactos son el informe, los
  archivos de trabajo y los documentos de esta feature.
- **FR-002**: Todo hallazgo MUST tener `id`, `file:line` existente, cita literal, regla con
  fuente resoluble, severidad derivada de la fuente (constitución/ADR/DECIDIDO del MVP ⇒
  `high`; `CLAUDE.md`/lint/arch/shape ⇒ `medium`; claridad ⇒ `low`), propuesta `before/after`
  en código y la prueba que lo cubriría.
- **FR-003**: Todo hallazgo MUST pasar por la refutación antes de confirmarse; los refutados
  MUST figurar en un anexo con su motivo.
- **FR-004**: Los gates deterministas MUST citarse tal cual salen; un hallazgo cognitivo sobre
  algo que un gate ya lista MUST descartarse salvo que aporte el caso que la regla no ve.
- **FR-005**: El informe MUST NOT contener puntuaciones numéricas; el estado global MUST
  derivarse por la regla fija (`rejected` / `changes-required` / `approved`).
- **FR-006**: El informe MUST tener, en orden: alcance y método (qué se leyó, qué se corrió,
  qué no se pudo verificar), gates, hallazgos confirmados por dimensión y severidad, matriz de
  cumplimiento, refutados, riesgos para 014–017, estado global.

**Calidad fina (intención del dueño, DECIDIDO)**

- **FR-007**: Cada módulo (`shared-kernel`, `system`, `merchant`, `ledger`, `experiment`,
  `ingestion`, `catalog`, `barrier`, `selection`, `commercial`, `decision`, `outcomes`) y los
  directorios `infrastructure` y `composition` MUST auditarse con la skill mecánica y MUST
  leerse archivo por archivo (dominio, aplicación, gateways, controllers y sus pruebas).
- **FR-008**: La lectura MUST aplicar una rúbrica fija de siete ejes —nombres, comentarios,
  tamaño y forma, tipos, errores, pruebas como documentación, documentación ↔ código— fijada
  antes de leer el primer módulo y con una fuente citable por eje.
- **FR-009**: Todo desvío entre documentación (ADR, glosario, quickstart, `CLAUDE.md`,
  comentario de encabezado) y código MUST reportarse con las dos líneas y con la severidad
  del documento que afirma.
- **FR-010**: El informe MUST cerrar con un cuadro por módulo con los hallazgos de cada eje
  (o "sin hallazgos"), sin puntuación.

**Cumplimiento funcional (DECIDIDO)**

- **FR-011**: La auditoría MUST extraer, antes de auditar cumplimiento, la lista de
  afirmaciones DECIDIDAS de la constitución (I–X), de los documentos del MVP (01 §4/§5/§6/§9/
  §10, 02 §4/§5, 03 §4.5/§4.7/§4.8/§4.11/§6/§10) y de las specs 001–013 (`FR-` y `SC-`).
- **FR-012**: Para cada afirmación, el informe MUST citar la prueba o gate que la sostiene
  (ruta y nombre) o declarar el hueco; una contradicción con un DECIDIDO MUST ser un hallazgo
  `high` con la sección y el `FR`/`SC`.
- **FR-013**: Las doce sospechas del handoff §6 MUST recibir veredicto (confirmada con
  hallazgo, o refutada con motivo).

**Dimensiones del handoff que se cubren sin exploración extra**

- **FR-014**: Robustez: fail-closed en cada borde, concurrencia en memoria, ventanas y podas,
  relojes, cuerpos grandes y `throw` que deberían ser resultados, según §5.B del handoff.
- **FR-015**: Escalabilidad (§5.C), seguridad (§5.D) y calidad de las pruebas (§5.E): las
  preguntas listadas en el handoff, cada una con respuesta y evidencia; sin ampliar el
  alcance.

**Organización y traza (DECIDIDO)**

- **FR-016**: El trabajo MUST organizarse en fases con cierre verificable: 0 base, 1 lectura
  fina por módulo, 2 robustez, 3 seguridad/escalabilidad/pruebas, 4 cumplimiento funcional,
  5 cierre.
- **FR-017**: `tasks.md` MUST ser la traza: una tarea por comando global, por módulo × eje,
  por grupo de afirmaciones y por sospecha; cada tarea se marca al cerrarse y cada sesión
  empieza leyéndolo.
- **FR-018**: Cada fase MUST terminar con un commit en la rama de la feature que incluya la
  sección del informe y los archivos de trabajo de la fase; el PR se abre al final; nada va a
  `main` sin que el dueño lo pida.
- **FR-019**: Los archivos de trabajo MUST vivir en `docs/auditoria/trabajo/`: avance, salidas
  crudas de gates y comandos, hallazgos por fase verificados por script, y la lista de
  afirmaciones.
- **FR-020**: Una duda que cambie alcance o criterio MUST plantearse al dueño una por una y su
  respuesta MUST quedar registrada en la traza antes de seguir.

### Key Entities

- **Hallazgo**: defecto verificable; `id`, ubicación (`file:line`), cita, regla y fuente,
  severidad, dimensión y eje, propuesta `before/after`, prueba que lo cubriría, estado
  (`proposed` → `confirmed` | `refuted` con motivo), fase que lo produjo.
- **Afirmación**: enunciado DECIDIDO de la constitución, de un documento del MVP o de una
  spec (`FR`/`SC`); origen (documento y sección), evidencia (prueba o gate, con ruta) o hueco.
- **Sospecha**: punto del handoff §6; veredicto y hallazgo o refutación asociada.
- **Fase**: unidad de trabajo con objetivo, tareas, sección del informe que cierra y commit.
- **Módulo auditado**: nombre, archivos leídos, salida de la skill, hallazgos por eje.
- **Informe**: el entregable, con sus siete secciones y el cuadro por módulo.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: El 100 % de los hallazgos confirmados pasa el verificador mecánico (archivo,
  línea, fuente y severidad) y el 100 % de los refutados tiene motivo escrito.
- **SC-002**: Los doce módulos e `infrastructure` y `composition` tienen los siete ejes de la
  rúbrica en el informe, y todos sus archivos figuran como leídos en la traza.
- **SC-003**: La matriz de cumplimiento tiene una fila por principio (10) y por criterio de
  aceptación de 03 §10, sin filas vacías; cada `FR`/`SC` de las specs 001–013 figura con
  evidencia o hueco; las doce sospechas tienen veredicto.
- **SC-004**: El estado global recalculado desde los gates y los hallazgos del informe
  coincide con el declarado.
- **SC-005**: Una sesión que sólo lee la traza identifica la fase abierta y el siguiente paso
  sin repetir ninguna lectura ni comando registrado; la rama tiene un commit por fase cerrada.
- **SC-006**: El diff de la rama contra `main` toca únicamente `specs/014-auditoria-integral/`
  y `docs/auditoria/`.

## Assumptions

- Los documentos del MVP (`../01`, `../02`, `../03`) son legibles desde la sesión (la sesión se
  lanza con acceso al directorio padre); si no, se declara antes de la fase 4.
- La skill `auditing-architecture` se usa tal como está, con una sola ampliación previa a la
  fase 0 decidida por el dueño: fuentes `mvp:` y `spec:` para los hallazgos funcionales (R-03).
  Ampliar sus criterios o reglas más allá de eso es trabajo de otra feature.
- Los `quickstart.md` de cada feature son la fuente honesta de los desvíos conocidos respecto
  del plan; se leen como parte de la fase 4.
- El número 014 corre en uno la numeración de las features planificadas en
  `contracts/api-map.yaml` (configuración pasa a 015, etc.); actualizar ese mapa es trabajo de
  la feature que lo toque, no de esta.
- Tres módulos por sesión es una estimación; la traza registra el avance real.
- La mutación completa se lanza en la fase 0 y su reporte se usa en la fase 3; si no está
  disponible, se usa el reporte incremental de la última rama y la traza lo dice.
