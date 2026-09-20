# Research — Merchants, configuración en tres niveles y administración (017)

Cada punto: decisión, fundamento, alternativas descartadas. Las decisiones del dueño del
2026-09-20 (sesión de la 016) son la entrada; lo que sigue las baja a la forma del repo.

## R-01 — Una fuente de verdad detrás de puertos por intención (decisión 1)

- **Decisión**: tres puertos de escritura, uno por agregado y en el módulo dueño —
  `MerchantStore` (`application/merchant/ports`), `ConfigurationStore`
  (`application/configuration/ports`, módulo nuevo) y `ExperimentStore`
  (`application/experiment/ports`)— con métodos que nombran intenciones (`create`, `get`,
  `list`, `rotateCredential`, `setSwitch`, `deactivate`; `publishVersion`, `versionsOf`;
  `open`, `activate`, `close`, `restartWindow`) y devuelven `Result` en `Promise`. Los
  puertos de lectura que ya existen (`MerchantDirectory`, `ExperimentDirectory`,
  `PolicyDirectory`) **se conservan como interfaces** (cada consumidor define lo que necesita,
  ADR-013) y pasan a implementarse **sobre los stores**: el gateway en memoria de cada agregado
  devuelve un objeto que implementa su store y sus directorias, y la composición enlaza la
  misma instancia a los dos puertos. `config-*-directory.ts` desaparecen.
- **Fundamento**: hoy hay tres copias derivadas de un JSON y ningún camino de escritura; la
  persistencia (018) tiene que poder reemplazar un gateway por otro sin tocar el núcleo, y un
  puerto que dice `rotateCredential` sobrevive a cualquier motor. Que la lectura y la escritura
  compartan instancia en memoria es lo que hace que un cambio valga en la siguiente solicitud
  sin I/O (FR-017).
- **Alternativas descartadas**: un solo `MerchantStore` con el merchant como objeto entero
  (obliga a sobrescribir configuración y experimentos; contradice versionado, D-G y ADR-022);
  un "repositorio genérico" `save(entity)` (no expresa intenciones; en Postgres se vuelve un
  `UPDATE` de todo).

## R-02 — El import de `OPE_MERCHANTS` pasa por el store (decisión 1)

- **Decisión**: `composition/config.ts` sigue parseando la forma de `OPE_MERCHANTS` /
  `OPE_MERCHANTS_FILE` (y de `OPE_ADMIN_OPERATORS`, R-06), pero ya no produce puertos: produce
  una **semilla** (`MerchantSeed[]`). `bootstrap` la importa **sólo si el store está vacío**, a
  través de un caso de uso `ImportMerchantsUseCase` (módulo `merchant`) que ejecuta el mismo
  `CreateMerchantUseCase`/`PublishConfigurationUseCase`/`OpenExperimentUseCase` que la API, a
  nombre del operador `system`, con las credenciales **tal como vienen** (la semilla trae las
  claves; la API las acuña). Con el store no vacío, la semilla se ignora y se loguea.
  `config/dev-merchants.json` y `startTestApp()` (`tests/helpers/test-app.ts`) siguen usando
  la variable: entran por el mismo camino.
- **Fundamento**: un solo punto de entrada = una sola validación y un solo registro; la
  semilla es el arranque de un entorno vacío, no una fuente de verdad. Con memoria, cada
  arranque está vacío y el comportamiento observable de hoy no cambia (SC-005 de la 016 sigue
  verde); con Postgres, el import sólo corre la primera vez.
- **Alternativa descartada**: script de operación `merchants:import` como único camino
  (obligaría a cambiar cada prueba y el `dev` de hoy; puede agregarse después sobre el mismo
  caso de uso).

## R-03 — Tres agregados, tres módulos, un módulo nuevo `configuration` (decisión 4)

- **Decisión**: `Merchant` (dominio `merchant`: identidad, estado `active | off |
deactivated`, orígenes, credenciales por clase con huella y vencimiento), `Experiment`
  (dominio `experiment`: gana `calibrating`, `activatedAt`, `windowStartedAt`, `closedAt`) y
  `ConfigurationVersion` (dominio **nuevo** `configuration`: número, contenido declarado,
  operador, `corrective`, motivo). El módulo `configuration` es dueño de los tres niveles y
  de la **resolución**: `EffectiveConfiguration` (valor por valor, con la terna de versiones)
  se calcula al publicar y se guarda por merchant en memoria; los módulos consumidores
  (`decision`, `catalog`, `ingestion`, `experiment`, `merchant`) **no importan
  `configuration`**: definen su puerto de lectura (`PolicyDirectory` ya existe;
  `CatalogPolicies`, `IngestionPolicies` nuevos) y la composición lo enlaza al servicio de
  configuración, como hoy `decisionPlaneOf`. `CONTEXT_MAP` gana `configuration: [shared-kernel,
merchant, experiment, decision, commercial, selection, catalog, ingestion]` (importa sus
  tipos para validar y construir; nadie lo importa a él).
