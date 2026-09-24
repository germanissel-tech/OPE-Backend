# OPE-Backend — instrucciones para agentes

Backend del MVP de OPE (Zona B). Se construye de cero; la POC no es base de código.
Idioma (ADR-015): documentación, specs, ADRs, glosario y commits en **español**. Código, comentarios,
strings, mensajes de error y de log, contrato OpenAPI (descripciones, catálogos, mensajes de reglas),
configuraciones y CI en **inglés**; `npm run check:language` lo hace cumplir. Excepción en línea:
`// lang:es -- motivo` (sin motivo falla; se cuentan, objetivo `Language exceptions: 0`).

## Fuentes de verdad, en este orden

1. `.specify/memory/constitution.md` — principios y gates. Prevalece sobre todo lo demás.
2. Documentos del MVP (fuera del repo, en `../`): `01-arquitectura-mvp.md`,
   `02-integracion-ecommerce.md`, `03-alcance-mvp.md`. Si no podés leerlos, la sesión se lanzó
   sin `--add-dir ..`; pedilo antes de asumir.
3. `specs/NNN-*/` — spec, plan y tareas de cada feature.
4. `contracts/openapi.yaml` — única fuente de verdad de toda superficie HTTP.

## Flujo de trabajo (inamovible)

`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
Nada se implementa sin spec ni plan. El plan debe pasar el Constitution Check, que **evalúa los
once principios y cita la versión de la constitución** — los once, también los que no aplican, que
se marcan como tales.

Dentro de una feature que toca HTTP hay un orden de seis pasos que empieza en el mapa del
contrato y termina en la cadena de gates. Está en `.claude/rules/contrato.md`, que llega cuando
tocás `contracts/`.

### Comandos

El lazo de una historia: `npm run format:check`, `npm run quality`, `npm run typecheck`, `npm test`.
Antes de cerrar la feature se agregan `npm run contract:check`, `npm run test:mutation`,
`npm run test:contract` y `npm run release-check`.

| Comando                           | Qué hace                                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm test`                        | Vitest, proyecto `fast`: unitarias, integración, contrato, gobernanza, arquitectura                       |
| `npm run test:tools`              | Proyecto `tools`: auditoría, cadena de calidad, documentación. Sólo cuando el cambio toca una herramienta |
| `npm run test:all`                | Los dos proyectos, como CI                                                                                |
| `npm run build`                   | `tsc` a `dist/`                                                                                           |
| `npm run dev`                     | El servidor real en memoria, sin mock (ADR-018)                                                           |
| `npm run arch`                    | dependency-cruiser sobre `src/`: anillos, módulos y composición (ADR-013)                                 |
| `npm run format` / `format:check` | Prettier sobre todo / falla si algo difiere del formato canónico (ADR-011)                                |
| `npm run lint:fix`                | Arregla lo que el lint puede arreglar solo                                                                |
| `npm run release-check`           | `contract:check` más los marcadores en modo estricto: la puerta antes de publicar                         |

**Qué hace cada uno de los demás está en el inventario de `scripts/`**, que su propia prueba
verifica fila por fila. No se copia acá: tenerlo en dos lugares fue lo que esta partición vino a
sacar.

### Tipado (ADR-011, ADR-012, ADR-017; verificado por `lint` y `typecheck`)

- Compilador: TypeScript 7 (`@typescript/native`) ejecuta `build` y `typecheck`; `typescript` es
  el alias de `@typescript/typescript6` (API 6.0) que importan typescript-eslint,
  openapi-typescript y dependency-cruiser, hasta que admitan la API ≥ 7.1 (ADR-017).

- Sin `any` explícito ni valores `any` (`no-unsafe-*`), sin `!`, promesas siempre manejadas,
  `switch` exhaustivo, imports de tipo con `type`. El borde con una librería que expone `any`
  se lee como `unknown` y se estrecha (ver `infrastructure/http/dispatch.ts`, `tests/helpers/json.ts`).
