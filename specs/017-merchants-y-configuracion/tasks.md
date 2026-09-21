# Tasks: Merchants, configuración en tres niveles y administración (017)

**Input**: Design documents from `/specs/017-merchants-y-configuracion/`

**Prerequisites**: plan.md, spec.md, research.md (R-01..R-12), data-model.md, contracts/{admin-api,configuration-levels,sdk-config}.md, quickstart.md

**Tests**: pedidos por la spec (SC-005..SC-007: gates en verde por historia, aislamiento en admin, constantes fuera del código) — cada historia escribe sus pruebas antes que el código (constitución: nada funciona sin prueba ejecutable).

**Organization**: una fase de fundamentos (consumidor `admin`, stores, glosario, catálogos) y una fase por historia (US1 merchants y credenciales, US2 configuración en tres niveles, US3 experimentos, US4 SDK), más el cierre. Un commit por historia con todos los gates en verde.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos, sin dependencia con tareas incompletas)
- **[Story]**: US1, US2, US3, US4

## Path Conventions

Proyecto único: `src/` (anillos `domain/`, `application/`, `interface-adapters/`, `infrastructure/`, `composition/`), `contracts/`, `config/`, `scripts/`, `docs/`, `tests/`.

---

## Phase 1: Setup

- [x] T001 Línea base: `git log -1` en `main` (`ccaa60c`); `npm run contract:check && npm test` en verde; anotar el commit base en `specs/017-merchants-y-configuracion/quickstart.md` § "Cambios respecto del plan"
- [x] T003 [P] Tiempo de las pruebas (pedido del dueño 2026-09-20): `scripts/test-scope.mjs` decide qué proyectos de Vitest corren según el diff contra `origin/main` (o `--all`): el proyecto `tools` (auditoría sobre fixtures, cadena de calidad, `contract:docs`) sólo si cambió `scripts/`, `.claude/`, `contracts/`, `docs/`, `tests/audit/`, `tests/governance/quality.test.ts`, `tests/unit/contract-docs.test.ts`, `vitest*.ts`, `package.json` o `.github/`; `package.json` `"test:scoped"`; `.github/workflows/ci.yml` usa `test:scoped` en vez de `test:all` y elimina los pasos `lint` y `arch` sueltos (ya los encadena `quality`); `tests/governance/test-scope.test.ts` con fixtures de diff; `CLAUDE.md` § Comandos (fila) y § Gates ("durante una historia: `npm test` + `test:mutation -- --files`; `test:all` y la corrida completa de mutación al cierre de la historia"); `test:all` sigue existiendo para el cierre local
- [x] T002 [P] Módulos nuevos declarados: `.dependency-cruiser.cjs` `CONTEXT_MAP` gana `configuration: ["shared-kernel", "merchant", "experiment", "decision", "commercial", "selection", "catalog", "ingestion"]` y `admin: ["shared-kernel", "merchant", "configuration", "experiment"]`; `CLAUDE.md` § "Anillos y módulos" lista `configuration` y `admin`; fixtures de `tests/architecture/fixtures/src/` si una regla nueva lo exige (R-03)

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: el consumidor `admin` con operadores, los catálogos y el glosario que toda historia cita, y el mapa del contrato con la superficie completa de la feature.

