# Feature Specification: Plano de decoración — la preocupación transversal deja de elegirse a mano

**Feature Branch**: `021-plano-de-decoracion`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Challengear `UseCaseDecorators` después de la 020. La elección entre log y auditoría es una función del contrato tomada a mano 29 veces, y ninguna regla la verifica: escribir `logged` donde correspondía `administered` deja una operación sin auditar en silencio. Que la derive el contrato, que no compile olvidarse, y que una acción administrativa que no se pudo auditar no se haga." (Decisión del dueño, 2026-09-23, tras la revisión posterior a la 020.)

## Contexto

La 020 dejó el cableado como un grafo que el compilador verifica: ningún puerto sin enlace, ninguna
operación del contrato sin handler, ninguna implementación fuera de un enlace. Una sola preocupación
quedó afuera de esa red, y es la que este trabajo cierra.

Medido en `020-grafo-de-composicion` (`5979c29`):

- **Los 29 handlers envuelven su caso de uso a mano**: 19 con `deco.logged(operation, …)` y 10 con
  `deco.administered(operation, …, readers?)`. Hay además 3 usos de `deco.audited(…)` para la
  semilla del arranque. Nadie se equivocó todavía; nadie está decidiendo tampoco.
- **La elección es una función del contrato.** Cruzada contra las capacidades declaradas coincide
  **29 de 29**: se audita si y sólo si el consumidor es `admin` y la capacidad **no** es de lectura.
  Las 10 `administered` son exactamente las de `merchants:write`, `credentials:rotate`,
  `configuration:write` y `experiments:write`; las 10 operaciones `admin` de lectura y las 9 del
  SDK, la plataforma y lo público van a `logged`.
- **Ninguna regla la verifica.** `CLAUDE.md` afirma "Toda operación `admin` se envuelve en
  `AuditedUseCase`" y no existe gate en `scripts/` ni en `tests/architecture/`. Escribir
  `deco.logged` en una escritura administrativa compila, pasa los siete gates de calidad y pasa las
  1281 pruebas, y esa operación deja de auditarse **en silencio**. Para un registro que es
  requisito (01 §14.2, ADR-031) es el peor modo de falla posible.
- **El decorador ocupa lugar en todos lados.** `deco` consume uno de los seis cupos de dependencias
  en los 29 handlers y es el nombre más repetido de `modules/`.
- **El tipo está en el anillo equivocado.** `UseCaseDecorators` —del que dependen esos 29
  handlers— se declara en `src/composition/modules/shared-kernel.ts`, es decir en el composition
  root, y es una bolsa de tres funciones genéricas de orden superior, no un puerto. Que no haya
  podido vivir en el anillo de aplicación es la señal de que está mal categorizado.
- **El kernel clasifica comparando texto.** `audited-use-case.ts` decide `denied` con
  `error.code === "merchant-out-of-scope"`, un código cuyo dueño es el módulo `operator`. El
  `shared-kernel` **no puede** tiparlo: el mapa de contextos le prohíbe importar `domain/operator`.
  Esa imposibilidad es el argumento de que la clasificación no va ahí. (Los otros quince literales
  de la misma familia quedaron bajo el compilador en `d2e2d83`; éste es el único que no se podía
  arreglar con un tipo.)
- **Una acción sin auditar se completa igual.** `AuditTrail.record` devuelve
  `Result<undefined, StoreUnavailable>` y el decorador **descarta** ese resultado: si el registro
  no se puede escribir, el operador rota una credencial y no queda constancia.

### Decisiones tomadas en la evaluación (2026-09-22 y 2026-09-23, dueño)

1. **La auditoría no se muda al borde HTTP.** Evaluada contra la alternativa de derivarla del
   contrato: el borde tiene nativos el actor y la operación, pero le faltan los dos hechos de
   aplicación —el código de dominio y lo que la acción produjo— y recuperarlos obliga a **invertir
   la traducción `toProblem`** (leer `urn:ope:problem:<slug>` de vuelta a un código) y a derivar un
   registro durable del DTO. El repositorio tiene una sola dirección de traducción declarada.
