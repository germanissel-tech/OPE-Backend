# Feature Specification: Calidad de código — tipado fuerte verificable, lint y formato

**Feature Branch**: `003-calidad-de-codigo`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "Calidad de código: tipado fuerte verificable, lint y formato. Hoy
CLAUDE.md dice 'TypeScript strict, sin any' y nada lo hace cumplir. (1) lint con reglas
type-aware en modo estricto (sin `any` explícito ni valores `any`, promesas sin manejar,
aserciones non-null, imports de tipos sin marcar, switch no exhaustivo; orden de imports) sobre
src/, tests/, scripts/ y las funciones custom del contrato, con excepciones justificadas
inline; (2) formato único y automático para TS, JS, JSON, YAML y Markdown con verificación
que falla el build; el linter no formatea; (3) los scripts JavaScript se verifican con tipos
sin cambiar cómo se ejecutan; (4) compilador endurecido; (5) hook de pre-commit con formato,
lint y typecheck sobre lo staged, sin contract:check ni pruebas; (6) .editorconfig; (7)
comandos en CI y en la guía de agentes. Sin cambios de comportamiento."

## Contexto

La guía de agentes exige "TypeScript `strict`. Sin `any`" y la constitución dice que toda
regla marcada como MUST es verificable por herramienta. Hoy el compilador sólo prohíbe el
`any` implícito: un `as any`, una promesa que nadie espera, un `!` que silencia un `null`
posible, o un import que salta de capa por una ruta relativa, pasan `typecheck`, `arch` y CI.
Además, unas 1.500 líneas de JavaScript (scripts de verificación y funciones del ruleset del
contrato) corren en cada build sin ningún tipo, y no existe formateador: con varios agentes
escribiendo en sesiones distintas, el estilo diverge y los diffs se llenan de ruido.

Esta feature convierte esas expectativas en verificaciones que fallan el build, con la misma
disciplina de la 001 y la 002: cada regla clave tiene un caso que la viola y una prueba que
confirma la falla. No cambia comportamiento: la suite completa pasa sin modificar aserciones.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El tipado fuerte se hace cumplir, no se recomienda (Priority: P1)

Un agente escribe código que escapa del sistema de tipos —un `any` explícito, una llamada o
asignación sobre un valor `any`, una promesa sin manejar, una aserción non-null, un `switch`
sobre una unión que no cubre todos los casos, un import de tipo sin marcar como tipo— y el
lint falla nombrando archivo, línea y regla. Si la excepción es legítima (una frontera con una
librería sin tipos), la desactiva **en esa línea** con un motivo escrito, y la herramienta
cuenta cuántas excepciones hay.

**Why this priority**: es la razón de la feature. Sin esto, "sin `any`" es prosa, y el
código que llega desde la 004 en adelante (dominio real, adaptadores de Postgres/Redis) es
donde más daño hace.

**Independent Test**: se agrega un archivo con cada violación → el lint falla con esa regla;
se quita → pasa. El código existente pasa (o cada excepción está justificada inline).

**Acceptance Scenarios**:

1. **Given** un archivo con `any` explícito en un tipo, **When** se corre el lint, **Then**
   falla nombrando archivo, línea y la regla.
2. **Given** código que asigna, llama, devuelve o accede a miembros de un valor de tipo
   `any`, **When** se corre el lint, **Then** falla.
3. **Given** una promesa creada y no esperada ni manejada, **When** se corre el lint, **Then**
   falla.
4. **Given** una aserción non-null (`x!`), **When** se corre el lint, **Then** falla.
5. **Given** un `switch` sobre una unión discriminada que no cubre todos los casos, **When**
   se corre el lint, **Then** falla.
6. **Given** un import que sólo se usa como tipo y no está marcado como tal, **When** se corre
   el lint, **Then** falla (o se corrige automáticamente con el modo de arreglo).
7. **Given** una excepción desactivada inline sin motivo escrito, **When** se corre el lint,
   **Then** falla; con motivo, pasa y el resumen cuenta la excepción.
8. **Given** el código actual del repositorio (fuente, pruebas, scripts, funciones del
   ruleset), **When** se corre el lint, **Then** pasa.

---

### User Story 2 - Un solo formato, automático, verificado (Priority: P1)

Un agente escribe un archivo TypeScript, JavaScript, JSON, YAML o Markdown con un formato
distinto al del repo. La verificación de formato falla nombrando el archivo; un comando lo
corrige entero sin intervención. El linter no opina de formato: no hay dos herramientas
discutiendo por una coma.

**Why this priority**: con agentes distintos en cada sesión, el formato es lo primero que
diverge y lo que más ruido mete en los diffs y en las revisiones. Es barato y se instala una
sola vez.

**Independent Test**: se desalinea un archivo → `format:check` falla nombrándolo; se corre el
formateador → pasa y el archivo queda idéntico al formato canónico.

**Acceptance Scenarios**:

1. **Given** un archivo de cualquiera de los cinco tipos con formato distinto al canónico,
   **When** se corre la verificación de formato, **Then** falla nombrando el archivo.
