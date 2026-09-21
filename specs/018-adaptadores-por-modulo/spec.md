# Feature Specification: Adaptadores por módulo

**Feature Branch**: `018-adaptadores-por-modulo`

**Created**: 2026-09-21

**Status**: Draft

**Input**: User description: "Refactor del anillo `src/interface-adapters/` por módulo (decisión
del dueño del 2026-09-20, registrada al cerrar la 017): el anillo crece acoplando módulos sin
regla que lo vigile —archivos de borde en la raíz de `http/`, controllers de un módulo que
importan helpers de otro, `composition/modules/<m>.ts` que importa cada controller y cada
gateway por su ruta— y ninguna regla de dependency-cruiser lo detecta. Intención: que el anillo
tenga la misma forma vertical que `domain/` y `application/`, que el núcleo HTTP no conozca
ningún módulo, y que la composición importe de cada módulo sólo su `index.ts`. Sin cambiar
ningún comportamiento observable."

## Contexto

El repositorio organiza `domain/` y `application/` por módulo (ADR-013): cada módulo expone su
API en un `index.ts`, sólo importa de otro módulo por ese `index.ts` y sólo si el mapa de
contextos lo permite; `npm run arch` lo hace cumplir. El anillo de adaptadores no sigue esa
forma: está partido en dos por tecnología (`http/controllers/<módulo>/` y
`gateways/<módulo>/`), los helpers de borde de varios módulos viven sueltos en la raíz de
`http/` (`boundary.ts`, `admin-boundary.ts`, `configuration-boundary.ts`,
`experiment-boundary.ts`), un controller de un módulo importa helpers que pertenecen a otro sin
que nada lo vigile, y la composición importa cada controller y cada gateway por su ruta (más
de cincuenta imports repartidos en los módulos de composición). Hoy 26 de los 29 controllers
importan un archivo de borde de la raíz. Cada feature nueva agranda el problema.

La versión radical del cambio (`src/modules/<m>/` con los cuatro anillos adentro) fue evaluada
y descartada por el dueño: rompe la forma de anillos que ADR-013 fija y todo el tooling que la
verifica. Esta feature es la versión conservadora: el anillo conserva su nombre y su lugar en la
cadena de dependencias; lo que cambia es su forma interna y las reglas que la vigilan.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - El anillo de adaptadores tiene la forma de los otros dos (Priority: P1)

Como agente o persona que agrega una operación o un gateway a un módulo, quiero encontrar todo
lo que ese módulo expone al borde en un solo directorio con una API pública —controllers,
traducción DTO ↔ dominio, security handlers y gateways—, con la misma forma que `domain/` y
`application/`, para que agregar una feature sea agregar archivos dentro de un módulo y una
línea en su `index.ts`, y no repartir helpers en la raíz del anillo ni tocar la composición
archivo por archivo.

**Why this priority**: es el cambio en sí; sin él no hay nada que vigilar ni que documentar.

**Independent Test**: para cada módulo que hoy tiene controllers o gateways existe un
directorio `interface-adapters/<módulo>/` con su `index.ts`, la raíz de `http/` no contiene
ningún archivo que conozca un módulo, y toda la suite (unitaria, integración, contrato,
Schemathesis) pasa sin cambiar una sola expectativa.

**Acceptance Scenarios**:

1. **Given** un módulo con controllers y gateways (por ejemplo `merchant`), **When** se lista su
   directorio del anillo, **Then** contiene sus controllers, su traducción DTO ↔ dominio, sus
   security handlers, sus gateways y un `index.ts` que exporta lo que la composición cablea, y
   nada de otro módulo.
2. **Given** los helpers de borde que hoy viven en la raíz de `http/`, **When** termina la
   feature, **Then** cada uno vive en el módulo cuyo vocabulario usa, o en el núcleo si no
   conoce ningún módulo (paginación, instantes, idempotencia, principal, capacidades), y la raíz
   de `http/` no contiene ningún nombre de módulo.
3. **Given** las pruebas existentes (unitarias, integración, contrato, Schemathesis, carga),
   **When** se corren tras el cambio, **Then** pasan con las mismas expectativas: ninguna
   respuesta, código de estado, log ni cuerpo cambia; sólo cambian rutas de import en las
   pruebas que importan del anillo.
4. **Given** el contrato OpenAPI y el mapa del contrato, **When** termina la feature, **Then**
   no tienen ningún cambio.

---

### User Story 2 - La forma se vigila: nadie puede volver a acoplar (Priority: P2)

Como dueño del repositorio, quiero que la forma nueva del anillo esté escrita como reglas que
fallan el build —el mapa de contextos rige también en el anillo, el núcleo HTTP no conoce
ningún módulo, la composición sólo entra por el `index.ts` de cada módulo—, cada una con su
fixture que la demuestra, para que la próxima feature no pueda volver a cruzar módulos sin
permiso ni dejar helpers sueltos.

