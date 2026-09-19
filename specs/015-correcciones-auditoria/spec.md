# Feature Specification: Corrección de los hallazgos de la auditoría integral (014)

**Feature Branch**: `015-correcciones-auditoria`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "Corrección de los hallazgos confirmados por la auditoría integral
014 (docs/auditoria/2026-09-19-informe-auditoria-integral.md, estado global `rejected`), salvo
los de diseño que la 017 absorbe (F-043, F-045, F-046) […]. Intención del dueño: cerrar la
auditoría con el código, las decisiones escritas y las pruebas alineados, de modo que una
segunda corrida de la misma auditoría dé `approved` o `changes-required` sólo por lo que la
017 absorbe. […] el criterio de cierre es que cada F-NNN quede resuelto (cambio aplicado con
su prueba, o decisión escrita que lo cierra) o explícitamente rechazado por el dueño con
motivo en el informe."

## Contexto

La feature 014 auditó el backend construido por las features 001–013 y dejó un informe con
estado global `rejected` por regla fija: ningún gate del repositorio en rojo, pero 55
hallazgos confirmados y verificados (6 de severidad alta, 17 media, 32 baja), cada uno con
`file:line`, cita literal, fuente, propuesta `before/after` y la prueba que lo cubriría. El
estado no sale de código que haga algo distinto de lo que sus specs dicen (la matriz de
cumplimiento del informe §4 lo confirma), sino de contradicciones con decisiones escritas de
rango superior, de conocimiento repetido por debajo del umbral de los gates, de gates que no
miran lo que creen mirar y de prosa que quedó detrás del código.

Esta feature aplica esas correcciones. Tres hallazgos de diseño quedan fuera porque la
persistencia real (feature 017 del mapa) los absorbe y resolverlos antes sería rehacer los
puertos y el despliegue dos veces: F-043 (los puertos de lectura sólo pueden fallar
lanzando), F-045 (los dos planos comparten un event loop) y F-046 (el presupuesto por sesión
es un leer-modificar-escribir). Esta feature los deja escritos como insumo de la 017 —en el
informe ya lo están (§6)— y no los implementa.

**Qué produce**: código, contrato, documentos de decisión y pruebas alineados, de modo que la
misma auditoría, corrida de nuevo con el mismo método (`specs/014-auditoria-integral/`), no
encuentre ninguno de los 52 hallazgos en alcance. **Qué no cambia**: el comportamiento HTTP
observable de las siete operaciones construidas, salvo una respuesta nueva de indisponibilidad
del catálogo que ADR-021 §5 declara compatible.

Fuera de esta feature: F-043, F-045 y F-046 (017); los huecos que el informe §4 lista como
planificados en las features 014–017 del mapa (flags, kill switch, configuración por API,
`NOT_AVAILABLE`, portal, durabilidad); cambio de herramienta, framework o lenguaje; cualquier
hallazgo que el dueño rechace, que se anota en el informe con su motivo.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Las decisiones escritas dicen lo que el sistema hace (Priority: P1)

El dueño abre la constitución, los ADRs y la guía de agentes y encuentra descrito lo que el
sistema construido hace hoy: la notificación de orden lleva el incentivo aplicado y la
constitución lo admite; el puerto de plataforma de cuatro operaciones y sus adaptadores que
el principio X exige están planificados en el mapa del contrato como una feature, y hasta
entonces la deuda está declarada donde se decidió el caso base push; ningún documento vivo
habla del servidor mock ni del "modo real" retirados; el replay de una request firmada
dentro de la ventana está explicado como absorbido por la idempotencia; el perfil local
declara que sus ledgers en memoria no podan y no son un perfil para tráfico; y la política
comercial cumple la convención de tasas dentro del dominio como ya lo hace el experimento.

**Why this priority**: son los hallazgos de severidad alta que se resuelven escribiendo o
planificando (F-062, F-063) y la prosa detrás del código que engaña a quien lee primero los
documentos (F-014, F-015, F-058, F-047), más la convención de tasas (F-031) que decide la
forma de la política comercial antes de que la historia 2 la toque. Sin esto, cualquier
corrección de código se apoya en documentos que la contradicen.

