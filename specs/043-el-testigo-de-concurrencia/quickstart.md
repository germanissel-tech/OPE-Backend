# Quickstart — cómo se verifica (043, el testigo de concurrencia)

## Las pruebas

| qué            | dónde                                                        | qué afirma                                                                                                                                                    |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| la revisión    | `tests/unit/domain/merchant/`                                | `of` empieza en 1; cada uno de los cuatro métodos suma uno; un documento sin revisión rehidrata en 0                                                          |
| el borde       | `tests/unit/interface-adapters/`                             | `If-Match` fuerte y único → su valor; `*`, varios, débil y sin comillas → no coinciden                                                                        |
| la extensión   | `tests/integration/` (el de `dispatch`)                      | sin `If-Match`, `428 witness-required` sin `ETag`; con otro error de forma además, `400`                                                                      |
| los niveles    | `tests/integration/levels.test.ts`, `platform-level.test.ts` | leer → `ETag`; publicar con él → `201` y el nuevo; con el viejo → `412` y nada escrito; idéntico con el viejo → `200`; el de plataforma no vale para defaults |
| el merchant    | `tests/integration/admin-configuration.test.ts`              | lo mismo con la configuración de un merchant, también sin versión propia; el testigo antes que el `409`                                                       |
| la identidad   | `tests/integration/admin-merchants.test.ts`                  | editar con el testigo → `200` y el nuevo; después del interruptor, de una rotación y de una desactivación, el testigo viejo da `412`                          |
| el aislamiento | `tests/integration/isolation.test.ts`                        | el testigo de A no habilita escribir en B; fuera de alcance, `403` antes que `412`                                                                            |
| la durabilidad | `tests/durability/merchant-store.test.ts`                    | la revisión sobrevive un reinicio; un documento viejo lee `0`                                                                                                 |
| el contrato    | `npm run contract:check`, `npm run test:contract`            | `1.15.0`, incompatible y aceptado por `building`; la extensión verificada                                                                                     |

## A mano, contra `npm run dev`

Con el token del operador de desarrollo (`README.md`):

1. `GET /v1/admin/platform-configuration` → `ETag: "platform-N"`.
2. Publicar sin `If-Match` → `428 witness-required`, sin `ETag`.
3. Publicar con `If-Match: "platform-N"` y un cambio → `201`, `ETag: "platform-N+1"`.
4. Publicar otro cambio con `If-Match: "platform-N"` → `412 stale-version`; lo que rige es N+1.
5. Repetir el cuerpo del paso 3 con `If-Match: "platform-N"` → `200`, la N+1.
6. `GET /v1/admin/merchants/{id}` → `ETag`; apagar el interruptor; editar la identidad con el testigo de
   antes → `412`.
7. Lo mismo para la configuración de un merchant.

## Romperle algo a cada comprobación

| se rompe                                       | lo agarra                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| un método del merchant que no suba la revisión | la prueba de la revisión, y la de la identidad después del interruptor |
| el testigo de la configuración sin el merchant | la prueba de aislamiento                                               |
| el testigo mirado antes de la repetición       | la prueba del reintento (`200` con el testigo viejo)                   |
| el testigo mirado antes del alcance            | la prueba de aislamiento (`403` antes que `412`)                       |
| `validationFail` sin la extensión              | la prueba del `428`                                                    |

## Lo corrido

**El dominio (2026-10-10)** · La revisión del merchant y su testigo. Un cambio que no cambia nada —desactivar
uno desactivado, el interruptor donde ya está— devuelve el mismo merchant y no sube la revisión. Durabilidad:
la revisión sobrevive un reinicio y un documento viejo lee `0`.

**El contrato y el servidor (2026-10-10)** · `contract:diff` de la `1.15.0`: 12 cambios, cuatro
`new-required-request-parameter` (el `If-Match` de las cuatro escrituras) y ocho respuestas nuevas (`412` y
`428` en cada una); «Incompatible change accepted: the contract is building». Las pruebas existentes que
publican o editan pasan sin tocarlas: el helper `admin()` lee el recurso y manda su `ETag`. Dos pruebas de
alcance ganaron un testigo para seguir siendo sobre el alcance: sin él, el validador responde `428` antes de
mirar el alcance, que es la forma del pedido y no dice nada del recurso.

**El cierre (2026-10-10)** · `test:contract` falló primero en dos chequeos de Schemathesis que no conocen el
testigo: «missing header not rejected» (esperaba un `400` y la respuesta es `428`) y «API rejected
schema-compliant request» (el testigo que genera nunca es el actual, y la respuesta es `412`). Se declararon
en `scripts/schemathesis.toml`. Cargar ese archivo hizo que Schemathesis empezara a contar como fallas los
`422` de las invariantes (ADR-007), que sin archivo no contaba: el archivo también lo declara, para todo el
contrato. Después, 17 743 casos generados y todos pasan.

**Corrección (2026-10-10, CI de la #52)** · Lo anterior estaba mal diagnosticado. Ya existía un
`schemathesis.toml` en la raíz, que Schemathesis descubre solo, y que declaraba el `422` y dos límites de
las operaciones `outcomes`. Pasarle `--config-file` con otro archivo **lo reemplazó**: CI falló en
`POST /v1/orders`, `POST /v1/returns` y `PUT /v1/catalog`, justo lo que el de la raíz cubría. En local no
se vio porque esas operaciones respondían `401` contra el almacén de `npm run dev` (`data/ope.db`). Las
expectativas del testigo pasaron al archivo de la raíz, y el de `scripts/` y la opción se fueron.

Contra `npm run dev`:

1. `GET /v1/admin/platform-configuration` → `ETag: "platform-248"`.
2. Sin `If-Match` → `428 witness-required`, sin `ETag`.
3. Con `If-Match: "platform-248"` → `201`, `ETag: "platform-249"`.
4. Otro cambio con el testigo viejo → `412 stale-version`; rige la 249.
5. El cuerpo del paso 3 con el testigo viejo → `200`, la 249.
6. «Tienda Sur» estaba desactivada y el interruptor respondió `409`, así que la edición con el testigo de antes
   **entró** y reemplazó su identidad por sólo el nombre (dato del almacén de desarrollo). Repetido con un
   merchant nuevo, «Tienda Testigo» (`mrc_7lignrazujar`): `ETag: "mrc_7lignrazujar:1"` al crearlo, `:2` al
   apagarlo; con el testigo `:1`, la misma identidad → `200` sin escribir, otra → `412`; con `:2` → `200` y
   `:3`.
7. La configuración de «Tienda Sur»: `ETag: "mrc_zejvsaiyuqgi:configuration:5"`; publicar con él → `201` y
   `:6`; otro cambio con el viejo → `412`.

La mutación del diff juzgó todo y dejó 17 supervivientes, todos reales. Diez estaban en `MerchantProfile.sameAs`:
cada uno hacía que dos identidades distintas se leyeran iguales, y una edición con testigo viejo habría
respondido `200` sin escribir en vez de `412`. Los mató una prueba campo por campo. Los de `validationFail`
se mataron extrayendo la decisión a `problemOfMissing`, pura y probada por su cuenta, y afirmando el
`instance` del `428`. El último, el `[]` de una operación sin parámetros, era equivalente y se quitó
reestructurando (`parameters?.find`). La confirmación acotada sobre esos archivos: todos los mutantes murieron.
Rotas a propósito, las de la tabla las agarra su prueba: un método del merchant que no suba la revisión, el
testigo de la configuración sin el merchant, el testigo antes de la repetición o antes del alcance, y
`validationFail` sin la extensión.
