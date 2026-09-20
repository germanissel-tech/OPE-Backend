# Research — Alineación con los documentos base del MVP (016)

Fuente de cada decisión: `docs/auditoria/2026-09-20-evaluacion-docs-base-vs-repo.md` (la
"evaluación"), con el número de la decisión del dueño entre paréntesis.

## R-01 — Constitución 1.4.0: principio XI y barreras (decisiones 6 y 12)

- **Decisión**: una sola enmienda, versión 1.4.0. MINOR por el principio XI ("Ninguna
  política vive en el código", texto de la evaluación §2.2, íntegro); el PATCH de las
  barreras (`fit`, `price`, `returns` como identificadores, el nombre de `03 §4.2` como prosa)
  se acumula en la misma versión, y el Sync Impact Report lo dice. La nota transitoria de VII
  (v1.3.0: "01 §10.3 sigue listando seis campos") se cierra en el mismo Sync Impact cuando la
  historia 3 edite `01`; si la historia 3 no se puede ejecutar, la nota queda.
- **Fundamento**: Governance de la constitución (MINOR "agregar principios"; PATCH
  "redacción"); dos enmiendas en una feature serían dos PR por el mismo documento.
- **Alternativa descartada**: dejar los nombres en castellano con una tabla de mapeo — el
  gate de identificadores (R-06) los marcaría igual, y la regla de ADR-015 es que los
  identificadores son los del contrato.

## R-02 — ADR-025 revisado y ADR nuevo de decisiones de producto (decisiones 1, 2, 8)

- **Decisión**: ADR-025 conserva su decisión construida (snapshot completo, `capturedAt`,
  firma) y reescribe su sección de consecuencias: push es **un modo** de la estrategia de
  sincronización por merchant y por flujo (push / pull / subscribe), negociada con cada
  merchant; los adaptadores viven en OPE; un puerto único recibe los cuatro flujos; el modo
  es configuración congelada durante el piloto. El ADR nuevo (número siguiente del
  directorio) registra D-B, D-C, D-E, D-F y D-G como confirmadas el 2026-09-20 con la
  propuesta de `04` y la consecuencia en el repo; ADR-010 pasa D3–D6 a `01 §13` y cita el
  nuevo. El estado de ADR-010 sigue `abierta` (D3–D6 no se cerraron).
- **Fundamento**: constitución Governance ("los principios derivados de una decisión
  DECIDIDO en los documentos del MVP sólo se enmiendan si el documento fuente cambia"): la
  fuente cambia en la historia 3 y el ADR es la cita del repo.
- **Alternativa descartada**: un ADR por decisión de producto — cinco documentos para una
  sola reunión con el dueño; la 015 ya agrupó decisiones análogas en ADR-028.

## R-03 — Roadmap: número de esta feature y reorden (decisiones 1, 4, 5, 11)

- **Decisión**: esta feature es la 016 (`specs/` es secuencial); las reservadas corren un
  número y se reordenan según la evaluación §5.2: 017 Configuración, flags, kill switch y
  administración; 018 Persistencia y resiliencia; 019 Puerto de plataforma, estrategia por
  flujo y adaptadores; 020 Catálogo de mensajes; 021 Análisis ITT y portal; 022
  Observabilidad y end-to-end. Cada descripción incorpora el alcance que la evaluación le
  asigna (tres niveles de configuración, idiomas, congelamiento y versión estampada; registro
  desacoplado y los tres hallazgos de diseño de la 014; refresco parcial, planificador,
  consumidor, adaptador Magento 2 y de prueba; catálogo por idioma y `message-unavailable`;
  `NOT_AVAILABLE` en el portal). Las operaciones planificadas cambian su `feature:` en el mismo
  commit; `check:api-map` verifica.
- **Fundamento**: decisión 4 ("memoria mientras se construye", pero 018 antes que 019 porque
  el planificador y las suscripciones necesitan estado durable) y decisión 1 (el puerto
  adelantado por delante del catálogo de mensajes y el portal).
- **Alternativa descartada**: numerar esta feature 022 para no mover las reservadas — rompe
  el orden cronológico de `specs/`; la renumeración es un edit mecánico verificado.

## R-04 — Contrato v2: `status` y `correlation` (decisión 7)

- **Decisión**: `OrderStatus` pasa a `[VERIFIED_ORDER, ATTRIBUTED_ORDER, RETURNED]` (la
  cadena de `01 §5`); un esquema nuevo `Correlation` con `[PENDING_CORRELATION, ATTRIBUTED]`;
  `OrderResult` lleva `status` + `correlation`; `ReturnResult` lleva `status: RETURNED` +
  `correlation` y pierde `orderStatus` (era la correlación con otro nombre). Una orden
  repetida que ya fue devuelta responde `status: RETURNED`. `info.version` 2.0.0 y todas las
  rutas bajo `/v2/` (regla `ope-path-version-prefix` y `check:api-map`); `contract:diff`
  reporta "Expected incompatible change: major version 1 → 2" y pasa. En el dominio,
  `Order.status()` devuelve la cadena y `Order.correlation` ya existe como valor; se agrega
  `Order.correlationStatus()`.
- **Fundamento**: `01 §5` distingue "la plataforma confirmó" de "OPE pudo vincular"; dos ejes,
  dos campos. Sin merchants conectados, la versión mayor cuesta sólo lo interno (ADR-003).
- **Alternativa descartada**: mantener `PENDING_CORRELATION` en `status` y agregar
  `VERIFIED_ORDER` como valor más — mezcla los dos ejes en un enum y obliga al portal (021) a
  inventar otro.
- **Alcance del `/v2/`**: contrato, `api-map.yaml`, pruebas de integración y unitarias que
  escriben rutas, Insomnia y docs generados, `scripts/test-contract.mjs` si nombra rutas,
  `sign-platform-request.mjs` si las nombra. Los fixtures de `tests/contract-rules` y
  `tests/contract-diff` que usan `/v1/` como ejemplo genérico **no** cambian (son contratos
  de prueba con su propia versión).

## R-05 — `locale` en el contexto de página (decisión 9)

- **Decisión**: `PageContext.locale` opcional, `type: string`, patrón BCP 47 por forma
  (`^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$`, longitud ≤ 35), descripción "idioma de la página
  como el SDK lo lee; contexto de la interacción, no dato personal". En el dominio,
  `PageContext.locale?: Locale` (tipo marcado en `ingestion/ids.ts`? No: no es identidad; es
  `string` validado por el contrato, con alias `Locale = string` en `event.ts`). Llega a
  `ProductFocus` (`EventBatch.focus()`) y de ahí al `DecisionRecord` como `locale?` de primer
  nivel (el idioma en que se decidió), sin efecto en ninguna autoridad hasta el catálogo por
  idioma (020). Cambio compatible del contrato (campo opcional en request).
- **Fundamento**: `01 §3.1.1` (`PageContext` es lo que el adaptador del SDK produce) y VII
  (lista blanca: el campo se declara). Registrarlo hoy evita que el catálogo por idioma tenga
  que reprocesar decisiones sin idioma.
- **Alternativa descartada**: validar contra una lista de idiomas — la lista es del merchant
  (017) y no existe todavía; la forma alcanza para rechazar basura.

## R-06 — Gate `check:identifiers` (decisión 12)

- **Decisión**: `scripts/check-identifiers.mjs`, en `contract:check` después de
  `check:glossary`. Lee la constitución, `docs/adr/*.md` y `docs/dominio/*.md`; extrae los
  spans entre comillas de código simples (no bloques); considera **identificador** lo que
  tiene forma de código: contiene `_` o `-` entre alfanuméricos (`talle_calce`, `ledger-unavailable`,
  `x-invariants`), camelCase (`merchantId`), o MAYÚSCULAS con `_` (`NO_OP`, `PENDING_CORRELATION`);
  ignora por forma lo que tiene `/`, `.`, espacio, `(`, `:`, `<`, `$`, `--`, `npm `, `#`, `@`
  o empieza con dígito. Un identificador **existe** si aparece como token en el bundle del
  contrato (`contracts/dist/openapi.yaml`), en algún `contracts/*.yaml` de catálogo
  (`problem-types`, `no-op-reasons`, `api-map`) o en algún archivo de `src/`. Exclusiones en
  `scripts/identifiers-allowlist.json`: `{ "identifier": "DECIDIDO", "reason": "marcador epistémico (ADR-009)" }`;
  una entrada sin `reason` falla. Salida: `archivo:línea: identificador` por hallazgo;
  `Identifiers: N cited, M unknown`.
- **Fundamento**: A-041 de la auditoría se marcó probada sin cotejar identificadores; el gate
  de glosario verifica sustantivos → notas, no identificadores → código.
- **Alternativa descartada**: verificar toda palabra entre comillas de código — el ruido con
  palabras sueltas (`push`, `pull`, `fit`) no distingue identificador de prosa; el criterio
  por forma cubre el caso que se escapó y los que se parecen.
- **Riesgo**: ruido inicial en ADR antiguos que citan nombres retirados. Se mide en la
  implementación; lo retirado se corrige en el documento (ADR reemplazado cita lo que
  existía: se marca con la exclusión y motivo "nombre de la versión reemplazada"), no se
  relaja el gate.

## R-07 — Edición de la base y diagramas (decisiones 3, 10, 11)

- **Decisión**: la historia 3 edita `../README.md`, `01`, `02`, `03`, `04` en los puntos de la
  evaluación §5.1, con `DECIDIDO` y fecha en cada afirmación nueva, sin renumerar secciones
  (el glosario cita `mvp:01-arquitectura-mvp.md#4.5` etc. y `check:glossary` las resuelve).
  Los diagramas se editan en sus fuentes JSON; `archify` no está instalado en la máquina ni
  en el repo (el `README` de la base lo referencia por ruta de otro repositorio): se intenta
  `npx` en la implementación y, si no está disponible, el HTML queda anotado como pendiente
  en el quickstart (asunción de la spec).
- **Acceso**: `../` no está entre los directorios autorizados de la sesión; la historia 3 pide
  la autorización al empezar. Si se niega, la feature cierra con las historias 1 y 2 y la 3
  documentada como pendiente (spec, Assumptions).
- **Fundamento**: decisión 11 (la base es la fuente y se actualiza).

## R-08 — Qué no se toca (FR-031)

- Modos pull/subscribe, refresco parcial, planificador y consumidor → 019; persistencia y
  registro desacoplado → 018; catálogo por idioma y `message-unavailable` → 020; tres niveles
  de configuración, idiomas del merchant, congelamiento → 017; `NOT_AVAILABLE` → 021;
  verificación documental de Magento 2 y VTEX → tarea previa a la 019, fuera de esta feature.
  El mapa describe cada uno; ninguno se implementa.