- **Fundamento**: las vidas son distintas (seguridad / tratamiento versionado / experimento
  inmutable) y así lo pide la spec; la resolución en un solo lugar evita que cada módulo
  reimplemente "merchant → default → plataforma"; la dependencia en una sola dirección
  mantiene el mapa de contextos acíclico.
- **Alternativas descartadas**: guardar la configuración dentro de `Merchant` (sobrescritura);
  que `decision` sea dueño de la configuración (ya es el módulo más grande y no le toca la
  frescura ni la deduplicación).

## R-04 — Niveles plataforma y defaults: archivos del release cargados por puerto (decisión 2)

- **Decisión**: `config/platform.json` y `config/treatment-defaults.json` en el repo, cada
  uno con `version` declarada (`"platform-1"`, `"defaults-1"`). Los lee un gateway
  `fileConfigurationLevels` (`gateways/configuration/`) que los construye con las fábricas del
  dominio (`PlatformConfiguration.of`, `TreatmentDefaults.of`) y falla el arranque nombrando
  el campo si algo no vale. **La validación en la construcción del release** es una prueba del
  proyecto `fast` (`tests/unit/configuration/release-levels.test.ts`) que carga los archivos
  reales y verifica que cada valor resuelve al vocabulario del código (barreras, candidatos,
  claims, motivos, modos): CI no pasa si un default nombra algo que el código no conoce
  (SC-005). Dos operaciones de lectura por API (`getPlatformConfiguration`,
  `getTreatmentDefaults`); ninguna de escritura.
- **Qué va en cada nivel** (inventario de la evaluación §2.2 y la constitución XI):
  - **Plataforma**: ventana de deduplicación (`dedup-window.ts`: 24 h, tope de ids),
    tolerancia de reloj (`shared-kernel/time.ts`), memoria de sesión y de visitante
    (`session-window.ts`, `visitor-window.ts`: 24 h), ventana de firma (`signature-window.ts`:
    ±5 min), gracia máxima de rotación (nueva), tope de diagnósticos por merchant (nuevo). Los
    dos primeros los publica el contrato: valen para todos.
  - **Defaults de tratamiento**: presupuesto de frescura (`freshness.ts`: 36 h / 15 min),
    umbrales del nivel de sincronización (`sync-level.ts`: recepciones conservadas, edad
    máxima, mediana), política de decisión (`default-1`), política comercial
    (`commercial-default-1`), perfil de evidencia (vacío), superficies y barreras activas
    (todas), estrategia de sincronización por flujo (`push` en los cuatro), idiomas (ninguno
    declarado: hasta el catálogo de mensajes el idioma no restringe).
  - **Merchant**: lo que sobrescribe de los defaults, más el mapa de anclajes (que no tiene
    default: sin mapa, el SDK usa su cadena de resolución de `01 §3.1.1`).
  - Las constantes de `src/` que gobiernan comportamiento se **eliminan** y sus consumidores
    reciben el valor por su puerto de lectura; quedan las invariantes (`isRate`, escaleras) y
    los algoritmos. Los buckets de asignación y FNV-1a son algoritmo (evaluación §2.2).
- **Fundamento**: son de la plataforma, viajan con el código, y su cambio en caliente
  contaminaría todos los experimentos activos (sesión del 2026-09-20). Git da revisión e
  historia; la prueba en CI da la garantía de vocabulario que una API no puede dar.
- **Alternativa descartada**: `PUT` de plataforma y defaults por API (aditivo si alguna vez
  hace falta; requeriría la regla de congelamiento multitenant).

## R-05 — Credenciales: huella para las claves, secreto de firma conservado

- **Decisión**: las **claves** (ingesta, plataforma) se acuñan con 32 bytes aleatorios
  (`base64url`, con prefijo `ope_ik_` / `ope_pk_`), se entregan una vez y se guardan **por
  huella** (SHA-256 del valor; la entropía hace innecesaria la sal): `findByIngestKey` y
  `findByPlatformKey` calculan la huella de lo presentado y buscan por ella. El **secreto de
  firma** no puede guardarse por huella: el HMAC necesita el valor (`MessageAuthenticator`), así
  que se conserva tal cual en memoria y **cifrado en reposo** cuando llegue la persistencia
  (018: clave de despliegue); nunca se devuelve por ninguna lectura. La spec (FR-003) se
  corrige en ese punto: "no recuperable" vale para las claves; el secreto es "nunca devuelto".
  Cada credencial lleva `issuedAt` y `expiresAt` (sólo tras una rotación); como máximo dos
  vigentes por clase; la gracia la declara la rotación con tope de plataforma; por defecto,
  sin gracia. Un `CredentialMinter` (puerto de `merchant`, gateway con `node:crypto`) acuña y
  calcula huellas: el dominio no importa Node.
