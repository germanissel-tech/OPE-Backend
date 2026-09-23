# Research — Plano de decoración (021)

Todo lo de acá se midió sobre `021-plano-de-decoracion` en `73d1746` (que hereda la 020). Cada
decisión cita la evidencia; lo descartado dice por qué.

## R-01 — El compilador puede saber qué operación se audita

**Pregunta**: la regla "se audita si y sólo si el consumidor es `admin` y la capacidad no es de
lectura" vive en el contrato, que es YAML. ¿Puede el compilador aplicarla?

**Medición**: `generated/api.d.ts` **no** lleva `x-required-capabilities` (openapi-typescript no
emite extensiones). El vocabulario por consumidor sí está replicado en
`src/interface-adapters/http/security/capabilities.ts`, pero es por **consumidor**, no por
operación: no alcanza para decidir operación por operación.

**Decisión**: extender `contract:types` con una cuarta salida generada — la lista de operaciones
que el contrato manda auditar — derivada del bundle cruzando `x-required-capabilities` con el
consumidor que fija el tag. Es el mismo mecanismo que ya usa el repositorio tres veces
(`api.d.ts`, `problem-types.{js,d.ts}`, `schemas/*.schema.json`), el mismo script, el mismo
chequeo de drift (`contract:types:check`) y la misma regla de importación.

**Cómo llega al grafo sin romper el anillo**: `generated/` sólo es importable desde
`interface-adapters/http/` e `infrastructure/http/`. La biblioteca del grafo ya recibe los tipos
del contrato por ese camino —`module.ts` y `compose.ts` importan `Handlers` de
`interface-adapters/http/typed.ts`, que reexporta `#generated/api.js`—, así que el tipo nuevo viaja
igual. **Ninguna regla de arquitectura cambia.**

**Por qué generado y no escrito a mano**: una réplica más escrita a mano es lo que esta feature
viene a eliminar. Generado, el contrato manda y el drift lo detecta el gate que ya existe.

**Alternativa descartada**: leer las capacidades del contrato en ejecución (el servidor ya carga el
archivo). Funciona para decorar, pero deja la garantía en ejecución y la spec pide compilación
(FR-007).

## R-02 — Los 29 handlers tienen exactamente un caso de uso

**Pregunta** (la spec la deja abierta como Edge Case): ¿hay handlers sin caso de uso o con más de
uno? `getHealth` y `confirmExposure` eran los sospechosos.

**Medición**: los **29 tienen exactamente uno**. Veintiséis lo construyen con `new` dentro del
handler; tres —`rotateIngestKey`, `rotatePlatformKey`, `rotatePlatformSecret`— lo reciben resuelto
del grafo por `RotateCredentialPort`, porque comparten el mismo caso de uso y cada uno lo audita
bajo su propio nombre. `getHealth` y `confirmExposure` construyen uno cada uno.

**Decisión**: la preocupación del Edge Case **no existe**, y la forma no necesita escotilla. El
caso de uso se declara como una función de lo que el handler pide, que cubre las dos maneras:

```
({ scoped }) => new GetMerchantUseCase({ scoped })     // los 26
({ rotate }) => rotate                                  // las 3 rotaciones
```

**Consecuencia**: se elimina el riesgo que más preocupaba —una escotilla para el caso raro habría
devuelto la elección manual por la ventana—.

## R-03 — Qué demuestra el fixture de tipos, exactamente

**Problema**: si la decoración se deriva del contrato, el autor no puede equivocarse: no hay nada
que olvidar. Entonces, ¿qué falla en compilación (FR-007)?

**Análisis**: lo que la biblioteca **no** puede derivar es si el caso de uso que se le da sirve para
auditar. Una entrada del registro necesita el operador, y lo lee del request
(`AdminRequest { actor: { operatorId } }`). Medido: los diez casos de uso auditados declaran
`actor: Operator` en su request, y los tres de la semilla también.

