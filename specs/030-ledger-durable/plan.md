# Implementation Plan: El ledger sobrevive a un reinicio

**Branch**: `030-ledger-durable` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/030-ledger-durable/spec.md`

## Summary

Los cinco puertos del ledger —decisiones, exposiciones, órdenes, corroboraciones y asignaciones— y el
del catálogo ganan una implementación sobre **SQLite**, con el esquema versionado en el repositorio y
el despliegue eligiendo tecnología. Los puertos no cambian de forma: el sistema ya está escrito contra
interfaces con canal de fallo.

**La decisión difícil no es la tecnología: es dónde cae la escritura.** El plano de decisión hoy
**espera** al registro, porque si el ledger no acepta la decisión degrada a `NO_OP` con motivo
(ADR-021, constitución IX). Volver durable el ledger pone una escritura a disco en el camino crítico,
y `01 §P9` separa los dos caminos. El plan decide **hacerla ahí y medirla**, con el argumento y el
número en `research.md` (R-01).

## Technical Context

**Language/Version**: TypeScript 7 sobre Node 24 (`.nvmrc`; subido desde 22 en T001), `strict`,
`erasableSyntaxOnly`, `exactOptionalPropertyTypes`, ESM.

**Primary Dependencies**: **ninguna nueva**. `node:sqlite` viene con Node; ver la pregunta abierta.

**Storage**: SQLite en archivo, en modo WAL. PostgreSQL es el motor de producción y queda para más
adelante con sus pruebas de concurrencia (**D-21**).

**Testing**: Vitest. El proyecto `fast` sigue en memoria; la durabilidad tiene su propia suite que
cruza reinicios (research R-06).

**Target Platform**: Node 24 en Linux y Windows. El archivo del almacén es local al proceso.

**Project Type**: servicio HTTP con arquitectura en anillos (ADR-013).

**Performance Goals**: el p95 del lote de ingesta con almacén durable **se mide y se reporta**; el
objetivo de diseño de `01 §4.6` son 150 ms para el camino crítico, marcado PROPUESTO y no SLA. El
número que salga es el que decide si «desacoplar la aceptación» sube de prioridad.

**Constraints**: un solo proceso contra el almacén. Sin I/O de red nueva. El lazo local sigue sin
depender de ningún servicio externo.

**Scale/Scope**: 6 gateways nuevos, 1 esquema versionado, 1 módulo de composición por cada módulo que
gana tecnología, 1 suite de durabilidad. Dos historias.

## Constitution Check

**Constitución v1.4.4.** Los **once** principios, también los que no aplican.

| Principio                                      | Veredicto                                | Por qué                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**               | ✅ sin impacto                           | Ninguna autoridad cambia. Se agrega una implementación detrás de puertos que ya existen.                                                                                                                                                                                                              |
| **II. Fail-closed: `NO_OP` por defecto**       | ✅ cumple                                | Un almacén que no acepta sigue degradando a `NO_OP` con motivo (ADR-021), y el arranque se niega ante un esquema inesperado.                                                                                                                                                                          |
| **III. La medición precede y no se contamina** | ✅ mejora                                | Hoy la medición se pierde en cada reinicio; después de esta feature, no.                                                                                                                                                                                                                              |
| **IV. Dos caminos, dos garantías**             | ⚠️ **aplica, y es la decisión del plan** | `01 §P9` quiere el camino de medición **asíncrono**; esta feature deja la escritura durable **en el camino síncrono**, porque desacoplarla permitiría intervenir sin haber registrado (principio IX). Se mide con la prueba de latencia que ya existe, y ese número decide cuándo llega el desacople. |
| **V. Aislamiento por merchant**                | ✅ cumple                                | Cada lectura sigue tomando el merchant; la suite de durabilidad lo prueba **cruzando el reinicio**, que es donde un índice mal puesto lo rompería.                                                                                                                                                    |
| **VI. Identidad e idempotencia explícitas**    | ✅ cumple                                | La idempotencia ya declarada tiene que valer **a través** de un reinicio (FR-005): es lo que la vuelve una garantía y no una caché.                                                                                                                                                                   |
| **VII. Comportamiento, no personas**           | ✅ cumple                                | El almacén guarda lo que el contrato ya admite; el ledger no gana campos por volverse durable (FR-011).                                                                                                                                                                                               |
| **VIII. Cero modelos de lenguaje en runtime**  | ✅ cumple                                | Ninguna llamada.                                                                                                                                                                                                                                                                                      |
| **IX. Nada entra al reporte sin trazabilidad** | ✅ **es el motivo**                      | Es el principio que impide desacoplar a la ligera: si se escribiera «a lo que salga», se podría intervenir sin registro.                                                                                                                                                                              |
| **X. Puertos en los dos bordes**               | ✅ cumple                                | Exactamente lo que el puerto de salida existía para permitir: una tecnología nueva sin que ningún consumidor cambie.                                                                                                                                                                                  |
| **XI. Ninguna política vive en el código**     | ✅ cumple                                | La ruta del archivo es entorno, no comportamiento: entra por la composición como el puerto o el host, no por los tres niveles.                                                                                                                                                                        |

### Gates explícitos del flujo

| Gate                                                   | Respuesta                                                                                                                                                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ¿Toca una superficie HTTP?                             | **No.** Ninguna operación cambia; `contracts/` no se toca y `check:api-map` lo confirma.                                                                                                                    |
| ¿Toca persistencia o API?                              | **Persistencia, y es la feature entera.** Las pruebas de aislamiento por merchant existen y se agregan las que cruzan el reinicio.                                                                          |
| ¿Toca el plano de decisión?                            | **Sí, y es el punto**: no introduce I/O de **red**, pero sí una escritura local bloqueante donde antes había memoria. Se mide con la prueba de latencia. Toda salida sigue pudiendo ser `NO_OP` con motivo. |
| ¿Toca el ledger o la cadena de evidencia?              | **Sí.** Cada estado se sigue registrando explícitamente y ahora además **es reconstruible después de un reinicio**, que es lo que «auditable» quería decir.                                                 |
| ¿Introduce un campo nuevo de evento u orden?           | No. El almacén guarda lo que ya existe.                                                                                                                                                                     |
| ¿Introduce una llamada a un modelo en runtime?         | No.                                                                                                                                                                                                         |
| ¿Introduce una regla que el esquema no puede expresar? | No; las invariantes del dominio siguen donde están.                                                                                                                                                         |
| ¿Introduce un sustantivo nuevo en el contrato?         | **No toca el contrato.** «Migración» y «almacén» son vocabulario interno.                                                                                                                                   |
| ¿Toca `src/`?                                          | **Sí**: gateways nuevos en el anillo de adaptadores y su cableado en composición. La dirección de dependencias no cambia y `npm run arch` es el gate.                                                       |

### La decisión que el plan no podía cerrar solo, y quién la cerró

`node:sqlite` existe en Node 22 pero emite `ExperimentalWarning` en cada arranque; en **Node 24** es
estable. **Decisión del dueño (2026-09-26): el repositorio sube a Node 24 LTS.** Así la feature no
agrega ninguna dependencia y no hay advertencia, y es consistente con la política de versiones del
repositorio —última versión, parchear antes que degradar— y con la constitución, que pide «Node.js
LTS» sin fijar el número.

**Lo que eso implica, y no es gratis**: tocar `.nvmrc`, `engines` y, por lo tanto, la versión con la
que CI corre **toda** la cadena. Si algo del stack se queja —el compilador nativo de TypeScript, el
runner de Vitest con su parche, Stryker— aparece ahí.

Por eso el salto va **primero y solo**, antes de cualquier código de SQLite: si rompe algo, rompe algo
que no tiene nada que ver con esta feature, y conviene saberlo con el diff más chico posible.

**Lo que era una limitación de este entorno, y dejó de serlo** (2026-09-26): la máquina corría Node 22
y `nvm use` no tomaba efecto —`C:\Program Files\nodejs` era un directorio real del instalador MSI, que
`nvm` no puede reemplazar por su enlace—. El dueño desinstaló el MSI y activó 24.21.0, así que la
cadena entera **se corrió acá** (T002) y no quedó librada a CI.

## Project Structure

### Documentation (this feature)

```text
specs/030-ledger-durable/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/
```

### Source Code (repository root)

```text
src/
├── infrastructure/sqlite/          # el driver y la apertura del archivo: la única que toca node:sqlite
├── interface-adapters/ledger/gateways/        # decisiones y exposiciones
├── interface-adapters/outcomes/gateways/      # órdenes y corroboraciones
├── interface-adapters/experiment/gateways/    # asignaciones
├── interface-adapters/catalog/gateways/       # la instantánea y sus recibos
└── composition/
    ├── modules/{ledger,outcomes,experiment,catalog}.ts   # cada uno declara su segunda tecnología
    ├── deployments/local.ts                              # elige, y no compila si no elige
    └── sqlite-config.ts                                  # la ruta del archivo, desde el entorno

migrations/            # el esquema versionado, revisable en una PR

tests/durability/      # la suite que cruza reinicios
```

**Structure Decision**: el driver vive en `infrastructure/`, que es el anillo que la regla reserva
para «lo que hospeda o provee tecnología»; los gateways viven con su módulo, como los de memoria. Un
gateway no importa npm ni `node:` de driver: lo recibe (regla de forma `port-implementations-only-in-bind`).

## Complexity Tracking

| Violación                                                          | Por qué hace falta                                                                                                                                          | Alternativa más simple, y por qué se rechaza                                                                                                                                                            |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Escritura bloqueante en el camino crítico (principio IV, `01 §P9`) | El registro no es un efecto colateral: si no se acepta, la decisión degrada a `NO_OP`. Desacoplarlo sin diseño permitiría intervenir sin trazabilidad (IX). | Desacoplar ahora con una cola: es una feature entera —qué significa «aceptado» sin estar escrito, cómo se reconcilia— y mezclarla acá dejaría a la cadena de gates sin poder distinguir qué rompió qué. |
