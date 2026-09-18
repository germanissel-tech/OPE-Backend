# Feature Specification: Dominio rico e invariantes por construcción

**Feature Branch**: `009-dominio-rico`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Dominio rico e invariantes por construcción. Refactor del anillo
de dominio sin cambio de comportamiento ni de contrato: los conceptos con invariantes o
comportamiento son clases con constructor privado, fábrica que devuelve un resultado y
rehidratación desde persistencia; las invariantes se validan en su dueño; las políticas
publicadas en el contrato viven en dominio o aplicación, no en gateways; todo puerto es
asíncrono; regla verificable de que el dominio no exporta funciones sueltas; casos de uso,
servicios, controllers y gateways adaptados; ADR y guía; pruebas de integración intactas."

## Contexto

La 008 dio forma a la capa de aplicación. El dominio quedó como lo dejó la 004: tipos de datos
(`EventBatch`, `Decision`, `Experiment`, `Merchant`) y, en otro archivo, las funciones que los
protegen (`checkBatch`, `assignArm`, `originAllowed`, `noOp`). Es un **modelo anémico**: los
datos y sus reglas viven separados, así que nada impide construir un lote que mezcla sesiones,
una decisión `INTERVENE` sin intervención o un experimento con un reparto fuera de rango; el
que tiene que acordarse de validar es quien consume. Además hay invariantes validadas fuera de
su dueño (el reparto del experimento se comprueba en la configuración, y el gateway de
configuración construye entidades sin pasar por ninguna regla), una política publicada en el
contrato que vive en un gateway (la ventana de deduplicación), una convención propia violada
(porcentaje 0–100 dentro del dominio en lugar de una tasa 0–1) y puertos que admiten
respuestas síncronas o asíncronas indistintamente.

Esta feature fija el criterio y lo hace cumplir por herramienta: **si tenés la instancia, es
válida**; las reglas viven con el concepto que protegen; lo publicado en el contrato es del
dominio o de la aplicación. Sin cambio de contrato ni de comportamiento observable.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Un concepto con reglas sólo existe válido (Priority: P1)

Quien recibe un lote, una decisión, un experimento o un merchant sabe, por el tipo, que
cumple sus invariantes: no hay forma de construirlo salvo por su fábrica, que devuelve éxito
con la instancia o fallo con el error de dominio correspondiente. Reconstruirlo desde
persistencia usa una vía distinta que no repite la validación de creación (las reglas se
evaluaron cuando se creó; los datos ya son hechos).

**Why this priority**: es la definición de "dominio rico": los estados ilegales dejan de ser
representables y el consumidor no puede olvidarse de validar.

**Independent Test**: no existe forma pública de construir un `EventBatch`, una `Decision`, un
`Experiment` o un `Merchant` inválidos; las fábricas devuelven el error de dominio que hoy
devuelven las funciones sueltas, con los mismos códigos; la suite de 001–008 pasa sin cambiar
aserciones.

**Acceptance Scenarios**:

1. **Given** eventos de dos visitantes, **When** se pide un lote con ellos, **Then** el
   resultado es un fallo con el error `session-visitor-mismatch` y no existe ningún lote.
2. **Given** eventos de una misma sesión y visitante dentro de la tolerancia publicada,
   **When** se pide un lote, **Then** existe y expone la sesión, el visitante y los eventos.
3. **Given** un lote válido, **When** un caso de uso lo recibe, **Then** no vuelve a validar
   nada: el tipo garantiza las invariantes.
4. **Given** una decisión `INTERVENE`, **When** se construye, **Then** lleva obligatoriamente
   su intervención; **Given** una `NO_OP`, **Then** lleva obligatoriamente un motivo del
   catálogo tipado; ningún otro estado compila.
5. **Given** un reparto de tratamiento fuera de 0–1 o una semilla vacía, **When** se pide un
   experimento, **Then** falla con un error de dominio del módulo `experiment`.
6. **Given** una fila persistida (o un registro en memoria), **When** se rehidrata una
   entidad, **Then** se obtiene la instancia sin volver a evaluar las reglas de creación.

