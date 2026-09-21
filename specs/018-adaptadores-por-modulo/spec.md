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
ningún comportamiento observable." Ampliado en la evaluación del 2026-09-21 con el dueño: lo
derivado y lo ajeno salen de `src/`, el catálogo de problemas se genera, `composition/config.ts`
se parte y las pruebas espejan el árbol.

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

Además, dentro de `src/` conviven tres cosas que no son código escrito a mano ni adaptadores
del servidor: los tipos generados del contrato (`http/generated/api.d.ts`, 4 000 líneas
derivadas), un cliente HTTP tipado para consumidores (`http/client.ts`, usado sólo por pruebas)
y una réplica manual de 311 líneas del catálogo de tipos de problema
(`http/problem-details.ts`), que una prueba mantiene igual a `contracts/problem-types.yaml`.

### Decisiones tomadas en la evaluación (2026-09-21, dueño)

- **El anillo conserva la lectura estricta de Clean Architecture** (ADR-013): `interface-adapters/`
  contiene todo lo que **traduce** en las dos direcciones —controllers y presenters (entrada),
  security handlers, gateways que implementan puertos (salida)—; `infrastructure/` contiene sólo
  lo que **hospeda o provee tecnología** (Fastify, pino, CORS, y mañana el driver de Postgres).
  Se evaluó y se descartó la variante "driving en `interface-adapters/`, driven en
  `infrastructure/`" (Onion): la separación entrada/salida se hace explícita **dentro de cada
  módulo** con los nombres del libro (`controllers/`, `presenters.ts`, `security/`, `gateways/`).
- **Se descarta la versión radical** (`src/modules/<m>/` con los cuatro anillos adentro): rompe la
  forma de anillos y todo el tooling que la verifica.
- **No se reduce la cantidad de archivos** fusionando controllers ni gateways: un controller por
  operación y un gateway por puerto y tecnología son reglas deliberadas (localizable, mutable de
  forma aislada). El adaptador en memoria no es un placeholder: es el doble oficial de cada puerto
  para desarrollo y pruebas, y se queda cuando llegue la persistencia.
- **Lo derivado sale de `src/`**: los tipos del contrato y el catálogo de problemas se generan en
  `generated/` (raíz del repo), versionados, verificados por drift y colapsados en las PR.
- **El catálogo de problemas se genera**, no se replica: `contracts/problem-types.yaml` es la
  única fuente; el archivo escrito a mano y su prueba de réplica desaparecen.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - El anillo de adaptadores tiene la forma de los otros dos (Priority: P1)

Como agente o persona que agrega una operación o un gateway a un módulo, quiero encontrar todo
lo que ese módulo expone al borde en un solo directorio con una API pública —controllers,
presenters (dominio → DTO), security handlers y gateways, con la entrada y la salida a la vista
por su nombre—, con la misma forma que `domain/` y `application/`, para que agregar una feature
sea agregar archivos dentro de un módulo y una línea en su `index.ts`, y no repartir helpers en
la raíz del anillo ni tocar la composición archivo por archivo.

**Why this priority**: es el cambio en sí; sin él no hay nada que vigilar ni que documentar.

**Independent Test**: para cada módulo que hoy tiene controllers o gateways existe un
directorio `interface-adapters/<módulo>/` con su `index.ts`, la raíz de `http/` no contiene
ningún archivo que conozca un módulo, la composición importa de cada módulo sólo su `index.ts`, y
toda la suite (unitaria, integración, contrato, Schemathesis) pasa sin cambiar una sola
expectativa.

**Acceptance Scenarios**:

1. **Given** un módulo con controllers y gateways (por ejemplo `merchant`), **When** se lista su
   directorio del anillo, **Then** contiene `controllers/` (uno por operación), `presenters.ts`
   (dominio → DTO), `security/` (sus security handlers), `gateways/` (una implementación por
   puerto y tecnología) y un `index.ts` que exporta lo que la composición cablea, y nada de otro
   módulo.
2. **Given** un módulo que sólo tiene gateways (`barrier`, `decision`) o sólo un controller
   (`system`), **When** se lista su directorio, **Then** tiene la misma forma con las partes que
   le faltan ausentes, y su `index.ts`.
