# Research — Feature 012: plano de decisión II

**Fecha**: 2026-09-19 · **Estado**: completo. Decisiones transversales → ADR-027.

## R-01 Qué hay hoy y qué se mueve (verificado en el código)

- `DecisionService.decide` (011): asignación → política → sesión (`absorb`) → foco → verdad →
  inferencia → `DecisionPolicy.verdict` → `DecisionRecorder.record` → sesión guardada (la
  intervención cuenta sólo si el ledger la aceptó). `verdict` encadena, en orden: sin
  experimento → CONTROL → alta intención → presupuesto por sesión → candidata (dominante por
  umbral y prioridad, o reaseguro por abandono) → evidencia por barrera → `intervene` con
  `ANCHOR_BY_BARRIER` y `msg_<barrera>_<anclaje>_v0`.
- Lo que es **inferencia** y se queda en `DecisionPolicy`: reglas, umbral, prioridad, lectura,
  evidencia exigida por barrera (`freshStockAndPrice`, `availableVariant`). Lo que es
  **comercial** y se muda a `CommercialPolicy`: `highIntent`, `abandonment`,
  `interventionsPerSession`. `DecisionPolicy.verdict` pasa a ser `barrierVerdict`: candidata
  de barrera (con disparador) y su evidencia; no decide intervenir.
- `DecisionFacts.inference` tipa con strings del kernel; `selection` se agrega igual, sin que
  `ledger` dependa de `selection` ni de `commercial`.
- `Intervention` (kernel) es `{ messageVersionId, anchor }`; el contrato `Intervention.yaml`
  lo mismo. Agregar `incentive?` es una propiedad opcional en una respuesta: compatible.
- `SessionState` guarda `signals`, `interventions`, `updatedAt`; gana `lastInterventionAt` para
  el cooldown. No hay estado por visitante: nace `VisitorState` + `VisitorStateStore`.
- `decision-policy-config.ts` tiene el parser de `Condition` (`condition(value, at)`): se
  reutiliza para `returnRisk` de la política comercial. La validación del vocabulario vive
  como funciones privadas de `barrier-rules.ts` (`checkCondition`): se expone en el módulo
  `barrier` para que la política comercial valide su condición por construcción.
- `ProductTruth` (catálogo) trae `product.attributes`, `freshness.stockAndPrice`,
  `variant.available`: todo lo que el gate necesita, aplanado por el orquestador.

## R-02 Módulos y dependencias

- **`selection`** (dominio): candidatos, claims, perfil de evidencia del merchant y el quality
  gate. Depende sólo de `shared-kernel` (`Barrier`, `Anchor`). La evidencia entra como hechos
  planos (`GateEvidence`), no como `ProductTruth`: el gate no conoce el catálogo.
- **`commercial`** (dominio): `CommercialPolicy` y su veredicto. Depende de `shared-kernel` y
  `barrier` (reutiliza `Condition` y `FactContext` para `returnRisk`) y de `selection`
  (recibe candidatos juzgados). `selection` no depende de `commercial`.
- **`decision`** suma `selection` y `commercial` a su mapa. Ninguno de los dos nuevos tiene
  capa de aplicación: son reglas puras que el orquestador invoca, como `DecisionPolicy`.
- Alternativa rechazada: un solo módulo `policy` con gate y política comercial: la
  constitución I los nombra como autoridades distintas (selección + gate; política comercial)
  y el gate no debe conocer margen ni techo para no relajarse por configuración.

## R-03 Candidatos y claims como vocabulario cerrado