- [x] T010 Glosario (ADR-008), notas nuevas en `docs/dominio/` con fuente: `operador.md` (`operator`; ADR-020), `registro-de-administracion.md` (`admin log`; spec 017), `version-de-configuracion.md` (`configuration version`; `mvp:01 §14.2`), `configuracion-de-plataforma.md` (`platform configuration`; constitución XI), `defaults-de-tratamiento.md` (`treatment defaults`; constitución XI), `credencial.md` (`credential`; ADR-014, ADR-029), `interruptor.md` (`kill switch`; `mvp:01 §14.2`), `calibracion.md` (`calibration`; `mvp:03 §4.10`), `diagnostico-de-anclajes.md` (`anchor diagnostics`; `mvp:01 §3.1.1`); actualizar `merchant.md` (estados, sin reinicio), `experimento.md` (`calibrating → active → closed`, ventana), `credencial-de-ingesta.md` (huella, gracia), `estrategia-de-sincronizacion.md` (`uso: disponible`, dato del merchant), `locale.md` (idiomas del merchant); `npm run check:glossary` en verde con `uso` correcto
- [x] T011 [P] Catálogos: `contracts/problem-types.yaml` gana `merchant-out-of-scope` (403), `merchant-not-found` (404), `merchant-deactivated` (409), `origin-already-registered` (422), `configuration-frozen` (409), `experiment-already-open` (409), `experiment-not-open` (409), `rotation-grace-too-long` (422), `operator-unknown` (401); `contracts/no-op-reasons.yaml` gana `merchant-off`; réplicas en `src/interface-adapters/http/problem-details.ts` y `src/domain/shared-kernel/no-op-reasons.ts`; `tests/unit/problem-details.test.ts`, `tests/unit/no-op-reasons.test.ts`, `tests/unit/domain/error-codes.test.ts` en verde (data-model § Catálogos)
- [x] T012 [P] Mapa del contrato (R-10, `contracts/admin-api.md` § Mapa): en `contracts/api-map.yaml` el consumidor `admin` con capacidades `[merchants:read, merchants:write, credentials:rotate, configuration:read, configuration:write, experiments:read, experiments:write, log:read, messages:publish]` (sale `flags:write`); `putFlags` → `publishMerchantConfiguration` (`POST …/configuration`, `configuration:write`); `setKillSwitch` con `merchants:write`; `listMerchants` con `merchants:read`; nuevas `planned` con consumidor, tag, capacidades, `feature: "017"` y fuente: `getMerchant`, `deactivateMerchant`, `rotatePlatformSecret`, `getMerchantConfiguration`, `listConfigurationVersions`, `listExperiments`, `activateExperiment`, `getPlatformConfiguration`, `getTreatmentDefaults`, `listAdminLog`, `listMerchantAdminLog`, `listAnchorDiagnostics`; `src/interface-adapters/http/security/capabilities.ts` gana `admin`; `tests/unit/http/capabilities.test.ts` y `npm run check:api-map` en verde
- [x] T013 [P] ADR-031 `docs/adr/031-merchants-operados-y-tres-niveles.md` (estado `aceptada`, fuente `specs/017-merchants-y-configuracion/research.md`): fuente de verdad detrás de puertos por intención (R-01, R-02), tres agregados y módulo `configuration` (R-03), niveles 1–2 en el release (R-04), credenciales por huella y secreto conservado (R-05), operadores con alcance y registro (R-06), kill switch (R-07), calibración y congelamiento (R-08), terna estampada (R-09); precisiones fechadas en ADR-020 (`adminToken` decidido; la tabla de consumidores sin `PROPUESTO`), ADR-022 (estados del experimento), ADR-026 y ADR-027 (las políticas por defecto son el nivel 2); `npm run check:adrs && npm run check:markers -- --strict` en verde (los dos `PROPUESTO` de ADR-020 quedan en uno: `portalSession`)
- [x] T014 Dominio `admin` (`src/domain/admin/`): `ids.ts` (`OperatorId`, `asOperatorId`, `SYSTEM_OPERATOR`), `operator.ts` (`Operator.of` con huellas 1–2 y `scope: "*" | MerchantId[]`; `scopeFor(merchantId): Result<MerchantId, MerchantOutOfScope>`; `rehydrate`), `admin-entry.ts` (tipo `AdminEntry`, `outcome: "accepted" | "rejected" | "denied"`), `anchor-diagnostic.ts` (tipo), `errors.ts` (`MerchantOutOfScope`, `OperatorUnknown`, `InvalidOperatorScope`, `AdminError`), `index.ts`; pruebas `tests/unit/domain/admin/operator.test.ts` (alcance `*`, lista, fuera, vacío)
- [x] T015 Aplicación `admin` (`src/application/admin/`): `ports/operator-directory.ts` (`findByTokenFingerprint`), `ports/admin-log.ts` (`record`, `list`, `listOf`), `ports/anchor-diagnostics-store.ts` (`upsert`, `listOf`), `services/admin-token.service.ts` (`AdminTokenResolver` → `Result<Operator, OperatorUnknown>` por huella), `services/admin-scope.service.ts` (`AdminScopeService.authorize(actor, merchantId)`: `scopeFor` + registra `denied` en `AdminLog`), `decorators/audited-use-case.ts` (`AuditedUseCase<I extends { actor; merchantId? }, O>`: envuelve un `UseCase`, registra `accepted`/`rejected` con operación, merchant, `code`, `result` y `reason`), `index.ts`; pruebas unitarias en `tests/unit/application/admin/`
- [x] T016 Gateways `admin` (`src/interface-adapters/gateways/admin/`): `config-operator-directory.ts` (operadores de `OPE_ADMIN_OPERATORS`), `memory-admin-log.ts` (orden por instante, cursor opaco), `memory-anchor-diagnostics-store.ts` (último por `(anchor, pageType, version)` con contador y tope); `node-credential-minter.ts` en `gateways/merchant/` (`randomBytes(32)` base64url con prefijo `ope_ik_` / `ope_pk_` / `ope_ps_`, SHA-256 hex); pruebas unitarias
- [x] T017 Seguridad `adminToken`: `src/interface-adapters/http/security/admin-token.ts` (`ADMIN_TOKEN_SCHEME = "adminToken"`, header `authorization`, `makeAdminTokenSecurity(resolver)`: `Bearer <token>` → huella → operador → `OperatorPrincipal { operator }`; sin token o desconocido → `SecurityError` 401 `operator-unknown`), `principal.ts` gana `operatorOf(req)`; `SecurityScheme` con `consumer: "operator"` si el cableado lo exige; `tests/unit/http/security-handlers.test.ts` con los casos (sin header, formato inválido, desconocido, conocido)
- [x] T018 Composición y configuración de operadores: `src/composition/config.ts` lee `OPE_ADMIN_OPERATORS` (JSON, `[{ operatorId, tokenFingerprints: [..], scope: "*" | [..] }]`) → `Operator.of` o `ConfigError` nombrando `operators[i].<campo>`; `src/composition/modules/admin.ts` (slice `AdminPorts { operators, adminLog, diagnostics, clock, logger }`, `configAdminPorts(operators)`, `memoryAdminPorts`, security `adminToken`), `MODULES` y `ports.ts`; `config/dev-operators.json` y `OPE_ADMIN_OPERATORS_FILE` para `npm run dev` (`package.json` `dev`); `scripts/mint-admin-token.mjs <operatorId>` (imprime token una vez + entrada JSON con la huella; JSDoc, `checkJs`); `tests/unit/composition/config.test.ts` con operadores válidos e inválidos; `tests/helpers/test-app.ts` arranca con dos operadores (`ops-all` alcance `*`, `ops-a` alcance `[m_a]`) y expone `adminToken(name)`
- [x] T019 Contrato base de `admin`: `contracts/components/securitySchemes/adminToken.yaml` sin `PROPOSED` (operador, emisión fuera de banda, alcance, registro); `contracts/components/responses/OperatorUnauthorized.yaml`, `MerchantForbidden.yaml` (403 `merchant-out-of-scope`), `MerchantNotFound.yaml`; `contracts/components/schemas/{OperatorId,AdminEntry,AdminEntryPage}.yaml`; `contracts/paths/admin-log.yaml` (`listAdminLog`, `x-collection: true`, `cursor`/`limit`); raíz `openapi.yaml`: `adminToken` en `securitySchemes`, `info.version: 1.4.0`; `npm run contract:check` en verde (aditivo, `building`); `npm run contract:types`
- [x] T020 Controller y prueba del primer camino admin: `src/interface-adapters/http/controllers/admin/list-admin-log.ts` (`OperationHandler<"listAdminLog">`, `operatorOf(req)`, caso de uso `ListAdminLogUseCase` en `application/admin/use-cases/`); `tests/integration/admin-log.test.ts`: sin token → 401 `operator-unknown` antes del cuerpo; token válido → 200 con las entradas; `tests/integration/security-capabilities.test.ts` gana el consumidor `admin`

