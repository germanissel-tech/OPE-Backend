# Feature Specification: Plano de decisión I — barrera y evidencia

**Feature Branch**: `011-plano-de-decision-i`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Plano de decisión I: barrera y evidencia. Primera feature en la
que una decisión puede ser INTERVENE. Módulo `decision` con la orquestación del camino crítico
(asignación → inferencia de barrera → evidencia de producto → intervención o NO_OP → ledger);
inferencia de barrera como regla pura sobre un vocabulario cerrado de hechos; política de
decisión por merchant como reglas tipadas, versionadas y validadas por construcción, con una
política por defecto; evidencia de producto fail-closed; intervención mínima con anclaje y
mensaje placeholder; puertos `BarrierInference`, `DecisionPolicyDirectory` y estado de sesión;
motivos de NO_OP nuevos; cierre de los PROPUESTO de ADR-024; ADR-026; holdout como pregunta
abierta."

## Contexto

Hasta hoy OPE observa y registra pero nunca habla: toda decisión es `NO_OP` con motivo. Las
features 004–010 construyeron las dos entradas del plano de decisión —qué hizo el visitante
(ingesta) y qué es verdad del producto (catálogo)— y el experimento que permite medir. Esta
feature construye el plano en su primera versión: **inferir por qué alguien que quería comprar
se está frenando** (una de las tres barreras del MVP: talle y calce, precio y valor, cambios y
devoluciones; 03 §4.2, DECIDIDO), **verificar que hay verdad suficiente para sostener lo que se
diría** (01 §4.3) y **decidir intervenir o callarse**, dejando en el ledger todo lo necesario
para reconstruir el razonamiento (01 §7).

Dos decisiones fijan la forma. Primera: **cada merchant tiene su propia política de decisión**.
Un merchant es un comercio con su propio experimento; una tienda de indumentaria deportiva y
una de moda femenina no reaccionan a las mismas señales ni con los mismos umbrales, y cambiar
la política con un experimento activo es un experimento nuevo (misma regla que la semilla y el
reparto, ADR-022). Segunda: **la política es un dato, no código**: reglas "cuando ⟨condición⟩
entonces ⟨barrera, peso⟩" sobre un **vocabulario cerrado** de hechos que OPE ya captura, más
umbrales, prioridades y respuestas ante los bordes. Un merchant combina lo que OPE sabe; no le
agrega hechos ni barreras por configuración (eso es alcance de producto). El evaluador es una
regla pura del dominio; la elección de motor propio frente a una librería genérica y su
criterio de revisión quedan en una decisión de arquitectura (ADR-026).

Fuera de esta feature: el quality gate del claim, la política de incentivos (techo, escalones,
cooldown, fatiga) y la selección entre candidatos (012); el catálogo de mensajes real (015); la
configuración en caliente y el portal (014, 016); la persistencia (017).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - OPE infiere la barrera con la política del merchant y decide (Priority: P1)

Un visitante de TREATMENT interactúa con la ficha de producto; con cada lote, OPE evalúa las
reglas de la política de su merchant sobre lo que el visitante hizo (en el lote y en la sesión
hasta ahora) y obtiene la barrera dominante con una confianza, o ninguna. Si la confianza
supera el umbral de la política y hay verdad de producto suficiente, la decisión es
`INTERVENE` con el anclaje de esa barrera y una referencia a un mensaje; si no, `NO_OP` con el
motivo exacto. La decisión registra la barrera, la confianza, las señales que la produjeron y
la versión de la política.

**Why this priority**: es el producto. Sin esto OPE no interviene nunca.

**Independent Test**: con la política por defecto y un merchant con experimento al 100 %
TREATMENT, una sesión con dos interacciones con el selector de talle y lectura de la guía de
talles produce `INTERVENE` en `size_selector` con barrera `fit`; una sesión con una sola
señal débil produce `NO_OP barrier-unclear`; el ledger guarda barrera, confianza, señales y
versión de política en ambos casos.

**Acceptance Scenarios**:

1. **Given** un visitante de TREATMENT con verdad de producto fresca, **When** su lote acumula
   dos interacciones con el selector de talle y 6 s en la guía de talles, **Then** la decisión
   es `INTERVENE`, anclaje `size_selector`, barrera `fit`, confianza ≥ umbral, y el ledger
   registra las señales y `policyVersion`.
2. **Given** el mismo visitante con una sola interacción con el selector y nada más, **When**
   se decide, **Then** `NO_OP` con motivo `barrier-unclear` y el ledger registra la barrera
   candidata con su confianza por debajo del umbral.
3. **Given** un visitante que agregó al carrito y luego leyó políticas 8 s, **When** se decide,
   **Then** barrera `returns`, anclaje `policies`.
4. **Given** un visitante que agregó y quitó del carrito sin ninguna otra señal, **When** se
   decide, **Then** la respuesta al abandono de la política por defecto: `INTERVENE` de reaseguro
   en `policies` con confianza mínima marcada como "abandono sin señal".
5. **Given** un visitante que ya entró al checkout, **When** se decide, **Then** `NO_OP`
   `high-intent`, aunque haya señales.
6. **Given** un visitante de CONTROL, **When** se decide, **Then** `NO_OP control-arm`, pero el
   ledger registra igualmente la barrera inferida y su confianza (misma inferencia para ambos
   brazos, constitución III).
7. **Given** dos barreras con la misma confianza, **When** se decide, **Then** gana la primera
   del orden de prioridad de la política (por defecto: `returns` → `fit` → `price`).
8. **Given** una sesión que ya recibió una intervención, **When** llega un lote con señales
   fuertes, **Then** `NO_OP session-budget-exhausted` (por defecto, una intervención por
   sesión).

---

### User Story 2 - Sin verdad de producto suficiente, OPE se calla (Priority: P1)

Antes de intervenir, OPE consulta la verdad de la variante en foco (el producto y la variante
del contexto de página del lote). Sin verdad, o con verdad demasiado vieja para lo que el
mensaje necesita, no interviene; con una variante no disponible, nunca la recomienda. Lo
registra con el motivo.

**Why this priority**: es lo que separa una intervención comercial de un mensaje de marketing
(01 §4.3): OPE no afirma lo que no puede sostener.

**Independent Test**: la misma sesión de la historia 1 con el catálogo ausente produce `NO_OP
evidence-missing`; con el snapshot de hace tres días, `evidence-stale`; con la variante en
foco marcada no disponible y barrera de talle, `NO_OP variant-unavailable`; con stock viejo
(2 h) y barrera de devoluciones, `INTERVENE` (el mensaje de reaseguro no depende del stock).

**Acceptance Scenarios**:

1. **Given** un merchant sin snapshot de catálogo, **When** una sesión reúne señales de talle,
   **Then** `NO_OP evidence-missing`.
2. **Given** un snapshot más viejo que el presupuesto de catálogo, **When** se decide, **Then**
   `NO_OP evidence-stale`.
3. **Given** verdad fresca y la variante en foco **no disponible**, **When** la barrera es de
   talle, **Then** `NO_OP variant-unavailable` (no se recomienda un talle agotado).
4. **Given** stock y precio viejos (2 h) pero catálogo fresco, **When** la barrera es de
   devoluciones o de calce, **Then** `INTERVENE` (esos mensajes no dependen de disponibilidad ni
   precio); **When** la barrera es de precio, **Then** `NO_OP evidence-stale`.
5. **Given** un lote cuyo contexto de página no tiene producto resuelto, **When** se decide,
   **Then** `NO_OP page-context-incomplete` (motivo existente), sin consultar el catálogo.
6. **Given** el contexto de página tiene producto pero no variante, **When** la barrera es de
   talle, **Then** `NO_OP evidence-missing`; **When** es de devoluciones, **Then** se decide con
   la verdad del producto (la política no necesita variante).

---

### User Story 3 - La política de decisión es del merchant, versionada y validada (Priority: P1)