**Decisión**: el fixture demuestra que **una operación que el contrato manda auditar, servida por un
caso de uso cuyo request no lleva operador, no compila**, y el mensaje nombra la operación. Es el
error real que aparece si alguien cablea una escritura administrativa al caso de uso equivocado, y
es la única forma de "olvidarse" que queda en pie después de derivar la elección.

**Consecuencia para la spec**: US2 se cumple, pero su escenario 1 hay que leerlo así —"declararla
de forma que no quede auditada" es darle un caso de uso que no puede auditarse—. El plan lo hace
explícito; no cambia el criterio de éxito (SC-003) ni el alcance.

## R-04 — Los readers son dato de la operación, no elección

**Medición**: de las diez operaciones auditadas, **cinco declaran readers** —`createMerchant`
(el merchant que creó), `publishMerchantConfiguration` (el motivo y la versión) y las tres
transiciones de experimento (el experimento)— y **cinco no**: `deactivateMerchant`,
`setKillSwitch` y las tres rotaciones.

**Decisión**: siguen declarándose por operación, como dice FR-006, y **son opcionales**. No se
usan como marcador de "esto se audita": el marcador es el contrato. Obligar a las cinco sin readers
a escribir `{}` sería ceremonia que no verifica nada —el compilador ya sabe cuáles se auditan— y
volvería a poner en manos del autor una declaración que puede faltar.

## R-05 — Dónde se clasifica `denied` (FR-012)

**Problema**: `audited-use-case.ts` decide comparando texto (`error.code === "merchant-out-of-scope"`)
un código cuyo dueño es `domain/operator`, y el `shared-kernel` no puede importarlo.

**Decisión**: **lo declara el error**. `MerchantOutOfScope` dice de sí mismo que deniega; el kernel
lee esa declaración y usa `rejected` cuando no hay ninguna. Nadie mapea, nadie compara texto, y el
día que otro error tenga que denegar lo dice en su propia clase.

**Alternativa descartada**: que `admin` clasifique al escribir la entrada. Funciona —`admin` sí
puede ver `operator`, y con `satisfies` quedaría tipado como en `d2e2d83`— pero deja un mapa
código → resultado que hay que mantener, y pone en el gateway una decisión que es del error.

**A verificar en la implementación**: `ope/domain-error-shape` exige `code` y `module` literales y
la unión exportada; hay que confirmar que no rechaza un miembro más. Si lo rechaza, se amplía la
regla con su fixture (es una regla propia del repositorio, `scripts/lint/domain-error-shape.mjs`).

## R-06 — El orden de la verificación previa (FR-009, FR-010)

**Decisión** (ADR-034, enmienda del 2026-09-23): preguntar al registro **antes** de ejecutar. Si no
acepta escrituras, la operación responde `503 store-unavailable` y el caso de uso **no se invoca**.

**Verificado, sin cambio de contrato**: los catorce archivos de paths de administración ya declaran
`503` y `store-unavailable` ya está en `contracts/problem-types.yaml`. FR-014 (cero diff) se cumple
sin hacer nada especial.

**La ventana que queda**: el registro puede caerse entre la verificación y la escritura, es decir
durante la acción. Entonces la acción ocurre y no queda constancia. No se cierra acá y se documenta:
hoy el registro es un almacén en memoria y la ventana es teórica; se vuelve real cuando el almacén
sea durable, que es cuando habrá transacción. El requisito ya está escrito en el hito
`persistence-and-resilience` del roadmap del mapa.

**Alternativa descartada** (ADR-034): escribir el intento primero y completarlo después. Correcta en
principio, pero su escritura en dos fases existe sólo por la transacción que falta, y cuesta un
valor más en `AdminOutcome` —enum cerrado del contrato, `[accepted, rejected, denied]`—, un estado
en `AdminEntry`, una operación de cierre en el puerto y decidir qué muestran de una entrada
pendiente las dos lecturas paginadas.

## R-07 — La semilla del arranque