- **Fundamento**: constitución "credenciales rotables"; ADR-014 (dos claves durante una
  rotación); una clave filtrada de una lectura de administración es el peor caso de un
  multitenant operado.
- **Alternativa descartada**: guardar las claves en claro como hoy (`OPE_MERCHANTS`), que
  mañana en Postgres serían legibles por cualquiera con acceso a la base.

## R-06 — Operadores, alcance y registro de administración (decisión 3)

- **Decisión**: módulo nuevo `admin` (dominio: `Operator` con `operatorId`, huellas de token
  (hasta dos), `scope: "*" | MerchantId[]`, regla `operator.scopeFor(merchantId): Result<…,
MerchantOutOfScope>`; `AdminEntry`). `OPE_ADMIN_OPERATORS` (JSON) lista operadores con
  **huellas** de token y alcance; el token en claro lo acuña `node
scripts/mint-admin-token.mjs` y se entrega fuera de banda. Esquema `adminToken` (bearer,
  ya definido en `contracts/components/securitySchemes/`) pasa de `PROPOSED` a decidido; el
  handler `makeAdminTokenSecurity` (módulo `admin`) resuelve el operador por huella y deja un
  `OperatorPrincipal`; `operatorOf(req)` en `http/security/principal.ts`. El **alcance** se
  juzga en cada caso de uso de administración por un servicio `AdminScopeService.authorize
(actor, merchantId)` que devuelve `fail(MerchantOutOfScope)` (403, sin revelar existencia)
  y registra la denegación en el puerto `AdminLog`; los éxitos y rechazos los registra un
  decorador `AuditedUseCase` (`application/admin/decorators/`, aplicado en la composición
  como `LoggedUseCase`) con actor, instante, operación, merchant, resultado y versión o
  experimento resultante. Sin datos personales: `operatorId` es un identificador.
- **Fundamento**: la autenticación es un servicio que el handler consulta antes del cuerpo
  (ADR-023), pero el alcance depende del `merchantId` de la ruta, que sólo el controller
  conoce; ponerlo en un servicio que todo caso de uso admin invoca primero mantiene la regla
  en un solo lugar y la denegación registrada. El decorador evita repetir el registro en cada
  caso de uso (transversal, como el log).
- **Alternativas descartadas**: un token compartido (sin actor); alcance en el security
  handler (no tiene la ruta); alta de operadores por API (fuera de alcance: los operadores
  somos nosotros y hoy son pocos).

## R-07 — Kill switch: apaga la decisión, no la medición

- **Decisión**: `Merchant.status = "off"` → el `DecisionService` (que ya consulta al merchant
  por su puerto de políticas) resuelve `NO_OP` con el motivo nuevo `merchant-off`
  (`contracts/no-op-reasons.yaml` + réplica en el kernel) **antes de asignar**: apagado no
  cuenta para el experimento ni consume presupuestos. Ingesta, exposición (que responde 202 y
  no registra si no hay decisión que confirmar), catálogo, órdenes y devoluciones siguen
  aceptándose. `getSdkConfig` expone `enabled: false` para que el SDK calle sin llamar.
  `deactivated` → ninguna credencial resuelve: el borde responde 401 como a una clave
  desconocida.
- **Fundamento**: `01 §14.2` ("sin deploy y sin tocar el sitio"); la cadena de evidencia no se
  corta porque OPE calle (ADR-028); un merchant apagado no debe distinguirse de uno
  inexistente para quien no lo opera.
- **Alternativa descartada**: 503 en ingesta (rompería el SDK y el sitio, contra `01 §3.1`).

## R-08 — Experimento: calibración, activación, congelamiento (D-G)

- **Decisión**: `ExperimentStatus = "calibrating" | "active" | "closed"`; `open` crea en
  `calibrating` (se asigna y se decide; `DecisionFacts.phase = "calibration"`), `activate`
  fija `windowStartedAt` y congela; `close` cierra. `PublishConfigurationUseCase` consulta
  `ExperimentDirectory.activeFor` (ya existe): si hay uno `active` y la versión no es
  `corrective`, `fail(ConfigurationFrozen)` (409); si es correctiva, publica y `restartWindow`
  del experimento en el mismo instante, todo registrado. Como máximo uno en `calibrating` o
  `active` por merchant (`ExperimentAlreadyOpen`, 409). El kill switch no toca el experimento.
  La asignación (ADR-022) no cambia: `Experiment.assign` sigue puro; `activeFor` devuelve el
  experimento en calibración o activo; la marca de fase la pone el plano de decisión.
