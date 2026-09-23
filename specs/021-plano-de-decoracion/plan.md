# Implementation Plan: Plano de decoración

**Branch**: `021-plano-de-decoracion` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-plano-de-decoracion/spec.md`

## Summary

La elección entre registrar y auditar deja de tomarse a mano en los 29 handlers y pasa a derivarse
del contrato, que es de donde ya salía: `contract:types` genera una cuarta salida —qué operaciones
el contrato manda auditar, cruzando el consumidor del tag con `x-required-capabilities`— y la
biblioteca del grafo aplica los decoradores al construir lo que un módulo sirve. Un handler declara
**qué caso de uso resuelve la operación** y **qué controller la traduce**, nada más.

Sobre eso entran las otras tres garantías: una operación que el contrato manda auditar servida por
un caso de uso que no puede auditarse **no compila** (R-03); una acción administrativa se verifica
contra el registro **antes** de ejecutarse y responde `503` sin haber ocurrido si el registro no
acepta escrituras (ADR-034, enmienda del 2026-09-23); y el resultado `denied` lo declara el error
que deniega, no una comparación de texto en el kernel.

Cero diff del contrato: los catorce paths de administración ya declaran `503` y el slug ya está en
el catálogo. **Verificado.**

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) para `build` y `typecheck`; API 6.0
(`@typescript/typescript6`) para el tooling que todavía no admite ≥ 7.1 (ADR-017). `strict`,
`erasableSyntaxOnly`, `exactOptionalPropertyTypes`, sin `any`.

**Primary Dependencies**: ninguna nueva. Fastify + openapi-backend (hospedaje), pino (logging),
openapi-typescript (generación de tipos) — todas ya presentes.

**Storage**: en memoria, como hoy. Esta feature no toca persistencia; la ventana que deja abierta
(R-06) se cierra con el hito `persistence-and-resilience`.

**Testing**: Vitest (proyectos `fast` y `tools`), fixtures de tipos bajo `tests/typecheck/fixtures/`,
Schemathesis para el contrato, Stryker para mutación.

**Target Platform**: Node 22, servidor HTTP único.

**Project Type**: servicio backend con arquitectura en anillos (ADR-013) y grafo de composición
tipado (ADR-033).

**Performance Goals**: sin cambio. La decoración es la misma que hoy, aplicada en otro lugar; la
verificación previa del registro (FR-009) agrega una llamada a un almacén en memoria **sólo** en
las diez operaciones administrativas de escritura, y ninguna está en el camino crítico de decisión.

**Constraints**: cero diff del contrato (FR-014); cero cambios en logs, entradas del registro y
códigos de error existentes (FR-015); sin I/O de red ni escritura bloqueante en el camino crítico
de decisión (constitución); `Lint exceptions: 0`.

**Un límite que el diseño roza**: el lint admite **≤ 4 parámetros** por función, y la forma de
declarar una operación —lo que necesita, el caso de uso, el controller y las lecturas de la
auditoría— son exactamente cuatro. No hay margen para un quinto: si el diseño necesita uno más,
agrupar en un objeto con nombres, como hizo la 020 cuando el mismo límite la obligó a cambiar las
dependencias posicionales por un registro (y salió mejor).

**Scale/Scope**: 29 operaciones servidas en 14 módulos de composición; 10 auditadas; 3 casos de uso
de semilla fuera del contrato; 1 biblioteca de grafo; 1 generador de tipos.

## Constitution Check

_Constitución v1.4.2. Se evalúan los once principios._

| Principio                                        | Evaluación                                                                                                                                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**                 | **Refuerza.** La preocupación transversal deja el composition root y deja de mezclarse con el cableado de cada módulo. `UseCaseDecorators` —una bolsa de funciones declarada en `composition/`— desaparece. |
| **II. Fail-closed: `NO_OP` por defecto**         | **Refuerza.** Una acción administrativa que no se puede auditar no ocurre y lo dice (`503`), en vez de completarse en silencio. No introduce ningún camino que asuma éxito.                                 |
| **III. La medición precede y no se contamina**   | **Sin efecto.** No toca asignación, experimentos ni la terna de configuración que cada decisión estampa.                                                                                                    |
| **IV. Dos caminos, dos garantías**               | **Sin efecto.** El camino crítico de decisión no se toca: la verificación previa afecta sólo a las diez escrituras administrativas.                                                                         |
| **V. Aislamiento por merchant**                  | **Sin efecto.** El `merchantId` sigue derivándose de la credencial y apareciendo en ruta sólo bajo `admin`. La entrada del registro lo sigue tomando de donde lo toma hoy.                                  |
| **VI. Identidad e idempotencia explícitas**      | **Sin efecto.** No toca claves de idempotencia ni acuñación de identificadores.                                                                                                                             |
| **VII. OPE observa comportamiento, no personas** | **Sin efecto y vigilado.** El log sigue sin llevar el request; la entrada del registro sigue llevando un identificador de operador y nunca un dato personal.                                                |
| **VIII. Cero modelos de lenguaje en runtime**    | **Sin efecto.**                                                                                                                                                                                             |
| **IX. Nada entra al reporte sin trazabilidad**   | **Refuerza.** Cierra el caso en que una acción administrativa quedaba sin entrada.                                                                                                                          |
| **X. Puertos en los dos bordes**                 | **Sin efecto.** No agrega ni quita puertos de plataforma. `AuditTrail` sigue siendo el puerto angosto del kernel.                                                                                           |
| **XI. Ninguna política vive en el código**       | **Sin efecto y verificado.** No introduce ninguna constante de comportamiento; `check:behaviour-constants` es el juez. Qué se audita no es una política configurable: es lo que el contrato declara.        |

**Gate de superficie HTTP**: no hay cambio de contrato (FR-014). No aplica versión mayor ni prefijo.

**Gate del flujo**: spec ✅ → plan (este documento) → tareas → implementación. La feature no entra
sin las dos primeras.

**Resultado del gate**: **pasa**, antes de la fase 0 y re-evaluado después de la fase 1. Ninguna
violación que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/021-plano-de-decoracion/
├── spec.md                      # Qué y por qué (ya escrita)
├── plan.md                      # Este archivo
├── research.md                  # Fase 0: R-01 … R-10, con lo medido y lo descartado
├── data-model.md                # Fase 1: el modelo de la declaración y de la derivación
├── quickstart.md                # Fase 1: cómo se verifica que quedó bien
├── contracts/
│   └── serving-an-operation.md  # Fase 1: la API con la que un módulo declara lo que sirve
├── checklists/requirements.md   # Calidad de la spec (ya escrita)
└── tasks.md                     # Fase 2 (/speckit-tasks; NO lo crea este comando)
```

