---
paths:
  - "contracts/**"
---

# Notas operativas del contrato

## El orden dentro de una feature que toca HTTP

Cuando una feature toca HTTP, el orden es:

0. La operación existe en `contracts/api-map.yaml` como `planned`, con consumidor, tag,
   capacidades, hito del roadmap (`roadmap: <slug>`; la `feature: "NNN"` de `specs/` la toma al
   pasar a `built`) y fuente (ADR-019). Nada entra al contrato sin estar antes en el mapa:
   `check:api-map` compara los dos en ambos sentidos. Construirla es pasarla a `built` y, si es
   la primera de su consumidor, referenciar su esquema de seguridad desde la raíz.
1. Cambiar el contrato en `contracts/` (multi-archivo, `$ref`). La raíz `openapi.yaml` no
   declara `components` (salvo `securitySchemes`, que `security` referencia por nombre): cada
   archivo de `components/` se referencia por ruta relativa desde donde se usa y el bundle lo
   promueve a `#/components/<tipo>/<NombreDeArchivo>`.
2. `npm run contract:check` en verde (lint, bundle, compatibilidad contra `main`, drift de
   tipos). Si agrega una regla nueva al ruleset, agregar su fixture en
   `tests/contract-rules/fixtures/` (la prueba falla si falta).
3. Regenerar tipos (`npm run contract:types`). **Nunca editar lo generado a mano.**
4. Reglas puras y errores en `src/domain/<módulo>/` (`errors.ts`), caso de uso en
   `src/application/<módulo>/use-cases/`, servicios en `services/` y puertos en `ports/`
   (ver "Cómo se escribe un caso de uso"), controller en
   `src/interface-adapters/<módulo>/controllers/<operacion>.ts` tipado con
   `OperationHandler<"<operationId>">` (sólo traduce DTO ↔ request/response; lee el merchant con
   `merchantOf(req)`; un fallo se responde con `toProblem(result.error, req.instance)`; lo que
   varios controllers del módulo comparten —dominio → DTO— en `<módulo>/presenters.ts`; su
   security handler en `<módulo>/security/`), gateway del puerto en
   `src/interface-adapters/<módulo>/gateways/`, todo exportado por
   `src/interface-adapters/<módulo>/index.ts`, y
   cableado en `src/composition/modules/<módulo>.ts`: el módulo declara sus componentes como
   constantes con `port("<módulo>.<qué>")<Tipo>()` y dice **tres** cosas —`provides` (sus
   componentes: la lista de enlaces, o una tabla por tecnología si hay más de una manera de
   servirlos), `assembles` (lo que arma con ellos, igual en todo despliegue) y `serves` (handlers
   por `operationId`, esquemas de seguridad, CORS)—; los casos de
   uso se instancian con `new` dentro de los builders; un handler se declara con `served(necesita,
{ name, build }, controller, readers?)` y **no elige** si se loguea o se audita.
   Lo que **necesita** no es una lista: son los `import` y los nombres del `bind`. Un módulo nuevo
   son tres archivos: el suyo, una línea en `deployments/local.ts` y otra en `CONTEXT_MAP`;
   olvidarse de cualquiera falla en compilación, en `arch` o en `npm test`.
   `bootstrap.ts` no nombra ninguna operación y se niega a arrancar si el contrato declara una
   que ningún módulo sirve. El servidor rutea por `operationId`; no hay otro mecanismo de rutas.
5. `npm run format:check && npm run quality && npm run typecheck && npm test && npm run test:mutation && npm run test:contract`
   en verde. El hook de pre-commit corre formato, lint y typecheck sobre lo staged; el resto lo
   corre CI.

Antes del paso 1, si la operación trae **un sustantivo nuevo**, su nota en `docs/dominio/`
(ADR-008); si trae **una regla que el esquema no expresa**, su `x-invariants` con tipo propio
en `contracts/problem-types.yaml` y una prueba `[invariant:<slug>]` (ADR-007); si toma **una
decisión transversal**, su ADR en `docs/adr/` (ADR-009).