**Checkpoint**: un operador autentica, lee el registro de administración y el mapa declara toda la superficie de la feature.

---

## Phase 3: User Story 1 — Un merchant se opera, no se despliega (Priority: P1) 🎯 MVP

**Goal**: alta, credenciales una vez, rotación con gracia, kill switch, desactivación, import de la semilla, alcance y registro (spec US1, escenarios 1–7).

**Independent Test**: quickstart § US1.

### Contrato (antes que el código)

- [x] T030 [US1] Esquemas: `contracts/components/schemas/{MerchantCreate,MerchantCreated,MerchantCredentials,Merchant,MerchantStatus,CredentialKind,CredentialSummary,MerchantPage,CredentialRotation,CredentialIssued,KillSwitch}.yaml` según `contracts/admin-api.md` § Esquemas (`additionalProperties: false` en bodies; `x-invariants` en `MerchantCreate` → `origin-already-registered`, en `CredentialRotation` → `rotation-grace-too-long`); `contracts/components/responses/{MerchantConflict,MerchantUnprocessable}.yaml`
- [x] T031 [US1] Rutas: `contracts/paths/admin-merchants.yaml` (`listMerchants` con `x-collection: true`, `createMerchant`), `admin-merchant.yaml` (`getMerchant`, `deactivateMerchant`), `admin-credentials.yaml` (`rotateIngestKey`, `rotatePlatformKey`, `rotatePlatformSecret`), `admin-kill-switch.yaml` (`setKillSwitch`); parámetro `merchantId` de ruta en `contracts/components/parameters/merchantId.yaml`; ejemplos con instantes fijos y cada 422 nombrando su invariante; mapa: las siete pasan a `built`; `npm run contract:check` (incluye `check:api-map`, `check:invariant-tests` → pruebas `[invariant:origin-already-registered]`, `[invariant:rotation-grace-too-long]` en T034) y `npm run contract:types`

### Pruebas primero

