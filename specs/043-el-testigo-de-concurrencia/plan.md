# Implementation Plan: El testigo de concurrencia

**Branch**: `043-el-testigo-de-concurrencia` | **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/043-el-testigo-de-concurrencia/spec.md`

## Summary

Las tres publicaciones de configuración y la edición de la identidad del merchant exigen el testigo del
recurso que reemplazan: `If-Match` con el `ETag` de la última lectura. Sin él, `428 witness-required`; con uno
viejo, `412 stale-version` y nada escrito; con un cuerpo idéntico a lo que rige, `200` como hoy. Las lecturas
y las escrituras de esos recursos devuelven el `ETag`, y el del merchant cambia en toda escritura suya.

**Lo que la investigación cambió** ([`research.md`](research.md)):

- **Comparar y escribir ya es atómico**: las acciones de administración corren en unidades serializadas por
  turno (feature 034), así que la comparación vive en el caso de uso, sin escritura condicional (R-01).
- **El `428` necesita una extensión del contrato**: el validador respondería `400`, y declarar el encabezado
  opcional, como la firma, ocultaría el cambio incompatible y el olvido. `x-when-missing` nombra el problema
  (R-02).
- **El testigo de la configuración de un merchant incluye al merchant**: cada uno numera sus versiones (R-03).
- **La revisión del merchant sube en la entidad**, por un único método que usan las cuatro mutaciones (R-04).

**Lo que toca `src/`**: un error en el kernel; la revisión y el testigo en `Merchant`; tres casos de uso que
ganan el testigo en el request, en el orden de R-05; los controllers, que leen `If-Match` y devuelven `ETag`;
`validationFail`, que mira la extensión. Ningún almacén cambia de esquema.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) en `src/` y pruebas (ADR-011, ADR-017). YAML para
el contrato.

**Primary Dependencies**: openapi-backend (valida el encabezado requerido), Spectral, Redocly. Ninguna nueva.

**Storage**: SQLite. El merchant es un documento (ADR-041) y la revisión viaja adentro: sin migración. Nada
más se guarda.

**Testing**: unidad (la revisión, la lectura de `If-Match`, los casos de uso en el orden de R-05),
integración sobre el servidor en memoria (niveles, merchant, identidad, aislamiento, el `428`), durabilidad
(la revisión), contrato. Mutación sobre lo nuevo (ADR-016).

**Target Platform**: el mismo servidor; `ubuntu-latest` en CI, Windows en desarrollo.

**Project Type**: backend de un servicio; la feature es de su contrato, de los módulos `configuration` y
`merchant`, y del borde HTTP.

**Performance Goals**: ninguno nuevo. El testigo se calcula de lo que el caso de uso ya lee.

**Constraints**: contrato `1.15.0`, incompatible por la marca `building` (R-09); la consola necesita su
feature siguiente para volver a escribir esos cuatro recursos; ninguna política en el código.

**Scale/Scope**: dos tipos de problema, un parámetro, un encabezado, una extensión; un error de dominio, un
campo del merchant; tres casos de uso, cuatro controllers protegidos y diez que devuelven `ETag`; un ADR.

## Constitution Check

**Constitución v1.5.1.** Los once principios, evaluados; los que no aplican se marcan como tales y se dice
por qué.

| Principio                                        | Aplica                 | Cómo se cumple / por qué no aplica                                                                                                                                                                                                                  |
| ------------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**                 | No                     | Ninguna autoridad de decisión lee el testigo.                                                                                                                                                                                                       |
| **II. Fail-closed: `NO_OP` por defecto**         | No                     | No hay decisión ni salida al SDK.                                                                                                                                                                                                                   |
| **III. La medición precede y no se contamina**   | Sí, de forma indirecta | Una publicación que pisa a otra puede devolver a lo que rige un valor que ya se había corregido, sin versión correctiva que lo diga. El testigo cierra esa vía. El congelamiento (`409`) no cambia.                                                 |
| **IV. Dos caminos, dos garantías**               | No                     | Ni el camino de decisión ni el de medición cambian.                                                                                                                                                                                                 |
| **V. Aislamiento por merchant**                  | **Sí**                 | El testigo de la configuración y el del merchant llevan al merchant (R-03), así que el de uno nunca coincide en otro. El alcance se juzga antes que el testigo (R-05). `isolation.test.ts` gana los dos casos.                                      |
| **VI. Identidad e idempotencia explícitas**      | **Sí**                 | Es el principio que la feature completa: la idempotencia por contenido sigue intacta, porque un cuerpo idéntico responde como hoy con cualquier testigo (FR-005), y el testigo agrega la versión explícita que una escritura de reemplazo necesita. |
| **VII. OPE observa comportamiento, no personas** | No                     | El testigo no lleva datos personales: identificadores y números.                                                                                                                                                                                    |
| **VIII. Cero modelos de lenguaje en runtime**    | Sí (trivialmente)      | Ninguna llamada nueva.                                                                                                                                                                                                                              |
| **IX. Nada entra al reporte sin trazabilidad**   | No                     | Nada de esto entra al reporte.                                                                                                                                                                                                                      |
| **X. Puertos en los dos bordes**                 | No                     | No hay borde de integración nuevo.                                                                                                                                                                                                                  |
| **XI. Ninguna política vive en el código**       | Sí                     | Ningún valor de comportamiento: el formato del testigo es forma, no política.                                                                                                                                                                       |

**Gates explícitos del Constitution Check** (constitución, Flujo de desarrollo, punto 2):

- **¿Toca una superficie HTTP?** **Sí.** Diseñada en [`contracts/testigo.md`](contracts/testigo.md) antes
  de cualquier tarea de código. **Incompatible** para `contract:diff` y entra por la marca `building`
  (ADR-003), con versión menor y el reporte citado en el quickstart y en ADR-046, como en la 041. Dispara el
  orden de seis pasos de `.claude/rules/contrato.md`.
- **¿Toca persistencia o API?** Las dos. La revisión viaja en el documento del merchant, sin migración; la
  prueba de durabilidad afirma que sobrevive un reinicio y que un documento viejo lee `0`. Aislamiento: dos
  casos nuevos y la suite entera.
- **¿Toca el plano de decisión?** No.
- **¿Toca el ledger o la cadena de evidencia?** No.
- **¿Campo nuevo de evento u orden?** No.
- **¿Llamada a un modelo de lenguaje en runtime?** No.
- **¿Regla de negocio que el esquema no expresa?** **Sí, una**: `stale-version`, con `x-invariants` sobre
  cada operación protegida y su prueba `[invariant:stale-version]` (ADR-007). `witness-required` es forma del
  pedido y lo expresa el parámetro.
- **¿Sustantivo nuevo en el contrato?** «Testigo» entra al glosario con ADR-046; no es una entidad del
  dominio con vida propia.
- **¿Toca `src/`?** Sí: `domain/shared-kernel` (el error), `domain/merchant` (revisión y testigo),
  `application/configuration` y `application/merchant` (tres casos de uso), `interface-adapters/*/controllers`
  y `presenters`, `infrastructure/http/dispatch.ts` (la extensión). Dirección de dependencias intacta; `npm
run arch` lo verifica.

**Resultado: pasa, con un cambio de contrato que la marca `building` admite (FR-011)**, ya decidido con el
dueño el 2026-10-10. Re-evaluado después del diseño de la fase 1: igual.

## Project Structure

### Documentation (this feature)

```text
specs/043-el-testigo-de-concurrencia/
├── spec.md
├── plan.md                 # Este archivo
├── research.md             # Fase 0: nueve hallazgos
├── data-model.md           # Fase 1: el testigo de cada recurso, la revisión, el error, el orden
├── contracts/
│   └── testigo.md          # Fase 1: el cambio de contrato y lo que el servidor hace
├── quickstart.md           # Fase 1: cómo se verifica
└── tasks.md                # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
contracts/
├── openapi.yaml                                     info.version 1.15.0
├── problem-types.yaml                               stale-version (412), witness-required (428)
├── README.md                                        la fila de x-when-missing
├── components/parameters/If-Match.yaml              NUEVO
├── components/headers/ETag.yaml                     NUEVO
├── components/responses/{StaleVersion,WitnessRequired}.yaml   NUEVOS
└── paths/                                           cuatro protegidas; diez que declaran ETag
docs/adr/046-el-testigo-de-concurrencia.md           NUEVO
src/
├── domain/shared-kernel/errors.ts                   StaleVersion
├── domain/merchant/merchant.ts                      revision, witness(), el método que arma el siguiente
├── application/configuration/use-cases/
│   ├── publish-level.use-case.ts                    witness, en el orden de R-05
│   └── publish-merchant-configuration.use-case.ts   ídem
├── application/configuration/services/              merchantConfigurationWitness
├── application/merchant/use-cases/update-merchant-profile.use-case.ts   witness; idéntico no escribe
├── interface-adapters/http/boundary.ts              witnessOf(If-Match), etagOf(testigo)
├── interface-adapters/{configuration,merchant}/controllers/   If-Match y ETag
└── infrastructure/http/dispatch.ts                  validationFail mira x-when-missing
tests/ (ver el quickstart)
```

**Structure Decision**: la del repositorio, por anillos y módulos (ADR-013). Ningún módulo nuevo.

## Tramos

1. **El contrato** (pasos 0 a 3 de `contrato.md`): el catálogo, el parámetro con la extensión, el encabezado,
   las respuestas, las descripciones, `contract:check` (incompatible, aceptado por `building`) y
   `contract:types`. **No se commitea solo**: con `If-Match` requerido, toda prueba que publica sin él falla
   en el validador. Va con el tramo 3.
2. **El dominio** (US1, US2): `StaleVersion`, la revisión y el testigo del merchant, con sus pruebas y la de
   durabilidad. Se commitea solo: nada lo usa todavía.
3. **El borde y los casos de uso** (US1, US2, US3): `validationFail`, la lectura y la escritura del testigo,
   los tres casos de uso, las pruebas existentes que publican ganan su `If-Match`, las nuevas. Un commit con el
   tramo 1.
4. **El cierre**: ADR-046 aceptada, el glosario, la cadena de gates, el quickstart a mano, la spec construida.

## Complexity Tracking

Nada que justificar.
