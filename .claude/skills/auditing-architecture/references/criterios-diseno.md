# Criterios de diseño de este repositorio

Cada principio está definido **en términos de este repo** y cita la fuente interna que lo
respalda. Un hallazgo que no pueda citar una de estas fuentes es `clarity:<slug>` (severidad
baja) o no es un hallazgo. Fuentes válidas para `rule.source`: `constitution#<sección>`,
`ADR-NNN`, `guide#<sección>` (CLAUDE.md), `lint:<regla>`, `arch:<regla>`, `clarity:<slug>`.

## Contenido

- SRP — una autoridad por módulo
- OCP — agregar sin tocar
- LSP — perfiles intercambiables
- ISP — puertos por caso de uso
- DIP — hacia adentro, por puertos
- DRY — conocimiento, no texto
- Claridad — nombres con intención y `NO_OP` con motivo
- Errores — explícitos, tipados, trazables
- Composition root — elige, no adivina
- Qué ya ve un gate (y qué no)

## SRP — una autoridad por módulo

- **Definición acá**: cada módulo de `domain/` y `application/` decide una sola cosa; el
  orquestador arma contexto e invoca, no decide (constitución I). Un archivo de dominio o
  aplicación cabe en 300 líneas (`shape`).
- **Fuente**: `constitution#I. Separación de autoridades`, `ADR-013`.
- **Viola**: un caso de uso que además persiste por su cuenta; un módulo con dos motivos de
  cambio (p. ej. `ingestion` que empieza a decidir mensajes); un `index.ts` que reexporta lógica
  de otro módulo.
- **Cumple**: `application/ledger/confirm-exposure.ts` sólo decide si una exposición se
  registra; el registro lo hace el puerto.
- **Lo ve un gate**: parcialmente (`shape`: tamaño; `arch`: mapa de contextos). La revisión
  cognitiva aporta el caso de "dos responsabilidades en 100 líneas".

## OCP — agregar sin tocar

- **Definición acá**: un módulo nuevo es una entrada en `CONTEXT_MAP`, otra en `MODULES` y una
  carpeta; un puerto nuevo es un campo en el slice de puertos del módulo que el compilador
  obliga a proveer en el perfil; una operación nueva es un controller nuevo **y una línea en el
  módulo que la sirve** (`composition/modules/<módulo>.ts`), no un `if` en un controller ni una
  entrada en un mapa central del root (ADR-013).
- **Fuente**: `ADR-013`, `guide#Anillos y módulos`, `arch:composition-wires-by-module`.
- **Viola**: un `switch` sobre `merchantId` o sobre "tipo de merchant" dentro de un caso de uso;
  un controller que rutea por `operationId` a mano; un composition root que enumera casos de uso
  o controllers de todos los módulos (`getHealth: makeGetHealth(...)`, `ingestEvents: ...`):
  crece con cada operación del sistema, no con cada módulo. "Hoy son tres" no lo refuta.
- **Cumple**: `composition/modules/ledger.ts` instancia sus casos de uso y entrega sus
  controllers; `bootstrap.ts` sólo conoce `MODULES`; `profiles/memory.ts` no toca los casos de
  uso.
- **Lo ve un gate**: el root que importa controllers, security handlers o casos de uso sí
  (`arch`); el `switch` sobre merchant, no.

## LSP — perfiles intercambiables

- **Definición acá**: cualquier implementación de un puerto (`memory-*`, futura `postgres-*`)
  se cambia en `composition/profiles/` sin tocar una prueba de caso de uso ni un controller.
- **Fuente**: `ADR-013`, `constitution#X. Puertos en los dos bordes`.
- **Viola**: un gateway que devuelve `undefined` donde el puerto promete `Promise<Decision>`;
  un caso de uso que hace `instanceof MemoryDecisionLedger`.
- **Cumple**: `tests/helpers/test-app.ts` reemplaza el reloj por override sin tocar nada más.
- **Lo ve un gate**: el tipado atrapa la firma; no atrapa la semántica (p. ej. un `find` que
  revela existencia para otro merchant: constitución V).

