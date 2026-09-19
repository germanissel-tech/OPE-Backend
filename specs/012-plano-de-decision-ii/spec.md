# Feature Specification: Plano de decisión II — selección, quality gate y política comercial

**Feature Branch**: `012-plano-de-decision-ii`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "Plano de decisión II: selección, quality gate y política
comercial. Completar las cinco autoridades del camino crítico: selección + quality gate y
política comercial en módulos propios; candidatos ordenados por la escalera del incentivo con
clases de claim; quality gate puro y sin relajación; política comercial por merchant
versionada (techo, escalones, margen, riesgo de devolución, alta intención, cooldown, fatiga,
abandono como amplificador); estado por visitante; `Intervention.incentive`; motivos NO_OP
nuevos; ledger con candidatos y veredictos; glosario; ADR-027."

## Contexto

La 011 dejó al plano de decisión hablando: infiere una barrera, verifica la evidencia y emite
una intervención por barrera con un mensaje placeholder. Pero saltó dos autoridades del camino
crítico (01 §4, constitución I): **selección y quality gate** (01 §4.4) —qué intervenciones
son posibles para esa barrera y cuáles pueden sostenerse con la evidencia que hay— y la
**política comercial** (01 §4.5), la única que emite el veredicto final: cuánto margen puede
gastar el merchant, cuándo un incentivo acelera una compra que va a volver, cuántas veces se
le habla a la misma persona.

Esta feature completa el plano en su forma del MVP. Tres ideas lo ordenan. Primera: **una
intervención es un candidato que declara qué afirma** (sus _claims_: política de devoluciones,
dato de calce, atributo autorizado, precio vigente, incentivo) y el **quality gate** es una
función pura que acepta o rechaza cada candidato según haya evidencia real de esa clase; un
solo claim sin sostén invalida el candidato entero, y el gate no se relaja nunca para mejorar
métricas. Segunda: los candidatos se recorren por la **escalera del incentivo** (03 §4.8):
información → reaseguro → reducción de incertidumbre → evidencia → incentivo; se elige el
escalón más bajo que resuelve la barrera, y el incentivo entra sólo por la escalera o de
inmediato cuando la barrera es precio. Tercera: **la política comercial es del merchant y se
versiona**, como la de decisión (ADR-026): techo, escalones, margen, riesgo de devolución,
alta intención, cooldown y fatiga son datos, y cada decisión estampa la versión con la que se
tomó.

Con la 012, la política de decisión de la 011 queda con lo que es inferencia (reglas, umbral,
prioridad, lectura, evidencia por barrera) y lo comercial (alta intención, abandono,
presupuesto por sesión) pasa a la política comercial con los mismos valores por defecto: el
comportamiento observable de la 011 no cambia salvo donde esta feature agrega algo.

Fuera de esta feature: los textos reales y el catálogo de mensajes (015); la mecánica del
cupón en la plataforma del merchant; configuración en caliente y flags (014); órdenes y
devoluciones (013); histórico de devoluciones por cliente (D-C); persistencia (017).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - El quality gate deja pasar sólo lo que la evidencia sostiene (Priority: P1)

Con una barrera inferida, OPE arma los candidatos de esa barrera (escalones de la escalera)
y valida cada uno contra la evidencia de producto y el perfil del merchant. Un candidato que
afirma el precio vigente necesita stock y precio frescos; uno que cita un atributo necesita
que el catálogo lo tenga y el merchant lo autorice; uno que habla de la política de
devoluciones necesita que el merchant la haya declarado; uno de calce necesita que el
merchant provea ese dato. Sin evidencia para un claim, el candidato es `UNACCEPTABLE`. Si
ninguno pasa, `NO_OP no-acceptable-candidate`.

**Why this priority**: es lo que separa una intervención comercial de un mensaje de marketing
(01 §4.3, §4.4); sin gate, la 011 podía afirmar lo que no sabía.

**Independent Test**: con barrera `returns` y un merchant que **no** declaró política de
devoluciones, todos los candidatos que la citan son rechazados y queda sólo el de
información general (o nada); con el merchant que sí la declaró, el candidato de reaseguro
pasa. El ledger lista cada candidato con su veredicto y motivo.