- Una excepción va **en la línea**, con motivo: `// eslint-disable-next-line <regla> -- <motivo>`.
  Sin motivo o sin uso, falla. Objetivo permanente: `Lint exceptions: 0`.
- Scripts JavaScript (`scripts/`, `contracts/rules/functions/`) se verifican con `checkJs`:
  toda función exportada lleva su firma en JSDoc; los valores desconocidos se leen con
  `prop()`/`isObject()`; los tipos compartidos son `@typedef` importables (`@import`).
- `erasableSyntaxOnly`: sin `enum` ni parámetros de propiedad; uniones de literales y campos
  explícitos. `noPropertyAccessFromIndexSignature`: `env["PORT"]`, no `env.PORT`.
- Formato: Prettier, y nada más. `npm run format` antes de commitear; el hook lo verifica.

### Documentación viva

- **Sin cifras de estado en prosa viva** (cuántas reglas, pruebas, operaciones, términos): se
  desactualizan y nadie las corrige. Las informan `contract:check`, `npm test` y
  `check:markers`. Las tablas de estado de `specs/*/quickstart.md` son históricas y fechadas.
- Decisiones transversales en `docs/adr/` (citar `ADR-NNN`); el `research.md` de una feature
  las cita y conserva la evidencia.
- Lo no resuelto se marca con `ABIERTO`, `PROPUESTO` o `PLACEHOLDER` dentro del texto al que
  pertenece; `release-check` no pasa con `ABIERTO` ni `PLACEHOLDER`. Lo abierto del MVP
  (D3–D6) vive en ADR-010, no como marcador del contrato.
- **Todo directorio de primer nivel que no es código lleva `README.md` con inventario**
  (ADR-032): una tabla `## Inventario` que nombra cada entrada (qué es, fuente o derivado, quién
  lo lee, verificación; columnas propias donde la prueba las exige) y sin cifras de estado.
  `tests/docs/readmes.test.ts` (proyecto `tools`; política en `scripts/readme-inventory-lib.mjs`)
  falla con un README ausente, una entrada sin fila, una fila sin entrada o un directorio nuevo
  sin política; también exige la cabecera de generados (`GENERATED by scripts/<x>.mjs`, y `<x>`
  existe), de parches (`# Fix:`, `# Retire:`) y de scripts (comentario inicial). Lo normativo
  queda en este archivo; lo descriptivo, en el README de cada directorio.
- **Dónde va una instrucción nueva** (ADR-032, features 024 y 025). Dos preguntas, en este orden:
  **¿hace falta en _toda_ sesión?** Si sí, va acá. Si no, **¿es un procedimiento de varios pasos?**
  Si sí, es una skill (`.claude/skills/`); si no, una regla acotada (`.claude/rules/`) a la parte
  del código donde se aplica, que llega cuando el agente trabaja sobre ella. Ser normativo **no
  alcanza**: el flujo de trabajo hace falta siempre y se queda; cómo se escribe un caso de uso es
  igual de normativo y sólo hace falta en `src/application/`.
  Este archivo **no puede pasar de 200 líneas** —es el número que la documentación de la
  herramienta publica, y su motivo es que un archivo más largo **se obedece peor**—, y el límite
  cuenta los punteros que las reglas dejan atrás.
- **Cómo se clasifica una sección.** Normativa si dice **qué hacer**, descriptiva si dice **cómo es
  el sistema hoy** —y entonces su contenido vive en su ADR, en el contrato o en el README del
  directorio, y acá queda de qué se trata y dónde buscarlo—, o **mixta con su motivo** si tiene
  párrafos de las dos: nombra una deuda concreta, no es una forma de no decidir. La clase de cada
  sección, de este archivo y de cada regla, se declara en `scripts/instructions-policy.json`, y
  `check:instructions` la verifica **en los dos sentidos**: una sección sin clase falla, y una
  clase para una sección que no existe también. Abrir una sección obliga a decidir.
