# Research — fase 0 (040, el contrato para consumidores)

Lo que había que mirar antes de planificar: qué hace hoy el servidor con cada una de las cinco cosas,
qué piezas ya existen, y en qué no alcanza ninguna. Cada hallazgo termina en una decisión, con lo que
se descartó.

## R-01 — Los punteros ya existen en el borde, y salen sin `/body`

**Lo que hay.** `src/interface-adapters/http/to-problem.ts` ya convierte `details.pointer` de un
`DomainError` en una entrada de `errors[]`: `jsonPointerOf("declared.rules[2].when")` →
`/declared/rules/2/when`. Lo usan los errores de configuración (`InvalidConfigurationValue`), de
textos (`UnknownTextKey`) y del kernel (`ConfigurationReasonRequired`, `LocaleIncomplete`).
`OriginAlreadyRegistered` lleva `{ index }` pero no `pointer`, y `RotationGraceTooLong` lleva
`{ maxGraceMs }`. Ninguno de los dos sale con `errors[]`.

**Lo que no cierra.** El esquema `ProblemDetails` dice que un `pointer` es «relativo al pedido
(`/query/foo`, `/body/kind`, `/headers/x`)», y los `400` del validador salen así (`BODY_POINTER` en
`dispatch.ts`). Los `422` de dominio salen **sin** `/body`: `/declared/rules/2/when`. El ejemplo de
`RotationUnprocessable` en el contrato muestra `/graceSeconds`, que es la misma falta. OPE-Web sólo
manda al campo los punteros bajo `/body` (`fieldNameOf`), así que hoy ni los que ya salen sirven.

**Decisión.** El campo que un error de dominio nombra es **siempre del cuerpo** —es lo único que un
invariante de esquema puede señalar—, así que `toProblem` publica `/body` + puntero, y los ejemplos
del contrato se corrigen. `OriginAlreadyRegistered` pasa a nombrar `origins[N]` y
`RotationGraceTooLong` a nombrar `graceSeconds`. Es un cambio de valor en respuestas que ya existían
(`/declared/...` → `/body/declared/...`): **compatible**, porque el contrato ya decía `/body` y el
servidor no cumplía; se anota en el ADR.

**Qué invariante señala un campo, y cuál no.** De los de esquema: `invalid-origin` (lo evalúa el
dominio por elemento: `origins[N]`), `origin-already-registered` (`origins[N]`),
`rotation-grace-too-long` (`graceSeconds`), `configuration-reason-required` (`reason`, ya lo lleva),
`duplicate-attribute-label` y `duplicate-order-item` (el elemento repetido, si el dominio sabe cuál),
`catalog-duplicate-product-id` / `catalog-duplicate-variant-id` (ídem), `invalid-experiment-cuts`
(el corte), `session-visitor-mismatch` (el evento que no coincide), `corroboration-confirmed-in-future`
(`confirmedAt`). Los de operación (`locale-incomplete`, `treatment-exceeds-holdout`,
`catalog-out-of-order`, `origin-not-allowed`, `exposure-decision-unknown`, `order-unknown`) **no**
señalan un campo del cuerpo que el operador pueda corregir tecleando: siguen sin `errors[]`.

**Lo que se descartó.** Un puntero sin `/body` «porque ya era así»: contradice al esquema y a los
`400`. Y adivinar el campo en el borde a partir del slug: el que sabe es el error de dominio, y
donde no lo lleva, se le agrega (es un detalle escalar, como los demás).

## R-02 — `x-invariants` gana `pointer`, y la comprobación de invariantes lo exige en la prueba

**Lo que hay.** `ope-invariants` exige `type`, `status`, `rule`, `description`; `check:invariant-tests`
exige una prueba `[invariant:<slug>]` por cada invariante del bundle. Nada declara, ni verifica, si
el rechazo señala un campo.

**Decisión.** Un invariante **de esquema** puede declarar `pointer` (un camino relativo al cuerpo,
`origins[N]` con `N` literal para «el elemento»); `ope-invariants` verifica la forma y rechaza
`pointer` en un invariante de operación; `check:invariant-tests` exige, cuando hay `pointer`, que la
prueba del invariante **nombre el puntero publicado** (`/body/origins/`) en su cuerpo. Es una
verificación textual, como las demás del repositorio (los títulos `[invariant:<slug>]` también lo
son), y alcanza: una prueba que lo nombra lo afirma, y una que no lo nombra falla el build.

**Lo que se descartó.** Hacer el puntero obligatorio en todo invariante (los de operación no tienen
campo); y derivar los `errors[]` del contrato en el borde (la verdad del índice la tiene el dominio).