**Why this priority**: sin las reglas el refactor se degrada con la siguiente feature; con las
reglas, la forma queda como un invariante del repositorio, igual que los anillos.

**Independent Test**: tres fixtures de arquitectura, uno por regla, que reproducen la violación
y son reportados por la verificación de arquitectura; el código real pasa limpio.

**Acceptance Scenarios**:

1. **Given** un archivo del módulo A del anillo que importa un archivo interno (no el `index.ts`)
   del módulo B del anillo, **When** corre la verificación de arquitectura, **Then** lo reporta
   como violación del mapa de contextos.
2. **Given** un archivo del módulo A del anillo que importa el `index.ts` del módulo B cuando el
   mapa de contextos no permite A → B, **When** corre la verificación, **Then** lo reporta.
3. **Given** un archivo del núcleo `http/` que importa cualquier archivo de un módulo del anillo,
   **When** corre la verificación, **Then** lo reporta.
4. **Given** un módulo de composición que importa del anillo un archivo que no es el `index.ts`
   de su módulo (o del `shared-kernel`), **When** corre la verificación, **Then** lo reporta.
5. **Given** dos módulos del anillo que hoy comparten un helper sin que el mapa permita esa
   dependencia, **When** termina la feature, **Then** el helper vive en el núcleo (si no conoce
   ningún módulo) o la dependencia se resuelve con un adaptador en la composición, y ninguna
   regla queda con excepción.

---

### User Story 3 - La decisión queda documentada (Priority: P3)

Como agente que llega al repositorio, quiero que la forma del anillo y sus reglas estén en el
ADR de anillos y en las instrucciones para agentes, y que las herramientas que citan rutas del
anillo (código muerto, forma de los anillos, auditoría) sigan funcionando, para no reconstruir
la decisión ni tropezar con una herramienta que apunta a una ruta vieja.

**Why this priority**: cierra el cambio; sin esto la próxima sesión vuelve a la forma vieja por
inercia de las instrucciones.

**Independent Test**: el ADR de anillos lleva la enmienda fechada con la forma nueva y las tres
reglas; las instrucciones para agentes describen dónde va cada cosa; los gates de calidad y la
auditoría corren sin excepción nueva.

**Acceptance Scenarios**:

1. **Given** el ADR de anillos, **When** termina la feature, **Then** tiene una enmienda fechada
   con la forma del anillo por módulo, el núcleo `http/` y las tres reglas nuevas.
2. **Given** las instrucciones para agentes, **When** se busca dónde va un controller, un DTO,
   un security handler o un gateway, **Then** la respuesta es un directorio del módulo, y el
   paso a paso de "feature que toca HTTP" nombra esas rutas.
3. **Given** las herramientas que citan rutas del anillo (código muerto, forma de los anillos,
   auditoría de arquitectura y sus fixtures), **When** corren, **Then** pasan sin excepción ni
   ruta rota.

---

### Edge Cases

- Un helper de borde usado por dos módulos que el mapa de contextos no relaciona (hoy:
  paginación y respuesta de colección de un merchant, usada por `configuration`, `experiment` y
  `admin`): si no conoce ningún módulo va al núcleo; si conoce uno, va a ese módulo y los otros
  lo reciben por un adaptador de la composición, nunca por un import cruzado.
- Un security handler que sirve a varios módulos (la credencial de ingesta la usan `ingestion`,
  `ledger`, `outcomes` y `admin`): vive en el módulo dueño de la credencial (`merchant`); los
  controllers que la leen sólo dependen del principal genérico del núcleo, no del handler.
- El `shared-kernel` del anillo (paginación en memoria, ids aleatorios, reloj) sigue siendo
  importable por cualquier módulo del anillo, como en los otros dos anillos.
- Un módulo que sólo tiene gateways y ningún controller (`barrier`, `decision`,
  `ledger` en parte): igual tiene su directorio e `index.ts`; la forma es la misma aunque falten
  partes.
- El proyecto `tools` de pruebas y las fixtures de auditoría que copian la forma de `src/` deben
  seguir reflejando la forma nueva, o la auditoría reporta rutas que ya no existen.
- El gate de mutación: mover archivos no crea mutantes nuevos, pero el diff contra `main`
  incluye cada archivo movido; el incremental de CI conserva los veredictos por contenido, así
  que la corrida es larga sólo si el contenido cambió.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Cada módulo que hoy tiene controllers o gateways MUST tener un directorio propio en
  el anillo con, según lo necesite, controllers, traducción DTO ↔ dominio, security handlers,
  gateways y un `index.ts` que exponga lo que la composición cablea.
- **FR-002**: La raíz del núcleo HTTP MUST contener sólo lo que no conoce ningún módulo: tipos
  generados del contrato, tipado de handlers, traducción a Problem Details, catálogo de
  problemas, estados HTTP, helpers genéricos de borde (paginación, instantes, idempotencia) y la
  seguridad genérica (principal, capacidades).
