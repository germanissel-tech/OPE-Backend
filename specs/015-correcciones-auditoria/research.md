# Research — corrección de los hallazgos de la auditoría integral (015)

Cada decisión cita el hallazgo que resuelve (`docs/auditoria/trabajo/hallazgos/fase-N.json`,
informe §3) y la alternativa que se descartó. Las tres decisiones del dueño (2026-09-19) están
en la spec (Assumptions) y no se rediscuten.

## R-01 — Enmienda de la constitución VII (F-062)

- **Decisión**: constitución v1.3.0. En VII, la lista del conector de órdenes gana un séptimo
  elemento: "el incentivo aplicado (`kind`, `value`), que no es un dato del comprador"; la
  frase "Campos adicionales se rechazan" se mantiene. Fecha y motivo en el historial de
  versiones de la constitución. ADR-028 §6 cita "constitución VII (v1.3.0)" en lugar de
  "01 §10.3", y anota que 01 §10.3 (documento del MVP, fuera del repo) no fue enmendado y
  lista seis campos; `docs/auditoria/trabajo/afirmaciones.md` A-031/A-070 pasan a "✓ (v1.3.0)".
- **Alternativa descartada**: quitar `incentive` del contrato (versión mayor, retirar
  `IncentiveRedemption`); el dueño eligió enmendar.
- **Consecuencia**: todo Constitution Check futuro cita la versión de la constitución que
  evalúa; el de esta feature evalúa los diez principios explícitamente (Edge case de la spec).

## R-02 — Principio X: se mantiene y se planifica el puerto (F-063)

- **Decisión**: el principio X no cambia. El mapa del contrato (`contracts/api-map.yaml`,
  sección `features`) gana la feature "Platform port and adapters" con el puerto de cuatro
  operaciones, el adaptador genérico (catálogo por REST/archivo + notificación HTTP de orden),
  el adaptador de prueba y la prueba de punta a punta evento → decisión → exposición → orden →
  atribución. Las operaciones del puerto son salientes (OPE llama a la plataforma), así que no
  son entradas de `operations` del mapa; la feature figura en el roadmap y su fuente es la
  constitución X y 02 §6. ADR-025 gana una nota de "Consecuencias": el caso base push es el
  primer escalón; X queda como deuda declarada hasta esa feature. CLAUDE.md § Fuentes de verdad
  no cambia; § Notas operativas gana una línea.
- **Renumeración del roadmap** (consecuencia de que la 014 sea la auditoría y la 015 esta
  feature): `016` Configuration, flags, kill switch and administration; `017` Message
  catalogue; `018` ITT analysis and merchant portal; `019` Persistence and resilience; `020`
  Observability and end-to-end; `021` Platform port and adapters. Toda entrada `feature:` de
  `operations` se actualiza en el mismo commit; `check:api-map` valida que cada número exista.
- **Prosa que cita features por número** (F-017, F-029 y las 23 menciones en CLAUDE.md, ADRs y
  glosario que la fase 5 de la 014 contó): se reemplaza por el nombre de la feature del mapa o
  por la operación (`putFlags`, `createExperiment`), nunca por el número nuevo, para que la
  próxima renumeración no las vuelva a romper. El informe de la 014 es un documento fechado:
  no se reescribe; su anexo de cierre (R-14) explica la renumeración.
- **Alternativa descartada**: enmendar X al caso base push (el dueño eligió planificar).

## R-03 — Tasas 0–1 en la política comercial (F-031)

- **Decisión**: `CommercialPolicyRecord` pasa a `maxIncentiveShare`, `incentiveLadderShare`
  y `marginShare` (0–1); `CommercialPolicy.of` valida tasas (`isRate`, R-08) y escalones
  estrictamente crecientes dentro del techo; la resolución a enteros se conserva al convertir
  en el borde: `commercial-policy-config.ts` lee `maxIncentivePercent`, `incentiveLadderPercent`,
  `marginPercent` del JSON (enteros 0–100, forma) y divide por 100; `Incentive.value` (DTO y
  ledger, `shared-kernel/intervention.ts`) sigue siendo el porcentaje entero que el comprador
  ve: la política lo produce con `Math.round(share * 100)`, como `Experiment.assign` resuelve
  el reparto a buckets enteros. `DEFAULT_COMMERCIAL_POLICY` se escribe en tasas (0,05 y 0,10;
  techo 0,10). Sin cambio de contrato ni de `OPE_MERCHANTS`.