El operador de OPE declara, junto al experimento, la política de decisión de cada merchant:
sus reglas, umbrales, prioridad, criterio de alta intención, respuesta al abandono y
presupuesto de intervenciones por sesión. Una política que nombra un hecho, una barrera o un
bloque que OPE no conoce no se construye y el servidor no arranca. Un merchant sin política
usa la política por defecto. Cada decisión registra la versión de política con la que se tomó.

**Why this priority**: es lo que hace de OPE un producto configurable por comercio sin
convertirlo en un motor de reglas abierto.

**Independent Test**: dos merchants con políticas distintas (uno exige dos señales fuertes,
el otro una) deciden distinto ante la misma sesión; una política con un hecho inexistente
impide el arranque con un error que nombra el campo; el ledger de A muestra `policyVersion`
de A y el de B el de B.

**Acceptance Scenarios**:

1. **Given** el merchant A con umbral alto y B con umbral bajo, **When** la misma secuencia de
   eventos llega a cada uno, **Then** A decide `NO_OP barrier-unclear` y B `INTERVENE`.
2. **Given** una política que referencia `block: "footer"` (bloque inexistente) o una barrera
   `variant`, **When** arranca el servidor, **Then** rechaza con un error de configuración que
   cita `merchants[i].decisionPolicy.rules[j]`.
3. **Given** un merchant sin `decisionPolicy`, **When** decide, **Then** usa la política por
   defecto y registra su versión (`default-1`).
4. **Given** una política con `version` distinta de la anterior, **When** se registra una
   decisión, **Then** el ledger lleva la nueva versión; el análisis (016) sólo compara decisiones
   de la misma versión.
5. **Given** una regla con condiciones `todas` / `alguna` / `no` anidadas, **When** se evalúa,
   **Then** el resultado es el de la lógica booleana esperada (probado por tabla).

---

### User Story 4 - La cadena de evidencia se recorre de punta a punta (Priority: P2)

Con decisiones `INTERVENE` reales, el SDK puede confirmar la exposición y el ledger pasa de
`ASSIGNED` → `DECIDED` → `EXPOSED` sin intervención manual: `confirmExposure` responde `201`
para una decisión del plano, y `422 exposure-of-no-op` para un `NO_OP`.

**Why this priority**: valida que 004, 007, 010 y 011 encajan; es la primera vez que el flujo
completo del MVP se puede ejecutar.

**Independent Test**: ingesta que produce `INTERVENE` → `confirmExposure` con esa
`decisionId` → `201 recorded`; repetir → `200 already-recorded`.

**Acceptance Scenarios**:

1. **Given** una decisión `INTERVENE` del plano, **When** el SDK confirma la exposición, **Then**
   `201` y el ledger tiene `ASSIGNED`, `DECIDED` (con barrera y señales) y `EXPOSED` de la misma
   sesión y visitante.
2. **Given** la respuesta al SDK, **When** se lee, **Then** contiene `intervention.anchor` y
   `intervention.messageVersionId` con el placeholder `msg_<barrera>_<anclaje>_v0`, y nunca la
   barrera, la confianza ni las señales (eso es del ledger).

---

### Edge Cases

- Lote sin eventos de ficha de producto (listado, carrito): no hay barrera que inferir;
  `NO_OP page-context-incomplete` como hoy.
- Sesión que cruza dos productos: el estado de sesión es por sesión, la verdad de producto se
  consulta para el producto del lote actual; el retorno entre productos es una señal, no un
  cambio de sesión.
- El estado de sesión (agregó al carrito, entró al checkout, intervenciones ya decididas) vive
  en memoria en esta feature, con la misma ventana que la deduplicación; una sesión "olvidada"
  vuelve a empezar (documentado; la persistencia lo resuelve en 017).
- CONTROL nunca recibe `intervention` aunque la inferencia diga `INTERVENE`: la decisión
  registrada es `NO_OP control-arm` con la barrera inferida en el ledger (el análisis ITT la
  necesita).
- Un merchant sin experimento activo: `NO_OP no-active-experiment` como hoy; la inferencia se
  registra igual.