---

### User Story 2 - Las reglas viven con su dueño y se invocan por su nombre (Priority: P1)

Quien lee un concepto ve su comportamiento en él: un experimento **asigna** un visitante a un
brazo; un merchant **posee** una credencial y **admite** un origen; una decisión **es una
intervención** o no y **pertenece** a una sesión y un visitante. Las funciones sueltas del
dominio desaparecen, y una regla con fixture lo verifica.

**Why this priority**: es lo que hace al dominio legible y evita que la lógica se reparta entre
casos de uso y adaptadores.

**Independent Test**: `src/domain/` no exporta ninguna función suelta salvo las excepciones
declaradas (constructores de identificadores, constructores de resultado); una función
exportada en un fixture falla la verificación; la asignación de cada visitante es idéntica a
la de hoy (misma semilla, mismo reparto ⇒ mismo brazo).

**Acceptance Scenarios**:

1. **Given** un experimento y un visitante, **When** el experimento asigna, **Then** el brazo
   es exactamente el que la 007 calculaba para ese visitante (verificado sobre la misma muestra
   de 100 000 visitantes).
2. **Given** un merchant con orígenes registrados, **When** se pregunta si admite un origen
   escrito con otras mayúsculas o barra final, **Then** responde igual que hoy, y la
   normalización ocurrió una sola vez al construir el merchant.
3. **Given** una decisión, **When** el caso de uso de exposición decide si puede exponerse,
   **Then** pregunta a la decisión (es intervención; pertenece a la sesión y visitante), sin
   comparar campos a mano.
4. **Given** un archivo del dominio que exporta una función suelta, **When** corre la
   verificación, **Then** falla nombrando el archivo y la función.

---

### User Story 3 - Las invariantes se validan en su dueño; nadie las esquiva (Priority: P2)

La configuración y los gateways que construyen entidades pasan por la fábrica del dominio y,
si falla, el sistema no arranca (fail-closed) con el error traducido a un error de
configuración que nombra el campo. Ningún adaptador construye una entidad "a mano".

**Why this priority**: sin esto, la garantía de la historia 1 tiene puertas traseras.

**Independent Test**: un `OPE_MERCHANTS` con un reparto fuera de rango o un origen inválido
impide el arranque con un error de configuración que cita el campo, como hoy; el gateway de
configuración no contiene ninguna regla de negocio.

**Acceptance Scenarios**:

1. **Given** un merchant configurado con `treatmentPercent: 150`, **When** el servidor lee la
   configuración, **Then** rechaza arrancar con un error que nombra `experiments[i].treatmentPercent`
   (mismo comportamiento que hoy, ahora originado en la regla del dominio).
2. **Given** un merchant configurado con un origen que no es `scheme://host`, **When** arranca,
   **Then** rechaza con un error que nombra `origins[j]`.
3. **Given** los gateways de configuración, **When** se leen, **Then** sólo traducen registros
   a llamadas de fábrica; no contienen comparaciones ni normalizaciones propias.

---

### User Story 4 - Las políticas publicadas no viven en gateways; los puertos son asíncronos (Priority: P2)

Una regla que el contrato publica (la ventana de deduplicación: 24 h o 100 000 identificadores
por merchant, lo que ocurra primero) es una política de la aplicación que el gateway recibe,
de modo que otra tecnología de almacenamiento la cumpla sin reinventarla. Todo puerto devuelve
una promesa, para que la persistencia real no cambie ninguna firma.

**Why this priority**: prepara la persistencia (feature posterior) sin tocar aplicación ni
dominio cuando llegue.

**Independent Test**: la ventana de deduplicación está definida en la aplicación y el gateway
en memoria la recibe; ningún puerto declara una respuesta síncrona; un gateway síncrono no
compila.

**Acceptance Scenarios**:

1. **Given** la ventana de deduplicación, **When** se busca dónde está declarada, **Then** está
   en el módulo de ingesta de la aplicación y el gateway sólo la aplica.
