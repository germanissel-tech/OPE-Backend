---
description: "Task list template for feature implementation"
---

# Tasks: Grafo de composición tipado y seguridad con dueño (020)

**Input**: Design documents from `/specs/020-grafo-de-composicion/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: la feature no pide pruebas nuevas de comportamiento —el criterio es que las existentes
pasen sin cambiar una aserción (FR-026)—. Sí lleva pruebas de **mecanismo**: los cuatro "no
compila", la biblioteca del grafo, y el fixture de cada regla nueva. Están donde corresponde en cada
fase.

**Organization**: una fase por historia. El orden de las fases es **por dependencia**, no por
prioridad; el porqué de cada adelanto está en "Dependencies & Execution Order".

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (otro archivo, sin dependencia pendiente)
- **[Story]**: US1..US6 según [spec.md](./spec.md)
- Cada tarea nombra sus archivos

## Path Conventions

Proyecto único: `src/`, `tests/`, `scripts/` en la raíz del repositorio (ADR-013).

---

## Phase 1: Setup

**Purpose**: dejar registrado el punto de partida y preparar el harness de las pruebas de tipos.

- [x] T001 Registrar la línea de base en verde antes de tocar nada: `npm run format:check`,
      `npm run quality`, `npm run typecheck`, `npm test`, y anotar en el commit de la fase que la
      suite parte limpia (es el juez de toda la feature)
- [x] T002 [P] Extender el harness de `tests/typecheck/typecheck.test.ts` para que un fixture pueda
      afirmar **código y fragmento del mensaje** (hoy sólo afirma el código): los cuatro casos del
      grafo se juzgan por el nombre que el error imprime

**Checkpoint**: base verde y harness listo.

---

## Phase 2: Foundational — la biblioteca del grafo

**⚠️ CRITICAL**: ninguna historia puede empezar antes de esta fase.

**Purpose**: la biblioteca que todo lo demás usa. Sin conocimiento de ningún módulo: no importa
`application/` ni `interface-adapters/`.

- [x] T003 Crear `src/composition/graph/port.ts`: `Port<T, L>` con la etiqueta en el tipo y el
      fantasma como **propiedad opcional** (no función: la variancia rompe la maquinaria, research
      R-03), `port()` currificada, `AnyPort`, y `Closable`/`isClosable` movidos desde
      `src/composition/ports.ts`
- [x] T004 Crear `src/composition/graph/binding.ts`: `Binding<Provides, Needs>`, `bind(port, deps,
build)` con los tipos del builder inferidos de `deps`, y `derive(vista, fuente)` con
      `S extends T`
- [x] T005 Crear `src/composition/graph/module.ts`: `CompositionModule` (technologies / exposes /
      serves), `technology(ports, bindings)` con `Unserved<…>`, `.with(tecnología)` tipado por las
      claves del propio módulo, y `operations()` / `handler(deps, build)` que inyecta el
      `operationId` **desde la clave** (FR-022)
- [x] T006 Crear `src/composition/graph/compose.ts`: `compose`/`deployment` con `Missing<…>` y
      `Unwired<…>`, resolución perezosa memorizada por presencia (`Map.has`, no `!== undefined`),
      `resolveAll()`, `ports`, `closables` en orden de creación, y detección de ciclo que nombra el
      ciclo completo. Los alias `ProvidesOf`/`NeedsOf` van con parámetro desnudo para que el
      condicional distribuya (research R-04)
- [x] T007 Crear `src/composition/graph/index.ts` con la API pública de la biblioteca
- [x] T008 Pruebas de la biblioteca en `tests/unit/composition/graph.test.ts`: misma instancia para
      dos consumidores, una sola construcción, vista derivada idéntica a su fuente, orden de la
      lista irrelevante, ciclo nombrado, `closables` en orden de creación, `resolveAll` construye lo
      que nadie consume
- [x] T009 [P] Fixture `tests/typecheck/fixtures/graph-missing-provider.ts` + su caso: `TS2345` con
      `Missing<"…">`
- [x] T010 [P] Fixture `tests/typecheck/fixtures/graph-technology-partial.ts` + su caso: `TS2345`
      con `Unserved<"…">`
- [x] T011 [P] Fixture `tests/typecheck/fixtures/graph-derive-foreign.ts` + su caso: la fuente no
      satisface la vista
- [x] T012 [P] Fixture `tests/typecheck/fixtures/graph-operation-unwired.ts` + su caso: `TS2345` con
      `Unwired<"…">`

**Checkpoint**: la biblioteca compila, sus pruebas pasan y los cuatro casos fallan como se espera.
Nada de `src/composition/modules/` cambió todavía.

---

## Phase 3: User Story 6 — La auditoría de operaciones deja de ser una excepción (Priority: P3)

**Goal**: registrar lo que hace un operador deja de obligar a un módulo a depender del módulo de
administración.

**Independent Test**: ningún módulo importa `application/admin` para auditar; el registro contiene
exactamente lo mismo que hoy (las pruebas del registro pasan sin cambios).

**Por qué va primera**: sin ella, `composition/modules/merchant.ts` tiene que importar
`application/admin`, y el mapa de contextos sobre la composición (US2) no puede pasar. Además no
depende del grafo: es un movimiento dentro de `application/`.

- [x] T013 [US6] Crear `src/application/shared-kernel/ports/audit-trail.ts`: puerto de **escritura
      angosto** (el actor como texto, la operación, el merchant opcional, el resultado y el motivo),
      exportado por `src/application/shared-kernel/index.ts`
- [x] T014 [US6] Mover `AuditedUseCase` a
      `src/application/shared-kernel/decorators/audited.use-case.ts`, escribiendo contra el puerto
      nuevo; `src/application/admin/` deja de exportarlo
- [x] T015 [US6] Crear `src/interface-adapters/admin/gateways/audit-trail.ts`: implementa el puerto
      del kernel sobre `AdminLog` y **vuelve a tipar** el actor con `asOperatorId` (la pérdida de
      tipado, acotada a este borde, queda comentada acá y en ADR-034)
- [x] T016 [US6] Actualizar `src/composition/modules/audited.ts` y los módulos que auditan
      (`merchant.ts`, `admin.ts`, `experiment.ts`, `configuration.ts`) para pedir el puerto del
      kernel en vez de `AdminLog`
- [x] T017 [US6] `npm run arch` y `npm run check:dead-code` en verde: `application/admin` conserva
      la entrada, el almacén y las dos lecturas paginadas, y nadie lo importa para auditar
- [x] T018 [US6] Prueba de igualdad del registro: la entrada escrita por una operación aceptada, una
      rechazada y una denegada es idéntica campo por campo a la de hoy (las pruebas existentes del
      registro y de la semilla corren **sin tocarse**)

**Checkpoint**: el registro es el mismo; el kernel es dueño de la obligación.

---

## Phase 4: User Story 1 — El cableado es un grafo que el compilador verifica (Priority: P1) 🎯 MVP

**Goal**: el ensamblado deja de ser tres listas paralelas y pasa a ser el grafo de la fase 2.

**Independent Test**: el despliegue no compila si falta un proveedor; no hay envoltorios perezosos
ni orden significativo; toda la suite pasa sin cambiar una aserción de comportamiento.

Cada módulo migrado declara sus puertos como constantes exportadas con etiqueta prefijada por su
módulo, su tabla `memory` (o la que corresponda), lo que expone y lo que sirve; y **deja de recibir**
lo que hoy hereda de otros (FR-010). Los objetos anónimos que hoy hacen de implementación de puerto
pasan a gateways con nombre en esta misma fase, porque son el cuerpo del `bind` (habilita la regla de
forma de US3).

- [ ] T019 [US1] Migrar `src/composition/modules/shared-kernel.ts`: puertos de reloj, logger,
      tolerancia y del puerto de auditoría; expone el servicio de decoradores
      (`logged`/`audited` sobre el `operationId` que `handler` inyecta), que reemplaza a
      `src/composition/modules/audited.ts`
- [ ] T020 [US1] Migrar `src/composition/modules/system.ts` (sólo sirve `getHealth`)
- [ ] T021 [US1] Migrar `src/composition/modules/merchant.ts`: el almacén y su vista por `derive`
      (se va el cierre `store ??= …`), acuñador, política de rotación; las ocho operaciones de
      administración por `operations()`; la semilla sigue entrando por el mismo caso de uso
- [ ] T022 [US1] Migrar `src/composition/modules/experiment.ts`: almacén y directorio por `derive`,
      acuñador de identificadores, ledger de asignaciones; expone el servicio de asignación; las
      cuatro operaciones
- [ ] T023 [US1] [P] Migrar `src/composition/modules/ledger.ts` y
      `src/composition/modules/barrier.ts`; el módulo de barrera deja de devolver un objeto vacío
      (omite `serves`) y el del ledger expone el registrador de decisiones
- [ ] T024 [US1] [P] Migrar `src/composition/modules/catalog.ts`: declara el puerto de sus políticas
      (que la configuración enlazará) y expone el servicio de verdad de producto
- [ ] T025 [US1] Migrar `src/composition/modules/decision.ts`: **deja de heredar** los puertos de
      experimento, catálogo, barrera y ledger; declara los suyos (estado de sesión y de visitante,
      directorio de políticas) y pide los **servicios ya construidos** de las otras autoridades;
      expone el plano de decisión; omite `serves`
- [ ] T026 [US1] Migrar `src/composition/modules/ingestion.ts`: su deduplicación y el plano que
      consume, sin heredar los puertos del plano
- [ ] T027 [US1] [P] Migrar `src/composition/modules/outcomes.ts` (tres operaciones)
- [ ] T028 [US1] Migrar `src/composition/modules/configuration.ts`: niveles, almacén y servicio por
      `derive`/enlace; enlaza los puertos de lectura que declaran decisión, catálogo y experimento
      (el mapa se lo permite); sus cinco operaciones
- [ ] T029 [US1] Migrar `src/composition/modules/admin.ts`: registro, diagnósticos y la vista que el
      SDK puede ver de la configuración —el adaptador se muda acá desde el módulo de configuración,
      porque `admin` puede ver `configuration` y no al revés—; sus cinco operaciones
- [ ] T030 [US1] Crear `src/composition/deployments/local.ts` (reemplaza
      `src/composition/profiles/local.ts`): la lista de módulos con su tecnología, **sin orden
      significativo y sin un solo envoltorio perezoso**
- [ ] T031 [US1] Reescribir `src/composition/bootstrap.ts` sobre el grafo: `resolveAll()` al
      arrancar, cierre en orden inverso de creación, **se conserva** la verificación de cobertura de
      operaciones contra el archivo de contrato (constitución II, research R-06)
- [ ] T032 [US1] Migrar `tests/helpers/test-app.ts`: reemplazos por puerto (`replace(Port, doble)`),
      lectura por `resolve(Port)`, y `sharedTestApp` conservando su optimización envolviendo cada
      puerto de `graph.ports` en el proxy delegante (research R-09)
- [ ] T033 [US1] Migrar los ~49 sitios que pasan `ports: { … }` en `tests/` a reemplazos por puerto
- [ ] T034 [US1] Migrar las ~27 lecturas `app.ports.<nombre>` en `tests/` a `resolve(Port)`
- [ ] T035 [US1] Borrar `src/composition/ports.ts`, `src/composition/profile.ts`,
      `src/composition/wiring.ts`, `src/composition/modules/index.ts` y
      `src/composition/modules/audited.ts`, y reescribir las pruebas **del mecanismo reemplazado**
      (`tests/unit/composition/wiring.test.ts`, `profile.test.ts`, el fixture
      `tests/typecheck/fixtures/ports-incomplete.ts`)
- [ ] T036 [US1] Poner al día lo que nombra los archivos borrados: `knip.json`, `eslint.config.mjs`,
      `tsconfig*.json` y `.dependency-cruiser.cjs` si corresponde; `npm run check:dead-code` en verde
- [ ] T037 [US1] Suite completa: `npm run format:check && npm run quality && npm run typecheck &&
npm test`, **sin una sola aserción de comportamiento modificada**

**Checkpoint**: el sistema entero corre sobre el grafo y se comporta igual.

---

## Phase 5: User Story 2 — Un módulo de composición tiene una forma y nada más (Priority: P1)

**Goal**: que la forma y el acoplamiento dejen de depender de la disciplina del autor.

**Independent Test**: una verificación de forma reporta un módulo que exporte otra cosa; el mapa de
contextos reporta un import prohibido entre módulos de composición, con su fixture.

- [ ] T038 [US2] Regla de forma `composition-module-shape` en `scripts/shape-rules.mjs` (+
      `SHAPE_RULES`): un archivo de `src/composition/modules/` exporta sólo sus puertos, sus tablas
      por tecnología, lo que expone y lo que sirve
- [ ] T039 [US2] [P] Fixture de la regla en
      `tests/architecture/fixtures/shape/composition-module-shape/src/` y su caso en
      `tests/architecture/shape.test.ts` (verde en `src/`, rojo en el fixture nombrando el archivo)
- [ ] T040 [US2] Extender las reglas `context-map:<módulo>` de `.dependency-cruiser.cjs` a
      `src/composition/modules/<módulo>.ts`, y actualizar `composition-imports-module-index` a la
      forma nueva
- [ ] T041 [US2] [P] Fixture del mapa en
      `tests/architecture/fixtures/src/composition/modules/` y su caso en
      `tests/architecture/architecture.test.ts`
- [ ] T042 [US2] Verificar los conteos de SC-002 sobre `src/`: cero `extends` de slices ajenos, cero
      módulos que devuelvan un objeto vacío, cero servicios compartidos construidos más de una vez,
      cero envoltorios perezosos en el despliegue, cero resoluciones por texto

**Checkpoint**: la forma y el acoplamiento los verifica el build.

---

## Phase 6: User Story 5 — La composición deja de decidir comportamiento (Priority: P3)

**Goal**: que la constitución XI valga también un nivel más arriba.

**Independent Test**: el directorio de adaptadores del root no existe; ninguna implementación de
puerto es un objeto anónimo escrito en la composición; el tope compartido está decidido; el nombre
de una operación aparece una sola vez.

**Por qué va antes de US3**: la regla de forma de US3 exige que ninguna política sea anónima.

- [ ] T043 [US5] Mover la regla del interruptor ("un merchant que el store no conoce está apagado")
      de `src/composition/adapters/switch-aware-policy-directory.ts` a
      `src/application/configuration/services/`, y su prueba desde
      `tests/unit/composition/adapters/` a `tests/unit/application/configuration/`
- [ ] T044 [US5] Borrar `src/composition/adapters/` y la mención del directorio en
      `.dependency-cruiser.cjs` y en la documentación de anillos
- [ ] T045 [US5] Cerrar el repaso de políticas con nombre: que ninguna de las que hoy son objetos
      anónimos —ventana de firma, gracia de rotación, tolerancia de reloj, ventana de visitante,
      ventana de sesión, holdout— haya quedado en un módulo de composición; todas viven en
      `src/interface-adapters/<módulo>/gateways/` con nombre (FR-020)
- [ ] T046 [US5] Agregar el lector con nombre del tope de identidades a
      `src/domain/configuration/` (devuelve el tope de la deduplicación, ADR-034) y usarlo en los
      tres almacenes en memoria que hoy lo toman de la deduplicación sin decirlo
- [ ] T047 [US5] Mover a `Merchant` la regla de qué credenciales están vigentes y hacer que el
      instante viaje con el resultado del caso de uso, para que los cuatro controllers de
      `src/interface-adapters/merchant/controllers/` dejen de recibir el reloj (FR-023)
- [ ] T048 [US5] Verificar que el DTO del merchant no cambió: mismas credenciales, mismo orden,
      mismos instantes; las pruebas de esas cuatro operaciones pasan sin tocarse

**Checkpoint**: en el composition root no queda ninguna regla ni ningún valor de política.

---

## Phase 7: User Story 4 — La seguridad tiene dueño (Priority: P2)

**Goal**: un solo módulo con los tres esquemas, sus resolvedores y las políticas de firma.

**Independent Test**: el módulo existe y los agrupa; el módulo de merchants no declara ninguno; las
pruebas de autenticación, autorización, firma y alcance pasan sin cambiar una aserción.

El módulo se llama `access` (research R-10: un módulo `security` daría
`interface-adapters/security/security/`).

- [ ] T049 [US4] Crear `src/application/access/` con los cuatro resolvedores movidos
      (`ingest-key`, `platform-key`, `platform-signature` desde `application/merchant/services/` y
      `admin-token` desde `application/admin/services/`), los puertos de firma, HMAC, directorio de
      operadores y huellas, y su `index.ts`
- [ ] T050 [US4] Crear `src/interface-adapters/access/` con los tres security handlers movidos
      (`security/`), los gateways de HMAC, huellas, directorio de operadores, ventana de firma y
      gracia de rotación (`gateways/`), y su `index.ts`
- [ ] T051 [US4] Crear `src/composition/modules/access.ts`: los tres esquemas del contrato con sus
      headers y consumidores, los resolvedores y las políticas de seguridad del nivel de plataforma;
      consume del módulo de merchants **sólo la vista de lectura** del directorio
- [ ] T052 [US4] Dejar `src/composition/modules/merchant.ts` sin ningún esquema de seguridad ni
      política de firma o rotación —conserva el agregado, su administración y la política de CORS—,
      y `src/composition/modules/admin.ts` con el registro, los diagnósticos y la vista del SDK
- [ ] T053 [US4] Agregar `access` a `CONTEXT_MAP` (`shared-kernel`, `operator`, `merchant`) con su
      fixture, y verificar que la dirección nunca se invierte: nadie importa `access` desde
      `merchant`
- [ ] T054 [US4] `npm run arch`, `npm run check:dead-code` y las pruebas de seguridad existentes en
      verde **sin cambiar una aserción**: 401/403, firma, ventana, alcance del operador y CORS

**Checkpoint**: "cómo se autentica cada consumidor" se lee en un módulo.

---

## Phase 8: User Story 3 — Ningún puerto sin enlace, ninguna implementación fuera del grafo (Priority: P2)

**Goal**: que el camino correcto deje de ser opcional.

**Independent Test**: el gate nuevo falla ante una abstracción declarada y no enlazada; la regla de
forma falla ante una implementación construida fuera de su enlace; cada una con su fixture.

**Por qué va última**: verifica el estado final. Corriéndola antes, la reportaría todo lo que las
fases anteriores todavía no movieron.

- [ ] T055 [US3] Crear `scripts/check-ports-bound.mjs`: lee `src/application/*/ports/*.ts` con la
      API 6.0 de TypeScript, verifica que cada tipo exportado sea el tipo servido de algún puerto de
      `src/composition/modules/*.ts`, que ninguna etiqueta se repita, con `--src <dir>` y `--json`
      en protocolo `findings-v1` ([contracts/ports-bound-gate.md](./contracts/ports-bound-gate.md))
- [ ] T056 [US3] Sumarlo a `package.json`, a la cadena de `scripts/quality.mjs` (después de
      `check:dead-code`) y a `tests/governance/quality.test.ts`, que cuenta los gates de la cadena
- [ ] T057 [US3] [P] Crear el adaptador `scripts/audit/gate-ports-bound.mjs` (`--files-from`,
      `--list-rules`, `--describe`) y agregar el gate a `audit.profile.json`
- [ ] T058 [US3] [P] Fixture `tests/audit/fixtures/unbound-port/src/` y su caso en
      `tests/audit/audit.test.ts`: el gate nombra el puerto con archivo y línea, y `src/` pasa limpio
- [ ] T059 [US3] Regla de forma `port-implementations-only-in-bind` en `scripts/shape-rules.mjs`
      (+ `SHAPE_RULES`): en `src/composition/modules/*.ts`, un `new` de algo de
      `interface-adapters/`/`infrastructure/` y todo objeto literal que haga de implementación de
      puerto sólo dentro del builder de un `bind`
- [ ] T060 [US3] [P] Fixture
      `tests/architecture/fixtures/shape/port-outside-bind/src/` y su caso en
      `tests/architecture/shape.test.ts`

**Checkpoint**: las dos preguntas —"¿está enlazado?" y "¿se construyó donde corresponde?"— las
responde el build.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T061 Actualizar `CLAUDE.md`: la sección de composición (el grafo, la forma del módulo, el
      despliegue, los tres archivos de un módulo nuevo), la tabla de comandos con
      `check:ports-bound`, la cadena de `quality`, la tabla de anillos (sin `adapters/`, con
      `graph/`) y la lista de módulos (con `access`)
- [ ] T062 [P] Pasar `docs/adr/033-grafo-de-composicion-tipado.md` y
      `docs/adr/034-dueno-del-acceso-y-auditoria-de-plataforma.md` a `estado: aceptada`
- [ ] T063 [P] Poner al día los inventarios de `README.md` que la prueba de documentación verifica
      (`scripts/`, `tests/`) con las entradas nuevas
- [ ] T064 Correr [quickstart.md](./quickstart.md) entero, incluida **la prueba del algodón** (§ 6):
      crear un módulo de juguete, omitir por turno cada uno de los tres pasos y anotar el error
      obtenido en cada caso
- [ ] T065 Cadena de cierre: `npm run contract:check` (cero diff del contrato y del mapa),
      `npm run test:scoped`, `npm run test:contract`, `npm run release-check` y
      `npm run test:mutation`; ante un sobreviviente, el procedimiento de ADR-016 (describir,
      clasificar, recién después tocar)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: sin dependencias.
- **Foundational (2)**: depende de Setup. **Bloquea todo**: es la biblioteca que las seis historias
  usan.
- **US6 (3)**: sólo depende de Foundational en el calendario, no en el código (es un movimiento
  dentro de `application/`). Va primera porque sin ella `modules/merchant.ts` tiene que importar
  `application/admin` y el mapa de US2 no puede pasar.
- **US1 (4)**: depende de Foundational y de US6.
- **US2 (5)**: depende de US1 (las reglas describen la forma que US1 deja).
- **US5 (6)**: depende de US1. Va antes de US3 porque la regla de forma de US3 exige que ninguna
  política sea anónima.
- **US4 (7)**: depende de US1. Independiente de US2 y US5.
- **US3 (8)**: depende de US1, US5 y US4: verifica el estado final.
- **Polish (9)**: depende de todo lo anterior.

### Diferencia con el orden de prioridades

La spec prioriza por valor (US1 y US2 en P1; US3 y US4 en P2; US5 y US6 en P3). Las fases ordenan
por dependencia técnica, y por eso US6 va primera y US3 última. Ninguna historia cambia de alcance:
lo que cambia es cuándo se ejecuta.

### Within Each User Story

- Los módulos de la fase 4 se migran de a uno, compilando entre medio; el despliegue (T030) es lo
  último que cierra el grafo y hasta ahí el proyecto no compila entero: es el costo declarado de un
  cambio de una sola vez (research R-17).
- Cada regla nueva entra **con su fixture en la misma tarea o en la inmediata**: una regla sin
  fixture no entra (ADR-016).
- Cada historia termina con su propio commit, en español, con las pruebas verdes.

### Parallel Opportunities

- T009–T012 (los cuatro fixtures de tipo) son independientes entre sí.
- T023, T024 y T027 (ledger + barrera, catálogo, outcomes) no se tocan entre sí.
- T039, T041, T057, T058, T060 (fixtures) van en paralelo con la regla que verifican una vez escrita.
- T062 y T063 son independientes.

---

## Implementation Strategy

### MVP

Fases 1 → 2 → 3 → 4. Con eso el sistema entero corre sobre el grafo, con el mismo comportamiento, y
la garantía central (lo que no compila) ya está viva. Es el punto natural para parar y validar.

### Entrega incremental

1. Base + biblioteca → la maquinaria existe y está probada, sin tocar el sistema.
2. US6 → el registro es del kernel; el sistema sigue igual.
3. US1 → **MVP**: todo sobre el grafo, suite verde sin cambiar aserciones.
4. US2 → la forma y el acoplamiento los verifica el build.
5. US5 → en el root no queda ninguna decisión de comportamiento.
6. US4 → la seguridad tiene dueño.
7. US3 → los dos gates cierran la puerta.
8. Polish → documentación, ADRs aceptados y la cadena completa.

### Notas

- El juez de toda la feature es la suite existente: si una aserción de comportamiento necesita
  cambiar, es un defecto de la migración, no de la prueba. Las únicas pruebas reescribibles son las
  del mecanismo reemplazado, enumeradas en T035 y T043.
- Sin push ni merge sin el dueño.