**Acceptance Scenarios**:

1. **Given** barrera `price`, catálogo fresco y stock/precio fresco, **When** se seleccionan
   candidatos, **Then** el candidato que afirma el precio vigente es aceptable.
2. **Given** barrera `price` con stock y precio viejos, **When** se seleccionan, **Then** ese
   candidato es `UNACCEPTABLE` con motivo `stale-price` y queda registrado; el candidato de
   información (valor, sin cifra) sigue aceptable.
3. **Given** barrera `fit` y un merchant sin dato de calce, **When** se seleccionan, **Then**
   el candidato de recomendación de talle es `UNACCEPTABLE` (`no-fit-data`); el de la guía
   general de talles es aceptable.
4. **Given** barrera `returns` y un merchant sin política de devoluciones declarada, **When**
   se seleccionan, **Then** todo candidato que la cite es `UNACCEPTABLE` (`no-returns-policy`)
   y la decisión es `NO_OP no-acceptable-candidate` si no queda ninguno.
5. **Given** un candidato que cita el atributo `material`, **When** el catálogo del producto
   no lo tiene o el merchant no lo autorizó, **Then** `UNACCEPTABLE` (`attribute-unknown` /
   `attribute-not-authorized`).
6. **Given** cualquier candidato, **When** se valida, **Then** el gate es determinista: la
   misma evidencia y el mismo perfil dan el mismo veredicto, sin consultar reloj ni puertos.

---

### User Story 2 - La política comercial emite el veredicto y gobierna el incentivo (Priority: P1)

Con los candidatos aceptables en orden de escalera, la política comercial del merchant elige:
el primer aceptable del escalón más bajo que resuelve la barrera; si la barrera es precio y la
política habilita el incentivo directo, el incentivo. Antes bloquea lo que no debe salir:
sin margen configurado no sale nada con componente económico; el incentivo elegido nunca
supera el techo ni sale de los escalones; con riesgo de devolución alto no hay incentivo
acelerador; con alta intención no hay descuento; y respeta cooldown por sesión y fatiga por
visitante. Un bloqueo es `NO_OP` con motivo y queda en el ledger con la versión de la
política.

**Why this priority**: es la única autoridad que emite el veredicto (01 §4.5); sin ella el
merchant no controla su margen.

**Independent Test**: barrera `price` confirmada por abandono, merchant con margen 40 %,
techo 10 %, escalones [5, 10] → `INTERVENE` con `incentive { percent: 5 }`; el mismo caso sin
`marginPercent` → `NO_OP commercial-policy-blocked`; con riesgo de devolución alto → mensaje
de valor sin incentivo.

**Acceptance Scenarios**:

1. **Given** barrera `fit` con candidatos aceptables de información y de reaseguro, **When**
   decide, **Then** elige el de información (escalón más bajo) y la respuesta no lleva
   `incentive`.
2. **Given** barrera `price` y política con incentivo directo habilitado, margen y techo,
   **When** decide, **Then** `INTERVENE` con `incentive { kind: "percent", value }` igual al
   primer escalón ≤ techo.
3. **Given** barrera `price` y política **sin** `marginPercent`, **When** decide, **Then**
   ningún candidato con componente económico sale: `NO_OP commercial-policy-blocked`
   (`margin-missing`) si no queda otro aceptable, o el candidato de información si lo hay.
4. **Given** un escalón que supera el techo, **When** se construye la política, **Then** se
   rechaza al arrancar (el techo manda).
5. **Given** riesgo de devolución alto (la condición de la política se cumple: duda de talle y
   lectura de políticas), **When** la barrera es `price`, **Then** no hay incentivo: sale el
   candidato de valor o `NO_OP commercial-policy-blocked` (`return-risk`).
6. **Given** el visitante ya recibió las intervenciones del día que permite la política,
   **When** empieza otra sesión, **Then** `NO_OP visitor-fatigue`.
7. **Given** una intervención hace menos de `cooldownSeconds`, **When** llega otro lote con
   candidato aceptable, **Then** `NO_OP session-budget-exhausted` (cooldown) aunque el
   presupuesto por sesión no esté agotado.
