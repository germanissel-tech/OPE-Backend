# Research — fase 0 (043, el testigo de concurrencia)

Lo que había que mirar antes de planificar: si comparar el testigo y escribir puede ser atómico, cómo se
declara un encabezado obligatorio con un rechazo propio, qué es el testigo de cada recurso, y qué cambia en
el merchant para que su testigo suba en toda escritura. Cada hallazgo termina en una decisión, con lo que
se descartó.

## R-01 — Comparar y escribir ya es atómico: las acciones de administración se serializan

**Lo que hay.** Las cuatro escrituras protegidas son auditadas, y `AuditedUseCase` ejecuta el caso de uso
**dentro** de `unit.scope` (feature 034). En el despliegue durable, `scope` espera su turno
(`open-store.ts`: «a unit that finds another open waits for its turn like everybody else») y el turno es uno
solo: dos acciones de administración nunca corren a la vez. Así que leer lo que rige, comparar el testigo y
escribir, dentro del caso de uso, no puede intercalarse con otra escritura.

**Decisión.** La comparación vive en el caso de uso, con lo que ya lee. No hace falta una escritura
condicional en el almacén (`UPDATE … WHERE version = :esperada`) ni un puerto nuevo.

**Lo que no cubre, y está bien.** El despliegue en memoria (`transientUnitOfWork`) no serializa: es el de
las pruebas, donde nadie publica en paralelo. Se dice en el plan para que nadie lo descubra después.

**Lo que se descartó.** La escritura condicional en cada gateway: repite en dos almacenes por recurso una
garantía que la unidad ya da para todos, y la comparación quedaría lejos de la regla que la explica.

## R-02 — Un encabezado obligatorio, con un rechazo propio y declarado

**Lo que hay.** `openapi-backend` valida los parámetros antes del caso de uso, y un encabezado requerido que
falta es `400 validation-failed` (`dispatch.ts`, `validationFail`). `TAN-10` pide un rechazo propio para el
testigo faltante, y el precedente del repositorio —`X-OPE-Signature`— lo resolvió declarando el encabezado
**opcional** y explicando en la descripción que su ausencia es `401 signature-missing`.

**Decisión.** `If-Match` se declara **requerido** en las cuatro operaciones, y el parámetro lleva una
extensión, `x-when-missing: witness-required`, que nombra el problema del catálogo. `validationFail` mira si
lo que falló es **sólo** la ausencia de un parámetro que declara la extensión y responde ese problema
(`428`). Es genérico: la próxima operación que exija un testigo no toca el código.

**Por qué no el precedente de la firma.** La firma es opcional de verdad: un merchant sin secreto no la
manda. El testigo no es opcional para nadie, y declararlo opcional tendría dos defectos:

- `contract:diff` diría «compatible» de un cambio que rechaza lo que hoy se acepta (FR-011 pide lo
  contrario);
- los tipos generados no obligarían a la consola a mandarlo, que es justo el olvido silencioso de `TAN-10`.

**Lo que se descartó.** Mirar el encabezado en el manejador de seguridad: el de `adminToken` resuelve al
operador y no sabe qué operaciones exigen testigo; enseñárselo sería otra lista que mantener.

## R-03 — El testigo de cada recurso, y por qué nunca coincide entre dos

**Decisión.** El testigo es un `ETag` fuerte, una cadena opaca entre comillas. Se calcula del estado
actual y no se guarda:

| recurso                      | testigo                                               | por qué así                                                                                               |
| ---------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| nivel de plataforma          | `"platform-12"`: el nombre de la versión que rige     | ya es único y ya es lo que estampa cada decisión                                                          |
| nivel de defaults            | `"defaults-3"`                                        | ídem; el de plataforma nunca coincide con uno de defaults                                                 |
| configuración de un merchant | `"mrc_x:configuration:5"`, o `…:0` sin versión propia | un merchant numera sus versiones: sin el merchant, la versión 5 de uno valdría para la 5 de otro (FR-012) |
| merchant                     | `"mrc_x:7"`: el merchant y su revisión                | el merchant no tiene versiones; ver R-04                                                                  |

Un `If-Match` con `*`, con varios testigos, débil (`W/`) o sin comillas **no coincide con nada** y se
responde `412`, sin distinguirlo de uno viejo (borde de la spec).