**Independent Test**: se lee cada documento enmendado junto al código que describe y no queda
frase que el código desmienta; `check:markers` sin marcadores nuevos bloqueantes; la
constitución sube de versión con su fecha de enmienda; `verify-finding` sobre los F-NNN de
esta historia con `status: resolved` y la referencia al commit que los cierra.

**Acceptance Scenarios**:

1. **Given** la constitución v1.2.0 y `Order.yaml` con `incentive`, **When** se aplica la
   historia, **Then** la constitución (v1.3.0) admite en VII el incentivo aplicado como campo
   no personal de la notificación de orden, con la fecha y el motivo, y el documento 01 §10.3
   se cita como enmendado o se anota la diferencia en el ADR-028. (DECIDIDO 2026-09-19: se enmienda la constitución; el
   campo y la redención quedan como están).
2. **Given** el principio X con el puerto de cuatro operaciones "desde el día uno", **When**
   se aplica la historia, **Then** el principio X se mantiene y el mapa del contrato gana la
   feature que construye el puerto de plataforma de cuatro operaciones, el adaptador genérico
   y el adaptador de prueba, con la prueba de punta a punta que pide el Flujo de desarrollo;
   hasta entonces X queda como deuda declarada en el ADR-025 y en la guía (DECIDIDO
   2026-09-19: se planifica, no se enmienda).
3. **Given** `CLAUDE.md`, ADR-013 y los comentarios que hablan del "modo real", el mock o
   ADR-006, **When** se aplica la historia, **Then** ninguna prosa viva del repo nombra un
   modo, un mock o un ADR reemplazado como vigente.
4. **Given** ADR-029 sin mención del replay, **When** se aplica la historia, **Then** el ADR
   dice que un replay dentro de la ventana es posible por diseño y qué efecto tiene (ninguno
   más allá de la respuesta idempotente).
5. **Given** la convención "porcentajes sólo en el borde", **When** se aplica la historia,
   **Then** la política comercial guarda tasas 0–1 (techo, escalones y margen) con la
   conversión en el borde, como el experimento, y el incentivo sale al DTO como el porcentaje
   entero que el comprador ve; el contrato no cambia (DECIDIDO 2026-09-19: convertir).

---

### User Story 2 - Las reglas viven en su dueño y la seguridad hace lo que los ADRs deciden (Priority: P1)

Un integrador o un revisor comprueba que: un merchant con cero claves, cero orígenes o dos
experimentos activos no puede existir como entidad (lo rechaza el dueño de la regla, no un
parser); un navegador en un origen registrado no recibe permiso para enviar la credencial de
plataforma; la clave de plataforma se compara sin depender de cuánto se parece a la real; la
credencial pública no puede empujar cuerpos del tamaño de un catálogo al plano de decisión; y
la plataforma que reemplaza el catálogo con el almacén caído recibe la misma respuesta de
reintento que en órdenes y devoluciones.

**Why this priority**: F-007 y F-051 son de severidad alta (ADR-024 y ADR-025 deciden algo
que el código no hace); F-053, F-057 y F-044 cierran la misma dimensión de seguridad y
robustez con cambios chicos y prueba propia.

**Independent Test**: las pruebas propuestas en el informe para cada F-NNN (§3.A, §3.B, §3.D)
existen y pasan; las pruebas de integración de las features 004–013 pasan sin cambiar
aserciones; la única diferencia observable del contrato es la respuesta 503 nueva de
`upsertCatalogSnapshot`, y `contract:diff` la reporta como compatible.

**Acceptance Scenarios**:

1. **Given** `Merchant.of({ ingestKeys: [], origins: [] })` y un merchant con dos experimentos
   activos, **When** se construyen por su fábrica, **Then** el dominio los rechaza con un error
   tipado que nombra el campo, y la configuración sólo traduce ese error al campo del JSON.