- **Prueba de regresión**: `tests/unit/domain/commercial/verdict.test.ts` y
  `commercial-policy.test.ts` conservan las mismas entradas en porcentaje (vía el conversor
  del borde) y los mismos veredictos; `tests/integration/commercial-policy.test.ts` no cambia
  (misma configuración JSON, mismo DTO). Un caso nuevo: cada entero 1..100 sobrevive el viaje
  porcentaje → tasa → porcentaje (misma propiedad que `assignment-regression.test.ts:45`).
- **Alternativa descartada**: escribir la excepción (el dueño eligió convertir).

## R-04 — Invariantes de merchants y experimentos en su dueño (F-007)

- **Decisión**:
  - `Merchant.of` rechaza `ingestKeys` vacío o con más de dos, claves vacías, `origins` vacío,
    `platformKeys`/`platformSecrets` con más de dos, con errores nuevos del módulo `merchant`
    (`invalid-ingest-keys`, `invalid-origins`, `invalid-platform-keys`,
    `invalid-platform-secrets`; `PlatformKeyCollision` e `InvalidOrigin` se conservan). Los
    códigos entran a `contracts/problem-types.yaml` (ADR-023: todo código existe en el
    catálogo aunque ningún endpoint lo emita; ampliación compatible).
  - El conjunto de experimentos de un merchant gana dueño en el módulo `experiment`:
    `Experiments.of(records)` (valor con regla: como máximo uno activo, ids únicos) devuelve
    `Result<Experiments, ExperimentError>` con `multiple-active-experiments` y
    `duplicate-experiment-id`; `activeFor` en `configExperimentDirectory` pasa a preguntarle
    a `Experiments.active()`. El patrón de `experimentId` (`^[A-Za-z0-9_-]{8,64}$`) es forma
    del contrato y se queda en `config.ts` como forma (no es regla de negocio: el id lo
    acuña el operador); `config.ts` deja de contar claves y orígenes y sólo traduce
    `DomainError` → `ConfigError` con el campo (`rejected()` ya existe en
    `condition-config.ts`).
- **Alternativa descartada**: que `Merchant` contenga los experimentos (haría depender
  `merchant` de `experiment` en el mapa de contextos; hoy `experiment` no depende de
  `merchant` y viceversa).
- **Pruebas**: `merchant.test.ts` `[invariant]` por cada conjunto inválido;
  `experiments.test.ts` nuevo; `config.test.ts` conserva sus casos con el mensaje que ahora
  viene del dominio.

## R-05 — CORS sólo para consumidores navegador (F-051)

- **Decisión**: `SecurityScheme` (`interface-adapters/http/typed.ts`) gana `consumer:
"browser" | "server"`; `modules/merchant.ts` declara `ingestKey` navegador y `platformKey`
  servidor; `build-server.ts` deriva `credentialHeaders` sólo de los esquemas navegador. El
  log sigue redactando todo header. Prueba: `cors.test.ts` con un preflight que anuncia
  `x-ope-platform-key` y `x-ope-timestamp`/`x-ope-signature` → no están en
  `access-control-allow-headers`.
- **Alternativa descartada**: derivar del mapa del contrato en runtime (el mapa no viaja al
  servidor; el cableado ya es la réplica verificada de las capacidades, ADR-025 §6).

## R-06 — Clave de plataforma en tiempo constante (F-053)

- **Decisión**: `constantTimeEquals(a, b)` en `domain/shared-kernel/` (puro: compara
  longitudes y luego XOR sobre todos los code units sin salida temprana); `PlatformSignature.
matches` y `Merchant.ownsPlatformKey` la usan; `owns` (clave de ingesta pública) sigue con
  `includes`. La primitiva entra a la lista de excepciones de `ope/domain-no-loose-functions`
  junto con R-08.
- **Alternativa descartada**: `crypto.timingSafeEqual` en el dominio (Node en el dominio,
  prohibido por `arch`).

## R-07 — Límite de cuerpo por consumidor (F-057)

- **Decisión**: un hook `preParsing` en `build-server.ts` resuelve la operación con
  `api.matchOperation` (ya se usa en la ruta `405`) y aplica el límite del consumidor de su
  tag: `platform` 32 MiB (el snapshot, sin cambio), el resto 1 MiB (un lote de 50 eventos
  pesa decenas de KiB). `Content-Length` mayor que el límite ⇒ `413` Problem Details
  (`payload-too-large`, tipo nuevo del catálogo) antes de leer el cuerpo; un cuerpo `chunked`
  sin `Content-Length` cae en el `bodyLimit` global de Fastify (32 MiB), que se mantiene como
  techo. Prueba: `ingest-events.test.ts` con 1 MiB + 1 byte → `413`; `catalog-size.test.ts`
  sigue en `201`.
