# contracts/ — la única fuente de verdad de la superficie HTTP

`openapi.yaml` y lo que referencia describen todo lo que el servidor expone (constitución VI:
contrato primero). El servidor rutea por `operationId` y valida requests y responses contra el
contrato; los tipos, el catálogo de problemas, los esquemas de configuración y el cliente se
**derivan** de él (`generated/`, `client/`); la documentación publicada y las pruebas generadas
también. Nada entra al contrato sin estar antes en el mapa (`api-map.yaml`, ADR-019), y ningún
cambio entra sin `npm run contract:check` en verde.

Todo lo de este directorio es fuente salvo `dist/`, que es el bundle derivado (ignorado por
git). Las reglas normativas —qué falla el build— están en `CLAUDE.md` § "Reglas que fallan el
build" y § "Notas operativas del contrato"; acá está lo descriptivo: qué es cada cosa, qué
convenciones rigen, qué significa cada extensión y cómo se agrega algo.

## Inventario

| Entrada                | Qué es                                                                                                                                                                                                             | Fuente o derivado         | Quién lo lee                                                                                | Verificación                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `openapi.yaml`         | Raíz del contrato: `info` (versión, `x-stability`), `security` global, `$ref` a cada path. No declara `components` salvo `securitySchemes`.                                                                        | fuente                    | bundle, servidor (openapi-backend), generación de tipos, docs, Schemathesis                 | `contract:lint` (Redocly + Spectral), `contract:diff`, `check:api-map`                        |
| `paths/`               | Un archivo por ruta, con sus operaciones (`operationId`, tag, seguridad, `x-*`, responses).                                                                                                                        | fuente                    | bundle                                                                                      | `contract:lint`; un controller por `operationId` (`shape`)                                    |
| `components/`          | `schemas/`, `parameters/`, `responses/`, `securitySchemes/`: un archivo por componente, referenciado por ruta relativa; el bundle lo promueve a `#/components/<tipo>/<Archivo>`.                                   | fuente                    | bundle, generación de tipos y de esquemas de configuración                                  | `contract:lint`; `check:glossary` (todo sustantivo resuelve a `docs/dominio/`)                |
| `examples/`            | Ejemplos con nombre que las responses citan; toda `422` nombra en su ejemplo la invariante que la produce.                                                                                                         | fuente                    | bundle, docs, Insomnia                                                                      | `contract:lint` (`ope-request-example`, `ope-success-response-example`, `ope-no-generic-422`) |
| `api-map.yaml`         | Mapa del contrato: toda operación construida o planeada, con consumidor, esquema de seguridad, capacidades, feature y fuente; ciclo de vida `planned → built → deprecated → retired`.                              | fuente                    | `check:api-map`, `contract:docs` (superficie planeada), la réplica de capacidades en `src/` | `check:api-map` (mapa ↔ contrato en los dos sentidos)                                         |
| `problem-types.yaml`   | Catálogo de tipos de error RFC 9457 (`urn:ope:problem:<slug>`, status, título). Único origen: se genera a `generated/problem-types.{js,d.ts}`; ningún archivo escrito a mano lo replica.                           | fuente                    | `contract:types`; el servidor lo importa generado; los `code` de los `DomainError`          | `contract:types:check` (drift); prueba de que todo `code` del dominio existe en el catálogo   |
| `no-op-reasons.yaml`   | Catálogo de motivos de `NO_OP` (string con patrón, no enum: ampliar es compatible), con la autoridad que emite cada uno.                                                                                           | fuente                    | réplica en `src/domain/shared-kernel/no-op-reasons.ts`                                      | prueba de réplica contra el contrato                                                          |
| `.spectral.yaml`       | Ruleset propio (`ope-*`) sobre el preset recomendado de Spectral; estilo bloque; `oas3-schema` apagada (la estructura la valida Redocly).                                                                          | fuente                    | `contract:lint`, `tests/contract-rules`                                                     | un fixture por regla en `tests/contract-rules/fixtures/` (la prueba falla si falta)           |
| `rules/`               | `functions/` (funciones CommonJS de las reglas `ope-*`, verificadas con `checkJs`) y `pii-denylist.json` (la **única** lista de datos personales prohibidos en esquemas).                                          | fuente                    | `.spectral.yaml`                                                                            | `tests/contract-rules`; `typecheck` (scripts)                                                 |
| `oasdiff-severity.txt` | Severidades que `contract:diff` eleva a `err`: quitar un campo opcional de respuesta, especializar o generalizar un tipo (ADR-003: lo que un consumidor ya construido no tolera aunque oasdiff lo considere leve). | fuente                    | `scripts/contract-diff.mjs`                                                                 | `contract:diff`, `tests/contract-diff/`                                                       |
| `dist/`                | Bundle derivado: `openapi.yaml` (lo que el servidor sirve y valida) y `openapi.docs.yaml` (con la superficie planeada desde el mapa). Ignorado por git; se regenera con `contract:bundle`.                         | derivado (no se commitea) | servidor, `contract:types`, `contract:docs`, `contract:insomnia`, Schemathesis              | `contract:bundle` corre dentro de `contract:check`                                            |