- Permanencia en un bloque enviada en varios eventos (`block_dwelled` repetidos): se suma por
  bloque dentro del lote y de la sesión.
- La política por defecto es la misma para todos los merchants que no declaran una; su versión
  se distingue de las declaradas (`default-<n>`).
- Ledger no disponible: sigue ADR-021 (`NO_OP ledger-unavailable` sin registrar).

## Requirements _(mandatory)_

### Functional Requirements

**Orquestación**

- **FR-001**: Por cada lote aceptado de un visitante asignado, el sistema MUST ejecutar en este
  orden: inferencia de barrera con la política del merchant → verificación de evidencia de
  producto → decisión (`INTERVENE` o `NO_OP` con motivo) → registro en el ledger, sin I/O de red
  ni consulta a la plataforma del merchant.
- **FR-002**: La inferencia MUST ejecutarse y registrarse para ambos brazos; sólo TREATMENT
  puede recibir `INTERVENE`; CONTROL registra `NO_OP control-arm` con la barrera inferida.
- **FR-003**: El motivo de `NO_OP` MUST ser uno del catálogo, con estos nuevos:
  `barrier-unclear`, `evidence-missing`, `evidence-stale`, `variant-unavailable`,
  `high-intent`, `session-budget-exhausted`; los existentes (`control-arm`,
  `no-active-experiment`, `page-context-incomplete`, `ledger-unavailable`) se conservan;
  `decision-plane-unavailable` deja de emitirse (queda en el catálogo por compatibilidad).

**Inferencia de barrera**

- **FR-010**: Las barreras MUST ser exactamente tres: `fit` (talle y calce), `price` (precio y
  valor), `returns` (cambios y devoluciones).
- **FR-011**: El vocabulario de hechos MUST ser cerrado y derivarse sólo de lo que OPE captura:
  conteo de eventos por tipo (y por subtipo: bloque, interacción de foto, tipo de acercamiento,
  paso de checkout, señal de salida); permanencia acumulada por bloque en segundos; secuencias
  ordenadas de dos eventos (p. ej. agregó al carrito → leyó políticas; quitó del carrito →
  volvió al producto); retorno a un producto; atributos del producto y disponibilidad de la
  variante desde la verdad de producto; estado de la sesión (agregó al carrito, entró al
  checkout, intervenciones decididas). Ninguna política MUST poder referenciar un hecho fuera
  del vocabulario.
- **FR-012**: La inferencia MUST producir, para cada barrera, una confianza 0–1 a partir de los
  pesos de las reglas que se cumplen (acotada a 1), elegir la dominante, resolver empates por
  el orden de prioridad de la política y devolver también las señales (reglas cumplidas) que
  la sustentan; si ninguna alcanza el umbral, ninguna barrera.
- **FR-013**: La inferencia MUST ser una regla pura del dominio (sin puertos, sin reloj, sin
  aleatoriedad): mismo contexto y misma política ⇒ mismo resultado, en cualquier instancia.

**Política de decisión**

- **FR-020**: `DecisionPolicy` MUST contener: `version` (texto no vacío), reglas (`when`:
  condición; `then`: barrera y peso 0–1; `strength`: fuerte/apoyo), umbral de confianza 0–1,
  segundos mínimos de lectura, orden de prioridad (permutación de las tres barreras), criterio
  de alta intención (`from-cart` | `from-checkout` | `never`), respuesta al abandono sin señal
  (`nothing` | `reassure-returns`), intervenciones por sesión (≥ 1) y, por barrera, qué
  clases de verdad exige (`catalog` siempre; `stockAndPrice` opcional).
- **FR-021**: Las condiciones MUST ser un álgebra cerrada: `all(...)`, `any(...)`, `not(...)`
  sobre predicados del vocabulario (`eventCount(type[, subtype]) ≥ n`, `dwellSeconds(block) ≥
s`, `sequence(a, b)`, `returnedToProduct`, `productAttribute(key) = value`,
  `variantAvailable`, `sessionAddedToCart`, `sessionEnteredCheckout`).