- **Alternativa descartada**: una ruta de Fastify por operación con `bodyLimit` propio (el
  servidor rutea por `operationId`, CLAUDE.md § Flujo; una ruta por path es otro mecanismo).

## R-08 — Conocimiento escrito una vez (F-021, F-030, F-033, F-048, F-022)

- `instantOf`: los tres controllers importan `boundary.instantOf`; se borran las copias.
- `isRate`, `isCount`: en `domain/shared-kernel/rate.ts`; `experiment.ts`, `barrier-rules.ts`,
  `condition.ts`, `decision-policy.ts`, `commercial-policy.ts` (R-03) las importan. La regla
  `ope/domain-no-loose-functions` amplía `DEFAULT_ALLOW` con `shared-kernel/rate.ts` (y
  `shared-kernel/compare.ts` de R-06); la lista de excepciones es de la regla, con su fixture.
- Ventana acotada por merchant: `gateways/shared-kernel/windowed-map.ts` con `bucket`/`expire`
  parametrizados (`touchedAt`), usada por `memory-event-dedup`, `memory-session-state-store` y
  `memory-visitor-state-store`; la regla `gateways-no-cross` de `.dependency-cruiser.cjs`
  exceptúa `gateways/shared-kernel/` en `pathNot` (como `CONTEXT_MAP` permite `shared-kernel`
  a todos), con su fixture en `tests/architecture/fixtures/`. Una tabla de pruebas sobre el
  helper (TTL, tope, orden) y las tres pruebas de gateways conservan sus casos de
  comportamiento.
- Tolerancia de reloj: `CLOCK_SKEW_TOLERANCE_MS = minutes(5)` en `shared-kernel/time.ts`;
  `event-batch.ts`, `catalog-snapshot.ts`, `order.ts` y `signature-window.ts` la leen; los
  mensajes de error que la repetían (`EventTimestampOutOfRange`, `CatalogCapturedInFuture`,
  `AHEAD_OF_CLOCK`) dejan de citar el número y llevan los milisegundos en `details` (F-022);
  `UnknownBarrier`/`InvalidPolicyPriority`/`InvalidPolicyEvidence` derivan la lista de
  `BARRIERS.join(", ")`.

## R-09 — Gates que miran lo que creen mirar (F-052, F-013)

- **Stryker**: toda excepción pasa a la forma `next-line` sobre la sentencia exacta; donde una
  sola línea no alcanza (los `case` agrupados de `condition.ts:172` y `signals.ts:113`), el
  `restore` se coloca **antes** del cierre del `switch` en una sentencia propia, y el reporte
  completo (`test:mutation -- --all`) se corre al cierre de la historia 3 para probar que
  ningún `Ignored` queda fuera de las líneas de una excepción (SC-006). `tests/governance/
mutation-diff.test.ts` gana un caso que lee un reporte y falla si un mutante ignorado está
  fuera del rango de su comentario (comprobación mecánica repetible).
- **`no-magic-numbers`**: `detectObjects: true`. Medido el 2026-09-19: 60 avisos en 8 archivos
  (`problem-details.ts`, cinco controllers, `cors.ts`, `commercial-policy-config.ts`), casi
  todos códigos de estado HTTP. Se nombran una vez en `interface-adapters/http/status.ts`
  (`HTTP_STATUS.CREATED`, …; `boundary.ts` ya nombra `CREATED`/`REPEATED` y pasa a leerlos de
  ahí) y `cors.ts` nombra `maxAge`. La justificación del umbral va al lado de la opción en
  `eslint.config.mjs` (FR-013 de la 005).

## R-10 — Vocabularios cerrados por el compilador (F-038, F-039)

- `Claim` pasa a unión discriminada por `kind` (`returns-policy`, `fit-data`, `current-price`,
  `availability`, `incentive`, `product-attribute { key }`); `CANDIDATES` y `QualityGate`
  agotan el `switch` sin `default`; `ATTRIBUTE_CLAIM_PREFIX` se retira. El ledger no registra
  claims (sin cambio en `DecisionSelection`).
- `FACTS` de `condition-config.ts`: `as const satisfies readonly FactCondition["fact"][]` y
  un `tests/types/condition-config.test-d.ts` que afirma `Exclude<FactCondition["fact"],
Fact>` es `never`.

## R-11 — Pruebas: contrato, suite, helper (F-054, F-055, F-056)