- [x] T032 [P] [US1] `tests/unit/domain/merchant/merchant.test.ts`: `Merchant.of` con `credentials` (huella, `issuedAt`), `status`, `createdAt`; `rotated(kind, credential, graceMs, now)` (gracia 0 ⇒ la anterior expira ya; gracia > tope ⇒ `RotationGraceTooLong`; tercera rotación ⇒ la más vieja expira; dos vigentes como máximo), `credentialsOf(kind, now)` ignora vencidas, `switched(false)`/`switched(true)`, `deactivated()` (terminal: `switched` sobre `deactivated` no cambia nada), `requiresSignature` con secreto vigente
- [x] T033 [P] [US1] `tests/unit/application/merchant/{create-merchant,rotate-credential,set-kill-switch,deactivate-merchant,import-merchants}.test.ts`: crear acuña id y tres credenciales (con `signature: true`) y las devuelve una vez; origen ya registrado por otro ⇒ `origin-already-registered`; rotar con gracia; desactivar es irreversible y `merchant-deactivated` en todo lo demás; import con store vacío crea a nombre de `system` con las claves de la semilla, con store no vacío no crea nada y loguea; alcance fuera ⇒ `merchant-out-of-scope` y entrada `denied` en el `AdminLog` falso
- [x] T034 [P] [US1] `tests/integration/admin-merchants.test.ts`: escenarios 1–7 de la spec por HTTP (`startTestApp` con dos operadores): 201 con credenciales una vez y `GET` sin valores; la clave devuelta autentica `POST /v1/events`; rotación con `graceSeconds` y reloj reemplazable (la anterior vale hasta el vencimiento; después 401); `[invariant:origin-already-registered]`, `[invariant:rotation-grace-too-long]`; kill switch → siguiente lote `NO_OP merchant-off`, `POST /v1/orders` sigue 201, encender vuelve a decidir; desactivar → 401 con toda clave y `GET` sigue 200 para admin; `ops-a` sobre `m_b` → 403 `merchant-out-of-scope` (mismo cuerpo con un id inexistente) y entrada `denied` en `GET /v1/admin/log`; `tests/integration/isolation.test.ts` gana el bloque admin (FR-025)
- [x] T035 [P] [US1] `tests/integration/bootstrap.test.ts` + `tests/unit/composition/profile.test.ts`: arranque vacío con `OPE_MERCHANTS` importa por `system` (entradas en el log) y responde como hoy; con el store ya poblado (`ports.merchants` reemplazado) la semilla no pisa nada; `config/dev-merchants.json` en la forma nueva (`experiments[].treatmentPercent` explícito, sin `status: active` implícito) sigue arrancando `npm run dev`

### Implementación

- [x] T036 [US1] Dominio `merchant`: `src/domain/merchant/credential.ts` (tipo `Credential`, `CredentialKind`), `merchant.ts` (`status`, `credentials`, `createdAt`; reglas `isOn`, `credentialsOf`, `rotated`, `switched`, `deactivated`, `requiresSignature` sobre credenciales; `of` valida orígenes y credenciales, `rehydrate`), `errors.ts` (`RotationGraceTooLong`, `MerchantDeactivated`, `OriginAlreadyRegistered`, `MerchantNotFound`), `ids.ts` si el acuñado del id vive en el módulo (`mrc_` + 12 base32 lo acuña el `CredentialMinter`/`MerchantIdGenerator` del gateway); `platform-signature.ts` y `origin.ts` sin cambio funcional
- [x] T037 [US1] Aplicación `merchant`: `ports/merchant-store.ts` (`create`, `get`, `list`, `update`), `ports/credential-minter.ts` (`mint`, `fingerprintOf`, `mintMerchantId`), `use-cases/{create-merchant,get-merchant,list-merchants,rotate-credential,set-kill-switch,deactivate-merchant,import-merchants}.use-case.ts` (cada uno recibe `actor: Operator`, llama a `AdminScopeService.authorize` primero salvo `create`/`list`/`import`; ≤ 6 dependencias; `Result` con la unión exacta); `services/ingest-key.service.ts` y `platform-key.service.ts` resuelven por huella y rechazan `deactivated` y credenciales vencidas (`Clock`); `index.ts`
- [x] T038 [US1] Gateways: `src/interface-adapters/gateways/merchant/memory-merchant-store.ts` implementa `MerchantStore` **y** `MerchantDirectory` sobre el mismo mapa (huella → merchant; orígenes → merchant); sale `config-merchant-directory.ts`; `node-credential-minter.ts` (T016) enlazado
- [x] T039 [US1] Controllers `src/interface-adapters/http/controllers/merchant/{list-merchants,create-merchant,get-merchant,deactivate-merchant,rotate-ingest-key,rotate-platform-key,rotate-platform-secret,set-kill-switch}.ts` (`operatorOf(req)`, `merchantId` de `req.params`, DTO ↔ dominio, `toProblem`); lo compartido de admin (`pageOf`, cursor) en `http/boundary.ts`
- [x] T040 [US1] Composición: `src/composition/modules/merchant.ts` (slice con `merchantStore`, `minter`; `memoryMerchantPorts` enlaza la misma instancia a `merchants` y `merchantStore`; casos de uso con `new`, envueltos en `AuditedUseCase` + `LoggedUseCase`; handlers de las ocho operaciones); `profiles/local.ts`; `bootstrap.ts` importa la semilla con `ImportMerchantsUseCase` si `merchantStore.list` está vacío; `config.ts` produce `MerchantSeed[]` (forma de hoy; `experiments[].status` deja de ser implícito); `src/main.ts` sin cambio
- [x] T041 [US1] Kill switch en el plano de decisión (R-07): `PolicyDirectory.policiesFor` (o el puerto que la composición enlace en US2; hasta entonces `MerchantDirectory.isOn`) informa `enabled`; `DecisionService.decide` resuelve `NO_OP merchant-off` **antes** de asignar cuando el merchant está apagado; `tests/unit/application/decision/decision.service.test.ts` con el caso
- [x] T042 [US1] Gates y commit: `npm run format:check && npm run quality && npm run typecheck && npm run test:all && npm run test:mutation && npm run test:contract && npm run release-check` (Schemathesis con `OPE_ADMIN_OPERATORS` y el token en `schemathesis.toml`/`scripts/test-contract.mjs`); `CLAUDE.md` § Composición ("merchants por `MerchantStore`; `OPE_MERCHANTS` es semilla; sin reinicio") y § Notas operativas (operadores, `adminToken`, alcance, registro); commit `feat(017): merchants operados — store, credenciales, operadores, kill switch y registro`