- **FR-022**: La política MUST construirse por fábrica con las invariantes: hechos, subtipos,
  bloques y barreras existentes; pesos y umbral en 0–1; prioridad completa; versión no vacía;
  al menos una regla por barrera habilitada. Una política inválida en `OPE_MERCHANTS` MUST
  impedir el arranque con un error que nombra el campo.
- **FR-023**: Un merchant sin política MUST usar la política por defecto, cuya versión es
  `default-1`; la política por defecto MUST codificar los valores propuestos al stakeholder:
  una señal fuerte más una de apoyo (umbral 0,6 con pesos fuerte 0,4 / apoyo 0,2), 5 s de
  lectura, prioridad `returns → fit → price`, alta intención desde checkout, abandono sin señal
  ⇒ reaseguro de devoluciones, una intervención por sesión, `stockAndPrice` fresco exigido sólo
  por `price`, y variante disponible exigida por `fit` (no se recomienda un talle agotado,
  aunque el dato sea viejo: guardia, no claim).
- **FR-024**: Cambiar la política de un merchant MUST cambiar `version`; cada decisión MUST
  registrar `policyVersion`, barrera candidata, confianza y señales cumplidas.
- **FR-025**: La política de un merchant MUST NOT afectar las decisiones de otro (aislamiento
  probado).

**Evidencia de producto**

- **FR-030**: Antes de `INTERVENE`, el sistema MUST consultar la verdad de producto del producto
  y la variante del contexto de página del lote: ausente ⇒ `evidence-missing`; vieja para la
  clase que la barrera exige ⇒ `evidence-stale`; variante no disponible cuando la barrera es de
  talle ⇒ `variant-unavailable`; producto sin variante en el contexto cuando la barrera la
  exige ⇒ `evidence-missing`.
- **FR-031**: La evidencia consultada (frescura por clase, disponibilidad) MUST registrarse en
  la decisión.

**Intervención**

- **FR-040**: `INTERVENE` MUST llevar anclaje por barrera (`fit → size_selector`, `price →
price`, `returns → policies`) y `messageVersionId = msg_<barrera>_<anclaje>_v0` (placeholder
  hasta la 015); la respuesta al SDK MUST NOT contener barrera, confianza ni señales.
- **FR-041**: `confirmExposure` de una decisión del plano MUST responder `201` (cadena
  `DECIDED → EXPOSED`).

**Estado de sesión**

- **FR-050**: El sistema MUST mantener por merchant y sesión: agregó al carrito, entró al
  checkout, intervenciones decididas y las señales acumuladas necesarias para la inferencia
  (conteos y permanencias por bloque de la sesión), detrás de un puerto con implementación en
  memoria y ventana igual a la de deduplicación; MUST NOT cruzar merchants.

**Estructura, contrato y documentación**

- **FR-060**: El módulo `decision` MUST absorber el motivo provisional de `EventBatch`
  (`noOpReason()` desaparece) y el vocabulario de intervención (`Anchor`, `Intervention`)
  MUST pasar al `shared-kernel`; los dos `PROPUESTO` de ADR-024 se cierran.
- **FR-061**: Sin operaciones ni schemas nuevos; `contracts/no-op-reasons.yaml` gana los
  motivos de FR-003 con su emisor y descripción; la réplica del dominio se actualiza.
- **FR-062**: Glosario: `barrera`, `señal`, `evidencia`, `confianza`, `política de decisión`,
  `intención`; ADR-026 con la decisión sobre el motor de reglas y su criterio de revisión;
  PROPUESTO registrado sobre el holdout al pasar a 100 % TREATMENT.

### Key Entities

- **Barrier**: `fit` | `price` | `returns`.
- **Fact vocabulary**: conteos por tipo/subtipo, permanencia por bloque, secuencias, retorno,
  atributos y disponibilidad de la variante, estado de sesión.
- **DecisionPolicy**: versión, reglas (condición → barrera, peso, fuerza), umbral, lectura
  mínima, prioridad, alta intención, respuesta al abandono, presupuesto por sesión, evidencia
  exigida por barrera.