- `scripts/test-contract.mjs` configura un merchant con `platformKeys` (sin secretos) y pasa
  también `X-OPE-Platform-Key`; Schemathesis ejercita órdenes, devoluciones y catálogo más
  allá del 401. El aviso "schema validation mismatch" seguirá por las `x-invariants`
  (ADR-007); se documenta en el encabezado del script.
- Vitest: `projects` `fast` (todo menos las carpetas que ejecutan herramientas) y `tools`
  (`tests/audit`, `tests/governance/quality.test.ts`, `tests/unit/contract-docs.test.ts`);
  `npm test` corre `fast`, `npm run test:tools` la otra, CI corre ambas; CLAUDE.md § Comandos
  lo dice. Las 22 pruebas de integración levantan la app en `beforeAll` y reemplazan los
  puertos en memoria por prueba (`startTestApp` gana `resetPorts()` o la fábrica por archivo);
  medido el 2026-09-19: 162 s de los 522 s de CPU son integración con una app por `it`.
- `tests/helpers/test-app.ts`: `eventOf` toma `occurredAt` del `NOW` que `fixedClock` usa por
  defecto (exportado), no del reloj real.

## R-12 — Cabeceras de prueba con feature (F-020)

- **Decisión**: forma `// Feature NNN (FR-…, SC-…; …)` que 011–013 ya usan; las 86 cabeceras
  restantes se completan con la feature que las creó (la que lista el archivo en su
  `quickstart.md`; en duda, `git log --follow`). Verificación en `tests/governance/` (o en el
  script de idioma, que ya recorre todo `tests/`): toda cabecera con `FR-`/`SC-` nombra
  `Feature NNN`. Sin cambio de contenido de las pruebas.

## R-13 — Forma y legibilidad (F-012, F-041 y el resto de la historia 4)

- **F-012 (`build-server.ts`, ocho motivos de cambio)**: se aplica la división propuesta en el
  informe en tres archivos de `infrastructure/http/`: `raw-bodies.ts` (parser y `WeakMap`),
  `security-boundary.ts` (outcomes, capacidades, `registerSecurity`) y `dispatch.ts` (rutas
  comodín, validación de la respuesta, errores de Fastify); `build-server.ts` queda como el
  ensamblado. Sin cambio de comportamiento: `server.test.ts`, `security-capabilities.test.ts`,
  `logging-privacy.test.ts` y Schemathesis no cambian.
- **F-041 (slices transitivos)**: se **rechaza** para esta feature, con motivo: la propuesta
  (que un módulo provea servicios y `wireModules` los enlace por orden) cambia `wiring.ts` y
  el perfil para todos los módulos por un beneficio de legibilidad de dos `extends`; se anota
  como riesgo en el anexo de cierre para la feature de persistencia, que va a tocar los
  perfiles de todos modos. F-040 (ISP en `NotifyOrderDependencies`) sí se aplica (`Pick`).
- El resto de la historia 4 aplica su `after` tal cual: F-001, F-003, F-004, F-005, F-006
  (mover `tests/unit/health.test.ts` a `tests/unit/application/system/`), F-009 (`merchantOf`
  a `security/principal.ts`), F-011, F-016, F-017, F-018, F-019, F-023, F-024, F-025, F-026
  (se borra `variant()` y `#byVariant`; `lookup` sigue con `find`), F-027, F-028, F-032,
  F-034 (derivar `SESSION_WINDOW` de `DEDUP_WINDOW`), F-035, F-036, F-037 (`Order.correlated`),
  F-047 (comentario), F-058 (ADR-029 §3).

## R-14 — Cierre de la auditoría y trazabilidad (FR-001..FR-003)

- **Decisión**: los JSON de hallazgos ganan `closure: { status: "resolved" | "absorbed-by" |
"rejected", by: "<commit>" | "F-NNN" | "<motivo>", feature: "015" }` sin tocar los campos
  que `verify-finding` valida (`additionalProperties: false`: se agrega `closure` al esquema
  de la skill como campo opcional, con su prueba en `tests/audit/`). El informe de la 014 gana
  un **anexo de cierre** fechado (§8): tabla F-NNN → estado → commit, la renumeración del
  mapa, los tres hallazgos que van a la persistencia (nombrada, no numerada) y el resultado de
  la re-corrida (SC-002): `run-gates.mjs` sobre los 15 alcances y la rúbrica sobre los
  archivos tocados, con el estado global recalculado por la regla fija.
- **Commits**: uno por historia (cuatro) más el de cierre; la rama abre PR a `main` al final,
  sin merge hasta que el dueño lo pida.