2. **Given** el mismo archivo, **When** se corre el formateador, **Then** queda en formato
   canónico y la verificación pasa.
3. **Given** el repositorio entero, **When** se corre el formateador dos veces, **Then** la
   segunda no cambia nada (idempotente).
4. **Given** los artefactos generados (tipos, bundle, docs) y los fixtures de prueba,
   **When** se corre la verificación, **Then** los ignora: no se formatea lo que se genera.
5. **Given** una regla de formato que el linter también podría aplicar, **When** se configura
   el lint, **Then** esa regla está apagada en el linter: el formato es de una sola herramienta.

---

### User Story 3 - Los scripts en JavaScript también tienen tipos (Priority: P2)

Un agente modifica un script de verificación o una función custom del ruleset (JavaScript,
sin compilar) y le pasa un tipo equivocado a una utilidad compartida o accede a una propiedad
que no existe. El typecheck falla, igual que en TypeScript, sin que el script cambie de
extensión ni de forma de ejecutarse.

**Why this priority**: esos scripts son la maquinaria de `contract:check` y corren en cada
build; hoy un typo se descubre en runtime y sólo si el camino se ejercita.

**Independent Test**: se introduce un acceso a propiedad inexistente en un script → el
typecheck falla nombrando archivo y línea; se corrige → pasa.

**Acceptance Scenarios**:

1. **Given** un script JavaScript que usa una propiedad inexistente de un objeto devuelto por
   una utilidad compartida, **When** se corre el typecheck, **Then** falla nombrando archivo y
   línea.
2. **Given** los scripts y funciones existentes, **When** se corre el typecheck, **Then**
   pasan, con anotaciones de tipo en JSDoc donde el compilador no puede inferir.
3. **Given** un script, **When** se ejecuta con el intérprete como hasta ahora, **Then** corre
   igual: la verificación de tipos no cambia el runtime ni agrega un paso de compilación.

---

### User Story 4 - El compilador está al máximo razonable (Priority: P2)

El compilador rechaza accesos implícitos a propiedades de índice, imports con efectos
secundarios que no resuelven, sintaxis de módulos ambigua y sintaxis de TypeScript que no
puede borrarse sin transformar código. El código existente compila, con las correcciones que
esas opciones exigen.

**Why this priority**: son opciones que cuestan poco hoy (código chico) y mucho después; una
de ellas deja el código listo para ejecutarse sin transpilar en Node moderno.

**Independent Test**: un archivo con cada patrón prohibido falla la compilación; el repo
compila.

**Acceptance Scenarios**:

1. **Given** acceso con punto a una propiedad que viene de una index signature, **When** se
   compila, **Then** falla; con acceso por corchetes, pasa.
2. **Given** un `import "./no-existe.js"` con efectos secundarios, **When** se compila,
   **Then** falla.
3. **Given** un `enum` o un parámetro de propiedad en constructor (sintaxis no borrable),
   **When** se compila, **Then** falla.
4. **Given** el repositorio, **When** se compila, **Then** pasa y las pruebas siguen en verde.

---

### User Story 5 - El commit no entra sucio (Priority: P3)

Un agente intenta commitear archivos mal formateados o con violaciones de lint. El hook de
pre-commit corre formato y lint sobre lo staged y el typecheck, y rechaza el commit con el
motivo. No corre la verificación del contrato ni las pruebas: eso lo hacen CI y la guía de
agentes.

**Why this priority**: red de seguridad local; CI ya atrapa lo mismo, pero más tarde y más
caro.

**Independent Test**: se stagea un archivo mal formateado y se intenta commitear → rechazado;
se formatea → pasa. El hook tarda segundos, no minutos.

**Acceptance Scenarios**:

1. **Given** un archivo staged con formato o lint inválidos, **When** se intenta commitear,
   **Then** el commit se rechaza mostrando el problema.
2. **Given** archivos staged válidos, **When** se commitea, **Then** pasa en menos de 15
   segundos.
3. **Given** un clon nuevo, **When** se instalan dependencias, **Then** el hook queda activo
   sin paso manual.
4. **Given** una urgencia justificada, **When** se commitea con la opción de saltar hooks,
   **Then** el commit entra y CI lo atrapa: el hook nunca es la última defensa.

---

### Edge Cases

- **Archivos generados** (`src/generated/`, `contracts/dist/`, `docs/api/`, `dist/`): fuera
  del lint, del formato y del hook.
- **Fixtures de prueba** que contienen violaciones a propósito (arquitectura, reglas del
  contrato): fuera del lint y del formato; están listados explícitamente.
- **Frontera con librería sin tipos** (por ejemplo el contexto de una función custom del
  ruleset): la excepción va inline con motivo; el resumen del lint la cuenta.
- **Import que salta de capa por ruta relativa** (`../adapters/...` desde `handlers/`): lo
  atrapa la prueba de arquitectura ya existente; el lint sólo agrega el orden de imports, no
  duplica la regla de capas.
- **Windows y Linux**: el formateador normaliza fin de línea a LF (coherente con
  `.gitattributes`); el hook funciona en ambos.