3. **Given** los helpers de borde que hoy viven en la raíz de `http/`, **When** termina la
   feature, **Then** cada uno vive en el módulo cuyo vocabulario usa (`presenters.ts`), o en el
   núcleo si no conoce ningún módulo (paginación, instantes, idempotencia, principal,
   capacidades), y la raíz de `http/` no contiene ningún nombre de módulo.
4. **Given** un módulo de composición, **When** se leen sus imports del anillo, **Then** son
   exactamente el `index.ts` de su módulo y, si lo necesita, el del `shared-kernel` del anillo; el
   resto del archivo (slice de puertos, tablas por tecnología, `new` de los casos de uso,
   handlers) no cambia.
5. **Given** `composition/config.ts`, **When** termina la feature, **Then** está partido por lo
   que lee (merchants, experimentos, niveles del release), con `operators-config.ts` como modelo,
   sin cambiar ningún mensaje de `ConfigError`.
6. **Given** las pruebas existentes (unitarias, integración, contrato, Schemathesis, carga),
   **When** se corren tras el cambio, **Then** pasan con las mismas expectativas: ninguna
   respuesta, código de estado, header, log ni cuerpo cambia; sólo cambian rutas de import, y
   las pruebas unitarias del anillo viven en `tests/unit/interface-adapters/<módulo>/`,
   espejando el árbol.
7. **Given** el contrato OpenAPI y el mapa del contrato, **When** termina la feature, **Then**
   no tienen ningún cambio.

---

### User Story 2 - La forma se vigila: nadie puede volver a acoplar (Priority: P2)

Como dueño del repositorio, quiero que la forma nueva del anillo esté escrita como reglas que
fallan el build —el mapa de contextos rige también en el anillo, el núcleo HTTP no conoce
ningún módulo, la composición sólo entra por el `index.ts` de cada módulo, los gateways sólo
toman drivers de `infrastructure/`—, cada una con su fixture que la demuestra, para que la
próxima feature no pueda volver a cruzar módulos sin permiso ni dejar helpers sueltos.

**Why this priority**: sin las reglas el refactor se degrada con la siguiente feature; con las
reglas, la forma queda como un invariante del repositorio, igual que los anillos.

**Independent Test**: un fixture de arquitectura por regla, que reproduce la violación y es
reportado por la verificación de arquitectura; el código real pasa limpio.

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
5. **Given** un gateway que importa un driver o un framework desde fuera de `infrastructure/`
   (por ejemplo un cliente de base de datos importado directo), **When** corre la verificación,
   **Then** lo reporta; la regla queda lista para la feature de persistencia aunque hoy no haya
   ningún driver.
6. **Given** dos módulos del anillo que hoy comparten un helper sin que el mapa permita esa
   dependencia, **When** termina la feature, **Then** el helper vive en el núcleo (si no conoce
   ningún módulo) o la dependencia se resuelve con un adaptador en la composición, y ninguna
   regla queda con excepción.
7. **Given** las reglas existentes (un controller por operación, un gateway no importa otro
   gateway, un controller no importa gateways, la traducción a problemas sólo desde el adaptador
   HTTP, los perfiles no eligen gateways), **When** corren sobre la forma nueva, **Then** siguen
   valiendo y sus fixtures siguen reportando.

---

### User Story 3 - Lo derivado y lo ajeno salen de `src/` (Priority: P3)

Como ingeniero que revisa el código, quiero que `src/` contenga sólo código escrito a mano y que
lo que se deriva del contrato —los tipos de la API y el catálogo de tipos de problema— se
genere en un solo lugar fuera de `src/`, verificado por drift y colapsado en las revisiones,
para que ninguna réplica manual pueda desviarse de la fuente y para que un diff de contrato no
ensucie la revisión con miles de líneas generadas.

**Why this priority**: elimina 311 líneas mantenidas a mano y una clase entera de desvío; es
independiente de la forma del anillo pero conviene hacerlo en la misma feature porque mueve
rutas del mismo núcleo.

**Independent Test**: `generated/` contiene los tipos de la API y el catálogo de problemas
producidos por `contract:types`; el drift de ambos falla `contract:types:check`; el archivo
escrito a mano del catálogo y su prueba de réplica no existen; toda la suite pasa sin cambiar
una aserción.