- `Step`: `information | reassurance | uncertainty | evidence | incentive`, en ese orden
  (`STEPS`). `Claim`: `returns-policy | fit-data | current-price | availability | incentive |
product-attribute:<clave>`. `Candidate { candidateId, barrier, step, anchor, claims }`.
- `CANDIDATES` por barrera, ordenados por escalón (03 §4.8; Assumptions de la spec):
  - `fit`: `msg_fit_size_selector_information_v0` (sin claims: guía general),
    `msg_fit_policies_reassurance_v0` (`returns-policy`),
    `msg_fit_size_selector_evidence_v0` (`fit-data`, `availability`).
  - `price`: `msg_price_price_information_v0` (sin claims: valor general),
    `msg_price_price_evidence_v0` (`current-price`), `msg_price_price_incentive_v0`
    (`incentive`).
  - `returns`: `msg_returns_policies_information_v0` (sin claims),
    `msg_returns_policies_reassurance_v0` (`returns-policy`).
  - Los atributos autorizados no forman candidatos fijos en el MVP (los textos llegan con la
    015); el claim `product-attribute:<clave>` existe en el vocabulario y el gate lo valida,
    con un candidato de prueba en los tests.
- `candidateId` reemplaza a `msg_<barrera>_<anclaje>_v0` en `messageVersionId`: las pruebas de
  la 011 que afirmaban el placeholder cambian a `..._information_v0` / `..._reassurance_v0`;
  el `outcome`/`reason` no cambia (SC-004).
- Un candidato hace claims de una sola barrera y no lleva confianza ni señales: por tipo.

## R-04 Quality gate

- `QualityGate.judge(candidate, evidence: GateEvidence, profile: MerchantProfile) →
GateVerdict` (`acceptable | unacceptable { reason }`), estático y puro. `GateEvidence = {
attributes: ReadonlyMap<string,string>; stockAndPriceFresh: boolean; hasVariant: boolean;
available?: boolean }`; `MerchantProfile = { returnsPolicy: boolean; fitData: boolean;
authorizedAttributes: readonly string[] }` con `EMPTY_PROFILE` (todo falso).
- Reglas por claim (primer fallo, en orden de claims): `returns-policy` ⇒ `no-returns-policy`
  si el merchant no la declaró; `fit-data` ⇒ `no-fit-data`; `current-price` ⇒ `stale-price`
  sin stock y precio frescos; `availability` ⇒ `variant-unavailable` sin variante en foco o
  no disponible; `product-attribute:<k>` ⇒ `attribute-unknown` si el producto no lo tiene,
  `attribute-not-authorized` si el merchant no lo autorizó; `incentive` ⇒ siempre aceptable
  para el gate (si puede salir lo decide la política comercial: **deviación de FR-021**:
  `incentive-not-allowed` pasa a ser motivo de bloqueo comercial, porque techo y escalones son
  de la política y el gate no debe conocerlos; la spec se corrige).
- Escasez numérica y prueba social no existen como claim: imposibles por tipo (03 §4.5).

## R-05 Política comercial

- `CommercialPolicy.of(record)`: `version` no vacía; `maxIncentivePercent` entero 0–100;
  `incentiveLadderPercent` enteros crecientes estrictos, cada uno en 1..techo; `marginPercent`
  opcional 0–100; `directIncentiveOnPrice`; `returnRisk: Condition` validada contra el
  vocabulario (`invalid-return-risk` con `path`); `highIntent`; `abandonment`;
  `interventionsPerSession` ≥ 1; `cooldownSeconds` ≥ 0; `interventionsPerVisitorPerDay` ≥ 1.
- `fallbackBarrier({ barrier?, abandoned }) → Barrier | undefined`: `returns` cuando no hay
  barrera, hubo abandono y `abandonment === "reassure-returns"` (el reaseguro de la 011, ahora
  decisión comercial; el orquestador lo usa para seleccionar y juzgar candidatos de `returns`).
- `verdict(input)`, en orden fijo: sin experimento ⇒ `no-active-experiment`; CONTROL ⇒
  `control-arm`; alta intención ⇒ `high-intent`; presupuesto por sesión o cooldown ⇒
  `session-budget-exhausted`; fatiga por visitante ⇒ `visitor-fatigue`; sin barrera ⇒
  `barrier-unclear`; evidencia faltante de la barrera (`evidenceReason`) ⇒ ese motivo;
  ningún candidato aceptable ⇒ `no-acceptable-candidate`; elección: con `price` y
  `directIncentiveOnPrice`, el de incentivo; si no, el primer aceptable desde el escalón
  habilitado (`abandoned && trigger === "rules"` ⇒ un escalón por encima del primer aceptable,
  D-B; sin nada más arriba, el más alto aceptable); si el elegido es de incentivo se aplican
  los bloqueos económicos (`margin-missing`, `incentive-not-allowed` = techo 0 o escalones
  vacíos, `return-risk` = `facts.holds(returnRisk)`) ⇒ se descarta y se toma el siguiente
  aceptable no económico; si no hay ⇒ `commercial-policy-blocked` con ese motivo. Valor del
  incentivo: primer escalón (≤ techo por invariante). Toda salida lleva `chosen?`,
  `blocked?`, y el orquestador la registra con `commercialPolicyVersion`.