**Checkpoint**: un operador da de alta y opera un merchant sin reinicio; el aislamiento en admin está probado.

---

## Phase 4: User Story 2 — La configuración se versiona y ninguna política vive en el código (Priority: P2)

**Goal**: niveles 1–2 en el release, nivel 3 por versiones, resolución en memoria, terna estampada, constantes fuera de `src/` (spec US2, escenarios 1–7).

**Independent Test**: quickstart § US2.

### Contrato

- [x] T050 [US2] Esquemas `contracts/components/schemas/{PlatformConfiguration,TreatmentDefaults,MerchantConfigurationDeclared,MerchantConfigurationInput,MerchantConfigurationVersion,MerchantConfigurationVersionPage,MerchantConfiguration,EffectiveConfiguration,SyncStrategy,SyncMode,Freshness,SyncLevelRules,Locales,AnchorMap,AnchorSelectors,DecisionPolicyInput,CommercialPolicyInput,EvidenceProfileInput}.yaml` según `contracts/admin-api.md` y `data-model.md` (los inputs de política replican la forma de `OPE_MERCHANTS[i].{decisionPolicy,commercialPolicy,evidenceProfile}` de hoy); `x-invariants`: `reason` obligatorio con `corrective` (`configuration-reason-required`, 422, catálogo), invariantes de política con sus slugs existentes
- [x] T051 [US2] Rutas `contracts/paths/admin-configuration.yaml` (`publishMerchantConfiguration` con `x-idempotency` por contenido: 201 crea / 200 repite; `getMerchantConfiguration`; `listConfigurationVersions` con `x-collection`) y `admin-levels.yaml` (`getPlatformConfiguration`, `getTreatmentDefaults`); mapa a `built`; `npm run contract:check && npm run contract:types`

### Pruebas primero

- [x] T052 [P] [US2] `tests/unit/domain/configuration/{platform-configuration,treatment-defaults,merchant-configuration-version,effective-configuration}.test.ts`: fábricas con cada invariante de `data-model.md` (valores > 0, `barriers ⊆ BARRIERS`, `surfaces` no vacío, `syncStrategy` con modo desconocido rechazado, `locales` por forma y `fallback ∈ supported`, `anchors` con anclaje desconocido o selector vacío rechazado, `reason` obligatorio si `corrective`); resolución valor por valor (declarado gana, ausente cae al default, plataforma encima; terna de versiones); `sameContentAs`
- [x] T053 [P] [US2] `tests/unit/configuration/release-levels.test.ts` (`contracts/configuration-levels.md` § Validación): carga `config/platform.json` y `config/treatment-defaults.json` reales por el gateway; `ok`; vocabularios; fingerprint del contenido de las políticas por defecto ligado a `version`
- [x] T054 [P] [US2] `tests/governance/behaviour-constants.test.ts` + fixture `tests/governance/fixtures/behaviour-constants/`: los archivos de la tabla "Qué sale del código" no existen; ningún archivo de `src/` declara `FRESHNESS_BUDGET`, `RECEIPTS_KEPT`, `DEDUP_WINDOW`, `SESSION_WINDOW`, `VISITOR_WINDOW`, `SIGNATURE_WINDOW`, `CLOCK_SKEW_TOLERANCE_MS`, `DEFAULT_DECISION_POLICY`, `DEFAULT_COMMERCIAL_POLICY` (lista en el test, con motivo); pasa en el fixture limpio y falla en el que reintroduce una
- [x] T055 [P] [US2] `tests/integration/admin-configuration.test.ts`: escenarios 1–7 de US2 por HTTP: sin versión ⇒ decisión con terna `{platform-1, defaults-1, sin merchant}`; publicar frescura + idiomas ⇒ 201 `version: 1`, `GET …/configuration` con `effective` resuelto, la siguiente decisión estampa `merchant: 1` y usa la frescura declarada (catálogo viejo por la nueva ventana ⇒ evidencia `stale`); versión idéntica ⇒ 200 misma versión; inválida ⇒ 422 con `pointer` y ninguna versión; `GET /v1/admin/platform-configuration` y `/treatment-defaults` con versión; `[invariant:configuration-reason-required]`; cambio en caliente: la solicitud siguiente ya decide con la versión nueva (sin `resetPorts`); aislamiento: la versión de A no cambia la decisión de B
- [x] T056 [P] [US2] Ajustes de pruebas existentes que leían constantes: `tests/unit/application/catalog/*.test.ts`, `tests/unit/application/ingestion/*.test.ts`, `tests/unit/application/decision/*.test.ts`, `tests/integration/{catalog,ingest-events,decision-plane,commercial-policy,platform-signature}.test.ts` reciben los valores por los puertos falsos o por `startTestApp` (mismos valores: expectativas intactas)

