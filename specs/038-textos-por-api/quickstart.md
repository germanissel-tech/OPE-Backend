# Quickstart — verificar que los textos se editan por API (038)

Siete pasos. Los comandos apuntan a rutas de archivo y no a filtros por nombre, por lo que la 031
encontró: `vitest run -t "<algo que no coincide>"` sale con 0 corriendo cero pruebas.

El paso que más importa es el 5: es el único que con el código **anterior** a la feature no se podía
escribir, porque un idioma sin textos se aceptaba y la decisión callaba.

## 1. El contrato primero

```bash
npm run contract:check && npm run contract:types
```

Las seis operaciones en el mapa como `built`, las capacidades `texts:read` y `texts:write`, los tres
tipos de problema, `Voice.yaml` retirado, y `contract:diff` reportando el cambio incompatible que el
contrato en construcción admite. Lo generado no se edita a mano.

## 2. Un texto base y un texto de merchant, con dobles

```bash
npx vitest run tests/unit/domain/messages tests/unit/application/messages
```

La clave juzgada contra el vocabulario; la versión que sólo admite «quitado» en la capa del merchant; la
completitud por familia incondicional; y los casos de uso con el almacén en memoria: repetir no crea
versión, quitar en la base se rechaza, el alcance se juzga.

## 3. Lo que una intervención muestra

```bash
npx vitest run tests/integration/messages
```

Historias 1 y 2 de punta a punta en memoria: publicar un texto base y verlo en la intervención siguiente
con su versión; publicar un texto de merchant y verlo sólo en ese merchant; la página en inglés con el
merchant personalizado en español muestra la base en inglés; quitar vuelve a la base.

## 4. Motivo y ventana

```bash
npx vitest run tests/integration/messages/frozen.test.ts
```

Historia 3: sin motivo se rechaza con `configuration-frozen`; con motivo, cada experimento alcanzado tiene
su ventana reiniciada y el registro guarda el motivo; un merchant con texto propio no está alcanzado por
un cambio de la base; diez publicaciones seguidas dejan la ventana reiniciada en la última.

## 5. Un idioma no se soporta sin textos

```bash
npx vitest run tests/integration/configuration/complete-locales.test.ts
```

Historia 4 y SC-004: publicar defaults con un idioma sin base se rechaza nombrando las familias; completar
la base por la API y volver a publicar se acepta; quitar un idioma no pide nada. **Este caso no existe hoy
y con el código actual el primer paso pasaría.**

## 6. Lo que sobrevive un reinicio, y lo que cuesta

```bash
npx vitest run --project durability tests/durability/texts.test.ts
npx vitest run --project durability tests/durability/ingest-latency.test.ts
```

Los textos y su historial tras un reinicio; nada cruza merchants; una escritura rechazada no deja ni
versión ni índice; la semilla no se aplica dos veces y lo dice. Y SC-006: el p95 de la ingesta contra la
misma corrida sin la feature, en la misma máquina, con la mutación **terminada antes** de medir (lo que la
037 aprendió).

## 7. Nada del comportamiento existente cambió

```bash
npm run format:check && npm run quality && npm run typecheck && npm test
npm run test:mutation
npm run build && npm run test:contract
npx vitest run --project durability
npm run check:adrs && npm run check:instructions && npm run check:markers && npm run test:tools
```

SC-007: las operaciones de administración de la 036 responden lo mismo con el decorador puesto; ninguna
prueba anterior cambia de expectativa salvo las que afirmaban la voz o el corpus del release como fuente.

## Usarlo: un texto corregido, visto desde afuera

Con `npm run dev` y un merchant de la semilla:

1. Publicar un texto base: `POST /v1/admin/texts` con `family`, `locale` y `text`. Respuesta `201` con
   la versión y su `messageVersionId`.
2. Enviar un lote del SDK que produzca una intervención de esa familia en ese idioma: la respuesta trae
   el texto nuevo y estampa la versión nueva.
