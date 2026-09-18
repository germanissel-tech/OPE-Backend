# Research — Feature 011: plano de decisión I, barrera y evidencia

**Fecha**: 2026-09-18 · **Estado**: completo. Decisiones transversales → ADR-026; cierre de
los dos PROPUESTO de ADR-024.

## R-01 Qué hay hoy y qué se reemplaza (verificado en el código)

- `IngestBatchUseCase` (`application/ingestion/use-cases/`) hace hoy **todo** el camino: `EventBatch.of`
  → `assignment.assign` → `eventDedup.claim` → `NoOpDecision.of(facts, reasonFor(batch,
assignment))` → `decisions.record` con degradación ADR-021. `reasonFor` resuelve
  `no-active-experiment` / `control-arm` y delega el resto en `EventBatch.noOpReason()`, el stub
  que devuelve `page-context-incomplete` o `decision-plane-unavailable`.
- `Decision` (`domain/ledger/decision.ts`) ya es `NoOpDecision | InterveneDecision`;
  `InterveneDecision.of(facts, reason, intervention)` existe y `DecisionBase.rehydrate` lo
  reconstruye. `ANCHORS`/`Anchor`/`Intervention` viven ahí con el PROPUESTO de moverlos al
  kernel. `NoOpReason`/`NO_OP_REASONS` **ya están en el `shared-kernel`** (movidos en 009/010):
  sólo falta ampliar el catálogo.
- Contrato: `Decision.outcome` ya es `enum [NO_OP, INTERVENE]` y `Decision.intervention` es
  `$ref Intervention { messageVersionId, anchor }`; ambos con descripciones marcadas PROPUESTO
  ("reservado para el plano de decisión"). `reason` es string con patrón. **Sin cambio de
  forma**: sólo descripciones y catálogo de motivos → compatible.
- `ProductTruthService.lookup(merchantId, productId, variantId)` → `known { product, variant,
freshness { catalog: "fresh", stockAndPrice }, ageMs }` | `unknown { reason: absent | stale |
unknown-product | unknown-variant }`. `productTruthOf(ports)` ya está en
  `composition/modules/catalog.ts` "para quien decida".
- `composition/config.ts`: `parseMerchants` valida forma y construye por fábrica
  (`Merchant.of`, `Experiment.of`); un `fail` se traduce con `rejected(at, error)` a un
  `ConfigError` que nombra el campo vía `FIELD_BY_CODE` + detalle `index`. `decisionPolicy`
  sigue el mismo patrón: forma en `config.ts`, invariantes en `DecisionPolicy.of`.
- Estado de sesión: no existe. Lo único por sesión es la deduplicación por `eventId`
  (`memoryEventDedup`, ventana `DEDUP_WINDOW` 24 h / 100 000 por merchant, `Map` con orden de
  inserción y expiración perezosa). El gateway de estado de sesión copia el mecanismo, no el
  código (otra clave, otro valor).
- `CONTEXT_MAP`: `ingestion: [shared-kernel, merchant, ledger, experiment]`; hay regla
  `no-circular`. Un módulo `decision` que importe `ingestion` (para leer `Event`/`EventBatch`) y
  un `ingestion` que importe `decision` (para invocarlo) sería un ciclo → R-02.

## R-02 Quién orquesta y en qué dirección van las dependencias

- Constitución I: cinco autoridades en orden fijo (asignación → inferencia → evidencia →
  selección + gate → política), **cada una en su módulo**, y un orquestador que sólo arma el
  contexto y las invoca. Hoy el orquestador es el caso de uso de ingesta; con la 011 pasa a
  tener nombre propio.