- **Fundamento**: D-G confirmada; constitución I y III (nadie cambia el brazo; el tratamiento
  se congela); `01 §14.2` ("si algo cambia, la ventana se corta ahí").
- **Alternativa descartada**: crear directamente `active` con una ventana de calibración por
  fecha (menos explícito; la activación como acto del operador deja registro).

## R-09 — La terna de versiones en cada decisión (FR-015)

- **Decisión**: `DecisionFacts.configuration = { platform: string; defaults: string;
merchant?: number }` y `phase?: "calibration"`; el `DecisionService` lo toma de la
  configuración efectiva que le entrega su puerto (que ya devuelve `commercialPolicyVersion`
  dentro de `selection`; se conserva). El DTO del SDK no cambia (constitución III: nada del
  tratamiento sale al navegador).
- **Fundamento**: `01 §14.2`; SC-003.

## R-10 — Superficie HTTP: el mapa antes que el contrato (FR-024)

- **Decisión**: se editan las entradas planificadas de la feature 017 en
  `contracts/api-map.yaml` (renombrar `putFlags` → `publishMerchantConfiguration`, POST: crea
  una versión) y se agregan como `planned` antes de construirlas: `getMerchant`,
  `deactivateMerchant`, `rotatePlatformSecret`, `getMerchantConfiguration`,
  `listConfigurationVersions`, `activateExperiment`, `listExperiments`,
  `getPlatformConfiguration`, `getTreatmentDefaults`, `listAdminLog` (global) y
  `listMerchantAdminLog` (por merchant), `listAnchorDiagnostics`. Capacidades del consumidor
  `admin`: `merchants:read`, `merchants:write`, `credentials:rotate`, `configuration:read`,
  `configuration:write` (reemplaza `flags:write`), `experiments:write`, `log:read`,
  `messages:publish` (queda para la 020). Las colecciones de admin (`listMerchants`,
  `listConfigurationVersions`, `listExperiments`, los logs, diagnósticos) usan los parámetros
  `cursor`/`limit` y un `<X>Page` ya definidos (entran a la raíz con su primera operación,
  ADR-020); la regla `ope-collection-pagination` sólo vigila al portal y no cambia.
  `merchantId` en la ruta sólo bajo `admin` (constitución V); nunca en query: el log por
  merchant es una ruta propia. Errores nuevos del catálogo: `merchant-out-of-scope` (403),
  `merchant-not-found` (404), `merchant-deactivated` (409), `origin-already-registered` (422,
  invariante), `configuration-frozen` (409), `experiment-already-open` (409),
  `experiment-not-open` (409), `invalid-configuration` no existe: cada invariante del dominio
  ya tiene su slug (`invalid-treatment-share`, `invalid-commercial-version`, …) y pasa a
  emitirse como 422 con `pointer`. El cambio del contrato es compatible (sólo agrega) salvo el
  renombre de una operación planificada, que no está construida: `contract:diff` no lo ve.
- **Fundamento**: ADR-019 (nada entra al contrato sin estar en el mapa; renombrar una
  `planned` es editar), ADR-020 (consumidores y paginación), constitución V.

## R-11 — `getSdkConfig` y `reportAnchorDiagnostics` (US4)

- **Decisión**: `GET /v1/sdk/config` (consumidor `sdk`, `config:read`): `{ enabled, version:
{ platform, defaults, merchant? }, surfaces, locales: { supported, fallback? }, anchors }`;
  nada de políticas ni reparto. `POST /v1/sdk/diagnostics` (`diagnostics:write`): lista de
  `{ anchor, pageType, resolved: false }`; OPE conserva por merchant el último por
  `(anchor, pageType, versión)` con contador (`AnchorDiagnosticsStore`, tope de plataforma);
  `listAnchorDiagnostics` para el operador. El mapa de anclajes es parte de la configuración
  del merchant: `anchors: { [anchor]: { selectors: string[] } }` con los anclajes del kernel
  (`ANCHORS`); cambiarlo con experimento activo cuenta como correctivo.
- **Fundamento**: `01 §3.1.1` (perfil del merchant como datos; autodiagnóstico); constitución
  III y `03 §4.11` (nada de la persona).

## R-12 — Persistencia futura: restricción para el diseño de los puertos

- **Decisión**: los puertos de esta feature no exponen identificadores de fila, transacciones
  ni paginación por offset; las listas aceptan `cursor`/`limit` opacos desde el puerto; las
  versiones se numeran en el store (`publishVersion` devuelve el número). La 018 investiga un
  solo motor (Postgres) con un Postgres embebido para desarrollo (PGlite como candidato) y
  decide; el gateway en memoria queda para pruebas rápidas y desarrollo sin base.
- **Fundamento**: sesión del 2026-09-20 (SQLite en desarrollo descartado: dos dialectos).
