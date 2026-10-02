---
description: "Task list template for feature implementation"
---

# Tasks: Registros honestos y lineamiento de persistencia

**Input**: Design documents from `/specs/037-registros-honestos/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: sí. La historia 1 existe porque tres gates y dos suites dejaron pasar un tipo que mentía, así
que cada conversión nueva lleva tres cosas: la prueba unitaria que la ejercita, el mutante que la mata y
el caso de durabilidad que **llama un método** de lo leído. Un caso que sólo compara campos pasa con el
defecto presente (spec, casos borde).

**Organization**: por historia, y las dos son independientes de verdad: la 1 toca `src/domain/`, tres
gateways y tres controllers; la 2 toca sólo documentación. **Esta feature no toca HTTP** —ninguna
operación cambia— así que el orden de seis pasos de `.claude/rules/contrato.md` no se dispara. **Y no hay
migración**: lo escrito es idéntico (R-03).

**No hay fase fundacional**: nada es compartido entre las dos historias. La 1 empieza por el dominio y
termina en los gateways; la 2 puede empezar el mismo día.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1 (lo leído se comporta como lo escrito), US2 (el lineamiento está donde se lee)
- Toda tarea nombra su archivo

---

## Phase 1: User Story 1 — Lo que se lee del almacén se comporta como lo que se escribió (P1) 🎯 MVP

**Goal**: el registro de cada entidad alcanzada declara datos planos y la entidad convierte al
construirse; los cuatro casts que mienten pasan a decir la verdad; el catálogo leído del almacén deja de
traer precios con un tipo que no cumple.

**Independent Test**: `npm run typecheck` con `tests/types/records.test-d.ts`; las tres unitarias del
dominio; y las tres suites de durabilidad de catálogo, pedidos y merchants, con el caso nuevo del
catálogo. Quickstart pasos 1 a 5.

### El dominio: el registro dice la verdad y el constructor convierte

- [ ] T001 [US1] `src/domain/merchant/origin.ts` — `OriginRecord { value: string }` exportado, y
      `Origin.rehydrate(record: OriginRecord)` en vez de `rehydrate(value: string)`. El único llamador
      externo es el gateway de merchants, que T009 borra. El comentario de `rehydrate` sigue valiendo y se
      ajusta: lo que explica («`JSON.parse` no devuelve clases») pasa a ser el motivo de que el registro
      del merchant declare este tipo.
- [ ] T002 [US1] `src/domain/merchant/merchant.ts` — `MerchantRecord.origins: readonly OriginRecord[]`;
      el constructor hace `record.origins.map((o) => Origin.rehydrate(o))`. `Merchant.of` sigue
      construyendo con `Origin.parse` y pasando instancias (cumplen con el registro). `record()` no
      cambia. Exportar `OriginRecord` por el `index.ts` del módulo.
- [ ] T003 [P] [US1] `src/domain/outcomes/order.ts` — `OrderFacts.total: MoneyRecord`;
      `OrderRecord.correlation?: CorrelationRecord`, `redemption?: IncentiveRedemptionRecord`,
      `returned?: ReturnRecord`. El constructor convierte las cuatro con el `rehydrate` de cada una, y
      **sólo cuando la parte opcional está presente** (FR-006). `Order.of` juzga lo mismo sobre el registro
      plano. `withCorrelation` y `withReturn` no cambian: pasan por `record()` y el constructor vuelve a
      convertir (R-03). Importar `Money` como valor, ya no sólo como tipo.
- [ ] T004 [P] [US1] `src/domain/catalog/catalog-snapshot.ts` — `Variant.price: MoneyRecord`. Sin
      conversión (R-02, R-05). El import de `Money` se va; entra `MoneyRecord` como tipo. La huella del
      snapshot ya lee `amount` y `currency` y no cambia.
- [ ] T005 [P] [US1] `src/domain/ingestion/event.ts` — `Event.price?: MoneyRecord`. Sin conversión. La
      lista blanca de campos no cambia.
- [ ] T006 [US1] `tests/types/records.test-d.ts` — **nuevo**, con la convención de `tests/types/`
      (`@ts-expect-error` con descripción, verificado por `npm run typecheck`, nunca ejecutado). Fija: un
      `MoneyRecord` no es asignable a `Money`; un `OriginRecord` no es asignable a `Origin`; un
      `OrderRecord` escrito con datos planos entra en `Order.rehydrate` sin cast; y un `MerchantRecord`
      con orígenes planos entra en `Merchant.rehydrate`. Es SC-003.
- [ ] T007 [P] [US1] `tests/unit/domain/outcomes/order.test.ts`,
      `tests/unit/domain/merchant/merchant.test.ts`, `tests/unit/domain/catalog/catalog-snapshot.test.ts`
      — por entidad, los casos de FR-002, FR-005 y FR-006: construida desde un registro **plano** (objetos
      literales, nunca instancias), sus partes responden a sus métodos (`returned.sameContentAs`,
      `total.equals`, `allowsOrigin`); construida desde una copia (`withReturn`, `rotated`) es igual por
      valor a la construida desde el registro plano equivalente; una parte opcional ausente sigue ausente.
      En el catálogo: rehidratado desde un registro plano, el precio conserva sus dos campos.
      **Antes de T008**: con T003 y T002 hechas, pasan; sin ellas, no compilan. Es lo que quiere decir que
      el compilador protege.

### El anillo: los gateways dejan de rehidratar a mano

- [ ] T008 [US1] `src/interface-adapters/outcomes/gateways/sqlite-order-ledger.ts` — `orderOf` pasa a
      una línea: `Order.rehydrate(fromDocument(String(document)) as OrderRecord)`. Se borran las cuatro
      rehidrataciones, los imports de `Correlation`, `IncentiveRedemption`, `Return` y `Money`, **y el
      comentario entero** que promete que «una quinta fallaría el typecheck» (FR-011). Lo que queda
      escrito ahí es una línea: el cast es verdadero porque el registro declara lo que el documento trae.
- [ ] T009 [US1] `src/interface-adapters/merchant/gateways/sqlite-merchant-store.ts` — `merchantOf` pasa
      a `Merchant.rehydrate(fromDocument(String(document)) as MerchantRecord)`. Se borran `StoredMerchant`,
      el `map` sobre los orígenes y el import de `Origin`. El comentario de `merchantOf`, que explica el
      peligro de un origen que vuelve plano, se reescribe en una línea: ese peligro lo cierra ahora el
      constructor del merchant. El resto del archivo (el índice, ADR-041) no se toca.
- [ ] T010 [P] [US1] Los tres controllers que envolvían un dato del contrato en `Money.rehydrate` para
      entregarlo a un tipo que ahora declara el dato plano:
      `src/interface-adapters/catalog/controllers/upsert-catalog-snapshot.ts` (`price: v.price`),
      `src/interface-adapters/ingestion/controllers/ingest-events.ts` (`price` tal cual),
      `src/interface-adapters/outcomes/controllers/notify-order.ts` (`total: body.total`; el constructor
      del pedido convierte). Se va el import de `Money` donde quede sin uso. SC-001 dice que
      `Money.rehydrate` no aparece en ningún controller.
- [ ] T011 [US1] `tests/durability/catalog.test.ts` — **el caso que hoy no existe** (FR-007, SC-002): un
      catálogo con un precio escrito, `restart()`, leído con `current`, y
      `Money.rehydrate(variant.price).equals(Money.rehydrate({ amount: "100.00", currency: "ARS" }))`
      es verdadero. El `productOf` del fixture puede seguir construyendo con `Money.rehydrate` (una
      instancia cumple con el registro) o pasar el literal; da igual, y conviene que pase el literal para
      que el fixture diga lo mismo que el tipo. Los casos de `tests/durability/outcomes.test.ts`
      («records a return after the restart, and calls a repeated one a repeat») y de
      `tests/durability/merchant-store.test.ts` (`allowsOrigin` tras el reinicio) ya llaman un método de
      cada parte y **no se tocan**: tienen que seguir pasando con T008 y T009 hechas.
- [ ] T012 [US1] El lazo de la historia: `npm run format:check && npm run quality && npm run typecheck
&& npm test`, y después `npx vitest run --project durability tests/durability/catalog.test.ts
tests/durability/outcomes.test.ts tests/durability/merchant-store.test.ts`. Más la verificación de
      SC-001 a mano: `grep -rn "\.rehydrate(" src/interface-adapters --include=*.ts` muestra una llamada
      por gateway durable sobre el documento entero y ninguna sobre una parte, y ningún tipo auxiliar de
      forma almacenada.
- [ ] T013 [US1] `npm run test:mutation` acotado al diff de la historia. Cada línea de conversión del
      constructor es un mutante posible (quitarla, cambiar la clase) y T007 tiene que matarlo; un
      sobreviviente se trabaja con la skill `triaging-mutants` **antes** de seguir, y nunca cambiando el
      código del dominio sólo para el gate.
- [ ] T014 [US1] `npx vitest run --project durability tests/durability/ingest-latency.test.ts` — SC-005,
      como confirmación: R-05 no agregó ninguna instrucción al camino de decisión, así que lo esperable es
      que la cifra no se mueva. Se anota en el quickstart con fecha, al lado de la medición previa, y si se
      moviera de forma apreciable **la feature no cierra** hasta explicar por qué.

**Checkpoint**: la historia 1 se puede commitear y entregar sola. El código es honesto aunque la
documentación todavía diga lo viejo.

---

## Phase 2: User Story 2 — Quien edita el anillo encuentra el lineamiento donde trabaja (P2)

**Goal**: lo que la evaluación del 2026-10-02 estableció queda escrito donde se lee a tiempo: un ADR
con cuatro decisiones y sus disparadores, las dos reglas acotadas con la rehidratación nueva y «qué no se
abstrae», y el registro de deudas con lo pendiente.

**Independent Test**: `npm run check:adrs && npm run check:instructions && npm run check:markers &&
npm run test:tools` en verde, y la lectura de las dos reglas por alguien ajeno a la evaluación (quickstart
paso 6).

- [ ] T015 [US2] `docs/adr/043-la-costura-entre-motores-es-el-puerto.md` — **nuevo**, con el frontmatter
      de `docs/adr/README.md` (`numero: 043`, `estado: aceptada`, `fecha`, `fuente: specs/037-registros-honestos/spec.md y research.md`).
      Cuatro decisiones, cada una con su **disparador de revisión** (FR-014): (1) `SqlStore` es el
      vocabulario del motor SQLite, síncrono porque el driver de la biblioteca estándar lo es y se eligió
      para no agregar dependencias; se revisa si Node publica su API asíncrona y el repo la adopta, o si
      SQLite recibiera tráfico real. (2) La costura para un motor nuevo es el puerto de aplicación, no una
      abstracción entre motores. (3) Las transacciones cuya corrección depende del escritor único se
      escriben por motor, con sus pruebas de concurrencia; **se listan las siete** (pedido primero/repetido/
      conflicto, devolución, versión de configuración de merchant, versión de nivel, apertura de
      experimento, valores sin mapear, exposición con `changes()`) y qué protege a cada una con dos
      escritores. (4) Los gateways quedan planos con prefijo de motor; se revisa cuando exista un tercer
      motor. Y las **cuatro abstracciones descartadas** con su motivo en una línea (FR-015): un solo nombre
      de fallo (son contrato), el índice como decorador (la mitad durable no implementa las lecturas), el
      almacén asíncrono (el escritor único, no la firma), la tabla de documentos (sin costura, sólo ahorra
      líneas y esconde el SQL que la suite de planes verifica). Cita ADR-021, ADR-024, ADR-038, ADR-041 y
      ADR-042; no reemplaza ninguno. **Sin cifras de estado** en el texto.
- [ ] T016 [P] [US2] `.claude/rules/gateway-durable.md` — el cuarto punto («Al leer, toda clase anidada
      se rehidrata») se reescribe: **la entidad vuelve sola de su registro** con una llamada a `rehydrate`
      sobre el documento; el gateway no nombra ninguna parte; si una parte vuelve plana, el defecto está en
      el registro de la entidad y se arregla en `src/domain/` (regla de entidades), nunca en el gateway. Las
      fechas siguen volviendo solas por `toDocument`/`fromDocument`. El ejemplo deja de ser el gateway de
      pedidos. Y una **sección nueva**, `## Qué no se abstrae, y por qué`, con las cuatro abstracciones del
      ADR nuevo de T015 en una línea cada una y el puntero a ese ADR (FR-016). Las rutas y los identificadores citados
      tienen que existir: `check:instructions` los verifica.