- **Decisión**: dos módulos nuevos, no uno.
  - `barrier` — la autoridad de inferencia: vocabulario cerrado de hechos (`Signals`), álgebra
    de condiciones, reglas de barrera (`BarrierRules`) y el evaluador puro; puerto
    `BarrierInference` con su implementación por reglas. Depende de `shared-kernel` e
    `ingestion` (lee `Event` para derivar señales).
  - `decision` — el orquestador y el veredicto: `DecisionPolicy` del merchant (versión, reglas
    de barrera del módulo `barrier` + parámetros del veredicto: umbral, prioridad, alta
    intención, abandono, presupuesto por sesión, evidencia exigida), `SessionState`,
    `DecisionService` que recorre asignación → inferencia → evidencia → veredicto → ledger.
    Depende de `shared-kernel, ledger, experiment, ingestion, catalog, barrier`.
  - `ingestion` **no depende de `decision`**: declara el puerto `DecisionPlane` en
    `application/ingestion/ports/decision-plane.ts` (`decide({ merchantId, batch, now }) →
Promise<Decision>`), lo que ya expresaba el motivo `decision-plane-unavailable`; el
    `DecisionService` lo implementa (`decision` → `ingestion` está permitido) y la composición
    los enlaza (`decisionPlaneOf(ports)` en `modules/decision.ts`, como `assignmentServiceOf`).
    Inversión de dependencia: el consumidor es dueño del puerto. Sin ciclo.
  - `IngestBatchUseCase` queda en lo suyo: invariantes del lote → dedup → `decisionPlane.decide`
    → respuesta. La asignación y la degradación ADR-021 se mudan al plano (son pasos del camino
    crítico, 01 §4.1 y §4.7). Dependencias: `clock, eventDedup, decisionPlane` (de 6 a 3).
- El veredicto (umbral, alta intención, presupuesto, evidencia por barrera, abandono) es la
  semilla de la política comercial (01 §4.5). Vive en `decision` en la 011; la 012 decide si la
  política comercial completa (techo, margen, cooldown) se separa en su módulo. Registrado en
  ADR-026.
- Alternativas rechazadas: (a) un solo módulo `decision` con la inferencia adentro — viola
  constitución I ("cada autoridad en su propio módulo") y mezcla lo que un merchant configura
  (reglas) con lo que el orquestador transporta; (b) mover `ingestEvents` al módulo `decision` —
  la operación es de ingesta y el módulo `ingestion` quedaría sin operación; (c) que
  `ingestion` importe `decision` — ciclo.

## R-03 Vocabulario cerrado de hechos (derivado de `domain/ingestion/event.ts`)

- Claves de evento: `EventKey = EventType | "<type>:<subtype>"` donde el subtipo es el
  campo cerrado de cada tipo: `photo_interacted:{zoom|navigate}`, `block_dwelled:{Block}`,
  `cta_approached:{hover|near}`, `checkout_advanced:{CheckoutStep}`, `exit_signaled:{ExitSignal}`.
  Los tipos sin subtipo (`product_viewed`, `size_selector_interacted`, `variant_selected`,
  `product_returned_to`, `added_to_cart`, `removed_from_cart`, `listing_viewed`) sólo por tipo.
- `Signals` (valor del dominio `barrier`) es la **agregación** de una secuencia de eventos:
  `count(key)`, `dwellMs(block)` (suma de `dwellMs`), `firstAt(key)` / `lastAt(key)` (para
  secuencias: `sequence(a, b)` ⇔ `firstAt(a) < lastAt(b)`), y es un **monoide**:
  `Signals.empty()`, `Signals.of(events)`, `a.merge(b)` (conteos y permanencias suman; instantes
  min/max). El estado de sesión acumula señales por `merge`; la inferencia evalúa sobre la
  sesión acumulada (que incluye el lote): "en el lote y en la sesión hasta ahora" sin dos
  vocabularios.
- Predicados (cerrados): `eventCount { type, subtype?, min }`, `dwellSeconds { block, min? }`
  (`min` ausente ⇒ `readingSeconds` de la política), `sequence { first, then }` (dos referencias
  `{ type, subtype? }`), `returnedToProduct`, `productAttribute { key, value }`,
  `variantAvailable`, `sessionAddedToCart` (`count(added_to_cart) ≥ 1`),
  `sessionEnteredCheckout` (`count(checkout_advanced) ≥ 1`). Combinadores: `all`, `any`, `not`.
- Runtime: `ingestion` gana las listas `EVENT_TYPES`, `BLOCKS`, `PHOTO_INTERACTIONS`,
  `CTA_APPROACHES`, `CHECKOUT_STEPS`, `EXIT_SIGNALS` como `as const` (hoy sólo son tipos) con
  una prueba de réplica contra los `enum` del contrato, para que `BarrierRules.of` valide una
  política contra el vocabulario **en runtime** (SC-003), no sólo en tipos.
- Alternativa rechazada: hechos como strings libres validados por expresión (`"count >= 2"`):
  necesita parser y abre el vocabulario; ADR-026.

## R-04 Forma de la política y su evaluación