**Acceptance Scenarios**:

1. **Given** el contrato bundleado y `contracts/problem-types.yaml`, **When** corre
   `contract:types`, **Then** escribe de forma determinista `generated/api.d.ts` y
   `generated/problem-types.ts` (namespace, tabla de tipos con status y título como literales, y
   el tipo de los slugs), y `contract:types:check` falla si cualquiera de los dos difiere.
2. **Given** el catálogo generado, **When** se compara con la réplica manual de hoy, **Then** es
   idéntico en contenido (mismos slugs, status y títulos), de modo que ninguna prueba cambia de
   expectativa; la réplica manual y su prueba desaparecen; la prueba de que todo código de error
   del dominio existe en el catálogo se conserva contra el generado.
3. **Given** un archivo de `domain/` o `application/`, **When** importa lo generado, **Then** la
   verificación de arquitectura lo reporta; sólo el núcleo HTTP del anillo y la infraestructura
   HTTP pueden importarlo, y los módulos del anillo lo consumen a través del núcleo.
4. **Given** el cliente HTTP tipado para consumidores, **When** termina la feature, **Then** no
   vive en el anillo de adaptadores del servidor (queda fuera de `src/`, disponible para las
   pruebas y para los consumidores) y nada de `src/` lo importa.
5. **Given** una PR que cambia el contrato, **When** se revisa en GitHub, **Then** los archivos
   generados aparecen colapsados como generados.
6. **Given** el valor de `Retry-After` que hoy es una constante en el adaptador, **When** termina
   la feature, **Then** es un valor del nivel de plataforma (constitución XI) y ningún archivo de
   `src/` declara ese número.

---

### User Story 4 - La decisión queda documentada (Priority: P4)

Como agente que llega al repositorio, quiero que la forma del anillo, sus reglas, lo generado y
las decisiones de la evaluación estén en el ADR de anillos y en las instrucciones para agentes,
y que las herramientas que citan rutas del anillo sigan funcionando, para no reconstruir la
decisión ni tropezar con una herramienta que apunta a una ruta vieja.

**Why this priority**: cierra el cambio; sin esto la próxima sesión vuelve a la forma vieja por
inercia de las instrucciones.

**Independent Test**: el ADR de anillos lleva la enmienda fechada; las instrucciones para
agentes describen dónde va cada cosa; los gates de calidad y la auditoría corren sin excepción
nueva.

**Acceptance Scenarios**:

1. **Given** el ADR de anillos, **When** termina la feature, **Then** tiene una enmienda fechada
   con la forma del anillo por módulo (entrada y salida por nombre), el núcleo `http/`, lo
   generado fuera de `src/`, las reglas nuevas y las variantes evaluadas y descartadas (Onion,
   radical, fusionar archivos) con su motivo.
2. **Given** las instrucciones para agentes, **When** se busca dónde va un controller, un
   presenter, un security handler, un gateway o un valor derivado del contrato, **Then** la
   respuesta es un directorio del módulo o `generated/`, y el paso a paso de "feature que toca
   HTTP" nombra esas rutas.
3. **Given** las herramientas que citan rutas del anillo (código muerto, forma de los anillos,
   generación de tipos, mutación, la auditoría de arquitectura con sus fixtures y evals, la
   skill de auditoría), **When** corren, **Then** pasan sin excepción ni ruta rota.

---

### Edge Cases

- Un helper de borde usado por dos módulos que el mapa de contextos no relaciona (hoy: la
  respuesta de colección paginada de un merchant, usada por `configuration`, `experiment` y
  `admin`; la respuesta de rotación, usada tres veces en `merchant`): si no conoce ningún módulo
  va al núcleo; si conoce uno, va a ese módulo y los otros lo reciben por un adaptador de la
  composición, nunca por un import cruzado.
- Un security handler que sirve a varios módulos (la credencial de ingesta la usan `ingestion`,
  `ledger`, `outcomes` y `admin`): vive en el módulo dueño de la credencial (`merchant`); los
  controllers que la leen sólo dependen del principal genérico del núcleo, no del handler.