Lo descriptivo —qué es cada entrada de `contracts/`, las convenciones del multi-archivo, la
tabla de extensiones `x-*` (dónde, forma, regla, consumidor) y cómo se agrega una operación, un
esquema, un tipo de problema, un motivo de `NO_OP`, una regla o un ejemplo— vive en
`contracts/README.md` (verificado por `tests/docs`: toda extensión de la fuente tiene su fila).
Acá queda lo normativo:

- Ruleset de Spectral en estilo bloque (no `{ a: b }`), `"off"` entre comillas.
  `oas3-schema` está apagada por un bug con path items `$ref` en 3.1; la estructura la
  valida Redocly. Detalle en `specs/001-api-contract-toolchain/research.md` (R-02).
- Lista de datos personales prohibidos: **sólo** `contracts/rules/pii-denylist.json`.
- Catálogo de tipos de error: `contracts/problem-types.yaml` (`urn:ope:problem:<slug>`),
  **generado** a `generated/problem-types.{js,d.ts}` por `contract:types` (una sola fuente, sin
  réplica; `ProblemSlug` y los status son literales) y re-exportado por
  `interface-adapters/http/problem-details.ts`.
  Catálogo de motivos de `NO_OP`: `contracts/no-op-reasons.yaml`, replicado en
  `src/domain/shared-kernel/no-op-reasons.ts` (vocabulario compartido por ingesta, ledger y
  decisión; string con patrón, no enum: ampliar es compatible). Barreras (`BARRIERS`) y
  anclajes (`ANCHORS`) también viven en el kernel, con réplica contra el contrato.
- Uniones discriminadas (`Event`): `type: object` + `oneOf` + `discriminator` **con `mapping`**
  y `type: { enum: [valor] }` en cada rama (sin `const`). Ajv no acepta `mapping` y sólo aplica
  el discriminador a objetos: el servidor lo quita en runtime
  (`infrastructure/http/strip-discriminator-mappings.ts`) y el `type: object` es obligatorio.
  Sólo el subconjunto de JSON Schema que OpenAPI 3.0 admite (ADR-014).
- **Ledger**: todo `record()` devuelve `Result<…, LedgerUnavailable>` y ningún puerto lanza por
  indisponibilidad. A qué degrada cada consumidor y cómo se prueba, en ADR-021 (ADR-023 precisa
  el tipo).
- **Puerto de plataforma y estrategia de sincronización**: los cuatro flujos entran por el mismo
  puerto, en uno de tres modos negociados con el merchant (`push`, construido; `pull` y
  `subscribe`, planeados). Cuáles, por qué y qué falta, en ADR-025 y en el hito `platform-port`
  del roadmap (constitución X).
- **Verdad de producto**: el catálogo entra como snapshot completo por `PUT /v1/catalog` y
  `capturedAt` es su clave de idempotencia; el stock es guardia, nunca un claim. La frescura por
  clase, el nivel de sincronización observado y qué de eso es configuración, en ADR-025.
- **Plano de decisión**: la ingesta no lo conoce —lo invoca por un puerto— y el orquestador recorre
  las cinco autoridades en orden fijo, de las que **sólo la política comercial** emite el veredicto
  (constitución I). El vocabulario de hechos, claims y candidatos es **cerrado**: uno nuevo es una
  feature, no configuración. Cómo infiere, qué registra y qué sale al SDK, en ADR-026 y ADR-027.
- **Outcomes y cadena de evidencia**: la plataforma notifica la orden (`platformKey`) y la
  correlación es **sólo** por sesión conocida; sin ella queda `PENDING_CORRELATION` y nunca se
  completa por inferencia. La idempotencia es atómica en el puerto, la orden es inmutable y la
  respuesta nunca lleva brazo, experimento ni visitante. Todo lo demás, en ADR-028.
- **Merchants operados**: el merchant es un agregado con estado y credenciales, y sus reglas se
  invocan por su nombre. El valor de una credencial viaja **una sola vez**, el store guarda huellas,
  el interruptor corta **antes** de asignar y toda operación de un operador se audita. Los nombres
  y los códigos, en ADR-031 y ADR-034.