2. **Given** cualquier puerto, **When** se lee su firma, **Then** toda operación devuelve una
   promesa.
3. **Given** un lote con un `eventId` visto hace 25 h, **When** se ingiere, **Then** se acepta
   (fuera de la ventana), igual que hoy.

---

### Edge Cases

- Un instante no parseable (`NaN`) no llega al dominio: el adaptador HTTP lo detecta al traducir
  el DTO (el contrato ya validó el formato; es una guarda de programación, no una regla).
- Un lote vacío no existe: el contrato exige al menos un evento; la fábrica lo rechaza como
  error de programación (lanza), no como error de negocio.
- Rehidratar datos que hoy serían inválidos (por ejemplo, un experimento cuya regla se
  endureció después): se rehidrata igual; las reglas de creación no se reevalúan sobre hechos
  registrados.
- `Decision.reason` en `NO_OP` es del catálogo tipado; en `INTERVENE` no hay motivo de `NO_OP`.
- El stub de decisión (`page-context-incomplete` / `decision-plane-unavailable`) sigue en el
  módulo de ingesta como comportamiento del lote hasta que exista el módulo de decisión;
  la regla de "sin funciones sueltas" lo alcanza: pasa a ser comportamiento de `EventBatch`.
- Valores sin reglas (`Exposure`, `Assignment`, identificadores, `Arm`, `ServiceHealth`) siguen
  siendo tipos: no se envuelven en clases por uniformidad vacía.

## Requirements _(mandatory)_

### Functional Requirements

**Entidades con invariantes por construcción**

- **FR-001**: `EventBatch`, `Decision`, `Experiment` y `Merchant` MUST ser clases con constructor
  privado, fábrica `of(...)` que devuelve `Result<T, E>` con los errores de su módulo, y
  `rehydrate(...)` que reconstruye sin validar reglas de creación.
- **FR-002**: `EventBatch.of` MUST hacer cumplir las invariantes publicadas en el contrato:
  misma sesión y visitante en todos los eventos, e instantes dentro de la tolerancia (24 h
  hacia atrás, 5 min hacia adelante) respecto del instante que recibe; MUST exponer la sesión,
  el visitante y los eventos; el comportamiento de decisión provisional (motivo de `NO_OP`
  según el contexto de página) MUST ser suyo hasta que exista el módulo de decisión.
- **FR-003**: `Decision` MUST ser una unión discriminada por `outcome`: `NO_OP` con `reason`
  del catálogo tipado y sin intervención; `INTERVENE` con intervención obligatoria; MUST
  ofrecer `isIntervention()` y `belongsTo(sessionId, visitorId)`.
- **FR-004**: `Experiment` MUST guardar el reparto como tasa 0–1 (`treatmentShare`), MUST
  rechazar tasas fuera de rango y semillas vacías, y MUST exponer `assign(visitorId): Arm`
  con **exactamente** la misma asignación que la 007 para todo visitante (misma clave y hash).
- **FR-005**: `Merchant` MUST exponer `owns(key)` y `allowsOrigin(origin)`; los orígenes MUST
  ser un value object `Origin` normalizado una única vez al construir; un origen no
  normalizable MUST fallar la construcción del merchant.
- **FR-006**: Los valores sin reglas (`Exposure`, `Assignment`, identificadores marcados, `Arm`,
  `ServiceHealth`) MUST seguir siendo tipos.

**Reglas con su dueño**

- **FR-010**: `src/domain/` MUST NOT exportar funciones sueltas; excepciones declaradas en la
  regla: los constructores de identificadores del núcleo compartido y `ok`/`fail`. Verificado
  con fixture.
- **FR-011**: Los casos de uso y servicios MUST invocar el comportamiento por su dueño
  (`experiment.assign`, `merchant.allowsOrigin`, `decision.isIntervention`) y MUST NOT
  reimplementar reglas del dominio.

**Invariantes validadas por su dueño**