## ISP — puertos por caso de uso

- **Definición acá**: los puertos viven en `application/<módulo>/ports/` y exponen lo que ese
  módulo necesita, no un repositorio genérico (`DecisionLedger.record/find`, no `Repository<T>`).
- **Fuente**: `constitution#X. Puertos en los dos bordes`, `ADR-013`.
- **Viola**: un puerto con `query(sql)`; un puerto que devuelve una entidad completa cuando el
  caso de uso sólo pregunta "¿existe?".
- **Cumple**: `MerchantDirectory.isRegisteredOrigin(origin)`: lo único que el preflight CORS
  puede preguntar.
- **Lo ve un gate**: no.

## DIP — hacia adentro, por puertos

- **Definición acá**: controllers reciben casos de uso; casos de uso reciben puertos; nadie fuera
  de `composition/`, `infrastructure/` y los gateways construye infraestructura.
- **Fuente**: `arch:controllers-no-gateways`, `arch:application-inward`, `arch:domain-is-pure`,
  `shape` regla 3, `constitution#I. Separación de autoridades`.
- **Viola**: `new Redis()` en un controller; `import Fastify` en aplicación; un caso de uso que
  lee `process.env`.
- **Cumple**: `composition/bootstrap.ts` es el único lugar que conoce a la vez perfil, casos de
  uso y controllers.
- **Lo ve un gate**: sí (`arch` + `shape`). El hallazgo cognitivo sólo aporta el caso que las
  reglas no expresan (p. ej. un puerto cuya firma filtra un detalle de infraestructura, como
  un `PoolClient`).

## DRY — conocimiento, no texto

- **Definición acá**: lo que se duplica es **conocimiento**: un catálogo replicado sin prueba de
  réplica, una regla de negocio escrita en el contrato y otra vez en el dominio con distinto
  umbral, un sustantivo sin nota en `docs/dominio/`. Dos bloques parecidos de código son DRY si
  cambian por motivos distintos.
- **Fuente**: `ADR-008` (glosario con fuente), `ADR-007` (invariantes declaradas una vez),
  `lint:sonarjs/no-identical-functions`, `check:duplication`.
- **Viola**: `TIMESTAMP_TOLERANCE` en el dominio y "24 horas" escrito distinto en la
  `description` del contrato; un `title` de Problem Details escrito en un controller en vez de
  salir de `PROBLEM_TYPES`.
- **Cumple**: `problem-types.yaml` ↔ `problem-details.ts` con `tests/unit/problem-details.test.ts`
  que verifica la réplica; `no-op-reasons.yaml` ↔ `no-op-reasons.ts` idem.
- **Lo ve un gate**: la duplicación textual sí (`check:duplication`, sonarjs); la de conocimiento
  no. Antes de reportar, refutar: ¿coincidencia o mismo motivo de cambio?

## Claridad — nombres con intención y `NO_OP` con motivo

- **Definición acá**: un nombre dice qué decide, no cómo (`confirmExposure`, no
  `processExposureRequest`); todo resultado negativo es un valor con motivo, nunca una
  ausencia (`{ ok: false, invariant, detail }`, `NO_OP` con `reason` del catálogo).
- **Fuente**: `constitution#II. Fail-closed`, `guide#Convenciones`, `clarity:<slug>` cuando no
  hay regla escrita.
- **Viola**: `data`, `handle`, `process` como nombres; un `boolean` devuelto donde el llamador
  necesita saber por qué; un comentario que explica lo que un nombre podría decir.
- **Cumple**: `checkBatch` devuelve la primera invariante violada con `detail`.
- **Lo ve un gate**: no.

## Errores — explícitos, tipados, trazables

- **Definición acá**: los casos de uso devuelven resultados, no lanzan por reglas de negocio;
  todo error HTTP es Problem Details de un tipo del catálogo; un `catch` que ignora el error es
  un `NO_OP` sin motivo.