- **Markdown con tablas anchas** (specs, ADRs): el formateador no las rompe; el ancho de
  línea de prosa se respeta si ya está por debajo y no se reflowea el texto existente.

## Requirements *(mandatory)*

### Functional Requirements

**Lint**

- **FR-001**: Un comando MUST analizar `src/`, `tests/`, `scripts/` y las funciones custom del
  contrato y fallar ante: `any` explícito; uso, asignación, llamada, retorno o acceso a
  miembros de valores `any`; promesas no manejadas; aserciones non-null; `switch` no
  exhaustivo sobre uniones; imports de tipo sin marcar como tipo; imports desordenados.
- **FR-002**: Toda excepción a una regla MUST ser inline, en la línea afectada, con un motivo
  escrito; una desactivación sin motivo o una desactivación que ya no aplica MUST fallar el
  lint.
- **FR-003**: El comando MUST informar la cantidad de excepciones vigentes.
- **FR-004**: El lint MUST NOT contener reglas de formato; el formato es de una sola
  herramienta.

**Formato**

- **FR-010**: Un comando MUST formatear TypeScript, JavaScript, JSON, YAML y Markdown según
  una única configuración, y otro MUST fallar si algún archivo difiere del formato canónico.
- **FR-011**: Los archivos generados y los fixtures con violaciones deliberadas MUST quedar
  excluidos, en una lista única.
- **FR-012**: El formato MUST ser idempotente y normalizar el fin de línea a LF.

**Tipos en JavaScript**

- **FR-020**: Los scripts de `scripts/` y las funciones de `contracts/rules/functions/` MUST
  verificarse con tipos con el mismo comando de typecheck, sin cambiar su forma de ejecución.
- **FR-021**: Las utilidades compartidas de esos scripts MUST tener sus firmas anotadas para
  que los consumidores se verifiquen.

**Compilador**

- **FR-030**: La configuración del compilador MUST exigir acceso explícito a index
  signatures, imports con efectos secundarios resolubles, sintaxis de módulos verbatim y
  sintaxis borrable; el repositorio MUST compilar con ella.

**Hook y editor**

- **FR-040**: Un hook de pre-commit MUST correr formato y lint sobre los archivos staged y el
  typecheck, y rechazar el commit ante fallas; MUST NOT correr la verificación del contrato
  ni las pruebas; MUST quedar instalado con la instalación de dependencias.
- **FR-041**: El repositorio MUST tener `.editorconfig` coherente con el formateador.

**Integración**

- **FR-050**: `lint` y `format:check` MUST correr en integración continua y figurar en la
  guía de agentes con el orden de trabajo actualizado.
- **FR-051**: Cada regla o verificación nombrada en FR-001, FR-002, FR-010, FR-020 y FR-030
  MUST tener un caso que la viola y una prueba que confirma la falla.
- **FR-052**: Toda la suite existente MUST pasar sin modificar aserciones; el servidor
  responde igual.

### Key Entities

- **Regla de lint**: identificador, severidad (siempre error), alcance (qué directorios),
  excepción inline con motivo.
- **Configuración de formato**: única, en un solo archivo; lista de exclusiones única.
- **Excepción justificada**: línea, regla, motivo; contable.
- **Hook**: eventos (pre-commit), pasos (formato, lint, typecheck), tiempo objetivo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las reglas y verificaciones de FR-051 tiene un caso que la viola y
  una prueba que confirma la falla.
- **SC-002**: `lint`, `format:check` y `typecheck` juntos corren localmente en menos de 60
  segundos sobre el estado de esta feature; el hook de pre-commit sobre un cambio típico, en
  menos de 15.
- **SC-003**: El código existente pasa el lint con cero excepciones no justificadas; las
  justificadas están contadas y cada una nombra su motivo.
- **SC-004**: Toda la suite anterior pasa sin modificar aserciones; los escenarios manuales de
  la 001 (§3, §4) responden igual.
- **SC-005**: Un agente nuevo que clona el repo e instala dependencias tiene formato, lint,
  typecheck y hook funcionando sin ningún paso manual adicional.

## Assumptions

- Las herramientas concretas (linter, formateador, gestor de hooks) se eligen en el plan; la
  spec fija el comportamiento. Restricción de la guía: el linter tiene que poder razonar con
  tipos (las reglas de `any` y promesas lo requieren); un linter sin análisis de tipos no
  cumple FR-001.
- Los scripts en JavaScript no se migran a TypeScript en esta feature: se verifican con tipos
  vía anotaciones, para no cambiar cómo arrancan en CI (US3, escenario 3).
- La regla de capas sigue siendo de la prueba de arquitectura (ADR-006); el lint no la
  duplica.
- Saltar el hook está permitido con la opción estándar del control de versiones; CI es la
  puerta real.
- "Sin cambios de comportamiento" admite correcciones de código exigidas por las reglas
  nuevas (marcar imports de tipo, reemplazar un `!` por un chequeo, acceso por corchetes),
  siempre que las pruebas existentes pasen sin tocar sus aserciones.