- `DecisionPolicy` (dominio `decision`), aggregate `of(record) → Result<DecisionPolicy,
DecisionError>`: `version` (no vacía), `rules: BarrierRules` (módulo `barrier`), `threshold`
  0–1, `readingSeconds` ≥ 0, `weights { strong, supporting }` 0–1, `priority` (permutación
  exacta de `BARRIERS`), `highIntent: "from-cart" | "from-checkout" | "never"`,
  `abandonment: "nothing" | "reassure-returns"`, `interventionsPerSession` ≥ 1,
  `evidence { freshStockAndPrice: Barrier[], availableVariant: Barrier[] }`.
- `BarrierRules.of({ rules, weights, readingSeconds })` (dominio `barrier`): cada regla `{ id,
when: Condition, barrier, strength: "strong" | "supporting", weight? }`; invariantes: ids
  únicos y no vacíos; `barrier ∈ BARRIERS`; toda referencia de `when` existe en el vocabulario
  (tipo, subtipo del tipo, bloque); `weight` (si se da) 0–1; `min` ≥ 0; al menos una regla por
  barrera. `infer(signals, facts) → BarrierVerdict { policyVersion?, confidences:
Record<Barrier, number>, matched: readonly RuleId[] }` — puro: confianza = `min(1, Σ pesos de
las reglas cumplidas)`. La elección de la dominante (umbral, prioridad) es del veredicto, para
  que el ledger conserve **las tres** confianzas (ITT necesita lo que casi se dijo).
- `weight` por regla: derivado de `strength` con `weights` de la política (0,4 / 0,2 por
  defecto); una regla puede fijarlo explícitamente (0–1). Así la spec ("fuerte + apoyo") y el
  ajuste fino conviven.
- `DecisionPolicy.verdict({ arm, inference, truth, session })` → `Verdict = { kind: "intervene",
barrier, confidence, anchor, messageVersionId } | { kind: "no-op", reason }`, puro, en este
  orden: sin experimento ⇒ `no-active-experiment`; CONTROL ⇒ `control-arm`; alta intención ⇒
  `high-intent`; presupuesto agotado ⇒ `session-budget-exhausted`; barrera dominante por
  umbral + prioridad, o abandono sin señal ⇒ candidata `returns` con confianza `weights.supporting`;
  ninguna ⇒ `barrier-unclear`; evidencia: `unknown/absent|unknown-*` ⇒ `evidence-missing`;
  `unknown/stale` o `stockAndPrice: stale` cuando la barrera lo exige ⇒ `evidence-stale`;
  variante no disponible cuando la barrera lo exige ⇒ `variant-unavailable`; contexto sin
  `variantId` cuando la barrera exige la variante ⇒ `evidence-missing`; si no ⇒ `intervene`.
  La inferencia se ejecuta y se registra **antes** del brazo (constitución III): CONTROL y
  TREATMENT llevan la misma `inference` en el ledger.
- Alternativa rechazada: `json-rules-engine` / `rulepilot`: vocabulario abierto (cualquier
  ruta del objeto), evaluación con `any`, sin validación por construcción contra el
  vocabulario, y dependencia npm en el dominio (prohibida por `arch`). Criterio de revisión en
  ADR-026: adoptar un motor genérico cuando un merchant necesite hechos fuera del vocabulario o
  autoría propia desde el portal (016).

## R-05 Evidencia y anclaje

- Variante en foco: `page.productId` / `page.variantId` del **último** evento de ficha de
  producto del lote (el SDK resuelve la ficha vigente). Sin `productId` ⇒
  `page-context-incomplete` (como hoy) sin consultar el catálogo. Sin `variantId` ⇒ se consulta
  el producto (`snapshot.product`) para atributos; las barreras que exigen variante
  (`availableVariant`) ⇒ `evidence-missing`. `ProductTruthService` gana `product(merchantId,
productId)` → `known-product { product, freshness.catalog } | unknown` para ese caso (mismo
  servicio, misma frescura).
- Los hechos de producto para las reglas (`productAttribute`, `variantAvailable`) salen de la
  verdad, aunque esté `stale` (guardia, no claim: un atributo viejo sigue siendo atributo).