2. **Given** un preflight desde un origen registrado que anuncia el header de la credencial de
   plataforma, **When** el servidor responde, **Then** ese header no aparece entre los
   permitidos y el de la credencial de ingesta sí.
3. **Given** una clave de plataforma que comparte un prefijo largo con una real, **When** se
   compara, **Then** el resultado no depende de la longitud del prefijo común (comparación en
   tiempo constante, la misma primitiva que la firma).
4. **Given** un cuerpo de 1 MiB enviado a la ingesta con la credencial pública, **When**
   llega, **Then** se rechaza por tamaño antes de parsearse; un snapshot de catálogo del
   tamaño del piloto sigue entrando.
5. **Given** un almacén de catálogo que no puede aceptar el snapshot, **When** la plataforma
   lo envía, **Then** recibe 503 con `Retry-After` y el tipo `ledger-unavailable`, y nada
   queda reemplazado a medias.

---

### User Story 3 - Los gates miran lo que creen mirar y el conocimiento está escrito una vez (Priority: P2)

Quien cambia una línea de `build-server.ts`, `condition.ts` o `signals.ts` recibe del gate de
mutación el veredicto sobre esa línea; un número dentro de un literal de objeto sin nombre
falla el lint; una regla de negocio, una tolerancia de reloj, una ventana acotada, un
predicado de tasa o la conversión de un instante existen en un solo lugar y las pruebas los
prueban una vez; un claim, un hecho o un candidato nuevos no compilan hasta que cada consumidor
dice qué hace con ellos; la prueba de contrato ejercita las operaciones de la plataforma con
su credencial; la suite por defecto no paga el tiempo de las pruebas que ejecutan
herramientas; y el helper de eventos no tiende la trampa del reloj real bajo un reloj fijo.

**Why this priority**: F-052 es medio y afecta la confianza en el gate de mutación de tres
archivos; el resto (F-013, F-021, F-030, F-033, F-038, F-039, F-048, F-054, F-055, F-056,
F-022) reduce el costo de cada feature siguiente.

**Independent Test**: el reporte completo de mutación no lista mutantes ignorados fuera de la
línea de cada excepción; el lint falla con un fixture de número sin nombre en un objeto; una
corrida de la auditoría 014 no encuentra las copias; `test:contract` reporta las siete
operaciones ejercitadas más allá del 401; `npm test` corre en menos tiempo que hoy sin perder
pruebas.

**Acceptance Scenarios**:

1. **Given** un `Stryker disable` de bloque, **When** se corre la mutación completa,
   **Then** cada mutante ignorado está en las líneas de la excepción y su motivo, y ninguno
   más allá.
2. **Given** `maxAge: 600` en un literal de objeto de `src/`, **When** corre el lint,
   **Then** falla hasta que el número tiene nombre.
3. **Given** las tres copias de `instantOf`, las dos de `isShare`/`isCount`, las tres del
   `bucket`/`expire` y las cuatro tolerancias de 5 minutos, **When** se aplica la historia,
   **Then** cada conocimiento existe una vez, con una prueba, y la regla de arquitectura
   permite el lugar compartido que lo aloja.
4. **Given** una clase de claim nueva, **When** se agrega al vocabulario, **Then** el quality
   gate no compila hasta que dice qué evidencia exige; lo mismo un hecho nuevo frente al
   parser de configuración.
5. **Given** el runner de pruebas de contrato, **When** corre, **Then** las tres operaciones
   de plataforma reciben la credencial y se fuzzean más allá de la autenticación.

---

### User Story 4 - El código se lee sin tropezar con prosa vieja, nombres que engañan ni pruebas que prometen de más (Priority: P3)

Quien lee un archivo cualquiera encuentra comentarios que describen lo que hay (no funciones,
features ni modos retirados), cabeceras de prueba que dicen de qué spec es cada requisito,
nombres que dicen lo que cablean, tipos que no aceptan más de lo que reciben y títulos de
prueba que prometen lo que sus aserciones verifican.