- Por defecto (`commercial-default-1`): techo 10, escalones [5, 10], sin margen (⇒ el
  incentivo se bloquea con `margin-missing` hasta configurarlo), `directIncentiveOnPrice`,
  `returnRisk = all(eventCount(size_selector_interacted) ≥ 2, dwellSeconds(policies))`,
  `from-checkout`, `reassure-returns`, 1 por sesión, cooldown 0, 3 por visitante y día.

## R-06 Estado por visitante y cooldown

- `VisitorState { interventions: readonly Date[] }` (clase): `countSince(now, windowMs)`,
  `withIntervention(now)` (poda lo anterior a la ventana). `VISITOR_WINDOW = { ttlMs:
hours(24), maxVisitors: 100_000 }`; gateway `memoryVisitorStateStore(clock, window)` por
  merchant, mismo patrón que la sesión. Clave `merchantId/visitorId`: no cruza merchants.
- `SessionState.withIntervention(now)` guarda `lastInterventionAt = now`; cooldown = `now −
lastInterventionAt < cooldownSeconds`.
- Dependencias del orquestador: `assignment, policies, state, inference, truth, recorder` =
  6: `PolicyDirectory.policiesFor(merchantId) → MerchantPolicies { decision, commercial,
profile }` reemplaza a `DecisionPolicyDirectory`, y `StateService { recall(merchantId,
sessionId, visitorId, now); remember(...) }` envuelve `SessionStateStore` y `VisitorStateStore`.

## R-07 Contrato y ledger

- `contracts/components/schemas/Incentive.yaml` (`kind: enum [percent]`, `value: integer
1..100`), referenciado desde `Intervention.incentive` (opcional). Descripción con PROPUESTO:
  la mecánica del cupón (código, aplicación en el checkout) es de la plataforma y llega con la
  013/014. `oasdiff`: propiedad opcional nueva en respuesta ⇒ compatible.
- `contracts/no-op-reasons.yaml` + `no-acceptable-candidate`, `commercial-policy-blocked`,
  `visitor-fatigue` (emisor `commercial`).
- `DecisionFacts.selection?: DecisionSelection { candidates: { candidateId, step, verdict,
reason? }[]; chosen?: string; commercialVerdict: { blocked: boolean; reason?: string };
commercialPolicyVersion: string }` (strings). Ausente cuando el plano no llegó a seleccionar
  (sin foco, ledger caído por asignación). `toDecisionDto` no lo copia.

## R-08 Configuración

- `OPE_MERCHANTS[i].commercialPolicy` (forma en `composition/commercial-policy-config.ts`,
  reutiliza `condition()` del parser de la 011, que pasa a un módulo compartido
  `condition-config.ts`) y `OPE_MERCHANTS[i].evidenceProfile { returnsPolicy, fitData,
authorizedAttributes }`. Ausentes ⇒ `DEFAULT_COMMERCIAL_POLICY` y `EMPTY_PROFILE`.
- Merchants de prueba A/B: `evidenceProfile: { returnsPolicy: true, fitData: true }` para que
  los escenarios de la 011 (reaseguro, talle) sigan interviniendo; el de desarrollo también,
  con `marginPercent: 40` para ver el incentivo a mano.

## R-09 Rendimiento

- El gate juzga ≤ 3 candidatos con comparaciones de mapas; la política comercial evalúa una
  condición. Sin I/O nuevo (estado por visitante en memoria). SC-005 con la prueba de latencia
  existente.