### Source Code (repository root)

Lo que esta feature toca, y nada más:

```text
scripts/
├── contract-types.mjs                    # + la cuarta salida generada
└── contract-audited-operations-lib.mjs   # NUEVO: deriva del bundle qué se audita

generated/
└── audited-operations.d.ts               # NUEVO, derivado; nunca editado a mano

src/
├── interface-adapters/http/
│   └── typed.ts                          # reexporta el tipo generado, como hace con `operations`
├── composition/
│   ├── graph/
│   │   ├── module.ts                     # `handler()` → la forma nueva; aplica los decoradores
│   │   └── compose.ts                    # resuelve lo que la decoración necesita
│   └── modules/
│       ├── shared-kernel.ts              # se retira `UseCaseDecorators` y `DecoratorsPort`
│       └── *.ts (13 módulos)             # los 29 handlers, convertidos
├── application/shared-kernel/decorators/
│   ├── logged-use-case.ts                # sin cambios
│   └── audited-use-case.ts               # verificación previa; deja de comparar texto
└── domain/operator/errors.ts             # `MerchantOutOfScope` declara que deniega

tests/
├── typecheck/fixtures/                   # + el fixture de US2
├── integration/                          # + el 503 con el registro caído (crear, rotar, cambiar)
└── unit/composition/graph.test.ts        # la derivación y el orden de la verificación
```