**Why this priority**: son 28 hallazgos de severidad baja y seis de media sobre prosa; ninguno
cambia comportamiento, pero cada uno es un tropiezo para la próxima feature y para la
próxima auditoría.

**Independent Test**: la rúbrica de la 014 (`contracts/rubrica.md`) aplicada de nuevo a los
alcances tocados no reproduce ningún F-NNN de esta historia; `check:language`, `format:check`
y `lint` en verde; las pruebas cuyo título se corrigió afirman lo que dicen.

**Acceptance Scenarios**:

1. **Given** las 86 cabeceras de prueba que citan `FR-nnn` sin spec, **When** se aplica la
   historia, **Then** cada cabecera nombra la feature junto al requisito, y una verificación
   ejecutable lo exige para las cabeceras futuras.
2. **Given** los comentarios que citan una feature planificada por su número (código y
   contrato), **When** se aplica la historia, **Then** citan la operación del mapa o el ADR, no
   el número.
3. **Given** la prueba "nothing is recorded twice", **When** se aplica la historia, **Then**
   afirma sobre lo registrado (decisiones de la sesión), no sólo sobre los contadores.

---

### Edge Cases

- Un hallazgo cuya propuesta `after` resulta peor que el `before` al aplicarla (por ejemplo,
  una regla de arquitectura que habría que relajar más de lo que el hallazgo supone): se
  rechaza con motivo en el informe y en `tasks.md`, no se aplica a medias.
- Dos hallazgos cuyas propuestas se contradicen (F-041, que propone que un módulo provea
  servicios, frente al cableado vigente): se resuelve en el plan con una sola forma y el otro
  se cierra como "absorbido por".
- La enmienda de la constitución cambia la versión: todos los Constitution Check de las
  features siguientes evalúan los diez principios (el hueco que dejó pasar F-062 y F-063).
- Un cambio de esta feature reabre un mutante o un clon en otro archivo: la feature no cierra
  hasta que los gates vuelven a verde; no se agregan excepciones nuevas para pasar.
- La renumeración del mapa (esta feature es la 015; el catálogo de mensajes y lo que seguía
  corren un número): el mapa y los comentarios citan operaciones, no números (F-017, F-029).

## Requirements _(mandatory)_

### Functional Requirements

**Trazabilidad y cierre**

- **FR-001**: Cada uno de los 52 hallazgos en alcance MUST terminar en uno de tres estados
  registrados en el informe de la 014 (`docs/auditoria/2026-09-19-informe-auditoria-integral.md`,
  anexo de cierre) y en los JSON de hallazgos: `resolved` con el commit que lo cierra,
  `absorbed-by` con el F-NNN que lo resuelve, o `rejected` con el motivo del dueño.
- **FR-002**: Ningún hallazgo MUST cerrarse sin la prueba que el informe propone o una
  equivalente que falle sin el cambio; las enmiendas de texto se cierran con la lectura
  cruzada documento ↔ código anotada en el informe.
- **FR-003**: Al cierre, la auditoría 014 corrida de nuevo con su método sobre los alcances
  tocados MUST NOT reproducir ningún hallazgo `resolved`; los tres de la 017 y los `rejected`
  son los únicos que puede reproducir.

**Decisiones escritas (US1)**

- **FR-010**: La constitución MUST subir a v1.3.0 con una enmienda fechada y motivada en VII
  que admita el incentivo aplicado como campo no personal de la notificación de orden; el
  ADR-028 MUST citar la enmienda en lugar de 01 §10.3, y la diferencia con 01 §10.3 MUST
  quedar anotada donde el documento del MVP se cita (F-062).
- **FR-010b**: El principio X MUST mantenerse; el mapa del contrato MUST ganar la feature que
  construye el puerto de plataforma de cuatro operaciones, el adaptador genérico y el
  adaptador de prueba (con la prueba de punta a punta evento → decisión → exposición → orden →
  atribución), con consumidor, fuente y estado `planned`; ADR-025 y la guía MUST declarar X
  como deuda hasta esa feature, y todo Constitution Check posterior MUST evaluar los diez
  principios (F-063).