- [ ] T017 [P] [US2] `.claude/rules/entidad.md` — una viñeta nueva en el primer punto: un registro declara
      sus partes que son clases como **registros planos** (`MoneyRecord`, `OriginRecord`), la conversión va
      en el **constructor**, y una instancia cumple con su registro así que quien construye con clases no
      cambia. Y la **otra forma válida**: guardar sólo datos planos y construir la clase al pedirla, como
      `MerchantConfigurationVersion`, cuando nadie aplica la regla de la parte (`Variant.price`). Con el
      motivo en una línea: un dato plano asignado a un campo de clase no compila, y eso es toda la
      protección (FR-017).
- [ ] T018 [US2] `scripts/instructions-policy.json` — la sección nueva de la regla de gateways con su
      clase, `normative`, y el `heading` **idéntico** al del archivo. `check:instructions` falla en los dos
      sentidos, así que una sección sin clase y una clase sin sección son el mismo error (FR-018).
- [ ] T019 [P] [US2] `docs/deudas.md` — tres cosas, cada una con su fila en el registro y su historia al
      final, como pide «Cómo se agrega una fila»: **D-33** `abierta`, «una lectura durable que falla
      responde `500 internal-error` en vez de `503` con reintento», origen la evaluación del 2026-10-02,
      con el motivo de no hacerse acá (toca el contrato y casi todos los casos de uso) y las tres salidas
      que se evaluaron. **D-34** `abierta`, «el almacén de versiones de merchant y el de niveles son copia
      literal, en memoria y en SQLite», con la condición de cierre escrita: un tercer almacén de versiones
      obliga a extraer lo común; antes, no. Y la **ampliación de D-21** como subsección fechada bajo su
      historia (al lado de «Y lo que la feature 033 le apoyó encima»): si SQLite se queda o se retira
      cuando llegue PostgreSQL, las siete transacciones que lista el ADR nuevo de T015, invalidar o consultar el índice de
      ADR-041, y la reorganización por carpetas de motor (FR-020, FR-021).