### Implementación

- [x] T057 [US2] Dominio `configuration` (`src/domain/configuration/`): `platform-configuration.ts`, `treatment-defaults.ts`, `merchant-configuration-version.ts`, `effective-configuration.ts` (clase con `resolve(platform, defaults, version?)` estático o método del dueño), `anchor-map.ts`, `sync-strategy.ts` (`SYNC_MODES`, `SyncMode`, `SYNC_FLOWS`), `locales.ts` (patrón BCP 47 compartido con el contrato), `errors.ts` (`InvalidPlatformConfiguration`, `InvalidTreatmentDefaults`, `InvalidConfigurationValue`, `ConfigurationFrozen`, `ConfigurationReasonRequired`, unión), `index.ts`; ≤ 300 líneas por archivo
- [x] T058 [US2] Aplicación `configuration`: `ports/configuration-store.ts`, `ports/configuration-levels.ts`, `services/configuration.service.ts` (`ConfigurationService`: `effectiveFor(merchantId)` desde memoria; `publish(version)` recalcula; implementa `PolicyDirectory`, `CatalogPolicies`, `IngestionPolicies`, `DecisionWindows`, `SignatureWindow`, `SdkConfigurationView` como vistas), `use-cases/{publish-merchant-configuration,get-merchant-configuration,list-configuration-versions,get-platform-configuration,get-treatment-defaults}.use-case.ts` (publish: alcance → `activeFor` → congelamiento → validar → `publishVersion` → recalcular → si correctiva con experimento activo, `ExperimentStore.update(restarted)`), `index.ts`
- [x] T059 [US2] Puertos de los consumidores y eliminación de constantes (`contracts/configuration-levels.md` § Qué sale del código): `application/catalog/ports/catalog-policies.ts` (+ `ProductTruthService` y `CatalogStore` reciben frescura y reglas por merchant), `application/ingestion/ports/ingestion-policies.ts` (+ `memoryEventDedup` recibe la ventana), `application/decision/ports/{policy-directory,decision-windows}.ts` (`policiesFor` gana `surfaces`, `barriers`, `enabled`, `versions`), `application/merchant/ports/signature-window.ts`; `Order.of` y `EventBatch.of` reciben la tolerancia de reloj; borrar `application/catalog/policies/{freshness,sync-level}.ts`, `application/ingestion/policies/dedup-window.ts`, `application/decision/policies/{session,visitor}-window.ts`, `application/merchant/policies/signature-window.ts`, `domain/decision/default-policy.ts`, `domain/commercial/default-commercial-policy.ts`, `CLOCK_SKEW_TOLERANCE_MS` de `domain/shared-kernel/time.ts`, `DEFAULT_TREATMENT_PERCENT` de `composition/config.ts`; `knip` sin exports huérfanos
- [x] T060 [US2] Terna estampada (R-09): `src/domain/ledger/decision.ts` `DecisionFacts.configuration` y `phase?`; `DecisionService` la toma de `policiesFor(...).versions` y la fase del experimento; `DecisionRecorder` sin cambio; `tests/unit/domain/ledger` y `tests/integration/decision-plane.test.ts` con la terna
- [x] T061 [US2] Gateways y archivos: `src/interface-adapters/gateways/configuration/{memory-configuration-store,file-configuration-levels}.ts`; `config/platform.json` y `config/treatment-defaults.json` con los valores de hoy (`configuration-levels.md` § Archivos); `composition/config.ts` resuelve sus rutas (`OPE_PLATFORM_CONFIG`, `OPE_TREATMENT_DEFAULTS`, por defecto los del repo) y `ConfigError` si no cargan; `MerchantSeed` lleva `decisionPolicy`/`commercialPolicy`/`evidenceProfile` como `declared` de la versión 1 del import
- [x] T062 [US2] Controllers `src/interface-adapters/http/controllers/configuration/{publish-merchant-configuration,get-merchant-configuration,list-configuration-versions,get-platform-configuration,get-treatment-defaults}.ts`; composición `modules/configuration.ts` (slice, `memoryConfigurationPorts`, `fileConfigurationLevels`, `configurationServiceOf(ports)` enlazado a `policies`, `catalogPolicies`, `ingestionPolicies`, `decisionWindows`, `signatureWindow`), `modules/{decision,catalog,ingestion,merchant}.ts` consumen por puerto; `profiles/local.ts`
- [x] T063 [US2] Gates y commit: la cadena completa; `CLAUDE.md` § Notas operativas "Verdad de producto" y "Plano de decisión" citan los niveles (frescura y políticas por defecto en `config/treatment-defaults.json`; ventanas en `config/platform.json`) y § Convenciones XI ("las constantes ya salieron; una nueva es una entrada en un nivel"); commit `feat(017): configuración en tres niveles — versiones por merchant, niveles del release y ninguna política en el código`