2. **La elección la deriva el contrato**, porque ya es una función de él.
3. **Que no compile olvidarse**, con fixture de tipos. Se evaluó y se descartó un gate `check:*`
   equivalente: la garantía estructural es más fuerte que un script, y el script se borraría en el
   mismo ciclo en que se escribe.
4. **Una acción administrativa que no se pudo auditar no se hace** (ADR-034, enmienda del
   2026-09-23). El problema que esa decisión obliga a resolver es el **orden**, no el código de
   error: hoy se audita después de ejecutar, así que fallar ahí le diría al operador que no pasó
   algo que sí pasó. En una rotación es peor que no fallar, porque la credencial nueva ya se acuñó
   y su valor viajaba en la respuesta descartada. Fallar significa **fallar antes de actuar**.
   Se adopta la verificación previa; el cierre completo de la ventana queda escrito como requisito
   del hito `persistence-and-resilience` del roadmap, donde habrá transacción.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Quien cablea un módulo ya no elige la preocupación transversal (Priority: P1)

Quien agrega o toca una operación declara **qué caso de uso la resuelve** y **qué controller la
traduce**, y nada más. Si la operación es una escritura administrativa, queda auditada; si no, queda
registrada en el log operacional. No hay decisión que tomar ni nombre que repetir.

**Why this priority**: es la historia que elimina la clase entera de error. Sin ella, las demás
protegen un mecanismo que sigue dependiendo de que alguien se acuerde.

**Independent Test**: se convierten los 29 handlers y se corre la suite completa; los logs, las
entradas del registro de administración y los códigos de error tienen que salir idénticos, sin
cambiar una sola aserción de comportamiento.

**Acceptance Scenarios**:

1. **Given** una operación de lectura de cualquier consumidor, **When** se declara su handler,
   **Then** su caso de uso queda registrado en el log operacional con el nombre del caso de uso, su
   duración y su resultado, sin que el handler lo pida.
2. **Given** una operación administrativa de escritura, **When** se declara su handler, **Then**
   queda auditada bajo su `operationId` y además registrada en el log, sin que el handler lo elija.
3. **Given** un handler cualquiera, **When** se leen sus dependencias, **Then** no figura el
   decorador entre ellas.
4. **Given** una operación cuyo nombre de log difiere del `operationId` (`ingestEvents` se registra
   como `ingestBatch`, `getHealth` como `getServiceHealth`), **When** se ejecuta, **Then** el log
   conserva el nombre del **caso de uso**, como hoy.

---

### User Story 2 - Olvidarse de auditar no compila (Priority: P1)

Quien declara una operación administrativa de escritura no puede dejarla sin auditar: el compilador
la nombra y el build se detiene antes de cualquier prueba.

**Why this priority**: es la garantía que hoy no existe y la razón de ser de la feature. Va junto a
la 1 porque es su criterio de aceptación, no un extra.

**Independent Test**: un fixture de tipos en `tests/typecheck/fixtures/` que declara una operación
administrativa de escritura sin auditoría y falla la compilación nombrándola, al lado de los
fixtures que la 020 dejó (`graph-missing-provider.ts`, `graph-operation-unwired.ts`).

**Acceptance Scenarios**:

1. **Given** una operación con consumidor `admin` y una capacidad que no es de lectura, **When**
   se declara de forma que no quede auditada, **Then** no compila y el mensaje nombra la operación.
2. **Given** el conjunto actual de 29 operaciones, **When** se compila el repositorio, **Then**
   compila sin excepciones ni supresiones.
3. **Given** una operación administrativa **de lectura**, **When** se declara sin auditoría,
   **Then** compila: auditar una lectura no es obligatorio.

---

### User Story 3 - Una acción que no se pudo auditar no ocurre (Priority: P1)

Un operador que intenta una acción administrativa mientras el registro no acepta escrituras recibe
un rechazo explícito, y el sistema queda **como estaba**: no se crea el merchant, no se rota la
credencial, no se activa el experimento.

**Why this priority**: es una decisión de producto ya tomada y afecta la integridad del registro,
que es un requisito. Comparte prioridad con las anteriores porque se implementa en el mismo lugar.

**Independent Test**: prueba de integración con un registro que rechaza escrituras; la operación
responde `503` y el estado del sistema no cambió.

**Acceptance Scenarios**:

1. **Given** un registro de administración que no acepta escrituras, **When** un operador crea un
   merchant, **Then** la respuesta es `503 store-unavailable` **y el merchant no existe**.
2. **Given** el mismo registro caído, **When** un operador rota una credencial, **Then** la
   respuesta es `503` y la credencial anterior sigue siendo la vigente: no se acuñó ninguna.
3. **Given** un registro de administración disponible, **When** un operador hace cualquier acción,
   **Then** el comportamiento es exactamente el de hoy: mismos códigos, mismas entradas.
4. **Given** una operación **no** administrativa (ingesta, catálogo, órdenes), **When** el registro
   de administración no acepta escrituras, **Then** no se ve afectada.

---

### User Story 4 - El resultado de una acción lo clasifica quien conoce el vocabulario (Priority: P2)

El registro sigue distinguiendo una acción **rechazada** por una regla de negocio de una **denegada**
por alcance, pero esa distinción deja de depender de que dos módulos que no pueden verse escriban el
mismo texto.

**Why this priority**: no cambia comportamiento observable y es un arreglo de diseño; entra después
de que el mecanismo esté en su lugar.

**Independent Test**: las pruebas actuales del registro pasan sin cambios, y no queda en el
`shared-kernel` ninguna comparación de un código de error contra un literal.

**Acceptance Scenarios**:

1. **Given** una acción rechazada porque el merchant está fuera del alcance del operador, **When**
   se escribe la entrada, **Then** su resultado es `denied`, como hoy.
2. **Given** una acción rechazada por cualquier otra regla, **When** se escribe la entrada,
   **Then** su resultado es `rejected` con su código, como hoy.
3. **Given** el código fuente del `shared-kernel`, **When** se lo inspecciona, **Then** no compara
   ningún código de error contra un texto escrito a mano.

---

### Edge Cases

- **Un handler que no tiene caso de uso, o que tiene más de uno.** `getHealth` y `confirmExposure`
  son los primeros a mirar. La forma elegida tiene que admitirlos sin una escotilla que devuelva la
  elección manual por la ventana.
- **La semilla del arranque.** `ImportMerchantsUseCase`, `ImportExperimentsUseCase` e
  `ImportMerchantConfigurationUseCase` se auditan (operador `system`) pero **no** se loguean, y no
  pasan por ningún handler: no hay `operationId` ni capacidades de donde derivar nada. Tienen que
  seguir comportándose igual, incluido el no emitir log de caso de uso al arrancar.
- **Una operación administrativa de escritura que no puede nombrar su merchant hasta después**
  (la creación): el dato del que se saca sigue siendo propio de esa operación.
- **El registro de administración que se cae _durante_ la acción**, después de la verificación
  previa: la acción ocurre y no queda constancia. Es la ventana que esta feature **no** cierra, y
  tiene que quedar documentada como tal.
- **Una operación nueva del contrato con una capacidad que no existe hoy**: la derivación no puede
  romperse ni elegir en silencio; el vocabulario de capacidades es cerrado por consumidor.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: La declaración de una operación servida MUST separar el caso de uso que la resuelve
  del controller que la traduce, de modo que la plataforma pueda envolver el primero.
- **FR-002**: El sistema MUST derivar del contrato si una operación se audita: se audita si y sólo
  si su consumidor es el de administración y alguna de sus capacidades declaradas no es de lectura.
- **FR-003**: Quien declara una operación MUST NOT poder elegir entre registrar y auditar.
- **FR-004**: El `operationId` MUST viajar una sola vez, desde la clave con que la operación se
  declara.
- **FR-005**: El log operacional MUST seguir llevando el nombre del **caso de uso**, que en dos
  operaciones no coincide con el `operationId`.
- **FR-006**: Los datos que la entrada de auditoría toma del request o de la respuesta (lo que la
  acción produjo, el motivo declarado, el merchant creado) MUST seguir declarándose por operación.
- **FR-007**: Una operación administrativa de escritura declarada sin auditoría MUST fallar la
  compilación, y el mensaje MUST nombrarla.
- **FR-008**: El repositorio MUST incluir un fixture de tipos que demuestre FR-007.
- **FR-009**: Antes de ejecutar una acción administrativa, el sistema MUST verificar que el registro
  de administración acepta escrituras.