- [ ] T020 [P] [US2] `tests/README.md` — la fila de `types/` nombra lo que contiene; gana «registros».
      `docs/README.md` y `docs/adr/README.md` no cambian: sus filas son genéricas y `check:adrs` verifica
      el ADR nuevo.
- [ ] T021 [US2] `npm run check:adrs && npm run check:instructions && npm run check:markers && npm run
test:tools` — y la lectura por alguien ajeno: las dos preguntas del quickstart paso 6 contestadas desde
      las reglas, sin abrir otro documento. Si una no sale de ahí, la regla se corrige antes de cerrar.

**Checkpoint**: las dos historias completas e independientes.

---

## Phase 3: Lo que queda dicho

- [ ] T022 Correr el **quickstart** de punta a punta, los seis pasos, y completar «Cambios respecto del
      plan» con fecha: la cifra de SC-005 al lado de la previa, lo que el gate de mutación pidió, y cualquier
      cosa que una prueba haya encontrado que el plan no vio.
- [ ] T023 La cadena de cierre: `npm run contract:check` (sin diferencias: FR-012), `npm run test:all`,
      `npm run test:mutation`, `npm run test:contract`, `npm run release-check`.

---

## Dependencies & Execution Order

### Entre fases

- **Fase 1 (US1)** y **Fase 2 (US2)** son independientes: ninguna espera a la otra. Si se hacen en serie,
  la 1 va primero porque la 2 describe una regla que la 1 hace cierta.