## Convenciones del multi-archivo

- **La raíz no declara `components`** salvo `securitySchemes` (que `security` referencia por
  nombre). Cada componente es un archivo en `components/<tipo>/<Nombre>.yaml`, referenciado por
  ruta relativa desde donde se usa; el bundle lo promueve a `#/components/<tipo>/<Nombre>`, y
  ese nombre es el que ven los tipos generados y los consumidores.
- **Componentes sin referencia hasta su primera operación.** Redocly rechaza componentes sin
  uso: un esquema de seguridad, un parámetro de paginación o un `Page` que ninguna operación
  construida usa existe como archivo pero **no** se referencia desde la raíz; entra con la
  primera operación que lo usa (ADR-020).
- **Todo schema de un media type es `$ref`** a `components/schemas` (nunca inline); todo
  request body lleva `additionalProperties: false`; toda propiedad lleva `description`
  (`ope-property-description`); ningún campo de dato personal (`ope-no-pii`,
  `rules/pii-denylist.json`); `merchantId` nunca en path, query ni body salvo bajo el consumidor
  `admin` (`ope-no-merchant-id-in-request`, constitución V).
- **Subconjunto de OpenAPI 3.0 en los esquemas** (ADR-014): nada que Ajv en el servidor o los
  generadores no entiendan. Uniones discriminadas: `type: object` + `oneOf` + `discriminator`
  **con `mapping`** y `type: { enum: [valor] }` en cada rama (sin `const`); el servidor quita el
  `mapping` en runtime (`infrastructure/http/strip-discriminator-mappings.ts`).
- **Todo error es Problem Details** (`application/problem+json`, `ope-error-response-problem-details`)
  con `type` del catálogo `problem-types.yaml`; toda `422` nombra su invariante
  (`ope-no-generic-422`); toda operación declara las respuestas de error de su consumidor
  (`ope-required-error-responses`).
- **El tag fija el consumidor** y el consumidor fija el esquema de seguridad y el vocabulario
  cerrado de capacidades (`api-map.yaml`, `ope-consumer-security`, `ope-tags-closed-catalog`;
  ADR-020). Toda operación con `platformKey` declara los dos headers de la firma
  (`ope-platform-signature-headers`, ADR-029).
- **Versionado** (ADR-003): un cambio incompatible sube la versión mayor y el prefijo `/v<N>/`
  (`ope-path-version-prefix`); mientras `info.x-stability: building`, entra con bump MINOR y
  `contract:diff` lo reporta y acepta.

## Extensiones

Las claves `x-*` son el vocabulario propio del contrato: cada una tiene un lugar, una forma, la
regla de Spectral que la verifica y, cuando aplica, quién la consume en runtime o en la cadena.
`tests/docs` exige que esta tabla nombre exactamente las extensiones presentes en la fuente.