- El `shared-kernel` del anillo (paginación en memoria, ids aleatorios, reloj, mapa acotado)
  sigue siendo importable por cualquier módulo del anillo, como en los otros dos anillos.
- El catálogo de problemas generado debe conservar el orden y los comentarios de agrupación
  que hoy tiene la réplica sólo si viven en la fuente (`group:` en el YAML); un comentario que
  sólo existe en el archivo manual se pierde a propósito.
- El archivo generado del catálogo tiene valores en runtime (no es sólo tipos): se compila y se
  emite a `dist/`; el gate de mutación, lint, Prettier y knip lo excluyen como a todo lo
  generado.
- El proyecto `tools` de pruebas y las fixtures de auditoría que copian la forma de `src/` deben
  seguir reflejando la forma nueva, o la auditoría reporta rutas que ya no existen.
- El gate de mutación: mover archivos no crea mutantes nuevos, pero el diff contra `main`
  incluye cada archivo movido y el incremental los identifica por ruta: la corrida de CI es
  larga una vez y debe dar cero sobrevivientes; un sobreviviente nuevo sería la evidencia de un
  import mal apuntado que dejó una prueba sin cubrir lo que cubría.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Cada módulo que hoy tiene controllers o gateways MUST tener un directorio propio en
  el anillo con, según lo necesite, `controllers/`, `presenters.ts`, `security/`, `gateways/` y
  un `index.ts` que exponga lo que la composición cablea.
- **FR-002**: La raíz del núcleo HTTP MUST contener sólo lo que no conoce ningún módulo: tipado de
  handlers, traducción a Problem Details, estados HTTP, helpers genéricos de borde (paginación,
  instantes, idempotencia) y la seguridad genérica (principal, capacidades).
- **FR-003**: Ningún archivo del núcleo HTTP MUST importar de un módulo del anillo.
- **FR-004**: Un módulo del anillo MUST importar de otro módulo del anillo sólo por su `index.ts`
  y sólo si el mapa de contextos permite esa dependencia; el `shared-kernel` del anillo queda
  siempre permitido.
- **FR-005**: Un módulo de composición MUST importar del anillo únicamente el `index.ts` de su
  propio módulo y el del `shared-kernel` del anillo; toda dependencia entre módulos del anillo
  que el mapa no permite MUST resolverse con un adaptador en la composición o moviendo el helper
  al núcleo.
- **FR-006**: Un gateway MUST tomar drivers y frameworks sólo desde `infrastructure/`; nunca
  importarlos directo.
- **FR-007**: Las reglas FR-003, FR-004, FR-005 y FR-006 MUST estar en la verificación de
  arquitectura, cada una con un fixture que reproduce la violación y una prueba que verifica
  que se reporta.
- **FR-008**: El comportamiento observable MUST no cambiar: contrato, mapa del contrato,
  respuestas, códigos, headers, logs y las expectativas de todas las pruebas existentes se
  conservan; sólo cambian rutas de import y la ubicación de las pruebas unitarias del anillo.
- **FR-009**: Las reglas existentes de forma y de arquitectura MUST seguir valiendo con la forma
  nueva: un controller por operación, un gateway no importa otro gateway, un controller no
  importa gateways, la traducción a problemas sólo desde el adaptador HTTP, los perfiles no
  eligen gateways.
- **FR-010**: Los tipos de la API y el catálogo de tipos de problema MUST generarse desde el
  contrato en `generated/` (fuera de `src/`), de forma determinista, versionados y verificados
  por drift; la réplica manual del catálogo y su prueba MUST desaparecer; la prueba de que todo
  código de error del dominio existe en el catálogo MUST conservarse.
- **FR-011**: Lo generado MUST ser importable sólo desde el núcleo HTTP del anillo y desde la
  infraestructura HTTP, verificado por la arquitectura, y MUST aparecer colapsado como generado
  en las revisiones.
- **FR-012**: El cliente HTTP tipado para consumidores MUST vivir fuera de `src/`; nada de `src/`
  MUST importarlo.
- **FR-013**: El valor de `Retry-After` MUST ser un valor del nivel de plataforma; ningún archivo
  de `src/` MUST declarar ese número.