3. Publicar el mismo cuerpo: `200`, `outcome: repeated`.
4. Publicar un texto del merchant para la misma clave: `POST /v1/admin/merchants/{merchantId}/texts`.
   Repetir el lote: trae el texto del merchant. Enviarlo con la página en otro idioma soportado: trae la
   base en ese idioma.
5. Quitar el texto del merchant con `remove: true`: el historial de la clave lo lista como quitado y el lote
   siguiente vuelve a la base.
6. Publicar defaults con un idioma sin textos: `422 locale-incomplete` nombrando las familias.

## Cambios respecto del plan

_2026-10-04, al cerrar la feature._

- **`remove: true` en lugar de `text: null`** para quitar el texto del merchant. El validador del
  documento de `openapi-backend` habla el meta-esquema 3.0 y un `null` no es expresable en él (un
  `type` en lista rompe el arranque entero); Redocly, que lee 3.1, rechaza `nullable`. `text` y
  `remove` son excluyentes por `oneOf`.
- **Quitar un texto que el merchant nunca publicó es `404 text-version-not-found`**, no un
  repetido: el cuerpo del `200` es la versión vigente, y ahí no hay ninguna.
- **El flujo común de las dos publicaciones es un servicio** (`TextPublications`): vigente → repetir,
  alcance, congelación, publicar, reiniciar. El gate de duplicación lo exigió; cada caso de uso conserva
  lo suyo —el alcance y el borrador— y `PublishedText` vive entre los dos porque un caso de uso no
  importa de otro ni para un tipo.
- **La causa de texto de un reinicio nombra la capa** (`layer: base | <merchantId>`), no
  `merchantId`: la regla del contrato prohíbe `merchantId` en cuerpos. `WindowRestart.text` entró
  al contrato con la historia 1, porque los mutantes de su presenter lo pidieron antes que la historia 3.
- **`LocaleIncomplete` vive en el kernel**, como `ConfigurationFrozen`: la semilla de los textos y las
  publicaciones de idiomas —dos módulos que no pueden depender entre sí— rechazan con él. La
  completitud la responde el almacén de textos (`TextStore.missingFor`), y `configuration` la enlaza a su
  puerto `TextCompleteness` en la composición.
- **Los tipos internos de la cadena de reinicios declaran `| undefined`** y la guarda queda una vez en
  el borde: la guarda `...(x === undefined ? {} : { x })` sobre una lectura opcional compila mutada
  (TS conserva la «ausencia» de la lectura), y quince supervivientes lo mostraron de golpe.
  `TextKeyInput` y `TextDeclaration` separan lo declarado de lo juzgado por el mismo motivo.
- **Una prueba de la 036 cambió de preparación, no de expectativa** (SC-007): declaraba idiomas sin
  base; ahora completa la base por la API antes de declararlos, que es el hueco que esta feature cierra.
- **D-34 queda para el merge de la 037**, donde la fila vive: el tercer historial llegó y lo común se
  extrajo (`pagedByVersion`) en la fase 1.
- **SC-006, medido el 2026-10-04** con la mutación terminada, tres corridas de
  `tests/durability/ingest-latency.test.ts` por lado en la misma máquina (p95 de la ingesta, en ms;
  «sin» es `main` en 51cadd8 con su propio bundle):

  | Caso                             | Con la feature (3 corridas) | Sin la feature (3 corridas) |
  | -------------------------------- | --------------------------- | --------------------------- |
  | memoria, un merchant             | 1.62 / 1.30 / 1.39          | 1.55 / 1.35 / 1.32          |
  | sqlite, un merchant              | 8.76 / 7.67 / 7.30          | 7.02 / 7.87 / 5.89          |
  | memoria, 20 merchants, el último | 1.17 / 1.18 / 1.11          | 1.06 / 1.02 / 1.07          |
  | sqlite, 20 merchants, el último  | 9.42 / 5.29 / 7.14          | 5.68 / 7.14 / 5.66          |

  La dispersión entre corridas del mismo lado (hasta 4 ms en sqlite) es mayor que la diferencia entre
  lados; en memoria, donde la decisión vive, las cifras son las mismas. Los textos se siguen sirviendo
  del índice en memoria y ninguna decisión ganó I/O.
