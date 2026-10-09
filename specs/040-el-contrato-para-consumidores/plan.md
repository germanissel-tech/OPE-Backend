# Implementation Plan: El contrato para consumidores, y el operador con identidad

**Branch**: `040-el-contrato-para-consumidores` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/040-el-contrato-para-consumidores/spec.md`

## Summary

El backend le da a un consumidor del contrato lo que hoy ese consumidor se fabrica solo o no tiene:
una carpeta de artefactos (`generated/contract/`) que OPE-Web copia tal cual, una operación que dice
quién es el operador autenticado (con nombre para mostrar, si lo tiene), el identificador de cada
pedido en toda respuesta y en todo Problem Details, y el campo que un rechazo de invariante señala,
bajo `/body`, donde el contrato ya decía que iba.

**Lo que la investigación cambió** ([`research.md`](research.md)): el borde **ya** publica punteros
de errores de dominio, pero sin `/body` y contra lo que el esquema dice; se corrige en un solo lugar
(R-01). `displayName` **pasaría el lint hoy**, porque la lista de datos personales no lo tiene: la
lista lo gana, y con él la excepción acotada que lo admite sólo en el esquema del operador (R-05).
Y el identificador de pedido existe; falta exponerlo y **no adoptar** el que venga en el pedido
(R-03).

**Lo que toca `src/`** es chico y de tres clases: transporte (dos hooks y una opción de Fastify),
una operación nueva con su caso de uso trivial, y un campo más en el agregado `Operator` con su
parser. Lo demás es contrato, generador y documentos.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) en `src/` y pruebas; JavaScript con
`checkJs` en `scripts/` y `contracts/rules/functions/` (ADR-011, ADR-017). YAML para el contrato.

**Primary Dependencies**: Fastify (el identificador de pedido es el suyo), openapi-backend,
Spectral (tres reglas tocadas), `yaml` en el emisor. Ninguna dependencia nueva.

**Storage**: N/A. `displayName` vive en la configuración de operadores (archivo o variable de
entorno), no en el almacén; el registro de administración no cambia.

**Testing**: pruebas de contrato (`tests/contract-rules/` con fixtures por regla), de integración
sobre el servidor en memoria (`tests/integration/`: `getOperator`, `X-Request-Id`, `requestId`, los
dos `422` con puntero), de unidad del dominio (`Operator.of` con nombre) y de gobernanza
(`tests/governance/consumer-artifacts.test.ts`, como `audited-operations.test.ts`). El gate de
mutación juzga lo nuevo de `src/` (ADR-016).

**Target Platform**: el mismo servidor; `ubuntu-latest` en CI, Windows en desarrollo.

**Project Type**: backend de un servicio; la feature es de su borde HTTP y de su cadena de contrato.

**Performance Goals**: ninguno nuevo; dos hooks de transporte por pedido, sin I/O.

**Constraints**: el contrato cambia de forma compatible (`1.12.0`); nada de política en el código
(el largo máximo del nombre es una constante nombrada del dominio, como `MAX_TOKENS`, no un valor de
comportamiento); los generados son deterministas (sin commit adentro, R-06); Tandilia no se toca.

**Scale/Scope**: una operación nueva, un campo nuevo, un emisor nuevo con ocho archivos, tres reglas
de Spectral enmendadas con cuatro fixtures, cuatro invariantes que ganan `pointer`, una enmienda a la
constitución, un ADR nuevo y una nota en otro.

## Constitution Check

**Constitución v1.4.5**, y esta feature la lleva a **v1.5.0** (R-08). Los once principios, evaluados;
los que no aplican se marcan como tales y se dice por qué.

| Principio                                        | Aplica                | Cómo se cumple / por qué no aplica                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**                 | No                    | No hay autoridad de decisión nueva ni cambia ninguna.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **II. Fail-closed: `NO_OP` por defecto**         | No                    | No hay decisión ni salida al SDK.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **III. La medición precede y no se contamina**   | No                    | Nada de esto toca la medición.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **IV. Dos caminos, dos garantías**               | No                    | No hay camino de decisión ni de medición.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **V. Aislamiento por merchant**                  | Sí                    | `getOperator` no nombra merchant y devuelve el alcance del operador, no datos de ninguno; el aislamiento existente se re-ejecuta entero (`npm test`, durabilidad). No hay persistencia nueva.                                                                                                                                                                                                                                                                                                                                                      |
| **VI. Identidad e idempotencia explícitas**      | Sí                    | El identificador de pedido es explícito en toda respuesta y es **del servidor** (FR-003). `getOperator` es una lectura sin idempotencia que declarar.                                                                                                                                                                                                                                                                                                                                                                                              |
| **VII. OPE observa comportamiento, no personas** | **Sí, y se enmienda** | El principio se acota a las personas observadas —visitante y comprador— y declara al operador como persona identificada, autenticada y auditada, cuyo nombre para mostrar se registra en su configuración y se sirve **sólo** a él. Lo que no cambia: la lista blanca de eventos, el conector de órdenes, la frase autorizada. La herramienta lo acompaña: `displayName` entra a la lista prohibida y la excepción es una, con nombre y razón, para el esquema del operador bajo `admin` (R-05). Versión 1.5.0 (MINOR), con su Sync Impact Report. |
| **VIII. Cero modelos de lenguaje en runtime**    | Sí (trivialmente)     | Ninguna llamada nueva.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **IX. Nada entra al reporte sin trazabilidad**   | Sí                    | El identificador de pedido es trazabilidad: lo que un operador cita es lo que el registro tiene.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **X. Puertos en los dos bordes**                 | No                    | No hay borde de integración nuevo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **XI. Ninguna política vive en el código**       | Sí                    | No se agrega ningún valor de comportamiento. El largo máximo de `displayName` es una restricción de forma del agregado (nivel 0, constante nombrada), no una política; `check:behaviour-constants` lo verifica.                                                                                                                                                                                                                                                                                                                                    |

**Gates explícitos del Constitution Check** (constitución, Flujo de desarrollo, punto 2):

- **¿Toca una superficie HTTP?** **Sí.** El cambio está diseñado en
  [`contracts/consumer-artifacts.md`](contracts/consumer-artifacts.md) antes de cualquier tarea de
  código, y es **compatible**: `requestId` y `displayName` opcionales, `getOperator` nueva,
  `errors[]` donde no había, `pointer` como extensión. Versión `1.12.0`, `contract:diff` lo clasifica
  menor. Dispara el orden de seis pasos de `.claude/rules/contrato.md`, que es el del tramo 1 y 2.
- **¿Toca persistencia o API?** API sí, persistencia no. Las pruebas de aislamiento existentes corren
  en el build; `getOperator` no tiene merchant que aislar, y se prueba que no revela nada de ninguno.
- **¿Toca el plano de decisión?** No. Los hooks nuevos son de transporte y no hacen I/O.
- **¿Toca el ledger o la cadena de evidencia?** No.
- **¿Campo nuevo de evento u orden?** No. `displayName` es del operador, bajo `admin`, y es
  precisamente lo que la enmienda a VII admite y el lint acota.
- **¿Llamada a un modelo de lenguaje en runtime?** No.
- **¿Regla de negocio que el esquema no expresa?** No hay invariante nuevo; los existentes ganan
  `pointer` y sus pruebas lo afirman (R-02; ADR-007 se conserva entero).
- **¿Sustantivo nuevo en el contrato?** No: `operator` ya tiene su nota (`docs/dominio/operador.md`),
  que gana el nombre para mostrar.
- **¿Toca `src/`?** Sí: `infrastructure/http` (transporte), `interface-adapters/http` (`toProblem`,
  `send`), `interface-adapters/operator` o `merchant` (controller y presentador de `getOperator`),
  `application/operator` (caso de uso trivial), `domain/operator` (el campo) y `domain/merchant`
  (dos errores ganan `pointer`), `composition` (cableado y parser). Dirección de dependencias
  intacta; `npm run arch` lo verifica.

**Resultado: pasa, con una enmienda a la constitución que es el objeto de FR-008** y que el dueño
ratifica al acordar este plan. Sin complejidad que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/040-el-contrato-para-consumidores/
├── spec.md                      # Fase previa
├── plan.md                      # Este archivo
├── research.md                  # Fase 0: ocho hallazgos
├── data-model.md                # Fase 1: el operador, el problema, el invariante, los artefactos
├── contracts/
│   └── consumer-artifacts.md    # Fase 1: el cambio de contrato y lo que el servidor emite
├── quickstart.md                # Fase 1: cómo se verifica de punta a punta
└── tasks.md                     # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

Lo que la feature toca, y nada más:

```text
contracts/
├── openapi.yaml                           info.version 1.12.0; /v1/admin/operator
├── api-map.yaml                           getOperator: planned (admin-panel) → built (feature "040")
├── paths/admin-operator.yaml              NUEVO
├── components/schemas/Operator.yaml       NUEVO
├── components/schemas/ProblemDetails.yaml requestId
├── components/schemas/{MerchantCreate,CredentialRotation,*Input}.yaml   x-invariants[].pointer
├── components/responses/{Rotation,Merchant}Unprocessable.yaml          ejemplos con /body
├── .spectral.yaml                         ope-no-pii allow; (las funciones leen las extensiones)
├── rules/pii-denylist.json                + displayName
├── rules/functions/{noPii,requiredCapabilities,invariants}.js
└── README.md                              filas de x-identifies-principal y pointer
tests/contract-rules/fixtures/             4 fixtures nuevas; valid-capabilities con la marca
scripts/
├── contract-consumer-artifacts-lib.mjs    NUEVO · generated/contract/
├── contract-types.mjs · contract-types-check.mjs   lo incluyen
├── check-invariant-tests.mjs              pointer ⇒ la prueba nombra /body/...
└── README.md                              las filas
generated/
├── contract/                              NUEVO · ocho archivos, versionados
└── README.md                              la fila
src/
├── infrastructure/http/build-server.ts    X-Request-Id en toda respuesta; requestIdHeader: false
├── infrastructure/http/http-response.ts   requestId en todo Problem Details
├── interface-adapters/http/to-problem.ts  /body + puntero
├── domain/operator/operator.ts            displayName, con su regla
├── domain/merchant/errors.ts              OriginAlreadyRegistered e InvalidOrigin nombran origins[N]; RotationGraceTooLong nombra graceSeconds
├── application/operator/use-cases/get-operator.use-case.ts   NUEVO · trivial
├── interface-adapters/operator/{controllers/get-operator.ts,presenters.ts}   NUEVO
├── composition/modules/<el que sirve admin>.ts   served(getOperator)
└── composition/operators-config.ts        displayName
config/schemas/operators.schema.json · config/dev-operators.json
tests/
├── integration/operator.test.ts           NUEVO · getOperator, X-Request-Id, requestId, no adopción
├── integration/admin-merchants.test.ts    los punteros
├── unit/domain/operator/…                 displayName
└── governance/consumer-artifacts.test.ts  NUEVO
docs/
├── adr/044-el-contrato-para-consumidores.md   NUEVO
├── adr/031-…                              nota de enmienda fechada
└── dominio/operador.md                    el nombre
.specify/memory/constitution.md            1.5.0
```

**Decisión de estructura**: el emisor de artefactos es una librería más de `scripts/` que
`contract:types` orquesta, como las cuatro que ya existen; `generated/contract/` es una subcarpeta de
`generated/` para heredar su política (versionado, `linguist-generated`, drift, inventario). La
operación nueva sigue el orden de `contrato.md` y vive en el módulo que hoy sirve `admin` y resuelve
el token; si eso es `merchant`, va ahí sin abrir un módulo por una operación.

## Phase 1 — Diseño

### Los cuatro tramos

|                        | qué                                                                                                                                                                                                                                      | punto de control                                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 · El contrato**    | `getOperator` en el mapa (`planned` → `built`), su path y esquema; `requestId`; `pointer` en cuatro invariantes y los ejemplos con `/body`; las tres reglas con sus fixtures; `1.12.0`; `check-invariant-tests` con el puntero           | `npm run contract:check` en verde; cada fixture nueva falla su regla; `contract:types` regenera `api.d.ts` con `getOperator` y `requestId`                                                |
| **2 · El servidor**    | `X-Request-Id`, `requestId`, `requestIdHeader: false`; `/body` en `toProblem` y los dos errores con puntero; `Operator.displayName` con parser y esquema; `GetOperatorUseCase`, controller, presentador y cableado; `dev-operators.json` | Las pruebas de integración nuevas y las de invariantes con puntero en verde; `npm test`, `test:contract`, mutación sin sobrevivientes en lo nuevo; contra `npm run dev`, el quickstart §2 |
| **3 · Los artefactos** | `contract-consumer-artifacts-lib.mjs`, `contract:types` y el drift; `generated/contract/` versionada; la prueba de gobernanza; los inventarios                                                                                           | `contract:types:check` en verde y **en rojo** con una capacidad tocada; en OPE-Web, `contract:sync` copia y `ope-check` pasa (con la línea de `conformity` de R-04)                       |
| **4 · Los documentos** | Constitución 1.5.0 con su Sync Impact Report; ADR-044; la nota en ADR-031; `operador.md`; `contracts/README.md`; `CLAUDE.md` si alguna tabla lo nombra; quickstart con lo corrido                                                        | `release-check` en verde; `check:adrs`, `check:identifiers`, `check:instructions`                                                                                                         |

**El 1 va primero** porque es el orden de `contrato.md` y porque el 2 compila contra sus tipos. **El 3
después del 2** para que lo emitido ya traiga `getOperator` y `requestId`. **El 4 al final**: los
documentos describen lo que quedó; la enmienda a la constitución se escribe cuando el lint y el
código ya hacen lo que ella dice.

### El identificador de pedido (R-03)

Dos hooks en `build-server.ts`, al lado de `retryAfterOn503`: uno que fija `x-request-id` al recibir
el pedido (antes de todo handler, para que un error del framework también lo lleve), y
`requestIdHeader: false` en las opciones de Fastify. `send()` en `http-response.ts` agrega
`requestId` al cuerpo cuando el `content-type` es el de problema. Lo prueba la integración: toda
respuesta trae el encabezado, un problema trae el miembro igual, un `X-Request-Id` pegado no se
adopta, y el valor es el `reqId` del registro (la prueba captura el logger).

### El operador con nombre (R-05)

`OperatorRecord.displayName?`; `Operator.of` lo valida con una constante `MAX_DISPLAY_NAME` del
dominio y un error `InvalidOperatorDisplayName` (código nuevo en el catálogo si sale al contrato; si
sólo lo ve la configuración al arrancar, es un `ConfigError` como los demás del parser). El parser de
`operators-config.ts` lo lee; el esquema JSON lo admite; `AdminTokenResolver` no cambia.
`GetOperatorUseCase.execute({ actor })` devuelve `actor`; `operatorDto` presenta `operatorId`,
`displayName` si lo hay, y `scope` tal cual. El registro de administración no lo toca.

### Los punteros (R-01, R-02)

`toProblem`: `pointer: "/body" + jsonPointerOf(details.pointer)`. `OriginAlreadyRegistered(index)` y
`InvalidOrigin(index)` ponen `pointer: \`origins[${index}]\``; `RotationGraceTooLong`pone`pointer: "graceSeconds"`. Los errores que ya tenían puntero (configuración, textos, kernel) salen con
`/body`sin tocarlos.`ope-invariants`acepta`pointer`sólo en esquemas;`check-invariant-tests`exige que la prueba de un invariante con`pointer`contenga`/body/<primer segmento>`. Las pruebas
`[invariant:origin-already-registered]`y`[invariant:rotation-grace-too-long]`afirman`errors[]`.

