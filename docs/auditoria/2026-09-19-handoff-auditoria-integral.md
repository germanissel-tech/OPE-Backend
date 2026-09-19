# Handoff — auditoría integral del backend de OPE (Zona B del MVP)

**Fecha**: 2026-09-19 · **Rama**: `main` en `8d12aa2` (PR #22 mergeado) · **Para**: el agente que
audita · **De**: el agente que construyó las features 001–013.

Este documento es lo único que el auditor necesita leer antes de empezar. Dice qué es el
proyecto, dónde está la verdad, cómo se corre, qué se construyó, qué sospecho que está flojo y
qué se espera del informe. No pide opinión: pide hallazgos verificables.

---

## 0. Reglas del juego para el auditor

1. **Modo lectura.** La auditoría no cambia código, contrato ni docs. Si un hallazgo pide un
   cambio, se propone con `before/after` en el informe; lo aplica otra sesión después.
2. **Sesión con los documentos del MVP.** Lanzar la sesión con `--add-dir ..` (los documentos
   `01-arquitectura-mvp.md`, `02-integracion-ecommerce.md`, `03-alcance-mvp.md` viven en el
   directorio padre y son fuente de verdad de lo funcional). Si no se pueden leer, decirlo
   antes de auditar cumplimiento funcional; no asumir.
3. **Leer primero, en este orden**: `.specify/memory/constitution.md` (principios y gates,
   prevalece sobre todo), `CLAUDE.md` (cómo se escribe cada cosa y por qué), `docs/adr/`
   (29 decisiones, citar `ADR-NNN`), y los tres documentos del MVP.
4. **Idioma**: el informe en español (ADR-015); citas de código tal cual.
5. **Nada entra al informe sin `file:line`, cita literal y fuente** (constitución, ADR,
   sección de `CLAUDE.md`, regla de lint/arch, o documento del MVP con sección). Sin
   puntuaciones ni "notas": estado derivado por reglas (ver §8).
6. **Refutar antes de reportar.** Cada hallazgo pasa por
   `.claude/skills/auditing-architecture/references/refutacion.md`: si un ADR lo justifica, si
   un gate ya lo lista, si la prueba propuesta hoy no fallaría, el hallazgo se descarta o va al
   anexo de refutados.
7. **Los gates deterministas son hechos**, no se reinterpretan. Se citan tal cual salen.
8. **Dónde escribir**: `docs/auditoria/2026-09-19-informe-auditoria-integral.md` (sin
   commitear: el dueño del repo decide). No crear `HANDOFF.md` en la raíz (tiene otro
   significado, ver `CLAUDE.md` § "Si existe HANDOFF.md").

---

## 1. Qué es esto

OPE decide, en la ficha de producto de un e-commerce de indumentaria, si mostrar una
intervención (un mensaje sobre talle, precio o devoluciones) según el comportamiento de la
sesión, con un experimento A/B por visitante, y mide el resultado con la cadena de evidencia
`ASSIGNED → EXPOSED → VERIFIED_ORDER → ATTRIBUTED_ORDER → RETURNED` (01 §5). Este repositorio
es el **backend** (Zona B): la API que el SDK del navegador y la plataforma del merchant llaman.
Se construyó de cero, contract-first, por features con spec → plan → tasks → implement.

Principios que gobiernan todo (constitución, `.specify/memory/constitution.md`): separación de
autoridades (I), fail-closed con `NO_OP` por defecto (II), la medición no se contamina (III),
camino crítico sin red (IV), aislamiento por merchant (V), identidad e idempotencia explícitas
(VI), sin datos personales (VII), cero LLM en runtime (VIII), trazabilidad total (IX), puertos
en los dos bordes (X).

---

## 2. Estado: qué está construido

| Feature | Qué dejó                                                                                                                                                                  | ADRs         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 001–003 | Toolchain del contrato (Redocly + Spectral con reglas `ope-*`, oasdiff, tipos generados), gobernanza (glosario, invariantes, marcadores, problem types), gates de calidad | ADR-001..012 |
| 004     | Ingesta de eventos del SDK (`POST /v1/events`), deduplicación, `ingestKey` + Origin, CORS                                                                                 | ADR-013..016 |
| 005     | Auditoría de calidad mecanizada: idioma, complejidad, duplicación, código muerto, mutación, forma de anillos; skill `auditing-architecture`                               | ADR-016..017 |
| 006     | Mapa del contrato (`contracts/api-map.yaml`): consumidores, capacidades, ciclo de vida, idempotencia, paginación                                                          | ADR-019..020 |
| 007     | Asignación experimental determinista (FNV-1a), ledger de asignaciones; `POST /v1/exposures`                                                                               | ADR-021..022 |
| 008–009 | Casos de uso y errores (`Result`, `DomainError`, `toProblem`), dominio rico (`of`/`rehydrate`), composición por módulos                                                   | ADR-023..024 |
| 010     | Catálogo y stock por snapshot (`PUT /v1/catalog`, `platformKey`), verdad de producto con frescura                                                                         | ADR-025      |
| 011     | Plano de decisión I: inferencia de barrera (`Signals`, `Condition`, `BarrierRules`), evidencia, política por merchant                                                     | ADR-026      |
| 012     | Plano de decisión II: selección + quality gate, política comercial (escalera del incentivo), estado por visitante                                                         | ADR-027      |
| 013     | Outcomes: órdenes, corroboraciones, devoluciones, redención del incentivo; firma HMAC de plataforma                                                                       | ADR-028..029 |

Pendiente (mapa `contracts/api-map.yaml`, `features:`): 014 configuración/flags/kill switch/
admin (`adminToken`, holdout 5 % configurable), 015 catálogo de mensajes reales, 016 análisis
ITT y portal, 017 persistencia (Postgres) y resiliencia, 018 observabilidad y end-to-end.

Cifras al cierre de la 013 (históricas): contrato `1.2.0`, 7 operaciones construidas / 16
planificadas; 176 archivos en `src/` (~9 500 líneas), 259 archivos de prueba, 1 003 pruebas;
`Lint exceptions: 0`, `Language exceptions: 0`; mutación sobre el diff de cada feature "every
mutant died"; Schemathesis 2 431 casos; p95 de ingesta y de órdenes < 1 ms con `inject`.

**Todo el estado es en memoria** (ledgers, stores, dedup, sesión, visitante): la persistencia
llega con la 017. Una sola instancia (01 §9, DECIDIDO).

---

## 3. Cómo se corre

Node 22, TypeScript 7 (`@typescript/native`) con el alias `typescript` → API 6 para las
herramientas (ADR-017). Windows (el repo se desarrolló en Windows; los scripts son
multiplataforma). `gh` no está en el PATH de la sesión: `"C:\Program Files\GitHub CLI\gh.exe"`.

```bash
npm ci
npm run contract:check        # lint → bundle → diff contra origin/main → drift de tipos + 5 check:*
npm run quality               # lint → arch → duplicación → código muerto → idioma
npm run typecheck && npm test # 1 003 pruebas: unitarias, integración (inject), reglas, arquitectura
npm run build && npm run test:contract   # Schemathesis levanta dist/: sin build previo usa código viejo
git add -A && npm run test:mutation      # Stryker sobre el diff contra origin/main (sólo archivos en el índice)
npm run test:mutation -- --all           # mutación de todo (informativa, ~largo)
npm run dev                              # servidor real en memoria con config/dev-merchants.json
```

Gotchas verificados: `test:mutation` usa `reports/mutation/stryker-incremental.json` si existe
(borrarlo para una corrida limpia); `test:contract` necesita `npm run build`; los tests de
latencia (`ingest-latency`, `catalog-size`, `outcomes-latency`) están excluidos de la mutación
(`vitest.mutation.config.ts`). CI (`.github/workflows/ci.yml`): job `checks` (~4 min) y job
`mutation` (~10 min, caché incremental por rama) en `push` y `pull_request`; `mutation-full`
semanal.

La skill de auditoría existente se invoca así (mecánica + criterios de este repo):

```bash
node .claude/skills/auditing-architecture/scripts/run-gates.mjs --module <nombre> --json
node .claude/skills/auditing-architecture/scripts/verify-finding.mjs /tmp/findings.json
```

y su procedimiento completo está en `.claude/skills/auditing-architecture/SKILL.md` con los
criterios en `references/criterios-diseno.md` (SOLID, DRY, claridad y errores **definidos en
términos de este repo**, con lo que ya ve cada gate). Úsala módulo por módulo como base; lo
que este handoff agrega es lo que esa skill no cubre (§5).

---

## 4. Mapa del sistema (para orientarse en dos minutos)

**Anillos** (ADR-013, verificados por `npm run arch`): `src/domain/` (puro, sin npm ni Node) →
`src/application/` (casos de uso, servicios, puertos; puro) → `src/interface-adapters/`
(`http/` controllers, seguridad, tipos generados; `gateways/<módulo>/` implementan puertos) →
`src/infrastructure/` (Fastify + openapi-backend, CORS, logging) → `src/composition/`
(módulos que se cablean solos, perfiles, `bootstrap`, `config.ts`) → `src/main.ts`.

**Módulos y mapa de contextos** (`.dependency-cruiser.cjs`, `CONTEXT_MAP`): `shared-kernel`,
`system`, `merchant`, `ledger`, `experiment`, `ingestion`, `catalog`, `barrier`, `selection`,
`commercial`, `decision`, `outcomes`. Cada módulo expone `index.ts`; sólo se importa por ahí y
sólo si el mapa lo permite.

**Camino crítico** (constitución IV; ADR-026/027): `POST /v1/events` →
`IngestBatchUseCase` (dedup, foco) → puerto `DecisionPlane` → `DecisionService`
(`application/decision/services/decision.service.ts`): asignación → políticas del merchant →
estado de sesión/visitante → evidencia (`ProductTruthService`) → inferencia (`BarrierRules`)
→ `DecisionPolicy.barrierVerdict` → `QualityGate.judgeAll(CANDIDATES[barrier])` →
`CommercialPolicy.verdict` → `DecisionRecorder` (ledger) → respuesta `202` con `NO_OP`+motivo
o `INTERVENE`+intervención. Nunca red; ledger caído degrada a `NO_OP ledger-unavailable`.

**Plano de medición** (ADR-021/022/028): `POST /v1/exposures` (SDK) → `EXPOSED`;
`POST /v1/orders` (plataforma) → `VERIFIED_ORDER` + `ATTRIBUTED_ORDER` sólo si el `sessionId`
tiene decisiones en el ledger del merchant (`DecisionLedger.bySession`), si no
`PENDING_CORRELATION`; `POST /v1/orders/corroborations` (SDK) evidencia; `POST /v1/returns` →
`RETURNED`. Idempotencia first/repeat/conflict decidida dentro del puerto (`OrderLedger`).

**Seguridad** (ADR-014/020/025/029): `ingestKey` (pública, en el tag) + Origin registrado;
`platformKey` (secreta, servidor a servidor) + firma HMAC-SHA256 opcional por merchant
(`platformSecrets`), verificada en el security handler antes del body; capacidades por
consumidor (`x-required-capabilities`). Sin PII por contrato (ruleset `noPii`).

**Configuración**: `OPE_MERCHANTS` / `OPE_MERCHANTS_FILE` (`src/composition/config.ts` +
`*-config.ts`): merchants, claves, secretos, orígenes, experimentos, `decisionPolicy`,
`commercialPolicy`, `evidenceProfile`. Todo se valida por fábrica del dominio; un fallo impide
el arranque nombrando el campo.

---

## 5. Alcance de la auditoría, por dimensión

Para cada dimensión: qué preguntar, dónde mirar, qué cuenta como evidencia. El auditor decide
el orden; sugiero A → F.

### A. Clean architecture y SOLID

Correr la skill `auditing-architecture` **por módulo** (los 12) y sobre `--dir
src/infrastructure` y `--dir src/composition`. Además, preguntas transversales que la skill no
hace:

- ¿Hay lógica de negocio fuera del dominio? Buscar condiciones sobre hechos del negocio en
  controllers, gateways, `composition/*-config.ts` y `build-server.ts`.
- ¿Los puertos son del que los usa (DIP) y mínimos (ISP)? `application/*/ports/*.ts`. Revisar
  `DecisionLedger` (creció con `bySession` para `outcomes`: ¿debería ser un puerto propio de
  `outcomes` servido por el mismo gateway?), `OrderLedger` (mezcla órdenes y devoluciones:
  ¿una responsabilidad o dos?).
- ¿`DecisionService` (259 líneas, límite 300 de `shape`) sigue siendo un orquestador que sólo
  transporta contexto (ADR-027) o ya decide? `application/decision/services/decision.service.ts`.
- ¿`composition/config.ts` + `condition-config.ts` + `decision-policy-config.ts` +
  `commercial-policy-config.ts` son parseo de forma o contienen reglas? (ADR-024: las
  invariantes viven en el dominio).
- OCP frente a la 014/015: agregar un flag, un candidato de mensaje o un hecho nuevo, ¿qué
  archivos toca? Si toca más de un módulo o un `switch` sin exhaustividad, es hallazgo.
- LSP/ADR-024: toda clase con `of`/`rehydrate`, ¿`rehydrate` puede producir un estado que
  `of` no admite y algún consumidor lo asume válido?

### B. Robustez

- **Fail-closed en cada borde**: dónde un `undefined`, un `NaN`, un reloj desfasado o un ledger
  caído produce algo distinto de `NO_OP`/`503`/`4xx` con tipo propio. Mirar `to-problem.ts`,
  `HEADERS_BY_CODE`, los `unrecorded`/`ledger-unavailable` en `DecisionRecorder` y
  `IngestBatchUseCase`, los `503` de `outcomes`.
- **Concurrencia en memoria**: la atomicidad de `memoryOrderLedger.record` es una sección
  síncrona; `NotifyReturnUseCase` hace `find` → `recordReturn` con `await` en medio (cubierto
  por `unknown`, pero revisar). `DecisionService` lee y escribe `SessionState`/`VisitorState`
  con `await`s entre medio: dos lotes simultáneos de la misma sesión, ¿pueden duplicar una
  intervención o saltarse el cooldown? Hay prueba de "una intervención por sesión" pero no de
  interleaving.
- **Ventanas y podas**: `SESSION_WINDOW`, `VISITOR_WINDOW`, `DEDUP_WINDOW` tienen TTL y máximo.
  `memoryDecisionLedger` (con su índice por sesión), `memoryOrderLedger`,
  `memoryCorroborationLedger`, `memoryAssignmentLedger`, `memoryExposureLedger` **no podan
  nunca**: crecen sin límite hasta la 017. ¿Está dicho en algún ADR o es deuda silenciosa?
- **Relojes**: tolerancias de 5 min en eventos, catálogo, órdenes, corroboraciones y firma;
  24 h hacia atrás en eventos. ¿Consistentes entre sí y con `02`?
- **Cuerpos grandes**: `bodyLimit` 32 MiB para el catálogo; la firma HMAC ahora se calcula
  sobre esos bytes en el security handler (`keepRawBodies` en `build-server.ts`). ¿Costo y
  memoria por request aceptables? ¿El `WeakMap` libera?
- **Errores de programación**: `throw new Error` → 500 genérico. Buscar `throw` en
  `application/` y `domain/` que deberían ser `Result`.

### C. Escalabilidad y camino a la 017

- ¿Qué supuestos de "una instancia" están escritos en el código sin nombrarse? (dedup en
  memoria, idempotencia en el gateway, estado de sesión). Listarlos con `file:line` para que la
  017 los encuentre.
- ¿Los puertos admiten una implementación Postgres sin cambiar los casos de uso? Revisar
  firmas: `Promise` en todo puerto (ADR-024), `Result<…, LedgerUnavailable>` en todo
  `record`, ninguna dependencia de que el gateway devuelva la misma instancia (aliasing de
  `Order` en `memoryOrderLedger`: el caso de uso recibe el objeto guardado).
- Costo del camino crítico por request: `Signals` se refunde por lote, `BarrierRules.infer`
  evalúa todas las reglas, `QualityGate` juzga todos los candidatos, `FactContext` se
  construye por decisión. Medido p95 < 1 ms con `inject`; ¿hay algo O(n²) escondido
  (`bySession` devuelve todas las decisiones de la sesión y `Correlation`/`Redemption` las
  recorren)?
- Tiempo de desarrollo como escalabilidad del proyecto: mutación ~10 min por PR y creciendo;
  suite de 1 003 pruebas en ~2 min. ¿Hay pruebas redundantes o lentas
  (`tests/integration/*` levantan la app entera por caso)?

### D. Seguridad

- Comparación de claves: `Merchant.owns`/`ownsPlatformKey` usan `includes` (no tiempo
  constante). La firma HMAC sí compara en tiempo constante (`PlatformSignature.matches`).
  ¿Importa para `platformKey` (secreta)?
- Redacción en logs: `request-logging.ts` redacta headers; verificar que ningún log de casos
  de uso o de `LoggedUseCase` filtra request, claves, secretos, firma, brazo o `visitorId`
  donde no corresponde (constitución VII, ADR-022).
- CORS: derivado de los headers de credencial declarados por módulo; `platformKey` sin CORS.
  ¿Alguna operación de plataforma alcanzable desde un navegador con `ingestKey`?
- PII: ruleset `noPii` sobre esquemas. ¿Y los logs, los ejemplos del contrato, los mensajes de
  error (`detail`) que interpolan valores del request (`orderId`, SKU)?
- Firma: replay dentro de la ventana de 5 min es posible por diseño (idempotencia lo absorbe);
  ¿está dicho? Rotación de secretos sin ventana de gracia explícita.

### E. Calidad de las pruebas

- Excepciones de mutación (`// Stryker disable`): 4 en `decision.service.ts`, 4 en
  `build-server.ts`, 1 en `notify-order.ts`, 1 en `condition.ts`, `signals.ts`, `cors.ts`.
  Cada una tiene motivo; verificar que el motivo es cierto (mutante equivalente o inalcanzable)
  y no una comodidad.
- Pruebas informativas que nunca fallan por cifras (latencia, carga): ¿alguna debería ser
  gate?
- `tests/helpers/test-app.ts`: dos merchants fijos, A con `treatmentPercent: 100`. ¿Hay
  comportamiento de CONTROL que sólo se prueba con `merchant(0)` ad hoc?
- Determinismo: relojes fijos (`fixedClock`), ids aleatorios (`randomDecisionIds`) — ¿alguna
  prueba depende del orden de un `Map` o de `Date.now()`? (`eventOf` usa `new Date()` por
  defecto: ya mordió dos veces en la 013).
- Réplicas contrato ↔ código verificadas por prueba (problem types, capacidades, motivos NO_OP,
  barreras, anclajes, vocabulario de eventos, `OrderStatus`): ¿falta alguna réplica
  (`REDEMPTION_VERDICTS`, `STEPS`)?

### F. Cumplimiento funcional

Esto es lo que ninguna herramienta mide y lo más valioso del informe. Método: por cada
afirmación DECIDIDA de los documentos del MVP y de la constitución, encontrar la prueba que la
sostiene o declarar el hueco.

- **Constitución I–X**: una fila por principio con la evidencia (prueba o gate) y el hueco si
  lo hay. Ejemplos de preguntas: III "misma inferencia para ambos brazos" — ¿CONTROL recorre
  las cinco autoridades y registra lo mismo? (hay prueba en `decision.service.test.ts`); IX
  "nada entra al reporte sin trazabilidad" — ¿toda decisión, exposición, orden y devolución
  se reconstruye desde el ledger?
- **01 §4 (las cinco autoridades)**, **§4.3 evidencia**, **§4.5 política comercial**, **§5
  cadena de evidencia**, **§6 identidades**, **§9 garantías**, **§10 privacidad**: ¿el código
  hace lo que el documento dice, ni más ni menos? Donde diga "DECIDIDO" y el código difiera,
  hallazgo `high` con la sección citada.
- **02 §5 (correlación A/B/C)**: A atribuye, B nunca, C no existe. **§4 catálogo**.
- **03 §4.5 (qué evidencia sostiene un mensaje: nada de escasez ni prueba social)**, **§4.7
  memoria**, **§4.8 escalera del incentivo** (orden de escalones, D-B: abandono habilita el
  escalón siguiente, incentivo sólo en precio), **§4.11 privacidad**, **§6 decisiones D-A/D-B/
  D-C**, **§10 criterios de aceptación** (uno por uno).
- **Specs de cada feature** (`specs/NNN-*/spec.md`): cada `FR-` y `SC-` con su prueba.
  Atajo: los `quickstart.md` traen la tabla escenario → prueba, y la sección "Cambios respecto
  del plan" de cada uno lista los desvíos conocidos (leerlas todas; son honestas).
- **Marcadores**: `npm run check:markers` (0 abiertos, 2 propuestos en ADR-020 sobre
  `portalSession`/`adminToken`; los dos propuestos al stakeholder de la 013 viven en su spec).
  ¿Hay decisiones tomadas en código que deberían estar marcadas y no lo están?

---

## 6. Lo que ya sospecho (verificar, no asumir)

Lista honesta de lo que dejé sabiendo que es discutible. Cada punto es un candidato a hallazgo,
no un hallazgo: el auditor lo confirma o lo refuta.

1. **Crecimiento sin límite de los ledgers en memoria** (§5.B). `memoryDecisionLedger`
   además indexa por sesión (`sessions: Map<string, Decision[]>`) y nunca poda. Hasta la 017
   es aceptable por diseño (01 §9), pero no está escrito en ningún ADR como límite conocido.
2. **`commercial-policy-blocked` es inalcanzable de punta a punta** con el catálogo actual de
   candidatos: toda barrera tiene un candidato de información sin claims al que la escalera
   cae. Está marcado con `// Stryker disable` y explicado en el quickstart de la 012; la 015
   lo cambia. ¿Debería el motivo existir hoy en el contrato?
3. **Redención del incentivo ignora la exposición**: `IncentiveRedemption.of` cruza contra la
   última decisión `INTERVENE` con incentivo de la sesión, no contra una exposición confirmada
   (`EXPOSED`). Un incentivo decidido pero nunca mostrado cuenta como "concedido"
   (`not-applied`). ¿Es lo que 01 §5 quiere?
4. **Correlación confía en el `sessionId` que manda la plataforma**: cualquier orden con un
   `sessionId` conocido del merchant se atribuye. La plataforma es de confianza (firma), pero
   nada verifica que esa sesión haya llegado al checkout. Consistente con 02 §5.1 ("el
   vínculo lo establece la plataforma"); revisar si 01 §5 pide algo más.
5. **`DecisionService` cerca del límite de 300 líneas** y con cinco `Stryker disable`
   (equivalentes por spreads y por la verdad desconocida). ¿Señal de que el orquestador
   acumula transformación de datos (`evidenceOf`, `selectionOf`) que podría ser del dominio?
6. **`build-server.ts` (428 líneas) concentra** parser de bytes crudos, seguridad, validación
   de respuestas, rutas comodín y errores de Fastify. Está en infraestructura (sin límite de
   `shape`), pero ¿tiene más de una razón de cambio?
7. **Tipos con `| undefined` explícito** en `outcomes` (`OrderRecord`, `NotifyOrderRequest`,
   etc.) para evitar spreads condicionales y mutantes equivalentes. Funciona, pero es una
   convención distinta a la del resto del código (`exactOptionalPropertyTypes` con claves
   omitidas). ¿Se generaliza o se revierte?
8. **`Return` vive en `order.ts`** por el ciclo que `arch` prohíbe; `Corroboration` es clase
   por una sola regla de reloj. Ambos documentados en el quickstart de la 013.
9. **Schemathesis avisa "schema validation mismatch"** en 5 operaciones (la mayoría de los
   cuerpos generados se rechazan por validación): puede ser inherente a los `pattern` de ids
   y `additionalProperties: false`, o indicar que el contrato es más estricto que lo que el
   servidor documenta. No falla; conviene entender por qué.
10. **`Merchant.owns`/`ownsPlatformKey` con `includes`** (no tiempo constante) frente a la
    firma que sí lo es.
11. **Replay dentro de la ventana de firma** absorbido por idempotencia: cierto para órdenes
    y devoluciones (misma clave ⇒ `200`), pero un `PUT /v1/catalog` repetido dentro de 5 min
    con el mismo `capturedAt` también es `200`; un snapshot viejo capturado y reenviado más
    tarde es `422 catalog-out-of-order`. Confirmar que no hay ventana explotable.
12. **Deuda declarada en CLAUDE.md** que conviene contrastar con el código: ADR-017 (alias de
    TypeScript hasta que las herramientas admitan la API 7.1), el parche
    `patches/@stryker-mutator+vitest-runner+10.0.0.patch`, `oas3-schema` apagada en Spectral.

---

## 7. Dónde está cada cosa (índice rápido)

| Quiero ver…                      | Archivo(s)                                                                                                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Principios y gates               | `.specify/memory/constitution.md`                                                                                                                                                               |
| Cómo se escribe cada capa        | `CLAUDE.md` (anillos, casos de uso, entidades, gates, tipado, contrato)                                                                                                                         |
| Decisiones                       | `docs/adr/001..029`                                                                                                                                                                             |
| Glosario (61 términos)           | `docs/dominio/*.md`, `_tecnicos.json`                                                                                                                                                           |
| Contrato                         | `contracts/openapi.yaml` + `paths/`, `components/`, `examples/`, `problem-types.yaml`, `no-op-reasons.yaml`, `api-map.yaml`, `.spectral.yaml`, `rules/functions/`                               |
| Reglas de dependencia            | `.dependency-cruiser.cjs` (`CONTEXT_MAP`), `scripts/shape-rules.mjs`, `eslint.config.mjs`, `scripts/lint/*.mjs`                                                                                 |
| Camino crítico                   | `src/application/ingestion/use-cases/ingest-batch.use-case.ts`, `src/application/decision/services/decision.service.ts`                                                                         |
| Inferencia y políticas           | `src/domain/barrier/`, `src/domain/decision/`, `src/domain/selection/`, `src/domain/commercial/`                                                                                                |
| Medición                         | `src/domain/ledger/`, `src/domain/outcomes/`, `src/application/outcomes/`, `src/application/ledger/`                                                                                            |
| Seguridad                        | `src/interface-adapters/http/security/`, `src/application/merchant/services/`, `src/domain/merchant/platform-signature.ts`, `src/infrastructure/http/{build-server,cors,request-logging}.ts`    |
| Composición y configuración      | `src/composition/{bootstrap,config,ports,wiring}.ts`, `modules/*.ts`, `profiles/local.ts`, `*-config.ts`                                                                                        |
| Gateways en memoria              | `src/interface-adapters/gateways/<módulo>/memory-*.ts`                                                                                                                                          |
| Pruebas por tipo                 | `tests/unit/{domain,application,gateways,http,composition,infrastructure}`, `tests/integration/`, `tests/contract-rules/`, `tests/architecture/`, `tests/lint/`, `tests/audit/`, `tests/hooks/` |
| Fakes para degradación           | `tests/helpers/unavailable-ledgers.ts`, `tests/helpers/test-app.ts`, `tests/helpers/sign.ts`                                                                                                    |
| Cierre de cada feature (desvíos) | `specs/NNN-*/quickstart.md` § "Estado al cierre" / "Cambios respecto del plan"                                                                                                                  |
| CI                               | `.github/workflows/ci.yml`, `tests/hooks/ci.test.ts`, `lefthook.yml`                                                                                                                            |

---

## 8. Entregable

`docs/auditoria/2026-09-19-informe-auditoria-integral.md`, en español, con estas secciones y
en este orden:

1. **Alcance y método**: qué se leyó, qué se corrió (comandos y su salida resumida), qué no se
   pudo verificar y por qué.
2. **Gates** (hechos): salida de `run-gates.mjs` por módulo y de los comandos globales, tal
   cual.
3. **Hallazgos confirmados**, agrupados por dimensión (A–F) y ordenados por severidad, cada
   uno con: `id`, `file:line`, cita literal, regla y fuente, severidad (`high` si la fuente es
   la constitución, un ADR o un DECIDIDO del MVP; `medium` si es `CLAUDE.md`/lint/arch; `low`
   si es claridad), propuesta `before/after` y la prueba que lo cubriría. Un hallazgo
   funcional (F) cita la sección del documento del MVP y el FR/SC de la spec.
4. **Matriz de cumplimiento**: constitución I–X y criterios de aceptación de 03 §10, una fila
   cada uno: evidencia (prueba/gate con ruta) o hueco.
5. **Refutados** (anexo): lo que se propuso y no sobrevivió, con la refutación.
6. **Riesgos para la 014–017**: lo que no es defecto hoy pero lo será (memoria, instancia
   única, aliasing, tiempos de CI), con la feature que debería absorberlo.
7. **Estado global**, por regla fija: `rejected` (algún gate bloqueante en rojo o algún
   `high`), `changes-required` (ningún `high`, algún `medium`), `approved` (sólo `low` o
   nada). Sin puntuación.

Lo que **no** se acepta: opiniones sin `file:line`; "podría mejorarse" sin `after`; repetir lo
que un gate ya lista; hallazgos sobre estilo que Prettier/ESLint ya gobiernan; proponer cambiar
de herramienta, de framework o de lenguaje; auditar la POC (no es base de código, `CLAUDE.md`).

---

## 9. Contacto con el contexto que no está escrito

- El dueño del repo trabaja solo; los PR se mergean cuando `checks` y `mutation` están en
  verde en `push` y `pull_request`.
- Decisiones del stakeholder recientes (PR #20): holdout 5 % configurable por merchant
  (014), decisión inline decidida (ADR-014), HMAC con la 013 (hecho), stock/precio por
  snapshot frecuente.
- Preguntas abiertas al stakeholder, sin bloquear: origen del checkout del merchant piloto
  (define si el mecanismo B sirve) y si la plataforma notifica devoluciones (02 §5.3–5.4;
  spec de la 013, Assumptions).