8. **Given** la política comercial por defecto y los escenarios de la 011, **When** se
   ejecutan, **Then** dan el mismo resultado que en la 011 (alta intención desde checkout,
   una intervención por sesión, abandono sin señal ⇒ reaseguro).

---

### User Story 3 - El abandono de carrito amplifica la barrera detectada (Priority: P2)

Sacar algo del carrito no dice por qué se frenó el visitante; confirma que se frenó. Si OPE
ya venía detectando una barrera, el abandono habilita el escalón siguiente de la escalera
para esa barrera; cuando la barrera es precio, habilita el incentivo (D-B). Sin barrera
previa, la respuesta sigue siendo el reaseguro de la 011.

**Why this priority**: cierra la decisión de producto D-B (03 §6) con la regla que el
stakeholder confirmó: el incentivo entra por barrera de precio, no por reflejo.

**Independent Test**: sesión con señales de precio bajo el umbral de incentivo directo y luego
abandono → `INTERVENE` con incentivo; misma sesión con señales de talle y abandono → escalón
siguiente de `fit` sin incentivo.

**Acceptance Scenarios**:

1. **Given** barrera `price` con la política sin incentivo directo, **When** el visitante
   abandona el carrito, **Then** el escalón habilitado sube uno y el incentivo puede salir
   (respetando margen, techo y riesgo).
2. **Given** barrera `fit` y abandono, **When** decide, **Then** sube un escalón dentro de
   `fit` (por ejemplo de información a reaseguro) y nunca hay incentivo.
3. **Given** abandono sin ninguna barrera sobre el umbral, **When** decide, **Then** reaseguro
   de devoluciones (011), sin incentivo.

---

### User Story 4 - Trazabilidad completa en el ledger (Priority: P2)

Cada decisión registra los candidatos considerados con el veredicto del gate y el motivo de
cada rechazo, el candidato elegido, el veredicto de la política comercial con su motivo y las
versiones de ambas políticas. El SDK sigue recibiendo sólo `outcome`, `reason`,
`intervention` (ahora con `incentive` opcional).

**Why this priority**: constitución IX; sin esto el piloto no puede explicar por qué habló o
calló, ni recalibrar techo y escalones con datos.

**Independent Test**: tras una decisión, el ledger tiene `candidates[]` con
`{ candidateId, step, verdict, reason? }`, `chosen`, `commercialVerdict`,
`commercialPolicyVersion`; el DTO no tiene ninguna de esas claves.

**Acceptance Scenarios**:

1. **Given** una decisión con tres candidatos (dos rechazados, uno elegido), **When** se lee
   del ledger, **Then** los tres aparecen con veredicto y motivo, y `chosen` es el tercero.
2. **Given** una decisión bloqueada por la política, **When** se lee, **Then**
   `commercialVerdict = { blocked: true, reason: "margin-missing" }` y el candidato que iba a
   salir queda registrado como `chosen` con `blocked`.
3. **Given** la respuesta al SDK, **When** se inspecciona, **Then** no contiene `candidates`,
   `claims`, `commercialVerdict` ni versiones.

---

### Edge Cases

- Sin barrera inferida (`barrier-unclear`) no hay candidatos: el gate y la política no se
  invocan y el ledger lo dice (`candidates: []`).
- CONTROL: la selección, el gate y la política **se ejecutan y se registran** igual; el
  veredicto final es `control-arm` (constitución III).
- Política comercial ausente para un merchant: la por defecto (`commercial-default-1`), con
  margen ausente ⇒ sin incentivos hasta que el merchant lo configure.
- Escalones vacíos o techo 0 ⇒ el merchant no admite incentivos: los candidatos de incentivo
  nunca salen; el resto de la escalera sigue.
- Riesgo de devolución alto y barrera `returns`: la política de devoluciones se cita igual (no
  es un incentivo).
- Estado por visitante en memoria con ventana de un día; un visitante olvidado vuelve a cero.
- Ledger no disponible: ADR-021; una intervención no registrada no cuenta para cooldown ni
  fatiga.

## Requirements _(mandatory)_

### Functional Requirements

**Orquestación y autoridades**