## R-03 — El identificador de pedido ya existe; falta exponerlo, y no adoptar el ajeno

**Lo que hay.** Fastify acuña `request.id` por pedido (`reqId` en el registro, por el serializador de
`request-logging.ts`). Por omisión, Fastify **adopta** el encabezado `request-id` si el cliente lo
manda (`requestIdHeader: 'request-id'`), y el formato es `req-N` por proceso.

**Decisión.** El servidor expone `X-Request-Id` en **toda** respuesta con `request.id`, desde un
hook de transporte (`onRequest` que fija el encabezado, como `retryAfterOn503` fija `Retry-After`); el
Problem Details lleva `requestId` con el mismo valor, puesto por `send()` en `http-response.ts` cuando
el cuerpo es un problema —el transporte, no cada controller—; y `requestIdHeader: false` para no
adoptar un identificador ajeno (FR-003). El `genReqId` por omisión se conserva: es único por proceso y
coincide con el registro, que es lo que la spec pide; un prefijo por proceso es de despliegue.

**Lo que se descartó.** Un UUID propio (otro identificador que el registro no tiene), y poner
`requestId` desde `problem()` (habría que enhebrar el pedido a cada controller para un dato del
transporte).

## R-04 — `getOperator` no necesita capacidad, y el contrato tiene que poder decirlo

**Lo que hay.** `ope-required-capabilities` exige una lista **no vacía** a toda operación autenticada.
`AdminTokenResolver` resuelve el token y entrega `OperatorPrincipal { operator }`; `operatorOf(req)`
lo saca en el controller. `audited-operations` audita las `admin` con una capacidad que no es de
lectura; una sin capacidad no se audita, que es correcto: leer quién sos no se registra, como leer el
registro no se registra.

**Decisión.** `getOperator` declara `x-identifies-principal: true` y `x-required-capabilities: []`;
`ope-required-capabilities` admite la lista vacía **sólo** con esa marca, y la marca sólo en una
operación autenticada (fixture de las dos violaciones). El módulo de capacidades la emite con
`capabilities: []`; un consumidor que quiera distinguirla de una operación olvidada lo lee del bundle,
que tiene al lado. **En OPE-Web, una línea**: su `conformity` hoy falla con una lista vacía y tiene que
admitirla cuando el bundle marca `x-identifies-principal`; es lo único que cambia allá, y se hace al
verificar SC-001.

**El caso de uso.** No hay regla: el principal ya es el resultado. Pero `served()` arma handlers con
un caso de uso y es lo que les pone registro y auditoría (ADR-023, ADR-034), así que
`GetOperatorUseCase` existe, trivial, con `execute({ actor })` que devuelve el operador. Un controller
que presente el principal sin pasar por ahí sería la única operación cableada distinto.

**Lo que se descartó.** Darle `merchants:read` (semánticamente falso: identificarse no lee
merchants, y el día que haya capacidades por operador sería un agujero); y una regla general «admin
puede no declarar capacidad» (lo que la regla existe para impedir).

## R-05 — `displayName` no está en la lista de datos personales, y eso es lo que hay que arreglar

**Lo que hay.** `pii-denylist.json` prohíbe `name`, `firstName`, `lastName`, …; la comparación es por
nombre exacto (minúsculas). **`displayName` pasaría el lint hoy sin tocar nada.** Lo que lo prohíbe es
la constitución VII («MUST NOT registrarse nunca: nombre»), no la herramienta.

**Decisión.** Dos cosas, para que la herramienta diga lo mismo que la constitución enmendada:
`displayName` **entra a la lista** (es un nombre, y en cualquier otro esquema sería el dato que VII
prohíbe), y el lint gana una **excepción acotada** con nombre y razón que `noPii` honra. Se planeó en
el ruleset (`functionOptions.allow` con un camino); **al implementar se movió al esquema**
(`x-personal-datum: { property: displayName, reason }` en `Operator.yaml`): Spectral recorre el
documento resuelto, donde el esquema del operador aparece copiado bajo cada operación que lo responde,
y una marca sobre el esquema viaja con cada copia mientras que una lista de caminos tendría que
nombrarlas una por una. Fixtures: `displayName` en el esquema de un merchant sigue fallando; en el del
operador, no; una marca sin razón, falla.

**Dónde vive el nombre.** `OperatorRecord` gana `displayName?: string`; `Operator.of` lo valida (no
vacío, sin espacios en los bordes, largo máximo razonable); el parser de `operators-config.ts` lo
lee; `config/schemas/operators.schema.json` lo admite; `config/dev-operators.json` lo trae. El
registro de administración sigue indexado por `operatorId`: `AdminEntry` no cambia.