### Los artefactos (R-06)

`contract-consumer-artifacts-lib.mjs` exporta `generateConsumerArtifacts(): [file, content][]` y
las rutas; `contract-types.mjs` las escribe y `contract-types-check.mjs` las compara. Las copias
(`openapi.yaml`, `api.d.ts`, `problem-types.d.ts`) se producen a partir de lo que los otros emisores
devuelven, no leyendo `generated/` del disco, para que el check sea del contenido y no del orden de
escritura. La prueba de gobernanza afirma sobre el bundle real: identidad igual al `sha256` del
bundle; toda operación `admin` en `OPERATIONS` y ninguna de más; `CAPABILITIES` igual a la unión
ordenada; `getOperator` con `[]`; todo esquema de cuerpo `admin` en `CONSTRAINTS` con su `required`;
`MerchantCreate.fields.origins.items.maxLength === 255`; determinismo (dos corridas, mismo texto).

### Lo que se enmienda y se escribe (R-08)

La constitución a **1.5.0**, con el Sync Impact Report al tope: qué cambia en VII, por qué es MINOR,
que la fuente del MVP no cambia de decisión (01 habla de datos del visitante y del comprador; el
operador no está ahí), y que las plantillas no cambian. **ADR-044 — El contrato para consumidores**
con fuente en este research. **ADR-031** gana una nota fechada («el operador tiene nombre para
mostrar; feature 040»), como ADR-036 la tiene. `docs/dominio/operador.md` describe el nombre.
`contracts/README.md` gana `x-identifies-principal` en la tabla de extensiones y el campo `pointer` en
la fila de `x-invariants`; `generated/README.md` y `scripts/README.md`, sus filas.

## Lo que depende de OPE-Web

Una línea: su `conformity` tiene que admitir `capabilities: []` para una operación que el bundle
marca `x-identifies-principal` (R-04). Se hace en OPE-Web al verificar SC-001, y es lo que deja que
las tres muletas se saquen en la feature de OPE-Web que siga.

## Complexity Tracking

Nada que justificar. Las piezas nuevas —un path, un esquema, un caso de uso trivial, un emisor, un
ADR— son las formas que el repositorio ya usa para exactamente esto; y la feature **borra** de
OPE-Web dos emisores y una sonda en vez de agregar otro mecanismo.