- **FR-001**: El camino crítico MUST ejecutar, en este orden y sólo con barrera inferida:
  selección de candidatos → quality gate → política comercial → registro; ninguna autoridad
  MUST forzar una intervención y sólo la política comercial emite el veredicto final.
- **FR-002**: Selección + gate y política comercial MUST vivir en módulos propios; el
  orquestador sólo transporta el contexto.
- **FR-003**: Ambos brazos MUST atravesar selección, gate y política; CONTROL registra el
  resultado y responde `control-arm`.

**Candidatos**

- **FR-010**: Los candidatos MUST ser un vocabulario cerrado de OPE por barrera, cada uno con
  `candidateId` (`msg_<barrera>_<anclaje>_<escalón>_v0` hasta la 015), barrera, escalón
  (`information` | `reassurance` | `uncertainty` | `evidence` | `incentive`), anclaje y claims
  (`returns-policy`, `fit-data`, `product-attribute:<clave>`, `current-price`, `availability`
  como guardia, `incentive`). Un merchant no MUST poder agregar candidatos por configuración.
- **FR-011**: Todo candidato MUST hacer claims de una sola barrera y MUST NOT exponer estados
  ni scores internos (por construcción: los claims no incluyen confianza, señales ni brazo).

**Quality gate**

- **FR-020**: El gate MUST ser una función pura: candidato + evidencia + perfil del merchant ⇒
  `acceptable` | `unacceptable { reason }`, sin reloj ni puertos.
- **FR-021**: Motivos de rechazo cerrados: `stale-price` (precio vigente sin stock/precio
  fresco), `no-fit-data`, `no-returns-policy`, `attribute-unknown`, `attribute-not-authorized`,
  `variant-unavailable` (recomendación de variante no disponible), `incentive-not-allowed`
  (incentivo con techo 0 o sin escalones).
- **FR-022**: El perfil del merchant MUST declarar `returnsPolicy: boolean`, `fitData: boolean`,
  `authorizedAttributes: string[]`; ausente ⇒ todo falso (fail-closed).
- **FR-023**: Sin ningún candidato aceptable ⇒ `NO_OP no-acceptable-candidate`; el gate MUST
  NOT relajarse por configuración.

**Política comercial**

- **FR-030**: `CommercialPolicy` por merchant, versionada (`version`), con: `maxIncentivePercent`
  (0–100), `incentiveLadderPercent` (lista creciente, todos ≤ techo), `marginPercent`
  (opcional, 0–100), `directIncentiveOnPrice: boolean`, `returnRisk` (condición sobre el
  vocabulario cerrado de hechos de la 011), `highIntent`, `abandonment`,
  `interventionsPerSession` ≥ 1, `cooldownSeconds` ≥ 0, `interventionsPerVisitorPerDay` ≥ 1.
  Inválida ⇒ el servidor no arranca nombrando el campo.
- **FR-031**: Selección: el primer candidato aceptable del escalón más bajo; con barrera
  `price` y `directIncentiveOnPrice`, el de incentivo; con abandono confirmando la barrera,
  el escalón habilitado sube uno (D-B); el incentivo MUST salir sólo con barrera `price`.
- **FR-032**: Bloqueos, en orden: alta intención (`high-intent`), cooldown o presupuesto por
  sesión (`session-budget-exhausted`), fatiga por visitante (`visitor-fatigue`), y para un
  candidato de incentivo: margen ausente, techo 0/escalones vacíos, riesgo de devolución alto
  o valor > techo ⇒ el candidato se descarta y se toma el siguiente aceptable no económico; si
  no hay, `NO_OP commercial-policy-blocked` con motivo (`margin-missing`, `ceiling`,
  `return-risk`).
- **FR-033**: El valor del incentivo MUST ser el primer escalón ≤ techo, y la respuesta MUST
  llevar `intervention.incentive { kind: "percent", value }`; ningún otro candidato lleva
  `incentive`.
- **FR-034**: La política de decisión de la 011 MUST perder `highIntent`, `abandonment` e
  `interventionsPerSession` (pasan a la comercial) y el comportamiento por defecto MUST ser el
  mismo (SC-004).