**Lo que se descartó.** Un `overrides` de Spectral por archivo (el lint corre sobre el documento
resuelto desde la raíz; una excepción por ruta de archivo no acota nada), y dejar `displayName` fuera
de la lista «porque pasa» (la lista sería mentira).

## R-06 — Los artefactos para consumidores: un emisor nuevo, dos copias, y sin commit adentro

**Lo que hay.** `contract:types` escribe `generated/` con cuatro emisores (`contract-types-lib`,
`contract-problem-types-lib`, `contract-audited-operations-lib`, `contract-schemas-lib`), cada uno con
cabecera `GENERATED by scripts/<x>.mjs`, y `contract:types:check` compara archivo por archivo.
`audited-operations-lib` es el modelo exacto de «módulo derivado del bundle y del mapa».

**Decisión.** Un emisor `contract-consumer-artifacts-lib.mjs` que produce `generated/contract/`:
`openapi.yaml` (copia del bundle), `api.d.ts` y `problem-types.d.ts` (copias de los generados, para
que la carpeta sea autocontenida), `capabilities.{js,d.ts}` (operaciones del consumidor `admin` en el
orden del bundle, con sus capacidades e idempotencia; vocabulario como unión ordenada),
`constraints.{js,d.ts}` (los esquemas objeto que algún cuerpo de pedido `admin` referencia, directa o
transitivamente, con las claves de `constraints-artifact.md`) e `identity.json` (`version` y
`sha256`). Entra a `contract-types.mjs` y a `contract-types-check.mjs`; `generated/README.md` gana su
fila; `.gitattributes` ya cubre `generated/**`.

**Sin commit en `identity.json`.** La forma de OPE-Web lo tiene opcional (`backendCommit`) y su
sincronizador lo agrega leyendo `git` del backend al copiar. Si el emisor lo escribiera, cada commit
cambiaría el artefacto y `contract:types:check` fallaría siempre; un generado determinista no puede
depender de `HEAD`.

**El oráculo.** Correr `npm run contract:sync` en OPE-Web contra este backend y `npx ope-check`: la
conformidad pasa y el README dice «copiado». La prueba de gobernanza propia
(`tests/governance/consumer-artifacts.test.ts`) afirma lo mismo que esa conformidad —identidad,
unión ordenada, toda operación `admin`, todo esquema de cuerpo de pedido— sobre el bundle real, para
no depender del otro repositorio en CI.

**Lo que se descartó.** Emitir sólo lo que hoy no se copia (la carpeta sería «lo que falta» y no «el
contrato para un consumidor»); y parametrizar por consumidor ya (no hay segundo consumidor; se
escribe para `admin` sin cerrarse: la constante del consumidor está en un lugar).

## R-07 — El contrato cambia de forma compatible: `1.12.0`

`requestId` opcional en `ProblemDetails`, `getOperator` nueva, `errors[]` donde antes no había,
`pointer` como extensión: ninguno rompe a un cliente. `contract:diff` lo clasifica menor; la versión
sube a `1.12.0` y `tests/integration/bootstrap.test.ts` la afirma. El mapa gana `getOperator` como
`built` con `feature: "040"`; el sustantivo `operator` ya tiene nota (`docs/dominio/operador.md`,
`en: operator`), así que `check:glossary` no pide una nueva.

## R-08 — Qué se enmienda y qué se escribe

- **Constitución VII → 1.5.0** (MINOR: amplía la guía materialmente sin cambiar el sentido): «OPE
  observa comportamiento, no personas» se acota a las personas observadas —visitante y comprador— y
  declara al operador como persona identificada, autenticada y auditada, cuyo nombre para mostrar
  puede registrarse en su configuración y servirse **sólo** a él, nunca a un consumidor `public`,
  `sdk`, `platform` o `portal`. Con su Sync Impact Report, como las anteriores.
- **ADR-044 — El contrato para consumidores**: los artefactos de `generated/contract/`, el
  identificador de pedido en toda respuesta, y los punteros bajo `/body` de los invariantes de esquema.
  Fuente: este research.
- **ADR-031, nota de enmienda fechada**: el operador tiene nombre para mostrar.
- `contracts/README.md`: filas de `x-identifies-principal` y del campo `pointer` de `x-invariants`;
  `generated/README.md` y `scripts/README.md`: las filas nuevas; `docs/dominio/operador.md`: el nombre.