- **Condition**: `all` | `any` | `not` | predicado del vocabulario.
- **BarrierVerdict**: barrera dominante con confianza y señales, o ninguna; siempre con
  `policyVersion` y las confianzas de todas las barreras.
- **DecisionContext**: señales del lote y de la sesión, verdad de producto de la variante en
  foco, brazo, política.
- **SessionState**: por merchant y sesión: carrito, checkout, intervenciones, señales
  acumuladas.
- **Decision (ampliada)**: `+ inference: { policyVersion, barrier?, confidence, signals,
evidence }` en el ledger (no en el DTO).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Con la política por defecto, los escenarios de las historias 1 y 2 producen
  exactamente la decisión y el motivo esperados (tabla de casos, 100 %).
- **SC-002**: La inferencia es determinista: 1 000 evaluaciones del mismo contexto dan el mismo
  veredicto; y pura: no consulta reloj ni puertos (verificado por arquitectura).
- **SC-003**: Toda política inválida de un conjunto de al menos 8 casos (hecho, bloque, barrera,
  subtipo inexistentes; peso/umbral fuera de rango; prioridad incompleta; versión vacía; sin
  reglas) impide el arranque nombrando el campo.
- **SC-004**: El flujo completo ingesta → `INTERVENE` → `confirmExposure 201` pasa en
  integración, y la latencia p95 de ingesta se mantiene ≤ 50 ms con la inferencia activa
  (`ingest-latency.test.ts` sin cambios en su umbral).
- **SC-005**: Aislamiento: políticas y estado de sesión de A no afectan a B (suite de
  aislamiento ampliada).
- **SC-006**: `contract:check`, `quality`, `test:mutation`, `test:contract`, `release-check` en
  verde; `check:markers` sin los dos PROPUESTO de ADR-024 (y con el del holdout).

## Assumptions

- Pesos por defecto: regla fuerte 0,4, de apoyo 0,2; umbral 0,6 (⇒ fuerte + apoyo, o dos
  fuertes); confianza = mínimo(1, suma de pesos de reglas cumplidas de esa barrera).
- Reglas de la política por defecto (traducción de las señales presentadas al stakeholder):
  - `fit` fuerte: `eventCount(size_selector_interacted) ≥ 2 ∧ ¬sessionAddedToCart`;
    `dwellSeconds(size_guide) ≥ 5`; `eventCount(variant_selected) ≥ 2`. Apoyo:
    `eventCount(photo_interacted, zoom) ≥ 2`; `returnedToProduct`.
  - `price` fuerte: `sequence(added_to_cart, removed_from_cart) ∧ ¬dwell(size_guide) ∧
¬dwell(policies)`; `dwellSeconds(price) ≥ 5`; `returnedToProduct` con `dwellSeconds(price) ≥ 5`.
    Apoyo: `eventCount(cta_approached) ≥ 1`; `eventCount(checkout_advanced) ≥ 1 ∧
eventCount(exit_signaled) ≥ 1`.
  - `returns` fuerte: `dwellSeconds(policies) ≥ 5`; `sequence(added_to_cart, block_dwelled:policies)`;
    `eventCount(size_selector_interacted) ≥ 2 ∧ dwellSeconds(policies) ≥ 5`. Apoyo:
    `eventCount(photo_interacted) ≥ 3 ∧ dwellSeconds(description) ≥ 10`; `sequence(block_dwelled:policies,
removed_from_cart)`.
- "Abandono sin señal" = `sequence(added_to_cart, removed_from_cart)` y ninguna barrera sobre
  el umbral; la respuesta por defecto es reaseguro de devoluciones con confianza 0,2 y anclaje
  `policies`.
- La variante en foco es `page.variantId` del lote; si falta, sólo las barreras que no la
  exigen pueden intervenir.
- La ventana del estado de sesión es la de deduplicación (24 h / 100 000 por merchant).
- Los umbrales numéricos se ajustan con datos del piloto; el ledger guarda lo necesario para
  recalibrar sin reinstrumentar.