- Anclaje por barrera: `ANCHOR_BY_BARRIER = { fit: "size_selector", price: "price", returns:
"policies" }` (dominio `decision`); `messageVersionId = "msg_<barrier>_<anchor>_v0"` hasta
  la 015. `reason` de la `InterveneDecision` = la barrera (`fit` | `price` | `returns`), y en
  el abandono sin señal también `returns` (el ledger distingue por `inference.trigger:
"abandonment"`).
- Cierre de ADR-024: `ANCHORS`, `Anchor`, `Intervention` pasan a `domain/shared-kernel/intervention.ts`
  (ledger reexporta nada: importa del kernel; el controller y `confirmExposure` importan del
  kernel); `BARRIERS`/`Barrier` nacen en `domain/shared-kernel/barrier.ts` (los comparten
  `barrier`, `decision` y `ledger`, que no dependen entre sí en esa dirección). `Signals` **no**
  va al kernel: es del módulo `barrier`.

## R-06 Ledger: qué registra la decisión

- `DecisionFacts` gana `inference?: DecisionInference` (ausente sólo cuando el plano no llegó a
  inferir: `page-context-incomplete`, `ledger-unavailable` por asignación):
  `{ policyVersion: string; confidences: Record<Barrier, number>; matched: readonly string[];
barrier?: Barrier; trigger: "rules" | "abandonment" | "none"; evidence: { truth: "known" |
"known-product" | "absent" | "stale" | "unknown-product" | "unknown-variant" | "not-consulted";
stockAndPrice?: "fresh" | "stale"; available?: boolean } }`. Tipos con strings del kernel
  (`Barrier`) para no depender de `barrier`/`catalog`. El DTO del SDK **no** lo lleva (FR-040);
  `toDecisionDto` ya copia campos explícitos.
- `DecisionRecorder` (servicio en `application/ledger/services/`): `record(facts sin id,
outcome) → Result<Decision, LedgerUnavailable>` acuña el id (`DecisionIdGenerator`), construye
  la decisión y la escribe; la degradación ADR-021 (loguear y `NO_OP ledger-unavailable`) queda
  en el orquestador, que es quien decide qué responder.

## R-07 Estado de sesión

- Puerto `SessionStateStore` (`application/decision/ports/`): `load(merchantId, sessionId) →
Promise<SessionState | undefined>`, `save(merchantId, sessionId, state) → Promise<void>`.
  `SessionState` (dominio `decision`, clase): `signals: Signals`, `interventions: number`,
  `updatedAt`; `absorb(batchSignals) → SessionState`, `withIntervention()`. La ventana
  `SESSION_WINDOW = { ttlMs: hours(24), maxSessions: 100_000 }` en
  `application/decision/policies/session-window.ts` (mismos valores que la deduplicación;
  documentado). Gateway `memorySessionStateStore(clock, window)` por merchant, sin cruzar.
- Orden en el plano: `load` → `absorb` → inferir/decidir → `save` (con la intervención contada)
  → registrar. Si el ledger no acepta, la intervención se suprime **y no se cuenta** (se guarda
  el estado sin la intervención): el presupuesto mide lo que el visitante vio.

## R-08 Composición y aislamiento

- `modules/barrier.ts`: `BarrierPorts { inference: BarrierInference }`,
  `ruleBarrierPorts: Bindings` (`RuleBasedBarrierInference`). `modules/decision.ts`:
  `DecisionPorts extends ExperimentPorts, CatalogPorts { policies: DecisionPolicyDirectory;
sessions: SessionStateStore; decisions; decisionIds; inference }`, `configDecisionPorts(merchants)`
  y `memoryDecisionPorts(clock)`; `decisionPlaneOf(ports)` construye `DecisionService`;
  `ingestionModule` lo recibe como `decisionPlane`. `MODULES` suma `barrierModule` y
  `decisionModule` (sirven ninguna operación, como `experiment`).
- `MerchantConfig.decisionPolicy?: DecisionPolicy`; `configDecisionPolicyDirectory` devuelve la
  del merchant o `DEFAULT_DECISION_POLICY` (constante del dominio `decision`, versión
  `default-1`, construida por `DecisionPolicy.of` y verificada por prueba).
- Aislamiento (constitución V): políticas por merchant (A umbral alto, B bajo → decisiones
  distintas ante la misma sesión); estado de sesión con clave `merchantId/sessionId` (el mismo
  `sessionId` en A y B son dos sesiones); pruebas en `isolation.test.ts`.

## R-09 Rendimiento

- La inferencia es `O(reglas × predicados)` sobre `Map`s ya agregados; la agregación del lote
  es lineal. Sin I/O nuevo en el camino: política y estado de sesión en memoria, verdad desde
  la caché (010). `ingest-latency.test.ts` conserva su umbral (SC-004); se agrega un caso con
  la política por defecto y una sesión con señales.