- **Fuente**: `ADR-001`, `ADR-002`, `lint:sonarjs/no-ignored-exceptions`,
  `constitution#II. Fail-closed`.
- **Viola**: `catch (e) {}`; `throw new Error("invalid")` en un caso de uso por una regla de
  negocio; un `status: 422` con `type: unprocessable` genérico.
- **Cumple**: `invariantResponse(req, result)` traduce una invariante a su tipo propio.
- **Lo ve un gate**: el `catch` vacío sí (lint); el `throw` por regla de negocio no.

## Composition root — elige, no adivina

- **Definición acá**: `composition/` es el único lugar que conoce a la vez perfiles, módulos y
  contrato. Eso no lo exime de los principios: **cada módulo se cablea solo**
  (`composition/modules/<módulo>.ts` instancia sus casos de uso y entrega sus controllers,
  security handlers y políticas); el root conserva la lista de módulos, nunca la de
  operaciones, y **se niega a arrancar** si el contrato declara una operación que ningún
  módulo sirve; **el perfil es un parámetro**
  (`Profile = (config, overrides) => { ports, closables }`), nunca un `if` sobre configuración;
  **el orden de cierre lo declara quien creó** los recursos (el perfil, en `closables`), nunca
  se infiere de `Object.values(...)`; **los overrides los resuelve el perfil**, que sabe qué
  gateway depende de cuál; y **ningún seam de pruebas vive en producción**: un módulo cargado
  desde una variable de entorno o un `import()` con especificador calculado es un vector de
  ejecución, no una comodidad.
- **Fuente**: `constitution#I. Separación de autoridades` (composition root único, ningún
  módulo instancia su infraestructura), `constitution#II. Fail-closed` (operación declarada sin
  servir), `ADR-013`, `shape:no-computed-dynamic-import`, `arch:composition-wires-by-module`.
- **Viola**: `wireControllers(useCases)` con una entrada por operación del sistema;
  `const ports = config.persistence === "postgres" ? postgresPorts() : memoryPorts()`;
  `for (const p of Object.values(ports).reverse()) p.close?.()`; `await import(process.env.X)`;
  `const clock = overrides.ports?.clock` resuelto en el root porque "dedup lo necesita".
- **Cumple**: `wireModules(MODULES, { ports, contractVersion })` y
  `assertEveryOperationWired(definition, handlers)`; `bootstrap(config, { profile })` con
  `memoryProfile` por defecto; `tracker()` registrando closables en orden de creación; la
  prueba negativa de contrato como entrada de proceso propia
  (`tests/contract/fixtures/health-203.ts`).
- **Lo ve un gate**: el `import()` calculado sí (`shape` regla 4); el root que importa
  controllers o casos de uso sí (`arch`). El `if` sobre configuración, el orden de cierre
  inferido y el override resuelto en el root, no: son criterio cognitivo, y el tamaño chico
  del archivo no los disculpa.

## Qué ya ve un gate (y qué no)

| Gate                | Ve                                                   | No ve                                          |
| ------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `lint`              | forma, duplicación semántica, `catch` vacío, `any`   | responsabilidades, nombres, conocimiento       |
| `arch`              | dirección de dependencias, mapa de contextos, root que importa controllers o casos de uso | puertos con forma de infraestructura           |
| `shape`             | tamaño, un controller por operación, `new` de npm, `import()` calculado | dos responsabilidades en un archivo corto; un `if` sobre configuración |
| `check:duplication` | bloques iguales                                      | mismo conocimiento con distinta forma          |
| `check:dead-code`   | exports y archivos sin uso                           | abstracciones que existen "por si acaso"       |
| `test:mutation`     | pruebas que no matan mutantes del cambio             | pruebas que prueban lo incorrecto              |

Un hallazgo cognitivo sobre algo que un gate ya reporta es ruido: se cita el gate y se
descarta, salvo que aporte el caso que la regla no ve.