- **FR-014**: `composition/config.ts` MUST partirse por lo que lee (merchants, experimentos,
  niveles del release) sin cambiar ningún mensaje de configuración.
- **FR-015**: Las pruebas unitarias del anillo MUST vivir en `tests/unit/interface-adapters/<módulo>/`,
  espejando el árbol.
- **FR-016**: El ADR de anillos MUST llevar una enmienda fechada con la forma nueva, lo generado,
  las reglas y las variantes descartadas con su motivo; las instrucciones para agentes MUST
  describir la forma nueva en la tabla de anillos, en el paso a paso de una feature que toca HTTP
  y en las notas que citan rutas del anillo.
- **FR-017**: Las herramientas que citan rutas del anillo o de lo generado (código muerto, forma
  de los anillos, generación de tipos, mutación, auditoría de arquitectura y sus fixtures y
  evals, la skill de auditoría) MUST actualizarse y pasar sin excepción nueva.
- **FR-018**: Todos los gates del repositorio MUST quedar en verde sin ninguna excepción nueva
  de lint, idioma, arquitectura, duplicación, código muerto ni mutación.

### Key Entities

- **Módulo del anillo**: el directorio de un módulo dentro del anillo de adaptadores; expone su
  API por `index.ts` y contiene, por nombre, la entrada (controllers, presenters, seguridad) y
  la salida (gateways) del módulo.
- **Núcleo HTTP**: lo que el anillo comparte sin conocer ningún módulo: tipado de handlers,
  Problem Details, helpers genéricos de borde y seguridad genérica.
- **Artefacto generado**: un archivo producido desde el contrato por un script determinista,
  versionado y verificado por drift, nunca editado: los tipos de la API y el catálogo de
  problemas.
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
  del anillo que no sea un `index.ts`; cero imports de lo generado desde fuera del núcleo HTTP y
  la infraestructura HTTP; cada regla reporta su fixture.
- **SC-003**: `src/` no contiene ningún archivo generado ni el cliente para consumidores; el
  catálogo de problemas escrito a mano no existe; `contract:types:check` cubre los dos
  artefactos generados.
- **SC-004**: La suite completa —unitaria, integración, reglas del contrato, gobernanza,
  arquitectura, herramientas, Schemathesis— pasa sin cambiar ninguna aserción; el contrato y
  el mapa del contrato no tienen diff.
- **SC-005**: Agregar una operación a un módulo existente toca archivos de un solo directorio
  del anillo (más su línea en el `index.ts`) y la línea de cableado en la composición: ningún
  archivo de otro módulo ni de la raíz del anillo.
- **SC-006**: Todos los gates en verde con cero excepciones nuevas; el gate de mutación de CI sin
  sobrevivientes.

## Assumptions

- El anillo conserva su nombre `interface-adapters` y su lugar en la cadena de dependencias
  (lectura estricta de Clean Architecture, ADR-013); las variantes Onion y radical quedan
  descartadas por decisión del dueño y se documentan en la enmienda.
- El mapa de contextos existente (el de `domain/` y `application/`) es el que rige en el anillo;
  si el anillo necesita una dependencia que el mapa no tiene, se resuelve con un adaptador de
  composición o moviendo el helper al núcleo, no ampliando el mapa por conveniencia. Ampliar el
  mapa es una decisión aparte y se documenta como tal si ocurre.
- Los módulos `system` y `shared-kernel` del anillo entran en la forma nueva aunque sean
  mínimos.
- No se crea ningún módulo nuevo ni se mueve nada entre `domain/`, `application/`,
  `infrastructure/` y `composition/` salvo rutas de import, la partición de `config.ts` y los
  adaptadores de composición que FR-005 exija.
- Los archivos generados se versionan (la compilación y las pruebas los necesitan sin correr el
  generador) y CI verifica que estén al día; un `.gitattributes` los marca como generados.
- El catálogo generado es un archivo con valores en runtime, compilado y emitido como el resto
  del código; queda excluido de lint, formato, código muerto y mutación como todo lo generado.
- Las pruebas que importan del anillo cambian sus rutas de import y, las unitarias del anillo,
  su ubicación; nada más.
- Commits en español, uno por historia; sin push hasta la PR final; sin merge hasta que el
  dueño lo pida.
