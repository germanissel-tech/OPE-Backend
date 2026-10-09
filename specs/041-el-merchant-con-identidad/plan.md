# Implementation Plan: El merchant con identidad

**Branch**: `041-el-merchant-con-identidad` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/041-el-merchant-con-identidad/spec.md`

## Summary

El merchant gana una identidad para personas —nombre de la tienda, URL, persona de contacto y notas
del operador— que se escribe al crearlo y se reemplaza con una operación propia, auditada, del
consumidor `admin`; se lee en la lista y en la ficha; y no sale de la administración. La persona de
contacto es la segunda persona identificada del sistema, y la constitución lo dice con una enmienda
de redacción.

**Lo que la investigación cambió** ([`research.md`](research.md)): el almacén guarda el merchant como
documento, así que no hay migración ni columna (R-01); la identidad es un **valor del agregado**, no
otro agregado (R-02); la edición es un `PUT` de reemplazo (R-03); el esquema juzga largos y formatos
y el dominio sólo lo que el esquema no dice, con un invariante nuevo (R-04); la excepción del lint
pasa a admitir una lista (R-05); y `displayName` obligatorio en el alta es un cambio que
`contract:diff` marca y la marca `building` admite: es la primera vez que se usa para un `required`
nuevo, y se decide con el dueño (R-09).

**Lo que toca `src/`**: un valor nuevo con sus reglas y un error en `domain/merchant`, un campo en el
agregado con un método, un caso de uso nuevo y dos campos en dos existentes (`createMerchant`, la
semilla), un controller, el presentador, y el cableado. Nada en infraestructura.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) en `src/` y pruebas; JavaScript con
`checkJs` en `scripts/` y `contracts/rules/functions/` (ADR-011, ADR-017). YAML para el contrato.

**Primary Dependencies**: openapi-backend con `ajv-formats` (valida `format: email`), Spectral (una
regla tocada). Ninguna dependencia nueva.

**Storage**: SQLite por el gateway existente; el merchant es un documento (ADR-041) y la identidad
viaja adentro. Sin migración.

**Testing**: contrato (`tests/contract-rules/`, fixtures de `ope-no-pii`), integración sobre el
servidor en memoria (`tests/integration/admin-merchants.test.ts` gana la edición; `isolation.test.ts`
gana el caso de alcance; `logging-privacy.test.ts` gana el del contacto), unidad del dominio
(`MerchantProfile.of`, `withProfile`), durabilidad (`merchant-store.test.ts`: la identidad y un
documento viejo), gobernanza (`consumer-artifacts.test.ts` afirma los esquemas nuevos). Mutación sobre
lo nuevo (ADR-016).

**Target Platform**: el mismo servidor; `ubuntu-latest` en CI, Windows en desarrollo.

**Project Type**: backend de un servicio; la feature es de su contrato, su dominio de merchants y su
borde `admin`.

**Performance Goals**: ninguno nuevo. La identidad no entra en el camino de decisión: el SDK y la
plataforma resuelven el merchant por huella y nada lee el perfil.

**Constraints**: contrato en `1.13.0` con un cambio que `contract:diff` reporta (R-09); nada de
política en el código (los largos viven en el contrato; el dominio juzga forma, no tamaño); el
contacto no entra en registro, logs ni decisiones; Tandilia no se toca.

**Scale/Scope**: cuatro campos, dos esquemas nuevos, una operación nueva, un invariante nuevo, una
clase de dominio, un caso de uso, una regla de lint enmendada con dos fixtures, una enmienda PATCH a la
constitución, un ADR.

## Constitution Check

**Constitución v1.5.0**, y esta feature la lleva a **v1.5.1** (R-08). Los once principios, evaluados;
los que no aplican se marcan como tales y se dice por qué.

| Principio                                        | Aplica                        | Cómo se cumple / por qué no aplica                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**                 | No                            | Ninguna autoridad de decisión lee la identidad del merchant.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **II. Fail-closed: `NO_OP` por defecto**         | No                            | No hay decisión ni salida al SDK.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **III. La medición precede y no se contamina**   | No                            | Nada de esto toca la medición.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **IV. Dos caminos, dos garantías**               | No                            | La identidad no está en el camino de decisión ni en el de medición.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **V. Aislamiento por merchant**                  | **Sí**                        | `merchantId` sólo en la ruta `admin` (v1.2.0, ADR-020). La edición pasa por `ScopedMerchantService`: fuera del alcance, `403` sin revelar existencia; la identidad vive en el documento del merchant, dentro de su transacción. Toca persistencia y API: `isolation.test.ts` gana el caso de la edición, y la suite existente corre entera.                                                                                                                                                                                                           |
| **VI. Identidad e idempotencia explícitas**      | Sí                            | `merchantId` sigue acuñado e inmutable; el nombre es para reconocer, no para identificar (puede repetirse). `PUT` de reemplazo: repetirlo deja lo mismo.                                                                                                                                                                                                                                                                                                                                                                                              |
| **VII. OPE observa comportamiento, no personas** | **Sí, y se enmienda (PATCH)** | El principio protege a las personas observadas (1.5.0). La persona de contacto del merchant no es una: es parte de la relación comercial, como el operador, y la viñeta de VII pasa a nombrar «las personas identificadas de la relación comercial: el operador y el contacto del merchant». No cambia la lista blanca, el conector de órdenes ni la frase autorizada. La herramienta lo acompaña: `name`, `email` y `phone` siguen prohibidos en todo esquema y se excusan sólo en `MerchantContact`, con razón por propiedad (R-05). Versión 1.5.1. |
| **VIII. Cero modelos de lenguaje en runtime**    | Sí (trivialmente)             | Ninguna llamada nueva.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **IX. Nada entra al reporte sin trazabilidad**   | No                            | Nada de esto entra al reporte.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **X. Puertos en los dos bordes**                 | No                            | No hay borde de integración nuevo; la plataforma no ve la identidad.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **XI. Ninguna política vive en el código**       | Sí                            | No se agrega ningún valor de comportamiento. Los largos máximos son del contrato (nivel 0: forma, no política) y el dominio no los copia; `check:behaviour-constants` lo verifica.                                                                                                                                                                                                                                                                                                                                                                    |

**Gates explícitos del Constitution Check** (constitución, Flujo de desarrollo, punto 2):

- **¿Toca una superficie HTTP?** **Sí.** Diseñada en
  [`contracts/merchant-identity.md`](contracts/merchant-identity.md) antes de cualquier tarea de
  código. **Un cambio es incompatible para `contract:diff`** (`displayName` obligatorio en
  `MerchantCreate`) y entra por la marca `building` (ADR-003), con bump MINOR a `1.13.0` y reporte
  citado en el quickstart y en ADR-045. El dueño lo acuerda con este plan (R-09). Dispara el orden de
  seis pasos de `.claude/rules/contrato.md`.
- **¿Toca persistencia o API?** Las dos. Sin migración (R-01); la prueba de durabilidad afirma que la
  identidad sobrevive un reinicio y que un documento viejo sigue rehidratando. Aislamiento: el caso
  nuevo en `isolation.test.ts` y la suite entera.
- **¿Toca el plano de decisión?** No. Nada del plano lee `profile`.
- **¿Toca el ledger o la cadena de evidencia?** No.
- **¿Campo nuevo de evento u orden?** No. Los campos son del merchant, bajo `admin`.
- **¿Llamada a un modelo de lenguaje en runtime?** No.
- **¿Regla de negocio que el esquema no expresa?** **Sí, una**: `invalid-merchant-profile` (sin
  espacios en los bordes; URL parseable), con tipo propio en el catálogo, `pointer`, y prueba
  `[invariant:invalid-merchant-profile]` (ADR-007).
- **¿Sustantivo nuevo en el contrato?** No: `merchant` tiene su nota (`docs/dominio/merchant.md`),
  que gana la identidad; «contacto» es un campo del merchant, no un sustantivo del dominio con vida
  propia.
- **¿Toca `src/`?** Sí: `domain/merchant` (valor, error, método), `application/merchant` (caso de
  uso nuevo, dos existentes), `interface-adapters/merchant` (controller, presentador),
  `composition/modules/merchant.ts` (cableado), `composition/merchants-config.ts` (semilla).
  Dirección de dependencias intacta; `npm run arch` lo verifica.

**Resultado: pasa, con una enmienda PATCH a la constitución (FR-010) y un cambio de contrato que la
marca `building` admite (FR-012)**, los dos a ratificar por el dueño al acordar este plan. Sin
complejidad que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/041-el-merchant-con-identidad/
├── spec.md                      # Fase previa
├── plan.md                      # Este archivo
├── research.md                  # Fase 0: diez hallazgos
├── data-model.md                # Fase 1: la identidad, el merchant, la semilla, el caso de uso
├── contracts/
│   └── merchant-identity.md     # Fase 1: el cambio de contrato y lo que el servidor hace
├── quickstart.md                # Fase 1: cómo se verifica de punta a punta
└── tasks.md                     # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

Lo que la feature toca, y nada más:

```text
contracts/
├── openapi.yaml                                   info.version 1.13.0; /v1/admin/merchants/{merchantId}/profile
├── api-map.yaml                                   updateMerchantProfile: built (feature "041")
├── paths/admin-merchant-profile.yaml              NUEVO
├── components/schemas/MerchantContact.yaml        NUEVO · x-personal-datum (lista)
├── components/schemas/MerchantProfileInput.yaml   NUEVO · invariante invalid-merchant-profile
├── components/schemas/MerchantCreate.yaml         displayName required; storeUrl, contact, notes; el invariante
├── components/schemas/Merchant.yaml               los cuatro, opcionales
├── components/responses/MerchantProfileUnprocessable.yaml   NUEVO
├── components/responses/MerchantUnprocessable.yaml          ejemplo de invalid-merchant-profile
├── problem-types.yaml                             invalid-merchant-profile
├── rules/functions/noPii.js                       x-personal-datum como objeto o lista
└── README.md                                      la fila de x-personal-datum
tests/contract-rules/fixtures/                     ope-no-pii.contact-elsewhere, ope-no-pii.list-without-reason; valid-admin-path
src/
├── domain/merchant/profile.ts                     NUEVO · MerchantProfile (clase) y MerchantContactRecord
├── domain/merchant/errors.ts                      InvalidMerchantProfile(field)
├── domain/merchant/merchant.ts                    profile?: en record e input; withProfile(); rehydrate anidado
├── domain/merchant/index.ts                       exports
├── application/merchant/use-cases/update-merchant-profile.use-case.ts   NUEVO
├── application/merchant/use-cases/create-merchant.use-case.ts           profile
├── application/merchant/use-cases/import-merchants.use-case.ts          MerchantSeed con los campos
├── application/merchant/index.ts                  exports
├── interface-adapters/merchant/controllers/update-merchant-profile.ts   NUEVO
├── interface-adapters/merchant/controllers/create-merchant.ts           lee los campos
├── interface-adapters/merchant/presenters.ts      merchantDto con la identidad; profileOf(body)
├── interface-adapters/merchant/index.ts           exports
├── composition/modules/merchant.ts                served(updateMerchantProfile)
├── composition/merchants-config.ts                la semilla lee los campos
└── composition/seed-errors.ts                     el campo de un perfil inválido
config/schemas/merchants-seed.schema.json · config/dev-merchants.json
tests/
├── unit/domain/merchant/profile.test.ts           NUEVO · MerchantProfile.of, withProfile, rehydrate
├── unit/application/merchant/merchant-admin.use-cases.test.ts   el caso de uso nuevo; createMerchant con profile
├── integration/admin-merchants.test.ts            alta con identidad; edición; [invariant:invalid-merchant-profile]; registro sin valores
├── integration/isolation.test.ts                  edición fuera del alcance
├── integration/logging-privacy.test.ts            el contacto no está en el registro del servidor
├── durability/merchant-store.test.ts              la identidad sobrevive; un documento viejo rehidrata
├── governance/consumer-artifacts.test.ts          MerchantContact y MerchantProfileInput en CONSTRAINTS
└── unit/composition/config.test.ts                la semilla con y sin identidad
docs/
├── adr/045-el-merchant-con-identidad.md           NUEVO
├── adr/031-…                                      nota fechada
└── dominio/merchant.md                            la identidad
.specify/memory/constitution.md                    1.5.1
```

**Decisión de estructura**: `MerchantProfile` vive en `domain/merchant/profile.ts` al lado de
`origin.ts` y `credential.ts`, que son los otros valores del agregado; el caso de uso y el controller
siguen la forma de `setKillSwitch`, que es la escritura `admin` más parecida (alcance, reemplazo,
`200` con lo que quedó). Ningún módulo nuevo.

## Phase 1 — Diseño

### Los cuatro tramos

|                        | qué                                                                                                                                                                                                                                                 | punto de control                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 · El contrato**    | `updateMerchantProfile` en el mapa; los dos esquemas nuevos y los dos enmendados; el invariante en el catálogo; la respuesta `422`; `noPii` con lista y sus fixtures; `1.13.0`; `contracts/README.md`                                               | `npm run contract:check` en verde con el diff reportando el `required` nuevo y aceptándolo; cada fixture nueva falla su regla; `contract:types` regenera con los esquemas y la operación |
| **2 · El servidor**    | `MerchantProfile` y su error; `withProfile`; el caso de uso nuevo; `createMerchant` y la semilla con identidad; controller, presentador, cableado; `dev-merchants.json`; las pruebas de dominio, integración, aislamiento, privacidad y durabilidad | `npm test`, `test:durability`, `test:contract`, mutación sin sobrevivientes en lo nuevo; contra `npm run dev`, el quickstart §2                                                          |
| **3 · Los artefactos** | `generated/contract/` regenerada; la prueba de gobernanza afirma los esquemas nuevos; en OPE-Web, `contract:sync` y `ope-check`                                                                                                                     | `contract:types:check` en verde; `ope-check` pasa sin tocar `conformity`                                                                                                                 |
| **4 · Los documentos** | Constitución 1.5.1 con su Sync Impact Report; ADR-045; la nota en ADR-031; `merchant.md`; `.claude/rules/contrato.md` si la viñeta de `x-personal-datum` lo necesita; quickstart con lo corrido                                                     | `release-check` en verde; `check:adrs`, `check:identifiers`, `check:glossary`, `check:instructions`                                                                                      |

**El 1 va primero** por el orden de `contrato.md` y porque el 2 compila contra sus tipos; igual que en
la 040, el arranque se niega con una operación sin handler, así que **1 y 2 van en un commit**. **El 3
después del 2**, para que lo emitido ya traiga la operación. **El 4 al final**: la enmienda se escribe
cuando el lint y el código ya hacen lo que ella dice.

### La identidad en el dominio (R-02, R-04)

`MerchantProfile.of(record)` juzga, en orden, `displayName`, `storeUrl`, `contact.name`,
`contact.email`, `notes`, y devuelve `InvalidMerchantProfile(field)` con `details.pointer` al primero
que falla (`contact.email` → `/body/contact/email` en el borde). `Merchant.withProfile` reemplaza y no
falla. `rehydrate` rehidrata el perfil anidado: es la regla de `gateway-durable.md` para toda clase
anidada, y la prueba de durabilidad la cubre leyendo el perfil tras un reinicio y rehidratando un
documento sin `profile`.

### La operación (R-03)

`UpdateMerchantProfileUseCase { scoped, merchants }`: `find` → `of` → `withProfile` → `update`.
`makeUpdateMerchantProfile(useCase)` lee `merchantIdOf(req.path)` y `profileOf(req.body)` (un helper
del presentador que convierte el cuerpo tipado en `MerchantProfileRecord`, y que `createMerchant`
reutiliza), y responde `200` con `merchantDto`. Cableado con `served({ scoped, merchants }, …)` sin
lectores de auditoría (R-06).

### El alta (R-09)

`CreateMerchantRequest.profile`; el caso de uso lo juzga antes de `ownerOfOrigin` y de acuñar. La
prueba `[invariant:invalid-merchant-profile]` crea con `displayName: " Tienda "` y afirma
`/body/displayName`; otra edita con `storeUrl: "https://"` y afirma `/body/storeUrl`.

### El lint (R-05)

`exceptionOf` acepta objeto o lista y devuelve el conjunto de propiedades excusadas; cada entrada con
`property` declarada y `reason` no vacía; lista vacía → error. Las razones del contacto dicen lo que
la constitución dice. Fixtures según `contracts/merchant-identity.md`.

### Lo que se enmienda y se escribe (R-08)

Constitución **1.5.1** con Sync Impact Report (PATCH; la fuente del MVP no habla del contacto porque
no tenía backoffice; plantillas sin cambio). **ADR-045 — El merchant con identidad**: la identidad
como valor del agregado, la edición como reemplazo, qué juzga quién, el contacto como persona
identificada, el `required` nuevo bajo `building`. ADR-031 gana una nota fechada; `merchant.md`
describe la identidad; `contracts/README.md` dice que `x-personal-datum` admite una lista.

## Lo que depende de OPE-Web

Nada para que esta feature cierre: `conformity` pasa con lo emitido (R-07). Listar por nombre y
mostrar la ficha completa es la feature siguiente de OPE-Web, que toma `generated/contract/` con
`contract:sync`.

## Complexity Tracking

Nada que justificar. Las piezas nuevas —un valor con reglas, un caso de uso, un path, dos esquemas,
un invariante— son las formas que el repositorio ya usa para exactamente esto. Lo único que no es
rutina es el `required` nuevo en el alta, y está decidido con su motivo (R-09) en vez de evitado con
un campo opcional que nadie completaría.
