# Implementation Plan: Grafo de composición tipado y seguridad con dueño

**Branch**: `020-grafo-de-composicion` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-grafo-de-composicion/spec.md`

## Summary

Seis historias sobre `src/composition/`, sin un solo cambio de comportamiento observable. El
cableado deja de ser tres listas paralelas escritas a mano —la intersección de puertos
(`ports.ts`), la lista de módulos (`modules/index.ts`) y el spread ordenado del perfil— y pasa a
ser **un grafo tipado**: un puerto es una constante que su módulo dueño declara una vez y los demás
importan; cada enlace declara de qué depende; el despliegue no compila si falta un proveedor
(`Missing<"clock">`), si una tabla de tecnología no sirve uno de sus puertos
(`TechnologiesDisagree<…>`), si una instancia no satisface todas sus vistas o si una
operación del contrato se queda sin handler (`Unwired<"getMerchant">`). Los cuatro mensajes están
**probados con el compilador del repositorio** antes de escribir este plan (research R-04). La
resolución es perezosa y memorizada —una instancia por arranque, sin nada global ni estático— y un
ciclo falla al arrancar nombrándolo.

Sobre ese grafo, lo demás es consecuencia: un módulo exporta tres cosas y el mapa de contextos
empieza a regir entre módulos de composición (posible **porque** consumir algo de otro módulo pasó a
ser un `import`); dos gates nuevos impiden que una abstracción quede sin enlace y que una
implementación de puerto se construya fuera del grafo; la seguridad gana dueño en un módulo nuevo,
`access`, con los tres esquemas, sus resolvedores y las políticas de firma; la composición deja de
decidir comportamiento (`composition/adapters/` desaparece, las políticas anónimas pasan a gateways
con nombre, el nombre de la operación viaja una sola vez); y la auditoría pasa a ser una obligación
de plataforma —un puerto de escritura en el kernel— para que ningún módulo importe `admin` para
auditar.

Detalle y evidencia en [research.md](./research.md) (R-01..R-17), [data-model.md](./data-model.md) y
[contracts/](./contracts/). ADR nuevos: **ADR-033** (grafo de composición tipado, enmienda a
ADR-013) y **ADR-034** (dueño del acceso y auditoría como obligación de plataforma).

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) para `build`/`typecheck`; API 6.0 para las
herramientas (ADR-017). Node ≥ 22, ESM. Gates nuevos en JavaScript ESM con `checkJs` y JSDoc
(ADR-012). Documentación en español, código en inglés (ADR-015).

**Primary Dependencies**: **ninguna nueva**. La biblioteca del grafo es código propio (~140 líneas
en `src/composition/graph/`). Se siguen usando Vitest, ESLint (+ el plugin `ope/*`),
dependency-cruiser, Stryker, Ajv y Fastify + openapi-backend tal como están.

**Storage**: N/A. Los mismos gateways en memoria; la persistencia sigue siendo una tabla futura.

**Testing**: Vitest proyecto `fast` (unitarias, integración por `fastify.inject`, arquitectura,
forma, gobernanza) y `tools` (cadena de calidad, auditoría sobre fixtures, documentación). Los
cuatro "no compila" entran como fixtures de `tests/typecheck/` (mecanismo existente: tsconfig
temporal + código de error afirmado). Al cierre: Schemathesis (`test:contract`), `release-check`,
`test:mutation`.

**Target Platform**: el mismo servicio Node de instancia única. El grafo se resuelve **una vez al
arrancar**; ninguna resolución ocurre por request.

**Project Type**: refactor estructural del composition root de un backend existente, con dos gates
nuevos y un módulo nuevo en los anillos de aplicación y adaptadores.

**Performance Goals**: sin efecto sobre el plano de decisión (constitución IV): el grafo no entra al
camino crítico. El arranque suma una resolución topológica de ~50 componentes; `sharedTestApp`
conserva su optimización (el servidor se construye una vez por archivo, R-09).

**Constraints**: cero cambios observables —contrato, mapa del contrato, respuestas, códigos,
headers, logs y entradas del registro idénticos, ninguna aserción de comportamiento modificada
(FR-026)—; cero excepciones nuevas de lint, idioma, arquitectura, duplicación, código muerto o
mutación (FR-027); `erasableSyntaxOnly`, sin `any`, sin `!`; un solo cast documentado dentro de la
biblioteca del grafo; commits en español, uno por historia; sin push ni merge sin el dueño.

**Scale/Scope**: 14 módulos de composición (13 de hoy + `access`); ~50 puertos declarados; 25
operaciones del contrato; 5 archivos nuevos de biblioteca y 4 borrados (`ports.ts`, `profile.ts`,
`wiring.ts`, `modules/index.ts`) más `composition/adapters/`; 1 gate nuevo + 1 regla de forma nueva,
cada uno con fixture; ~11 archivos que se mudan a `access`; 49 llamadas y 27 lecturas del helper de
pruebas migradas mecánicamente; 2 ADR.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Evaluados los once principios de la constitución **v1.4.2**.

| Gate                                       | ¿Aplica? | Cómo se cumple                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Separación de autoridades               | **Sí**   | El composition root sigue siendo único y se refuerza: ningún módulo instancia sus dependencias de infraestructura fuera de su `bind`, y el plano de decisión deja de heredar los slices de cuatro módulos para pedir **servicios construidos** (FR-010). `npm run arch` pasa a juzgar también los módulos de composición (R-13). |
| II. Fail-closed                            | **Sí**   | La verificación de cobertura de operaciones al arrancar **se conserva** (protege del contrato que el proceso carga) y se le suma la de compilación (R-06). Un ciclo o un puerto sin proveedor detienen el arranque; nada degrada en silencio. Ningún motivo de `NO_OP` cambia.                                                   |
| III. La medición precede y no se contamina | No       | Asignación, ledger, brazos y estampado de versiones intactos. El experimento no se toca.                                                                                                                                                                                                                                         |
| IV. Dos caminos, dos garantías             | **Sí**   | El grafo se resuelve al arrancar; cero I/O y cero resolución en el camino crítico. La memorización sustituye cierres `??=` sin cambiar cuándo se construye nada.                                                                                                                                                                 |
| V. Aislamiento por merchant                | **Sí**   | `merchantId` sigue derivándose de la credencial; `access` no cambia ningún resolvedor, sólo su domicilio. Las pruebas de contaminación cruzada existentes corren **sin tocarse** y son parte del criterio de cierre; no hay superficie nueva que exija pruebas nuevas.                                                           |
| VI. Identidad explícita, idempotencia      | No       | Ninguna identidad ni clave de idempotencia cambia.                                                                                                                                                                                                                                                                               |
| VII. Comportamiento, no personas           | No       | Ningún esquema de evento, orden o log cambia. Los logs siguen sin IP, headers ni cuerpo.                                                                                                                                                                                                                                         |
| VIII. Cero LLM en runtime                  | No       | Sin modelos en ningún camino.                                                                                                                                                                                                                                                                                                    |
| IX. Nada entra al reporte sin trazabilidad | **Sí**   | El registro de administración conserva **cada campo**; lo que cambia es quién declara el puerto de escritura (el kernel) y quién lo implementa (`admin`). Una prueba afirma la igualdad campo por campo de las entradas (FR-024, SC-007).                                                                                        |
| X. Puertos en los dos bordes               | **Sí**   | Se refuerza: agregar una tecnología (Postgres) pasa a ser una tabla junto a la de memoria y una línea del despliegue, sin tocar ningún consumidor. El puerto de plataforma y sus cuatro operaciones no cambian.                                                                                                                  |
| XI. Ninguna política vive en el código     | **Sí**   | Se extiende un nivel hacia arriba: ninguna regla de negocio queda en el root (`composition/adapters/` desaparece), toda implementación de política del nivel 1 pasa a un gateway con nombre, y el tope compartido de memoria queda **decidido y nombrado** (`identityCap()`), sin agregar constantes (R-15).                     |
| Superficie HTTP / mapa del contrato        | **Sí**   | No se toca `contracts/`: `contract:diff` y `check:api-map` deben dar **cero diff**. Es criterio de aceptación (SC-007), no un efecto colateral.                                                                                                                                                                                  |
| Persistencia o API → aislamiento           | **Sí**   | Ver principio V: las pruebas existentes son el juez; ninguna se modifica.                                                                                                                                                                                                                                                        |
| Plano de decisión                          | **Sí**   | Sin I/O ni escritura bloqueante nuevas; toda salida sigue pudiendo ser `NO_OP` con motivo.                                                                                                                                                                                                                                       |
| Ledger / cadena de evidencia               | No       | Sin cambios de estados ni de registro.                                                                                                                                                                                                                                                                                           |
| Campo nuevo de evento u orden              | No       | Ninguno.                                                                                                                                                                                                                                                                                                                         |
| LLM en runtime                             | No       | No.                                                                                                                                                                                                                                                                                                                              |
| Regla que el esquema no expresa            | No       | Ninguna `x-invariants` nueva: la feature no toca el contrato.                                                                                                                                                                                                                                                                    |
| Sustantivo nuevo en el contrato            | No       | Ninguno; `access` es un módulo del código, no un sustantivo del contrato (no entra al glosario, ADR-008).                                                                                                                                                                                                                        |
| Capas y dirección de dependencias          | **Sí**   | `npm run arch` en verde con reglas **más** estrictas (mapa de contextos sobre composición, R-13) y sin excepciones nuevas.                                                                                                                                                                                                       |
| Decisión transversal → ADR                 | **Sí**   | ADR-033 (grafo, enmienda a ADR-013) y ADR-034 (dueño del acceso, auditoría en el kernel, tope compartido). `check:adrs` y `check:identifiers` en verde.                                                                                                                                                                          |

**Resultado**: sin violaciones. La complejidad que la feature agrega está acotada y justificada
abajo.

## Project Structure

### Documentation (this feature)

```text
specs/020-grafo-de-composicion/
├── plan.md              # este archivo
├── research.md          # R-01..R-17 (Phase 0)
├── data-model.md        # las siete entidades del grafo (Phase 1)
├── quickstart.md        # cómo se valida, paso a paso (Phase 1)
├── contracts/
│   ├── composition-graph.md   # la API que un módulo de composición respeta
│   └── ports-bound-gate.md    # el gate nuevo y la regla de forma nueva
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/composition/
├── graph/                     # NUEVO — la biblioteca (nada de dominio acá)
│   ├── port.ts                # Port, port(), AnyPort, Closable
│   ├── binding.ts             # bind(), bindAll(), Binding
│   ├── module.ts              # compositionModule() (provides/assembles/serves), handler(), uses()
│   ├── compose.ts             # deployment(), instantiate(), Missing/Unwired
│   └── index.ts
├── modules/                   # 14 módulos: cada uno provides / assembles / serves
│   ├── access.ts              # NUEVO — los tres esquemas, resolvedores y políticas de firma
│   ├── admin.ts  barrier.ts  catalog.ts  configuration.ts  decision.ts  experiment.ts
│   ├── ingestion.ts  ledger.ts  merchant.ts  outcomes.ts  shared-kernel.ts  system.ts
│   └── (audited.ts y index.ts desaparecen)
├── deployments/local.ts       # reemplaza profiles/local.ts: la única lista
├── bootstrap.ts  config.ts  *-config.ts  coverage.ts  lifecycle.ts  start.ts  env.ts
└── (adapters/, ports.ts, profile.ts, wiring.ts: borrados)

src/application/
├── access/                    # NUEVO — services/ (cuatro resolvedores), ports/, index.ts
├── shared-kernel/
│   ├── ports/audit-trail.ts        # NUEVO — el puerto de escritura angosto
│   └── decorators/audited.use-case.ts  # se muda desde application/admin/
├── admin/                     # conserva AdminEntry, AdminLog y las dos lecturas
└── merchant/                  # conserva el agregado, su administración y sus puertos

src/interface-adapters/
├── access/                    # NUEVO — security/ (tres handlers), gateways/, index.ts
├── admin/gateways/audit-trail.ts   # NUEVO — implementa el puerto del kernel
└── <módulo>/gateways/…        # las políticas del nivel 1, con nombre (R-12)

scripts/
├── check-ports-bound.mjs      # NUEVO — gate
├── audit/gate-ports-bound.mjs # NUEVO — adaptador findings-v1
├── shape-rules.mjs            # + regla port-implementations-only-in-bind
└── quality.mjs                # + el gate en la cadena

tests/
├── typecheck/fixtures/        # cuatro fixtures "no compila" (+ el de hoy, reescrito)
├── architecture/fixtures/     # fixture del mapa de contextos en composición y de la regla nueva
├── audit/fixtures/            # fixture del gate nuevo
└── unit/composition/          # graph/ (biblioteca) reemplaza wiring/profile
```

**Structure Decision**: se conservan los cinco anillos y el composition root único de ADR-013. Lo
único que cambia de estructura es (a) `composition/graph/` como biblioteca sin conocimiento de
ningún módulo, (b) `composition/deployments/` en lugar de `composition/profiles/` —un despliegue es
una lista, no una función que compone tablas—, (c) el módulo `access` en los anillos de aplicación y
adaptadores, y (d) la desaparición de `composition/adapters/`.

## Complexity Tracking

| Violación / complejidad agregada                                                   | Por qué se necesita                                                                                                                                         | Alternativa más simple, y por qué se descarta                                                                                                                    |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Maquinaria de tipos (`Missing`, `Unwired`, `TechnologiesDisagree`, tipos fantasma) | Es **lo que compra la feature**: sin requisitos en el tipo, el olvido sigue apareciendo como `undefined` en ejecución (SC-003).                             | Verificar al arrancar (lo de hoy): no impide escribir mal el despliegue, sólo lo detecta cuando el proceso corre, y no cubre las pruebas que no arrancan la app. |
| Mensajes de error del compilador largos                                            | Efecto inevitable de llevar la cobertura al tipo.                                                                                                           | Se mitiga con alias con nombre (`Missing<…>` aparece literal en el mensaje, probado) y con fixtures de tipo que fijan el texto esperado.                         |
| Un módulo más (`access`) y una entrada más en `CONTEXT_MAP`                        | La seguridad tenía tres dueños parciales; el módulo de merchants tenía dos motivos de cambio (SRP).                                                         | Dejar la seguridad repartida: es justo el defecto que la historia 4 cierra.                                                                                      |
| Un gate más en la cadena de calidad (`check:ports-bound`)                          | Hoy nadie verifica que una abstracción declarada esté enlazada; knip sólo informa tipos sin uso.                                                            | Confiar en la revisión: la spec lo rechaza explícitamente (FR-014, "no depende de la disciplina de quien escribió el módulo").                                   |
| Un cast dentro de la biblioteca (`build as (...a: unknown[]) => unknown`)          | El borde entre una lista heterogénea de enlaces y sus builders tipados; `bind` ya verificó los parámetros.                                                  | Sin cast haría falta `any` (prohibido) o una unión gigante. Queda **uno**, comentado, en un archivo de ~30 líneas y cubierto por las pruebas de la biblioteca.   |
| El tope de memoria compartido se resuelve con decisión, no con campo nuevo         | El nivel de plataforma se **publica** por el contrato con `additionalProperties: false`; un campo nuevo sería diff del contrato y SC-007 exige cero (R-15). | Agregar `sessionCap`/`visitorCap`: rompe el criterio de aceptación de esta misma feature. Queda nombrado (`identityCap()`) y registrado en ADR-034.              |

### Desviación declarada respecto de la spec

- **FR-018** dice que el módulo de merchants no debe declarar "políticas de firma o rotación". Las
  de **firma** se van enteras a `access`. La **gracia de rotación** (`RotationPolicy`) se queda
  declarada como puerto de `application/merchant` —la consume `RotateCredentialUseCase`, que
  administra el agregado— y es `access` quien **provee su implementación**: así
  `composition/modules/merchant.ts` no declara ninguna política de firma ni de rotación, que es lo
  que la historia persigue, y se evita el ciclo `merchant → access → merchant` que la alternativa
  produce (R-10). Es el idioma que el repositorio ya usa con `configuration`.

## Phase 0: Outline & Research

**Estado**: completa. `research.md` resuelve las cuatro decisiones que la spec delegó al plan —el
nombre del módulo de seguridad (`access`, R-10), la forma de la biblioteca (R-03..R-08), el destino
de cada implementación de política (R-10, R-12) y el tope compartido (R-15)— y no deja ningún
`NEEDS CLARIFICATION`.

La decisión central (§ R-04) **no se tomó sobre el papel**: se escribió un spike y se compiló con el
compilador del repositorio bajo las mismas banderas que `tsconfig.json`. El caso completo compila;
los cuatro incompletos fallan nombrando lo que falta; el runtime comprobó identidad de vista
derivada, una sola construcción por arranque y el ciclo nombrándose.

## Phase 1: Design & Contracts

**Estado**: completa.

- [data-model.md](./data-model.md) — las siete entidades del grafo (componente, puerto, enlace,
  vista derivada, tabla por tecnología, módulo, despliegue), sus invariantes y sus reglas de
  transición, más el mapa de lo que se mueve entre módulos.
- [contracts/composition-graph.md](./contracts/composition-graph.md) — la API que un módulo de
  composición respeta, con las firmas exactas y los cuatro errores de compilación esperados.
- [contracts/ports-bound-gate.md](./contracts/ports-bound-gate.md) — el contrato del gate nuevo
  (entrada, regla, salida `findings-v1`, fixture) y el de la regla de forma nueva.
- [quickstart.md](./quickstart.md) — cómo se valida, comando por comando, y qué tiene que dar cada
  uno.

**Contrato HTTP**: sin cambios. `contracts/` no se toca en esta feature; `contract:check` corre
igual y su exigencia es **cero diff**.

**Re-evaluación del Constitution Check después del diseño**: sin cambios. El diseño no introdujo
ninguna violación nueva; las dos decisiones que rozaban un principio —el tope compartido (XI) y la
pérdida de tipado en el borde de la auditoría (IX)— quedaron acotadas, con fundamento escrito y con
prueba que las cubre.