- **FR-010**: Si esa verificación falla, la acción MUST NOT ejecutarse y la operación MUST responder
  `503` con el tipo de problema de almacén no disponible.
- **FR-011**: La ventana que queda abierta —el registro que se cae durante la acción— MUST quedar
  documentada, junto con el requisito de cerrarla cuando exista transacción.
- **FR-012**: La clasificación del resultado de una acción administrativa MUST dejar de depender de
  que el kernel compare un código de error contra un literal.
- **FR-013**: El vocabulario de resultados del registro (`accepted`, `rejected`, `denied`) MUST
  quedar igual: no se agrega ni se quita ninguno.
- **FR-014**: El contrato MUST quedar sin cambios: cero diff.
- **FR-015**: Los logs, las entradas del registro de administración y los códigos de error de las 29
  operaciones actuales MUST quedar idénticos.
- **FR-016**: La semilla del arranque MUST seguir auditándose sin emitir log de caso de uso.
- **FR-017**: Si tras FR-003 sobrevive en el código alguna referencia abreviada al decorador, MUST
  escribirse completa: no hay abreviaturas en `src/`.

### Key Entities

- **Operación servida**: lo que el contrato declara y el servidor rutea. Lleva un consumidor, un
  conjunto de capacidades y un `operationId`; de los dos primeros sale qué preocupación transversal
  le corresponde.
- **Caso de uso**: lo que resuelve la operación. Es lo que se envuelve; no sabe que lo envuelven.
- **Controller**: lo que traduce la operación a DTO y de vuelta. Recibe el caso de uso ya envuelto.
- **Entrada del registro de administración**: quién hizo qué, sobre qué merchant, con qué resultado
  (`accepted`, `rejected`, `denied`) y su motivo. Se escribe pase o falle la acción.
- **Registro de administración**: dónde se escriben esas entradas. Puede no aceptar escrituras, y
  eso ahora impide la acción en vez de pasar inadvertido.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Cero decisiones manuales entre registrar y auditar en todo el repositorio.
- **SC-002**: Cero apariciones del decorador en las dependencias de los handlers.
- **SC-003**: Una operación administrativa de escritura sin auditar **no compila**, demostrado por
  un fixture que se corre en cada build.
- **SC-004**: Una acción administrativa intentada con el registro caído responde con un rechazo
  explícito y deja el sistema exactamente como estaba, demostrado por una prueba de integración por
  cada clase de acción (crear, rotar, cambiar estado).
- **SC-005**: Cero comparaciones de un código de error contra un literal escrito a mano en el
  `shared-kernel`.
- **SC-006**: Cero diff del contrato.
- **SC-007**: La suite completa pasa sin modificar ninguna aserción de comportamiento preexistente;
  las únicas aserciones nuevas son las de SC-003 y SC-004.
- **SC-008**: Agregar una operación administrativa de escritura nueva no requiere recordar nada:
  olvidarse detiene el build.

## Assumptions

- La feature sale de `020-grafo-de-composicion` y no de `main`: depende de la forma de declaración
  de operaciones que introdujo la 020, que tiene 23 commits sin mergear. Si el dueño mergea la 020
  antes de empezar, sale de `main`.
- El vocabulario de capacidades sigue siendo cerrado por consumidor y sigue estando replicado en el
  código con su prueba contra el mapa del contrato; la derivación de FR-002 se apoya en esa réplica
  y no introduce una segunda.
- Los catorce caminos de administración ya declaran el rechazo por almacén no disponible y el tipo
  de problema ya existe en el catálogo, así que FR-010 no toca el contrato. **Verificado.**
- El registro de administración vive en memoria hasta la feature de persistencia, así que la ventana
  de FR-011 es hoy teórica: se vuelve real cuando el almacén sea durable, que es cuando habrá
  transacción para cerrarla.
- Las tres operaciones de la semilla no tienen consumidor ni capacidades porque no son operaciones
  del contrato; su tratamiento se declara explícitamente y no se deriva.
- Mover la auditoría al borde HTTP, la escritura en dos fases del registro, el registro de seguridad
  de los intentos no autenticados, los encabezados de archivo y la densidad de comentarios quedan
  **fuera de alcance**, cada uno con su motivo registrado.
