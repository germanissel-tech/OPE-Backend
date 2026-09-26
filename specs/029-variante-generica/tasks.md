---
description: "Task list template for feature implementation"
---

# Tasks: La variante deja de exigir dos atributos de indumentaria

**Input**: Design documents from `/specs/029-variante-generica/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/delta.md](./contracts/delta.md),
[quickstart.md](./quickstart.md)

**Tests**: sí, y de dos clases que conviene no mezclar. **Las que ya existen son el control**: pasan
con la forma nueva sin cambiar ninguna expectativa, y eso es lo que demuestra que no se rompió nada.
**Las dos nuevas cubren lo único que cambia de comportamiento**: el rechazo de la forma vieja y el
conflicto de idempotencia por un atributo distinto.

**Organization**: una sola historia, así que las fases son el orden de seis pasos de toda feature que
toca HTTP: glosario → contrato → `contract:check` → tipos → código → gates. **Los tipos generados
nunca se editan a mano.**

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1 (hay una sola)
- Toda tarea nombra su archivo

---

## Phase 1: Setup — lo que va antes del contrato

- [x] T001 `docs/dominio/variante.md` — la cita pasa a ser la que la fuente dice **hoy** («la
      combinación exacta de atributos que define un artículo vendible — en indumentaria, talle y
      color»), y el cuerpo deja de enumerar talle y color entre los campos del catálogo. ADR-008: la
      nota va **antes** de que el contrato cambie. Es la única nota del glosario que cita texto que la
      enmienda del 2026-09-25 borró, verificado contra el diff (research R-05).
- [x] T002 `contracts/api-map.yaml` — **verificar que no cambia**: la variante viaja dentro del cuerpo
      de una operación que ya existe, así que ninguna se agrega, retira ni cambia de forma.
      `check:api-map` es el gate.

**Checkpoint**: el glosario ya dice lo que el contrato va a decir.

---

## Phase 2: User Story 1 - Una tienda que no vende ropa puede publicar su catálogo (Priority: P1) 🎯

**Goal**: la variante declara los atributos que la definen, con la misma forma que el producto, y
ningún campo obligatorio le pide a una plataforma algo que su mundo no tiene.

**Independent Test**: publicar un catálogo con variantes de atributos cualesquiera y verlo aceptado;
uno con la forma vieja, rechazado; y una decisión sobre ese catálogo, idéntica a la de antes.

### El contrato

- [x] T003 [US1] `contracts/components/schemas/CatalogAttribute.yaml` — **nuevo**: el par clave/valor
      tal como la plataforma lo expone, sin normalización. Es **exactamente** la forma que
      `CatalogProduct` define hoy en línea: clave hasta 64, valor hasta 512, los dos requeridos,
      `additionalProperties: false`.
- [x] T004 [US1] `contracts/components/schemas/CatalogProduct.yaml` — su lista de atributos pasa a
      referenciar el componente en vez de definirlo en línea. **El esquema efectivo no debe cambiar**:
      si `contract:diff` reporta algo sobre el producto, la extracción se hizo mal. Es la verificación
      que convierte esto en un cambio seguro y no en un trámite.
      **Verificado**: `contract:diff` no reporta **nada** sobre los atributos del producto; los dos
      únicos cambios que lista son los campos de la variante, que es lo que la feature viene a hacer.
- [x] T005 [US1] `contracts/components/schemas/CatalogVariant.yaml` — **pierde** los dos campos de
      indumentaria de `properties` y de `required`; **gana** `attributes`, opcional, lista de hasta 64
      con `$ref` al componente nuevo. La descripción deja de decir «la combinación exacta de talle y
      color» y dice lo que la fuente dice desde la enmienda.
- [x] T006 [P] [US1] `contracts/examples/catalog-snapshot.yaml` — las variantes del ejemplo declaran
      atributos. Es lo que un integrador copia primero, así que si el ejemplo sigue mostrando talles,
      el contrato dice una cosa y enseña otra.
- [x] T007 [US1] `contracts/openapi.yaml` — `info.version` a la **MINOR** siguiente. Incompatible, y
      entra por la marca `info.x-stability: building` (ADR-003).
- [x] T008 [US1] `npm run contract:check` y `npm run contract:types`. **Nunca editar lo generado.**

### El código

- [x] T009 [US1] `src/domain/catalog/catalog-snapshot.ts` — la interfaz de la variante lleva
      `attributes: readonly Attribute[]`, **reusando la interfaz `Attribute` que el módulo ya
      exporta** (research R-06). Ningún tipo nuevo: es el mismo concepto.
- [x] T010 [US1] `src/domain/catalog/catalog-snapshot.ts` — la huella de contenido serializa los
      atributos de la variante **igual que los del producto**, que lo hace una línea más arriba en la
      misma función. Es la única línea de la feature que cambia comportamiento.
- [x] T011 [US1] `src/interface-adapters/catalog/controllers/upsert-catalog-snapshot.ts` — la
      traducción del DTO al dominio sigue al contrato.

### Pruebas de US1

- [x] T012 [P] [US1] `tests/helpers/test-app.ts` — el constructor de variantes deja de recibir un
      talle y recibe atributos. Es el que usan casi todas las demás, así que arreglarlo primero es lo
      que hace mecánico el resto.
- [x] T013 [US1] `tests/integration/catalog.test.ts` — **prueba nueva**: un catálogo cuyas variantes
      declaran atributos que no son de indumentaria se acepta y su verdad de producto queda legible; y
      uno con los campos viejos recibe `400` nombrando el campo. Es lo que convierte «una tienda que no
      vende ropa puede publicar» en algo verificable.
- [x] T014 [US1] `tests/unit/domain/catalog/catalog-snapshot.test.ts` — **prueba nueva**: dos
      instantáneas del mismo instante cuyas variantes difieren **sólo** en un atributo **no** son el
      mismo contenido; dos idénticas sí. Cubre el único cambio de comportamiento (constitución VI), y
      hasta hoy ese caso sólo se notaba si cambiaba el talle o el color. Se agregó también el caso
      **reordenado**, que el precedente del producto ya decidía: reordenar atributos es contenido
      distinto, y escribirlo evita que alguien invente después una segunda semántica de igualdad.
- [x] T015 [US1] El resto de `tests/` que construye variantes: `catalog-size.test.ts`,
      `ingest-events.test.ts`, `product-truth.service.test.ts`,
      `upsert-catalog-snapshot.use-case.test.ts`, `decision.service.test.ts`. **Ninguna cambia de
      expectativa**: si alguna necesita cambiar lo que espera, no era un cambio de forma y hay que
      parar a mirar por qué. **Ninguna lo necesitó**: las tres que fallaron al principio lo hicieron
      por la **forma** del dato —dos aserciones de catálogo y la versión del contrato en el health—, no
      por lo que esperaban.

**Checkpoint**: una plataforma de cualquier rubro publica su catálogo sin inventar nada.

---

## Phase 3: Cierre

- [ ] T016 `docs/deudas.md` — D-16 a `implementada` con su commit.
- [ ] T017 `CLAUDE.md` y `.claude/rules/` — **sólo si hace falta**, con el criterio de admisión. La
      hipótesis es que no: la regla sobre campos que nadie lee ya está en la 028 y su research, y el
      criterio de qué vocabulario es de quién está en `.claude/rules/contrato.md` desde la 027.
- [ ] T018 `npm run check:glossary`, `check:invariant-tests`, `check:identifiers`, `check:api-map`,
      `check:language`, `check:behaviour-constants`, `check:ports-bound` — los siete, uno por uno,
      antes de la cadena completa.
- [ ] T019 Correr el quickstart **entero**, sus seis pasos, y dejar su tabla de estado **fechada**. El
      paso 6 no lo decide ningún comando: leer la definición de variante como si uno vendiera
      heladeras.
- [ ] T020 Cadena completa como CI: `format:check`, `quality`, `typecheck`, `build`, `test`,
      `test:tools`, `contract:check`, `test:contract`, `release-check`. **`build` antes de
      `test:contract`**, que si no prueba el `dist/` anterior.
- [ ] T021 `npm run test:mutation`. Por historia, el gate acotado
      (`--files <archivo>:<desde>-<hasta>`) sobre la huella de contenido, que es la línea con lógica;
      la corrida completa del diff, al cierre.
- [ ] T022 **El canario**: `grep -nE "\bsize\b|\bcolor\b"` en
      `contracts/components/schemas/CatalogVariant.yaml` y `src/domain/catalog/` tiene que dar
      **nada**. Mientras quede una ocurrencia, la feature no está hecha.

---

## Dependencies & Execution Order

- **Setup (F1)**: el glosario va **antes** del contrato (ADR-008). T002 es una verificación y no
  bloquea.
- **US1 (F2)**: el orden es inamovible dentro de la fase — contrato (T003–T007) → tipos (T008) →
  código (T009–T011) → pruebas (T012–T015). Dentro del contrato, **T003 antes que T004 y T005**,
  porque los dos lo referencian.
- **F3**: al final. T022 antes de declarar la feature terminada.

### Paralelismo real

Poco, y es honesto decirlo: la feature es una cadena. T006 puede ir con el resto del contrato y T012
es lo primero de las pruebas porque el resto depende de él. Nada más.

---

## Implementation Strategy

Una sola historia y un solo incremento. El orden dentro de la fase es el que importa, no el reparto.

### Commits

Uno por la historia, en español, con las pruebas en verde. El cierre puede llevar el suyo.

---

## Notes

- **Las dos pruebas nuevas no son simétricas con el resto.** T013 y T014 cubren lo que cambia; las
  demás demuestran que nada más cambió. Escribir más pruebas nuevas para un cambio de forma daría
  cobertura sin información.
- **T004 es la tarea que puede salir mal en silencio.** Extraer la forma del atributo del producto
  tiene que dejar su esquema efectivo idéntico, y el único que lo puede decir es `contract:diff`. Si
  reporta algo del producto, hay que volver a T003 y no seguir.
- **Lo que este plan no puede verificar**: que los ejes que una plataforma de otro rubro mande sean
  los correctos para su catálogo. Eso lo dice un merchant de ese rubro, y `03 §9` ya avisó que el
  piloto no va a poder contestarlo.