- **FR-011**: `CLAUDE.md`, ADR-013, `profiles/local.ts` y los comentarios de `src/` MUST NOT
  nombrar un modo, un mock ni un ADR reemplazado como vigentes (F-014, F-015, F-008, F-036,
  F-016, F-023).
- **FR-012**: ADR-029 MUST decir que un replay dentro de la ventana es posible por diseño y
  que la idempotencia lo absorbe, con los tres casos (orden, devolución, catálogo) (F-058).
- **FR-013**: ADR-018 o la cabecera del perfil local MUST declarar que los ledgers en memoria
  no podan y que el perfil no es para tráfico (F-047); la promesa de que la ventana de sesión
  es la de deduplicación MUST convertirse en derivación o retirarse (F-034).
- **FR-014**: La política comercial MUST guardar techo, escalones y margen como tasas 0–1,
  con la conversión desde porcentajes enteros en el borde (configuración y DTO), como el
  experimento; el valor del incentivo MUST salir al DTO como el porcentaje entero que el
  comprador ve, con la misma regresión de valores que la 012 (F-031).

**Reglas en su dueño y seguridad (US2)**

- **FR-020**: `Merchant.of` MUST rechazar un conjunto de credenciales u orígenes inválido y el
  conjunto de experimentos de un merchant MUST tener un dueño en el dominio que rechace más de
  uno activo; la configuración MUST limitarse a la forma del JSON y a traducir errores del
  dominio al campo (F-007).
- **FR-021**: Los headers que CORS admite MUST derivarse sólo de los esquemas de seguridad de
  consumidores navegador; cada esquema MUST declarar su consumidor en el cableado (F-051).
- **FR-022**: La comparación de la clave de plataforma MUST ser en tiempo constante con la
  misma primitiva que la firma (F-053).
- **FR-023**: El límite de cuerpo MUST ser por operación o por consumidor, de modo que la
  credencial pública no alcance el límite del catálogo (F-057); el límite del catálogo no
  cambia.
- **FR-024**: `CatalogStore.replace` MUST devolver disponibilidad o indisponibilidad como los
  demás puertos de escritura, y `upsertCatalogSnapshot` MUST declarar la 503 con `Retry-After`
  como cambio compatible (F-044).

**Gates y conocimiento único (US3)**

- **FR-030**: Ninguna excepción de mutación MUST silenciar mutantes fuera de su línea; el
  reporte completo lo prueba (F-052).
- **FR-031**: El lint MUST detectar números sin nombre dentro de literales de objeto en `src/`
  (F-013).
- **FR-032**: `instantOf`, los predicados de tasa y conteo, la ventana acotada por merchant y
  la tolerancia de reloj MUST existir una vez cada uno, con prueba, y la regla de arquitectura
  que impide que un gateway importe a otro MUST exceptuar el lugar compartido (F-021, F-030,
  F-033, F-048); los mensajes de error MUST NOT repetir los números de sus constantes (F-022).
- **FR-033**: El vocabulario de claims MUST ser una unión cerrada que el compilador exija
  agotar, y la lista de hechos del parser MUST fallar en compilación cuando el dominio agrega
  uno (F-038, F-039).
- **FR-034**: La prueba de contrato MUST autenticar a la plataforma y ejercitar sus tres
  operaciones más allá del 401 (F-054).
- **FR-035**: La suite por defecto MUST separar las pruebas que ejecutan herramientas
  (auditoría, calidad, documentación del contrato) en un proyecto propio que CI corre, y las
  pruebas de integración MUST levantar la aplicación una vez por archivo (F-055); el helper de
  eventos MUST usar el instante del reloj fijo por defecto (F-056).

**Legibilidad (US4)**

- **FR-040**: Toda cabecera de prueba que cite `FR-`/`SC-` MUST nombrar la feature, y una
  verificación ejecutable MUST exigirlo (F-020).