- **FR-035**: Política comercial por defecto (`commercial-default-1`): techo 10, escalones
  [5, 10], sin margen (⇒ sin incentivos hasta configurarlo), `directIncentiveOnPrice: true`,
  `returnRisk` = duda de talle (≥ 2 interacciones con el selector) y lectura de políticas,
  `highIntent: from-checkout`, `abandonment: reassure-returns`, 1 por sesión, cooldown 0,
  3 por visitante y día.

**Estado por visitante y sesión**

- **FR-040**: El sistema MUST contar intervenciones por merchant y visitante en una ventana
  de un día, detrás de un puerto en memoria, sin cruzar merchants; sólo cuentan las que el
  ledger aceptó.
- **FR-041**: El estado de sesión MUST recordar el instante de la última intervención para el
  cooldown.

**Contrato, ledger y documentación**

- **FR-050**: Sin operaciones nuevas; `Intervention.incentive?` como adición compatible;
  motivos NO_OP nuevos: `no-acceptable-candidate`, `commercial-policy-blocked`,
  `visitor-fatigue`; réplicas actualizadas; la mecánica del cupón queda PROPUESTO.
- **FR-051**: La decisión MUST registrar `candidates[] { candidateId, step, verdict, reason? }`,
  `chosen?`, `commercialVerdict { blocked, reason? }`, `commercialPolicyVersion`; el DTO del
  SDK MUST NOT llevar nada de eso.
- **FR-052**: Glosario: candidato, claim, quality gate, escalera del incentivo, política
  comercial, techo, margen, riesgo de devolución, cooldown, fatiga. ADR-027.
- **FR-053**: Aislamiento probado: política comercial y estado por visitante de A no afectan
  a B.

### Key Entities

- **Candidate**: `candidateId`, `barrier`, `step`, `anchor`, `claims[]`; vocabulario cerrado
  por barrera (catálogo de candidatos de OPE).
- **Claim**: clase de afirmación con la evidencia que exige.
- **MerchantProfile** (evidencia declarada): `returnsPolicy`, `fitData`, `authorizedAttributes`.
- **GateVerdict**: `acceptable` | `unacceptable { reason }`.
- **CommercialPolicy**: ver FR-030.
- **CommercialVerdict**: `{ chosen?, blocked, reason?, incentive? }`.
- **VisitorState**: intervenciones aceptadas por merchant y visitante en la ventana.
- **Decision (ampliada)**: `+ selection { candidates, chosen, commercialVerdict, commercialPolicyVersion }`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Los escenarios de las historias 1–3 dan el veredicto y motivo exactos (tabla,
  100 %).
- **SC-002**: El gate es puro y determinista: 1 000 evaluaciones del mismo candidato y
  evidencia dan el mismo veredicto; ninguna combinación de perfil relaja un rechazo.
- **SC-003**: Toda política comercial inválida de ≥ 8 casos (techo fuera de rango, escalón >
  techo, escalones no crecientes, margen fuera de rango, cooldown negativo, presupuesto 0,
  condición de riesgo con hecho inexistente, versión vacía) impide el arranque nombrando el
  campo.
- **SC-004**: La suite de integración de la 011 pasa sin cambios de expectativa (mismo
  comportamiento por defecto), salvo las claves nuevas del ledger.
- **SC-005**: p95 de ingesta ≤ 50 ms con las cinco autoridades activas.
- **SC-006**: Aislamiento y gates (`quality`, `contract:check`, `test:mutation`,
  `test:contract`, `release-check`) en verde.

## Assumptions

- Catálogo de candidatos del MVP (por barrera, en orden de escalera): `fit`: información
  (guía de talles general), reaseguro (política de devoluciones si declarada), evidencia
  (recomendación de talle con dato de calce + variante disponible); `price`: información
  (valor: atributos autorizados), evidencia (precio vigente), incentivo (porcentaje);
  `returns`: información (cambios en general), reaseguro (política declarada). No hay
  escalón `uncertainty` en el MVP; queda en el vocabulario para la 015.
- El riesgo de devolución se estima por comportamiento en la sesión con la condición de la
  política (D-C fuera de alcance).
- La ventana del estado por visitante es de 24 h desde la última intervención.
- El incentivo es un porcentaje; montos fijos y cupones quedan para la plataforma.