- **Firma de plataforma**: con secreto vigente, toda operación con `platformKey` exige
  `X-OPE-Timestamp` y `X-OPE-Signature`, y se rechaza **antes** de validar el body. Cómo se calcula,
  qué ventana tiene y de dónde salen los bytes crudos, en ADR-029.
- **Asignación y experimentos**: la asignación es pura y estable por visitante, y el brazo, el
  experimento y la fase **nunca** salen al SDK: sólo el motivo del `NO_OP`. El ciclo de vida del
  experimento, qué congela cada estado y cómo entra la semilla, en ADR-022 (03 §4.10, D-G) y
  ADR-031.
- **Configuración del SDK y diagnóstico de anclajes**: el SDK ve del merchant de su credencial
  sólo lo que necesita para correr, y **nunca** una política, un margen, un escalón, un reparto, un
  brazo ni un experimento (constitución III y VII). Qué devuelve cada una y qué conserva, en la
  descripción de `getSdkConfig` y `reportAnchorDiagnostics` del contrato, que es su fuente de verdad.
- Operación autenticada con la credencial de ingesta ⇒ `security: [{ ingestKey: [] }]`; con
  la de plataforma (servidor a servidor, `X-OPE-Platform-Key`, ADR-025) ⇒ `security: [{
platformKey: [] }]`; de un operador (`Authorization: Bearer`, ADR-031) ⇒ `security: [{
adminToken: [] }]`. El security handler resuelve el merchant antes de validar el body (401 /
  403 `origin-not-allowed`) y entrega las capacidades de su consumidor
  (`http/security/capabilities.ts`, réplica del mapa); la infraestructura compara
  `x-required-capabilities` y responde `403 capability-missing` si falta alguna. Cada esquema
  declara su header en el cableado (`SecurityScheme { handler, header }`): CORS los deriva de
  ahí y el log redacta todo header. Los logs nunca llevan IP, headers ni cuerpo
  (`infrastructure/http/request-logging.ts`). `bodyLimit` del servidor: 32 MiB (un snapshot de catálogo).
- Cambio incompatible ⇒ `info.version` a la mayor siguiente **y** prefijo `/v<N>/`. Excepción
  declarada (ADR-003): mientras el contrato lleve `info.x-stability: building` (ningún merchant
  lo consume), entra con bump MINOR y el prefijo se conserva; `contract:diff` lo reporta y lo
  acepta, `release-check` avisa. La marca se quita antes del primer piloto.
- Todo schema de un media type es `$ref` a `components/schemas` (nunca inline).
- `x-invariants` sobre la operación (si depende de otro recurso) o sobre el schema (si sólo
  involucra sus campos): `type` (slug del catálogo, nunca `unprocessable`), `status`, `rule`,
  `description`. Toda `422` nombra en su ejemplo la invariante que la produce.
- Operación autenticada ⇒ `x-required-capabilities: [recurso:accion]`; pública ⇒ sin él. El
  vocabulario de capacidades es cerrado por consumidor (`consumers.<x>.capabilities` del mapa).
- **Consumidores**: el tag fija el consumidor y su esquema de seguridad, y
  `ope-consumer-security` exige exactamente ése. La tabla de los cinco, en ADR-020; qué hacer con
  un componente que todavía ninguna operación usa, en `contracts/README.md`.
- Operación `outcomes` (notificación servidor a servidor) ⇒ `x-idempotency: { key, first,
repeat }` (clave = propiedad requerida del body; dos 2xx distintos) y respuesta `409
idempotency-conflict`. Lectura de colección del portal (`GET` sin parámetro final) ⇒
  `x-collection: true`, parámetros `cursor`/`limit`/`from`/`to` por `$ref` y `200` con un
  `<X>Page` (`items`, `nextCursor?`).
- `merchantId` en la ruta sólo bajo el consumidor `admin` (constitución V v1.2.0, ADR-020); en
  query y body, nunca.
- Ciclo de vida (ADR-019): depreciar = `deprecated: true` en la operación + estado `deprecated`
  en el mapa + anuncio en la descripción; retirar = quitar del contrato + `retired` con
  `retiredIn` + versión mayor. La documentación publicada muestra la superficie planeada
  generada desde el mapa (`contract:docs`).