- **FR-003**: Ningún archivo del núcleo HTTP MUST importar de un módulo del anillo.
- **FR-004**: Un módulo del anillo MUST importar de otro módulo del anillo sólo por su `index.ts`
  y sólo si el mapa de contextos permite esa dependencia; el `shared-kernel` del anillo queda
  siempre permitido.
- **FR-005**: Un módulo de composición MUST importar del anillo únicamente el `index.ts` de su
  propio módulo y el del `shared-kernel` del anillo; toda dependencia entre módulos del anillo
  que el mapa no permite MUST resolverse con un adaptador en la composición o moviendo el helper
  al núcleo.
- **FR-006**: Las tres reglas anteriores (FR-003, FR-004, FR-005) MUST estar en la verificación
  de arquitectura, cada una con un fixture que reproduce la violación y una prueba que verifica
  que se reporta.
- **FR-007**: El comportamiento observable MUST no cambiar: contrato, mapa del contrato,
  respuestas, códigos, headers, logs y las expectativas de todas las pruebas existentes se
  conservan; sólo cambian rutas de import.
- **FR-008**: Las reglas existentes de forma y de arquitectura MUST seguir valiendo con la forma
  nueva: un controller por operación, un gateway no importa otro gateway, un controller no
  importa gateways, la traducción a problemas sólo desde el adaptador HTTP, los perfiles no
  eligen gateways.
- **FR-009**: El ADR de anillos MUST llevar una enmienda fechada con la forma nueva del anillo y
  las tres reglas; las instrucciones para agentes MUST describir la forma nueva en la tabla de
  anillos, en el paso a paso de una feature que toca HTTP y en las notas que citan rutas del
  anillo.
- **FR-010**: Las herramientas que citan rutas del anillo (código muerto, forma de los anillos,
  auditoría de arquitectura y sus fixtures, la skill de auditoría) MUST actualizarse y pasar sin
  excepción nueva.
- **FR-011**: Todos los gates del repositorio MUST quedar en verde sin ninguna excepción nueva
  de lint, idioma, arquitectura, duplicación, código muerto ni mutación.

### Key Entities

- **Módulo del anillo**: el directorio de un módulo dentro del anillo de adaptadores; expone su
  API por `index.ts` y contiene controllers, DTO, seguridad y gateways del módulo.
- **Núcleo HTTP**: lo que el anillo comparte sin conocer ningún módulo: tipos del contrato,
  tipado de handlers, Problem Details, helpers genéricos de borde y seguridad genérica.
- **Adaptador de composición**: lo que cablea una dependencia entre módulos del anillo que el
  mapa de contextos no permite dentro del anillo; vive en la composición.
- **Regla de arquitectura**: una restricción de imports verificada por el build, con su fixture.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: El 100 % de los módulos con controllers o gateways tiene su directorio en el anillo
  con `index.ts`; la raíz del núcleo HTTP no contiene ningún archivo cuyo nombre o contenido
  nombre un módulo.
- **SC-002**: Cero imports de un módulo del anillo hacia el interior de otro módulo del anillo;
  cero imports del núcleo HTTP hacia un módulo; cero imports de la composición hacia un archivo
  del anillo que no sea un `index.ts`; las tres reglas reportan su fixture.
- **SC-003**: La suite completa —unitaria, integración, reglas del contrato, gobernanza,
  arquitectura, herramientas, Schemathesis— pasa sin cambiar ninguna expectativa; el contrato y
  el mapa del contrato no tienen diff.
- **SC-004**: Agregar una operación a un módulo existente toca archivos de un solo directorio
  del anillo (más su línea en el `index.ts`) y la línea de cableado en la composición: ningún
  archivo de otro módulo ni de la raíz del anillo.
- **SC-005**: Todos los gates en verde con cero excepciones nuevas; el gate de mutación de CI sin
  sobrevivientes.

## Assumptions

- La versión radical (`src/modules/<m>/…` con los cuatro anillos adentro) queda descartada por
  decisión del dueño; el anillo conserva su nombre `interface-adapters` y su lugar en la cadena
  de dependencias.
- El mapa de contextos existente (el de `domain/` y `application/`) es el que rige en el anillo;
  si el anillo necesita una dependencia que el mapa no tiene, se resuelve con un adaptador de
  composición o moviendo el helper al núcleo, no ampliando el mapa por conveniencia. Ampliar el
  mapa es una decisión aparte y se documenta como tal si ocurre.
- El módulo `system` (salud) y el `shared-kernel` del anillo entran en la forma nueva aunque
  sean mínimos.
- No se crea ningún módulo nuevo ni se mueve nada entre `domain/`, `application/`,
  `infrastructure/` y `composition/` salvo rutas de import y los adaptadores de composición
  que la regla FR-005 exija.
- Las pruebas que importan del anillo (helpers de pruebas, unitarias de gateways y controllers)
  cambian sus rutas de import y nada más.
- Commits en español, uno por historia; sin push hasta la PR final; sin merge hasta que el
  dueño lo pida.