**Medición**: tres casos de uso se auditan sin loguearse y sin pasar por ningún handler
(`ImportMerchantsUseCase`, `ImportExperimentsUseCase`, `ImportMerchantConfigurationUseCase`). No
tienen `operationId` ni capacidades: no son operaciones del contrato.

**Decisión**: se declaran explícitamente, no se derivan. La derivación es para lo que el contrato
gobierna; la semilla se envuelve donde hoy se envuelve, en el enlace de su puerto, con el nombre de
la acción del sistema. FR-016 se cumple sin mecanismo nuevo.

**Por qué no forzar una regla única**: inventar un consumidor o una capacidad falsos para que la
semilla entre por el mismo camino sería mentirle al contrato para satisfacer una simetría.

## R-08 — El nombre del log sigue siendo el del caso de uso

**Medición**: en dos operaciones el nombre del log no es el `operationId` —`ingestEvents` se
registra como `ingestBatch` y `getHealth` como `getServiceHealth`— y hoy se pasan explícitos, con
su comentario. `tests/integration/use-case-log.test.ts` afirma `useCase: "ingestBatch"`.

**Decisión**: el nombre del log lo da el **caso de uso**, no la operación. Derivarlo del
`operationId` rompería esas dos y cambiaría comportamiento observable, que FR-015 prohíbe. La
opción a resolver en el diseño es de dónde lo toma la biblioteca: del nombre de la clase
(`useCase.constructor.name`, que el minificador puede cambiar y este repositorio no minifica pero
tampoco depende de nombres en ejecución) o de una declaración explícita por operación. **Se prefiere
la declaración explícita**: es un dato, no una convención frágil, y hoy ya se escribe en las dos que
difieren.

**A decidir en el diseño**: si el nombre se declara siempre o sólo cuando difiere del
`operationId`. Declararlo siempre son 29 strings; sólo cuando difiere son 2 y una regla implícita.
El plan elige declararlo siempre que se construya el caso de uso, porque es el nombre que el log
imprime y esconder 27 de 29 detrás de un default hace que el lector tenga que saber la convención.

## R-09 — `UseCaseDecorators` desaparece del composition root

**Medición**: el tipo del que dependen 29 handlers se declara en
`src/composition/modules/shared-kernel.ts`, es decir en `composition/`, y es una bolsa de tres
funciones genéricas de orden superior.

**Decisión**: desaparece. Lo que hoy expone (`logged`, `audited`, `administered`) deja de ser un
componente que alguien pide: la biblioteca del grafo aplica los decoradores al construir lo que el
módulo sirve, y toma el reloj, el logger y el registro por los puertos que ya existen
(`ClockPort`, `LoggerPort`, `AuditTrailPort`). `DecoratorsPort` se retira.

**Consecuencia**: FR-017 (la abreviatura `deco`) queda sin objeto — el campo no existe más—, y la
historia 5 de la descripción original no llega a la spec. Es el resultado buscado.

**A verificar**: `check:ports-bound` exige que toda interfaz de `application/*/ports/` esté
enlazada. `UseCaseDecorators` no vive ahí (vive en composición), así que retirarlo no lo afecta;
`AuditTrail` sí vive ahí y sigue enlazado.

## R-10 — Qué prueba que no cambió nada

**Decisión**: el juez de FR-015 es la suite existente, sin tocar una aserción:

- `tests/integration/use-case-log.test.ts` — el nombre, la duración y el resultado del log.
- Las pruebas del registro de administración — actor, operación, merchant, resultado y motivo de
  cada entrada, incluidas las `denied` y las `rejected`.
- `tests/unit/application/shared-kernel/audited-use-case.test.ts` — que importa el
  `MerchantOutOfScope` real, así que cubre R-05 de punta a punta.
- `contract:diff` — cero.

Las únicas aserciones nuevas son las de US2 (el fixture de tipos) y US3 (el `503` con el registro
caído, por cada clase de acción: crear, rotar, cambiar estado).