**Lo que se descartó.** Un hash del contenido: cambiaría también por un cambio que no es una escritura (un
campo nuevo en la forma de la respuesta) y no dice nada que la versión no diga.

## R-04 — La revisión del merchant sube en la entidad, en un solo lugar

**Lo que hay.** El `Merchant` (ADR-031, ADR-045) cambia por cuatro métodos —`rotated`, `switched`,
`deactivated`, `withProfile`— y los cuatro arman el siguiente con `new Merchant({ ...this.record(), … })`. Se
guarda como documento (ADR-041), así que un campo nuevo viaja sin migración.

**Decisión.** `MerchantRecord.revision: number`. `Merchant.of` empieza en `1`, y un método privado arma el
siguiente con la revisión más uno, para que los cuatro métodos lo usen y un quinto que se agregue mañana no
pueda olvidarlo. Un documento escrito antes de esta feature rehidrata con `0` cuando no la trae: su testigo
es `"mrc_x:0"` hasta la primera escritura, y es estable.

**Lo que se descartó.** Que la suba el gateway al escribir: son dos gateways que tendrían que acordarse, y la
regla «toda escritura cambia el testigo» es del agregado. Usar `updatedAt`: dos escrituras en el mismo
milisegundo darían el mismo testigo.

## R-05 — El orden dentro del caso de uso

**Decisión.** Alcance → cuerpo bien formado → **¿idéntico a lo que rige?** (responde como hoy, FR-005) →
**testigo** → lo demás (juicio, congelamiento, escritura).

- El alcance va primero para que el testigo no revele un merchant fuera de alcance (FR-010).
- La repetición va antes del testigo para que el reintento de lo que ya entró no falle (US3).
- El testigo va antes del congelamiento: explicar el `409` de algo que ya cambió no sirve (borde de la
  spec).

Para la identidad, «idéntico» es que el perfil pedido sea igual al que tiene: hoy el `PUT` repetido escribe
de nuevo, y con esta feature responde sin escribir, así que la revisión no sube por un reintento.

## R-06 — Dónde vive cada parte

**Decisión.**

- **Dominio**: `StaleVersion` en el kernel (`stale-version`, `412`), porque lo devuelven `configuration` y
  `merchant`; la revisión en `Merchant`; `Merchant.witness()`, `LevelVersion` sin cambio (su nombre ya es el
  testigo).
- **Aplicación**: cada request protegido gana `witness: string`, y cada respuesta de lectura o escritura
  sobre estos recursos dice su testigo. El cálculo del testigo de la configuración de un merchant
  (`merchant:configuration:n`) es una función del módulo, usada por la lectura y por la publicación.
- **Borde**: el controller lee `If-Match` (quita las comillas de un testigo fuerte y único; cualquier otra
  forma pasa tal cual y no coincide) y devuelve `ETag`. `witness-required` es del catálogo y lo responde la
  infraestructura (R-02); no hay error de dominio para él.

## R-07 — CORS

**Lo que hay.** `cors.ts` sirve CORS sólo al consumidor de navegador (`sdk`). El consumidor `admin` no tiene
CORS: la consola entra por el mismo origen (decisión de OPE-Web 005, ADR-044 «lo que no da»).

**Decisión.** FR-009 queda escrito en ADR-046 para el día que `admin` tenga CORS: `ETag` en
`Access-Control-Expose-Headers`. Ninguna prueba nueva, porque no hay cableado que probar.

## R-08 — Un ADR

**Decisión.** ADR-046, «El testigo de concurrencia». Es una decisión transversal (ADR-009): fija cómo se
protege **toda** escritura que reemplaza lo que leyó, hoy cuatro y mañana las que vengan. Registra las
cuatro exigencias de `TAN-10`, la extensión `x-when-missing`, el formato del testigo y el orden de R-05. La
extensión gana su fila en `contracts/README.md`.

## R-09 — El contrato, incompatible por la marca `building`

**Decisión.** Contrato `1.14.0 → 1.15.0`. `If-Match` requerido en cuatro operaciones es incompatible para
`contract:diff`, y entra por `info.x-stability: building` (ADR-003), como el `displayName` de la 041; el
reporte se cita en el quickstart y en ADR-046. `ETag` se declara en las respuestas de las cuatro lecturas y
de las escrituras del merchant y de la configuración. Dos tipos nuevos en el catálogo: `stale-version`
(`412`) y `witness-required` (`428`).