**Checkpoint**: cada decisión estampa su terna; los archivos de nivel gobiernan; `src/` no tiene constantes de comportamiento.

---

## Phase 5: User Story 3 — Un experimento se abre, se calibra, se congela y se cierra (Priority: P3)

**Goal**: `calibrating → active → closed`, fase en la decisión, congelamiento y versión correctiva con reinicio de ventana, uno por merchant (spec US3, escenarios 1–8).

**Independent Test**: quickstart § US3.

### Contrato

- [ ] T070 [US3] Esquemas `contracts/components/schemas/{ExperimentCreate,Experiment,ExperimentStatus,ExperimentPage,WindowRestart}.yaml`; rutas `contracts/paths/admin-experiments.yaml` (`createExperiment`, `listExperiments` con `x-collection`, `activateExperiment`, `closeExperiment`); `x-invariants` sobre `createExperiment` (`experiment-already-open`, 409 — conflicto, no invariante 422: va como respuesta `409` documentada) y `ExperimentCreate` (`invalid-treatment-share`, `invalid-seed`, cortes crecientes → `invalid-experiment-cuts`, 422, catálogo); mapa a `built`; `npm run contract:check && npm run contract:types`

### Pruebas primero

- [ ] T071 [P] [US3] `tests/unit/domain/experiment/experiment.test.ts`: `of` con `targetSample ≥ 1` y cortes crecientes; `activated(now)` sólo desde `calibrating`; `closed(now)` desde ambos; `windowRestarted(now, reason, version)` sólo `active`; `phaseOf`; `assign` intacto (regresión con fingerprint de la 007 sigue verde)
- [ ] T072 [P] [US3] `tests/unit/application/experiment/{create-experiment,activate-experiment,close-experiment}.test.ts` y `tests/unit/application/configuration/publish-merchant-configuration.test.ts`: segundo experimento abierto ⇒ `experiment-already-open`; activar cerrado ⇒ `experiment-not-open`; publicar con activo ⇒ `configuration-frozen`; correctiva ⇒ versión + `restartWindow` registrados
- [ ] T073 [P] [US3] `tests/integration/admin-experiments.test.ts`: escenarios 1–8 por HTTP: crear ⇒ 201 `calibrating`, lotes se asignan y la decisión lleva `phase: calibration`; publicar en calibración ⇒ 201; activar ⇒ `windowStartedAt`; publicar ⇒ 409 `[invariant:…]` no aplica (409); correctiva ⇒ 201 y `windowRestarts` con motivo y versión, entrada del log con `reason`; segundo experimento ⇒ 409; cerrar ⇒ siguiente lote `no-active-experiment`, no reabre; kill switch con experimento activo no cambia su estado; `tests/integration/assignment.test.ts` con `calibrating` asignando

### Implementación

- [ ] T074 [US3] Dominio `experiment`: `experiment.ts` (`status` nuevo, `targetSample`, `cuts`, `openedAt`, `activatedAt`, `windowStartedAt`, `closedAt`, `windowRestarts`; reglas `activated`, `closed`, `windowRestarted`, `isOpen`, `phaseOf`), `experiments.ts` (a lo sumo uno abierto), `errors.ts` (`ExperimentAlreadyOpen`, `ExperimentNotOpen`, `InvalidExperimentCuts`, `InvalidTargetSample`); semilla: `startedAt` → `openedAt`, `status: active` de la semilla ⇒ `active` con `windowStartedAt = openedAt` (compatibilidad con `config/dev-merchants.json` y las pruebas)
- [ ] T075 [US3] Aplicación `experiment`: `ports/experiment-store.ts` (`open`, `update`, `get`, `listOf`); `ExperimentDirectory.activeFor` devuelve el abierto; `use-cases/{create-experiment,activate-experiment,close-experiment,list-experiments}.use-case.ts`; `DecisionService` estampa `phase` (T060) desde `experiment.phaseOf(now)`; gateway `gateways/experiment/memory-experiment-store.ts` implementa store + directorio (sale `config-experiment-directory.ts`)
- [ ] T076 [US3] Controllers `controllers/experiment/{create-experiment,list-experiments,activate-experiment,close-experiment}.ts`; composición `modules/experiment.ts` (slice con `experimentStore`, casos de uso auditados, handlers); `ImportMerchantsUseCase` abre los experimentos de la semilla por el store
- [ ] T077 [US3] Gates y commit; `CLAUDE.md` § "Asignación" (estados, calibración, congelamiento); commit `feat(017): experimentos — calibración, activación con congelamiento, versión correctiva y cierre`