- **Lo que ese gate no verifica, y conviene no confundir**: comprueba que **lo nombrado exista**
  —cada ruta contra el disco, cada comando contra `package.json`, cada identificador contra el
  contrato y el código—, no que lo escrito sea **cierto**. Un verde no dice que el documento tenga
  razón; dice que no cita nada que no esté. Lo demás lo verifica la revisión.

### Reglas acotadas

Lo que sigue **no** está acá: vive en `.claude/rules/` y llega cuando trabajás sobre esa parte del
código. De cada una queda la línea que impide equivocarse antes de que llegue.

- **Auditoría de arquitectura** (ADR-032): el método vive en la skill; lo de este repo, en
  `audit.profile.json`. Detalle en `.claude/rules/auditoria.md`.
- **Cómo se escribe una entidad** (ADR-024): **clase si hay reglas, tipo si no**; una clase tiene
  `private constructor`, `of(...)` que devuelve `Result` y `rehydrate` que no re-juzga. Las reglas
  viven con su dueño y se invocan por su nombre: **`src/domain/` no exporta funciones sueltas**.
  Detalle en `.claude/rules/entidad.md`.
- **Gates de calidad** (ADR-016): un cambio **no entra si un mutante de sus propias líneas
  sobrevive**, y una excepción va en línea con su motivo. Los umbrales y cómo se trabaja el gate de
  mutación, en `.claude/rules/gates-de-calidad.md`.
- **Cómo se escribe un caso de uso** (ADR-023): una clase `<Nombre>UseCase` con `execute`, cuyas
  dependencias llegan por constructor en un único objeto de **interfaces, seis como máximo**; un caso
  de uso **nunca invoca a otro**, y un error de negocio **se devuelve, nunca se lanza**. Las cuatro
  las rechaza `lint` en el acto. Detalle en `.claude/rules/caso-de-uso.md`.
- **Anillos y módulos** (ADR-013): la dependencia va **sólo hacia adentro** —dominio, aplicación,
  adaptadores, infraestructura— y un módulo importa de otro **sólo por su `index.ts`** y sólo si
  `CONTEXT_MAP` lo permite. Lo verifica `npm run arch`. Detalle en
  `.claude/rules/anillos-y-modulos.md`.
- **Notas operativas del contrato**: el contrato es la **única fuente de verdad de toda la
  superficie HTTP**, y nada entra sin estar antes en su mapa. Cómo se escribe cada cosa —invariantes,
  consumidores, idempotencia, paginación— en `.claude/rules/contrato.md`.

## Reglas que fallan el build (no son sugerencias)

- `merchantId` nunca en path, query ni body: se deriva de la credencial. Única excepción: en
  la ruta de las operaciones del consumidor `admin` (ADR-020; constitución V, v1.2.0).
- Ningún campo de dato personal en ningún esquema (lista en el ruleset de lint).
- Todo request body con `additionalProperties: false`.
- Todo error es RFC 9457 Problem Details.
- Cambio incompatible del contrato ⇒ nueva versión mayor, o falla (salvo contrato marcado
  `building`, ADR-003: se acepta y se reporta).
- Cero llamadas a modelos de lenguaje en runtime.
- Sin I/O de red ni escritura bloqueante en el camino crítico de decisión.
- Toda feature que toca persistencia o API incluye pruebas de aislamiento entre merchants.

## Convenciones