- **FR-020**: La configuración y los gateways de configuración MUST construir entidades por su
  fábrica y traducir un fallo a `ConfigError` fail-closed que nombra el campo; MUST NOT contener
  reglas de negocio propias (rangos, normalizaciones, comparaciones).
- **FR-021**: La guarda de instantes no parseables MUST vivir en la traducción DTO → dominio del
  adaptador HTTP, no en el dominio.

**Políticas y puertos**

- **FR-030**: La ventana de deduplicación MUST declararse en el módulo de ingesta de la
  aplicación y entregarse al gateway; el gateway MUST NOT definirla.
- **FR-031**: Toda operación de todo puerto MUST devolver `Promise`; ningún puerto MUST admitir
  respuesta síncrona.

**Sin cambio de comportamiento**

- **FR-040**: El contrato HTTP y el mapa MUST NOT cambiar; las respuestas de las operaciones
  construidas MUST ser idénticas (Schemathesis y pruebas de integración sin cambios en
  aserciones; las pruebas sólo cambian en cómo construyen el sujeto).
- **FR-041**: La asignación experimental MUST ser bit a bit la misma que en la 007 (prueba de
  regresión sobre la muestra de 100 000 visitantes con brazos precomputados).
- **FR-042**: Una decisión de arquitectura MUST registrar el criterio (qué es clase, qué es
  tipo, fábrica/rehidratación, dueño de las reglas, políticas publicadas, puertos asíncronos)
  y la guía de agentes MUST describir cómo se escribe una entidad nueva.

### Key Entities

- **EventBatch**: lote de una sesión y un visitante; invariantes de coherencia y tolerancia
  temporal; motivo de `NO_OP` provisional.
- **Decision**: `NoOpDecision` (motivo tipado) | `InterveneDecision` (intervención); pertenencia
  a sesión y visitante.
- **Experiment**: identidad, merchant, `treatmentShare` 0–1, semilla, estado, inicio; asigna
  visitantes.
- **Merchant**: identidad, credenciales de ingesta, `Origin[]`; posee credenciales y admite
  orígenes.
- **Origin**: value object `scheme://host[:port]` normalizado.
- **Política de deduplicación**: ventana (duración, cantidad) declarada en aplicación.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: El 100 % de los conceptos con invariantes (`EventBatch`, `Decision`, `Experiment`,
  `Merchant`) sólo se construyen por fábrica o rehidratación; cero funciones sueltas exportadas
  en `src/domain/` fuera de las excepciones (regla con fixture en verde).
- **SC-002**: Cero reglas de negocio en gateways y configuración: los gateways de configuración
  sólo traducen registros a llamadas de fábrica (revisión + prueba de arranque fail-closed).
- **SC-003**: 100 000 visitantes de la muestra de la 007 reciben el mismo brazo que antes del
  refactor.
- **SC-004**: Pruebas de integración y Schemathesis de 004–008 pasan sin cambios en aserciones;
  el contrato no cambia.
- **SC-005**: `quality`, `test:mutation` y `release-check` en verde.
- **SC-006**: Una entidad nueva se escribe siguiendo la guía en un archivo de dominio (clase +
  errores) sin tocar aplicación ni adaptadores para validarla.

## Assumptions

- Nombres: fábrica `of`, rehidratación `rehydrate`; las clases llevan el nombre del concepto
  (sin sufijo).
- `Decision` como unión de dos clases con una base común es la forma elegida de "unión
  discriminada"; el discriminante sigue siendo `outcome`.
- El DTO de `Decision` no cambia: el controller traduce la unión al mismo cuerpo de hoy.
- La rehidratación confía en los datos: no valida reglas de creación, sí aplica las marcas de
  identificadores.
- El porcentaje 0–100 sigue siendo el formato de `OPE_MERCHANTS`; la traducción a tasa ocurre en
  la configuración, que es el borde.
- La regla "sin funciones sueltas" se implementa con la misma mecánica que las reglas `ope/*`
  de la 008 (lint tipado o de forma, con fixture).
- Persistencia real fuera de alcance: `rehydrate` se prueba con los gateways en memoria y con
  pruebas unitarias.