| Extensión                 | Dónde                                                                          | Forma                                                                                                             | Regla                                                               | Consumidor                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `x-stability`             | `info` de la raíz                                                              | `building` mientras ningún merchant consume el contrato; se quita antes del primer piloto                         | `ope-path-version-prefix` (el prefijo se conserva); `contract:diff` | `scripts/contract-diff.mjs` (acepta y reporta lo incompatible), `release-check` (avisa)                                    |
| `x-required-capabilities` | operación autenticada                                                          | lista `recurso:accion` del vocabulario cerrado del consumidor (`consumers.<x>.capabilities` del mapa)             | `ope-required-capabilities`, `check:api-map`                        | `infrastructure/http/security-boundary.ts`: compara con las capacidades del principal y responde `403 capability-missing`  |
| `x-invariants`            | operación (si depende de otro recurso) o schema (si sólo involucra sus campos) | lista de `{ type, status, rule, description }`; `type` es un slug del catálogo, nunca `unprocessable`             | `ope-invariants`, `ope-no-generic-422`, `check:invariant-tests`     | `scripts/check-invariant-tests.mjs`: exige una prueba `[invariant:<slug>]` por cada una; los ejemplos de `422` la nombran  |
| `x-idempotency`           | operación del consumidor `outcomes` (notificación servidor a servidor)         | `{ key, first, repeat }`: clave = propiedad requerida del body; dos 2xx distintos; más `409 idempotency-conflict` | `ope-outcomes-idempotency`                                          | documentación y pruebas de integración; la semántica la implementa el puerto (`recorded \| repeated \| conflict`, ADR-028) |
| `x-collection`            | `GET` de colección sin parámetro final                                         | `true`; parámetros `cursor`/`limit`/`from`/`to` por `$ref` y `200` con un `<X>Page` (`items`, `nextCursor?`)      | `ope-collection-pagination`                                         | `contract:docs`; los controllers leen la página con `pageQueryOf`/`pageDto` (`http/boundary.ts`)                           |

## Cómo se agrega

- **Una operación**: (0) entrada `planned` en `api-map.yaml` con consumidor, tag, capacidades,
  feature y fuente; (1) el path en `paths/` y sus componentes; (2) `npm run contract:check`;
  (3) `npm run contract:types`; (4) el resto del flujo en `CLAUDE.md` § "Flujo de trabajo"
  (pasos 0–5); al construirla, `built` en el mapa. Un sustantivo nuevo trae su nota en
  `docs/dominio/` (ADR-008).
- **Un esquema**: un archivo en `components/schemas/<Nombre>.yaml` con `description` en cada
  propiedad, referenciado por ruta relativa; si es un request body, `additionalProperties:
false`; si lleva una regla que el esquema no expresa, su `x-invariants` (ADR-007).
- **Un tipo de problema**: una entrada en `problem-types.yaml` (`slug`, `status`, `title`) y
  `npm run contract:types`; el `DomainError` que lo emite lleva `code = "<slug>"` (ADR-023).
- **Un motivo de `NO_OP`**: una entrada en `no-op-reasons.yaml` (`slug`, `emitter`,
  `description`) y su réplica en `src/domain/shared-kernel/no-op-reasons.ts` (la prueba de
  réplica falla si difieren).
- **Una regla**: `tests/contract-rules/README.md` (definirla en `.spectral.yaml` en estilo
  bloque, su función en `rules/functions/` si hace falta, su fixture generado, su documentación).
- **Un ejemplo**: un archivo en `examples/` referenciado desde la response; si es una `422`,
  su `type` nombra la invariante.
- **Una extensión `x-*` nueva**: su fila en la tabla de arriba (dónde, forma, regla,
  consumidor) y la regla que la verifica; `tests/docs` falla con una extensión sin fila.