- **FR-041**: Ningún comentario de `src/` ni descripción del contrato MUST citar una feature
  planificada por su número (F-017, F-029, `Incentive.yaml`).
- **FR-042**: Los hallazgos de nombres, tipos, comentarios y forma de la historia 4 (F-001,
  F-003, F-004, F-005, F-006, F-009, F-011, F-012, F-018, F-019, F-024, F-025, F-026, F-027,
  F-028, F-032, F-035, F-037, F-040, F-041) MUST aplicarse con su propuesta `after` o
  rechazarse con motivo; F-012 (dividir `build-server.ts`) y F-041 (que un módulo provea
  servicios) se deciden en el plan, con un solo diseño.

**Gates**

- **FR-050**: `format:check`, `quality`, `typecheck`, `test`, `test:mutation`, `test:contract`
  y `release-check` MUST estar en verde al cierre de cada historia; `Lint exceptions: 0`,
  `Language exceptions: 0`; sin excepciones de mutación nuevas.
- **FR-051**: Las respuestas HTTP de las siete operaciones construidas MUST NOT cambiar salvo
  la 503 nueva del catálogo; `contract:diff` MUST reportar el cambio como compatible.

### Key Entities

- **Hallazgo (F-NNN)**: entrada de `docs/auditoria/trabajo/hallazgos/fase-N.json` con
  `file:line`, cita, regla y fuente, severidad, propuesta y prueba; en esta feature gana un
  estado de cierre (`resolved` + commit, `absorbed-by`, `rejected` + motivo).
- **Decisión escrita**: constitución (versionada), ADR (numerado, con estado y fecha), sección
  de `CLAUDE.md`; lo que el código debe cumplir y lo que esta feature enmienda cuando el
  código construido es lo decidido.
- **Anexo de cierre de la auditoría**: sección del informe de la 014 que registra el estado
  de cada hallazgo al cierre de esta feature y el resultado de la re-corrida del método.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: El 100 % de los 52 hallazgos en alcance tiene estado de cierre registrado
  (`resolved`, `absorbed-by` o `rejected` con motivo) en el informe y en los JSON.
- **SC-002**: Una re-corrida de la auditoría 014 con su método sobre los alcances tocados no
  reproduce ningún hallazgo `resolved`; el estado global recalculado por la regla fija es
  `changes-required` o `approved`, o `rejected` sólo por F-043/F-045/F-046.
- **SC-003**: Todos los gates del repositorio en verde al cierre, con cero excepciones de lint,
  idioma o mutación nuevas.
- **SC-004**: Las pruebas de integración y de contrato de las features 004–013 pasan sin cambiar
  aserciones; la única diferencia de contrato es una respuesta nueva compatible.
- **SC-005**: `npm test` por defecto tarda al menos un 40 % menos que la corrida de referencia
  de la auditoría (147 s) sin perder pruebas, y CI sigue corriendo el 100 % de ellas.
- **SC-006**: El reporte completo de mutación no lista ningún mutante ignorado fuera de las
  líneas de una excepción con motivo.

## Assumptions

- Los tres hallazgos de diseño (F-043, F-045, F-046) se dejan a la 017 por decisión del dueño;
  esta feature no los toca ni los "prepara".
- La numeración: esta feature es la 015; el mapa del contrato corre un número las features
  planificadas y, por F-017/F-029, deja de citarlas por número en comentarios y descripciones.
- Las decisiones del dueño (2026-09-19): VII se enmienda para admitir el incentivo aplicado;
  X se mantiene y el puerto de plataforma con sus adaptadores se planifica como feature del
  mapa; la política comercial pasa a tasas 0–1 con conversión en el borde.
- Un hallazgo `rejected` por el dueño no cuenta contra SC-002: la re-corrida puede
  reproducirlo y el informe dice por qué se aceptó así.
- La re-corrida de la auditoría (SC-002) usa `run-gates.mjs` sobre los alcances tocados y la
  rúbrica sobre los archivos cambiados, no las cuatro fases completas.