- **Fase 3** espera a las dos.

### Dentro de la fase 1

- T001 → T002 (el registro del origen antes que el del merchant).
- T002, T003, T004, T005 → T006 y T007 (las pruebas compilan sólo con el dominio cambiado).
- T002 → T009; T003 → T008; T004 y T005 → T010.
- T008, T009, T010, T011 → T012 → T013 → T014.

### Dentro de la fase 2

- T016 → T018 (la sección tiene que existir con su título exacto antes de declararla).
- T015 primero, porque T016 y T019 citan el ADR nuevo por su número y `check:adrs` falla si no existe.
- Todo → T021.

### Paralelismo

- T003, T004 y T005 entre sí (tres archivos del dominio sin dependencia).
- T007 con T006.
- T010 con T008 y T009.
- T016, T017, T019 y T020 entre sí, después de T015.

---

## Implementation Strategy

### Lo mínimo entregable

La fase 1 entera. Al terminarla el defecto está corregido, el compilador protege y ningún gateway
rehidrata a mano, aunque la regla acotada todavía diga lo viejo. Es entregable y commiteable sola.

### Incremental

1. Fase 1 → `npm test`, las tres suites de durabilidad, mutación → commit de la historia.
2. Fase 2 → los gates de documentación → commit de la historia.
3. Fase 3 → quickstart y cadena de cierre → commit de cierre.

### Notas

- Un commit por cambio, en español, conventional commits; nada se commitea con pruebas en rojo.
- Las pruebas de T007 se escriben **con** el dominio cambiado, no antes: sin T002 y T003 no compilan, y
  eso es la demostración y no un obstáculo.
- Toda cifra de SC-005 va fechada al quickstart; ninguna a un documento vivo.
- Un mutante que sobrevive en una conversión no se mata cambiando el dominio para el gate: se escribe la
  prueba que falta, o se explica por qué es equivalente, con la skill `triaging-mutants`.