**Checkpoint**: D-G ejecutable: el resultado no se puede contaminar por accidente.

---

## Phase 6: User Story 4 — El SDK recibe su configuración y reporta lo que no resuelve (Priority: P4)

**Goal**: `getSdkConfig` y `reportAnchorDiagnostics` (spec US4, escenarios 1–4).

**Independent Test**: quickstart § US4.

- [ ] T080 [US4] Contrato: `contracts/components/schemas/{SdkConfig,SdkLocales,AnchorDiagnosticsReport,UnresolvedAnchor,DiagnosticsReceived,AnchorDiagnostic,AnchorDiagnosticPage}.yaml`; rutas `contracts/paths/sdk-config.yaml`, `sdk-diagnostics.yaml`, `admin-diagnostics.yaml` (`listAnchorDiagnostics`, `x-collection`); `Cache-Control: no-store` documentado en `getSdkConfig`; mapa a `built`; `npm run contract:check && npm run contract:types`
- [ ] T081 [P] [US4] `tests/integration/sdk-config.test.ts`: escenarios 1–4: `GET /v1/sdk/config` con la clave de A devuelve `enabled`, `versions`, `surfaces`, `locales`, `anchors` y **no** `decisionPolicy`, `commercialPolicy`, `treatmentPercent` (aserción sobre las claves); apagado ⇒ `enabled: false`; `POST /v1/sdk/diagnostics` ⇒ 202 y `GET /v1/admin/merchants/{A}/anchor-diagnostics` con `count`; ráfaga ⇒ contador, no filas; tope de plataforma ⇒ descarta el más viejo; la clave de B no ve lo de A; CORS con el origen registrado (`tests/integration/cors.test.ts` gana las dos rutas)
- [ ] T082 [US4] Aplicación `admin`: `use-cases/{get-sdk-config,report-anchor-diagnostics,list-anchor-diagnostics}.use-case.ts` (`get-sdk-config` lee `SdkConfigurationView` del servicio de configuración y `Merchant.isOn()`); controllers `controllers/admin/{get-sdk-config,report-anchor-diagnostics,list-anchor-diagnostics}.ts` (`merchantOf(req)` para el SDK, `operatorOf(req)` para admin); composición en `modules/admin.ts`
- [ ] T083 [US4] Gates y commit; `CLAUDE.md` § Notas operativas (configuración del SDK y diagnóstico); commit `feat(017): configuración del SDK y diagnóstico de anclajes`

---

## Phase 7: Cierre

- [ ] T090 `specs/017-merchants-y-configuracion/quickstart.md` § "Cambios respecto del plan" completo (decisiones tomadas en el camino, supervivientes de mutación y cómo se resolvieron, forma final de la semilla y de los archivos de nivel)
- [ ] T091 `docs/api/` regenerado si está versionado (`contract:docs`, `contract:insomnia`); `README.md` del repo (arranque con operadores, `mint-admin-token`, `config/*.json`); `docs/dominio/README.md` si lista módulos
- [ ] T092 `npm run format:check && npm run quality && npm run typecheck && npm run test:all && npm run test:mutation && npm run test:contract && npm run release-check`; commit `docs(017): cierre`; PR `017-merchants-y-configuracion` → `main` con el Constitution Check (once principios, v1.4.2) y SC-001..SC-007; sin merge hasta que el dueño lo pida

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 → US2 → US3 → US4 → Cierre. Las historias son incrementos: US2 necesita el store y el alcance de US1; US3 necesita las versiones de US2 (congelamiento); US4 necesita la configuración efectiva de US2 y el interruptor de US1.
- Dentro de Phase 2: T010–T013 en paralelo; T014 → T015 → T016/T017 → T018 → T019 → T020.
- Dentro de cada historia: contrato (T030–T031, T050–T051, T070, T080) antes que pruebas y código; pruebas `[P]` en paralelo; dominio → aplicación → gateways → controllers → composición; gates y commit al final.
- T041 (kill switch en la decisión) puede cerrarse con `MerchantDirectory.isOn` en US1 y pasar al puerto de configuración en T059.
- T059 (eliminación de constantes) y T056 (pruebas que las leían) van juntas: ninguna prueba cambia su expectativa numérica.

## Parallel Opportunities

- Phase 2: glosario, catálogos, mapa y ADR (T010–T013) a la vez.
- US1: T032–T035 a la vez tras T031; T036 y T016 a la vez.
- US2: T052–T056 a la vez tras T051; T057 con T061.
- US3: T071–T073 a la vez tras T070.

## Implementation Strategy

MVP = Phase 2 + US1 (un merchant se opera sin reinicio, con operadores y registro). US2 es el
corazón del principio XI; US3 cierra D-G; US4 completa el borde del front. Cada historia deja
todos los gates en verde y un commit; la PR se abre al cierre, sin merge.