**Fuera de alcance del árbol**: `contracts/` no cambia (FR-014), `src/infrastructure/` no cambia,
y ningún otro módulo de dominio se toca.

## Complexity Tracking

Ninguna violación del Constitution Check que justificar. Dos cosas que sí conviene anotar porque
agregan superficie y se aceptan con motivo:

| Qué agrega                                                       | Por qué se acepta                                                                                                                                                | Alternativa descartada                                                                                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Una cuarta salida generada (`generated/audited-operations.d.ts`) | Es la única forma de que el compilador aplique una regla que hoy vive en YAML. Usa el mecanismo que el repositorio ya tiene tres veces, con su chequeo de drift. | Una réplica escrita a mano (es exactamente lo que la feature elimina) o leer el contrato en ejecución (deja la garantía fuera de compilación, FR-007). |
| Un miembro más en un error de dominio (el resultado que declara) | Pone la clasificación en el dueño del vocabulario y saca la comparación por texto del kernel, que no puede tipar ese código.                                     | Que `admin` mapee código → resultado: queda un mapa que mantener y una decisión del error tomada en un gateway.                                        |

## Phase 0 — Research

Completa en [research.md](./research.md). Diez preguntas; las tres que más cambiaron el plan:

- **R-02 cerró un Edge Case abierto en la spec**: los 29 handlers tienen **exactamente un** caso de
  uso (26 con `new`, 3 desde `RotateCredentialPort`). La forma no necesita escotilla, que era el
  riesgo real: una escotilla para el caso raro habría devuelto la elección manual por la ventana.
- **R-03 corrigió qué demuestra el fixture de US2**: si la elección se deriva, no hay nada que
  olvidar. Lo que queda enforzable —y es el error real— es servir una operación que el contrato
  manda auditar con un caso de uso cuyo request no lleva operador.
- **R-01 fijó el mecanismo**: generar el vocabulario desde el contrato, no replicarlo.

## Phase 1 — Design & Contracts

- **[data-model.md](./data-model.md)** — qué es una operación servida, qué declara un módulo, cómo
  se deriva la decoración y qué invariantes tiene cada cosa.
- **[contracts/serving-an-operation.md](./contracts/serving-an-operation.md)** — la API con la que
  un módulo declara lo que sirve, con las firmas y los mensajes de error que el compilador emite.
- **[quickstart.md](./quickstart.md)** — cómo se verifica, comando por comando, que las cuatro
  garantías están en pie.

**Constitution Check, re-evaluado después del diseño**: **pasa**. El diseño no agrega puertos de
plataforma, no mueve reglas de negocio de anillo, no introduce constantes de comportamiento y no
toca el camino crítico de decisión. El único anillo que cambia de forma es `composition/`, que es
donde la feature vive.

## Orden sugerido de implementación

Las tres historias P1 comparten el mismo código, así que el orden es por dependencia y no por
prioridad:

1. **La derivación** (R-01): el generador, la salida generada, su reexporte y el chequeo de drift.
   Sin esto no hay nada que el compilador pueda aplicar. Verificable solo: `contract:types:check`
   en verde y el tipo nombra las diez operaciones esperadas.
2. **La forma nueva** (US1) y la conversión de los 29 handlers. El juez es la suite existente sin
   tocar una aserción.
3. **El fixture de tipos** (US2), que sólo puede escribirse cuando la forma existe.
4. **La verificación previa** (US3), con sus pruebas de integración.
5. **El `denied` declarado** (US4) y el retiro de `UseCaseDecorators`.
6. **Documentación**: ADR (nuevo o enmienda de ADR-023/ADR-033 — lo decide quien implemente con la
   evidencia del diseño en la mano), `CLAUDE.md`, y los README que correspondan.
