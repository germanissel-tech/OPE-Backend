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
5. Quitar el texto del merchant con `text: null`: el historial de la clave lo lista como quitado y el lote
   siguiente vuelve a la base.
6. Publicar defaults con un idioma sin textos: `422 locale-incomplete` nombrando las familias.

## Cambios respecto del plan

_Se completa al cerrar la feature, fechado._