- **Ninguna política vive en el código (constitución XI, ADR-031)**: todo valor que gobierna
  el comportamiento es configuración en tres niveles —plataforma (`config/platform.json`:
  ventana de deduplicación, tolerancia de reloj, memoria de sesión y visitante, ventana de
  firma, gracia máxima de rotación, tope de diagnósticos), default de tratamiento
  (`config/treatment-defaults.json`: frescura, umbrales del nivel de sincronización,
  `holdoutShare`, las tres políticas, superficies, barreras, estrategia de sincronización,
  idiomas) y merchant (versiones publicadas por `publishMerchantConfiguration`, más el mapa de
  anclajes)— resuelta valor por valor por `EffectiveConfiguration` y servida desde memoria por
  `ConfigurationService`; cada decisión estampa la terna (`DecisionFacts.configuration`). El
  código conserva invariantes y algoritmos; las constantes ya salieron (`check:behaviour-constants`
  vigila que no vuelvan): un valor de comportamiento nuevo es una entrada en un nivel, nunca una
  constante. Los consumidores reciben los valores por su puerto (`ClockTolerance`,
  `SignatureWindow`, `CatalogPolicies`, `PolicyDirectory`, `VisitorWindow`) o en su construcción
  (los stores en memoria reciben su ventana), enlazados en `composition/modules/`.
- TypeScript `strict`. Sin `any`. Un módulo por autoridad. Composition root único en
  `src/composition/` (ADR-013). Identificadores como tipos marcados (`Branded`): una identidad
  vive en `src/domain/shared-kernel/ids.ts` **sólo** si la comparten módulos que no pueden
  depender entre sí (`MerchantId`, `SessionId`, `VisitorId`, `ExperimentId`); con un dueño, vive
  en su módulo (`DecisionId` en `ledger/ids.ts`, `EventId` en `ingestion/ids.ts`). Quien acuña
  un id lo pide por un puerto del dueño (`DecisionIdGenerator` del ledger), nunca al kernel.
- Tasas como fracciones de 1 en todas partes, adentro y afuera; el backend no convierte formatos
  de porcentaje, y una tasa que algo cuantiza tiene que ser exactamente la de su balde (ADR-035).
- Literales de la plataforma (señales, métodos, headers, media types, claves reservadas de una
  librería) se declaran una vez, con nombre y tipo (`HTTP_METHODS`, `SHUTDOWN_SIGNALS`); un
  literal repetido en `src/` donde alguna ocurrencia no la verifica un tipo literal falla el
  lint (`ope/no-magic-strings`). Donde el tipo es una unión de literales (`ProblemSlug`,
  `NodeJS.Signals`) el literal se queda: el compilador es la constante.
- `NO_OP` es un resultado válido con motivo, nunca una excepción. Un error de negocio es un
  `DomainError` devuelto en un `Result`, nunca lanzado (ADR-023).
- **Un comentario explica lo que el código no puede decir por sí mismo.** Donde el código es una
  regla de negocio, el comentario dice la regla y su fuente (`01 §8`, `ADR-026`). Donde el código
  es un **truco** —un tipo condicional, la varianza de una posición, un `as`, un orden de ramas o
  de líneas que importa— el comentario explica **el mecanismo** y por qué la versión obvia está
  mal: eso es justo lo que el lector no puede reconstruir mirando el código, y lo que hace que
  alguien lo "simplifique" y lo rompa en silencio (`Everything<U>`, `IsUnion`,
  `[Names<M>] extends [never]` y el fantasma de `Port` en `composition/graph/`). Un comentario que
  repite el nombre de lo que comenta, o que sólo justifica la decisión sin decir qué pasa, sobra:
  la decisión va al ADR. Ningún gate lo verifica; lo verifica la revisión.
- Marcar afirmaciones como `DECIDIDO` / `PROPUESTO` / `ABIERTO` y estado del sistema como
  **BUILT / CONNECTED / ACTIVE / TESTED**. No afirmar que algo funciona sin prueba ejecutable.
- Commits: conventional commits, en español, un cambio por commit. No commitear sin que las
  pruebas pasen. No hacer push sin que el usuario lo pida.

## Si existe `HANDOFF.md` en la raíz

Leerlo primero: contiene el estado de la tarea en curso. Borrarlo cuando la tarea que describe
esté terminada y commiteada.
