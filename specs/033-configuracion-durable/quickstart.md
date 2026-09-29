# Quickstart — verificar que nada de lo configurado se pierde (033)

Siete pasos. **Los comandos apuntan a rutas de archivo y no a filtros por nombre**, por lo que la 031 encontró: `vitest run -t "<algo que no coincide>"` **sale con 0 corriendo cero pruebas**, y seis pasos daban verde sin ejecutar nada.

**Y el último paso trae los comandos completos, incluidos los dos que la 032 descubrió que faltaban**: que hay que publicar un catálogo, y que ese `PUT` va firmado. Sin eso, seguir el paso al pie no llega a ninguna parte.

## 1. El esquema subió a la versión 4

```bash
ls migrations/
npx vitest run --project durability tests/durability/store.test.ts
```

Hay una `004`, y es la primera de la serie que **sólo crea**: ninguna tabla se reconstruye, porque ninguno de estos seis almacenes estuvo nunca persistido. Un almacén en versión 3 —el que deja la 032— sube a 4 y no pierde nada de lo que ya tenía.

## 2. Un merchant sobrevive, con sus credenciales y sus orígenes

```bash
npx vitest run --project durability tests/durability/merchant-store.test.ts
```

SC-001. Lo que importa acá no es que el merchant exista después del reinicio sino que **autentique**: la huella de su credencial y su origen resuelven, y una credencial cuya gracia venció durante el apagado ya no autentica al volver.

**Y el caso que se rompe en silencio**: `Origin` es una clase con `equals`, y `JSON.parse` no devuelve clases. Un merchant leído sin rehidratar sus orígenes se lista bien, se ve bien y **no autentica ninguna petición** — el síntoma no aparece al leer, aparece en el borde de CORS.

## 3. La unicidad de origen la hace cumplir el almacén

```bash
npx vitest run --project durability tests/durability/merchant-store.test.ts
npx vitest run --project fast tests/integration/isolation.test.ts
```

Un origen pertenece a un solo merchant, **desactivados incluidos**, y sigue reservado después de un reinicio. Es la única unicidad global del esquema y está en su propia tabla justamente por eso: dentro de un documento ningún índice la garantiza, y comprobarla leyendo antes de escribir es la carrera que `01 §6` prohíbe.

## 4. La configuración, su historial y los experimentos

```bash
npx vitest run --project durability tests/durability/configuration-store.test.ts
```

SC-003 y SC-004. Las versiones con su orden, su operador, su instante y su motivo; la efectiva es la de versión máxima y no hay bandera de «vigente». Y **ninguna asignación queda huérfana**: hoy las asignaciones son durables y la definición del experimento no, así que tras un reinicio quedan apuntando a un experimento que no existe — en los merchants de la semilla no se nota porque el archivo trae los mismos identificadores.

## 5. Lo que se observó del tráfico, y la deduplicación

```bash
npx vitest run --project durability tests/durability/admin-observations.test.ts
npx vitest run --project durability tests/durability/event-dedup.test.ts
```

SC-005 y SC-006. Las dos listas que el panel muestra —anclajes sin resolver, atributos sin mapear— siguen ahí con sus conteos, y el `upsert` del diagnóstico acumula sobre lo que ya había.

Y un evento reenviado después del reinicio cuenta como **duplicado**. Las dos mitades de SC-006 se verifican juntas: que se detecte, y que **reconstruir no se pague por evento** — el primer lote de un merchant tras el reinicio no tarda apreciablemente más que el siguiente.

## 6. El caso normal no cambió, y la latencia tampoco

```bash
npm test
npx vitest run --project durability tests/durability/ingest-latency.test.ts
```

SC-010 y **SC-002, que es la condición de aceptación de la feature**. Ninguna prueba de comportamiento existente cambia de expectativa: las 21 operaciones responden lo mismo. Y el p95 de la ingesta con el almacén durable contra el mismo con todo en memoria, en la misma corrida: si empeora de forma apreciable, la feature no está terminada.

**Acá es donde el índice en memoria se justifica o no.** Si la resolución del merchant hubiera quedado como una consulta por petición, este paso es donde se vería.

## 7. Usarlo: dar de alta un merchant, apagar, prender, y que siga ahí

Éste es el paso que ningún gate reemplaza. Los comandos están completos a propósito: en la 032 el paso equivalente decía «mandar tráfico hasta que intervenga» y siguiéndolo al pie no se llegaba nunca.

```bash
rm -rf data && npm run dev
```

**Lo primero es ver qué dice el arranque de la semilla** (SC-008), que es una de las cosas que esta feature agrega:

```
merchant seed imported   merchants=1        ← primer arranque, almacén vacío
```

Dar de alta un merchant por la API y guardarse lo que devuelve, **porque las credenciales viajan una sola vez**:

```bash
A="Authorization: Bearer ope_dev_admin_token"; B=http://localhost:3000
curl -X POST "$B/v1/admin/merchants" -H "$A" -H 'content-type: application/json' \
  -d '{"origins":["https://tienda-demo.example"],"signature":true}'
# → merchantId acuñado (mrc_*) y las tres credenciales. Guardarlas.
```

Publicarle configuración y abrirle un experimento:

```bash
M=<el merchantId acuñado>
curl -X POST "$B/v1/admin/merchants/$M/configuration" -H "$A" -H 'content-type: application/json' \
  -d '{"declared":{"commercialPolicy":{"version":"demo-1","marginShare":0.35}},"reason":"alta del piloto"}'
curl -X POST "$B/v1/admin/merchants/$M/experiments" -H "$A" -H 'content-type: application/json' \
  -d '{"treatmentShare":0.5,"seed":"demo-seed","targetSample":1000}'
```

**Apagar con Ctrl+C, volver a levantar**, y mirar las dos cosas:

```
merchant seed NOT applied   merchants=2   ← el arranque lo dice, que es lo que hoy falta
```

```bash
curl "$B/v1/admin/merchants/$M" -H "$A"                       # existe
curl "$B/v1/admin/merchants/$M/configuration/versions" -H "$A" # su versión 1 está
curl "$B/v1/admin/merchants/$M/experiments" -H "$A"            # su experimento está
curl "$B/v1/admin/log?limit=10" -H "$A"                        # y quién hizo cada cosa
```

Y lo que de verdad prueba que sobrevivió: **una petición con la credencial emitida antes del reinicio**. Eso necesita un catálogo, y el `PUT` del catálogo va **firmado** porque el merchant se creó con `signature: true` (ADR-029):

```bash
node -e "const {createHmac}=require('node:crypto');const fs=require('node:fs');
const at=new Date().toISOString();
const body=JSON.stringify({capturedAt:at,products:[{productId:'SKU-1',title:'Remera',attributes:[{key:'material',value:'algodon'}],variants:[{variantId:'SKU-1-M',attributes:[{key:'size',value:'M'},{key:'color',value:'negro'}],available:true,price:{amount:'19990.00',currency:'ARS'}}]}]});
const ts=String(Math.floor(Date.now()/1000));
fs.writeFileSync('cat.json',body);
console.log(ts, 'v1='+createHmac('sha256','<el platformSecret>').update(ts+'.'+body).digest('hex'));"

curl -X PUT "$B/v1/catalog" -H 'content-type: application/json' \
  -H 'X-OPE-Platform-Key: <el platformKey>' \
  -H 'X-OPE-Timestamp: <el ts>' -H 'X-OPE-Signature: <la firma>' --data-binary @cat.json

curl -X POST "$B/v1/events" -H 'content-type: application/json' \
  -H 'X-OPE-Ingest-Key: <el ingestKey de antes del reinicio>' \
  -H 'Origin: https://tienda-demo.example' -d '{"events":[ ... ]}'
```

Un `202` es la feature: **la credencial emitida antes del reinicio sigue autenticando**. Hoy eso es un `401`, porque el merchant no existe.

Y mirar el almacén, que es donde se ve si los orígenes quedaron donde tienen que quedar:

```bash
node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('data/ope.db');
console.log('version:', d.prepare('PRAGMA user_version').get());
console.table(d.prepare('SELECT merchant_id, status FROM merchants').all());
console.table(d.prepare('SELECT merchant_id, origin FROM merchant_origins').all());
console.table(d.prepare('SELECT merchant_id, version FROM merchant_configurations').all());
console.table(d.prepare('SELECT operation, outcome, merchant_id FROM admin_entries ORDER BY id DESC LIMIT 5').all());"
```

---

## Lo que este quickstart **no** puede mostrar, y hay que saberlo

- **Lo que el índice en memoria cuesta el día que el almacén sea remoto.** Contra SQLite local las dos formas son baratas y la medición del paso 6 no las distingue tanto como debería. Lo que decide es que consultar por petición sería **un viaje de red por request** contra PostgreSQL (**D-21**), y eso no se puede medir sin PostgreSQL.
- **Que el índice deja de ser correcto con dos procesos.** Con un proceso no puede divergir, y con dos sí: el índice de uno no ve el alta del otro. Es lo mismo que D-21 declara del resto, y está escrito en el gateway además de acá.
- **La auditoría atómica**, que **no entra en esta feature**: `SqlStore.transaction` es síncrona y el caso de uso es asincrónico, así que no hay forma de componer la transacción sin volver la auditoría no transversal (research R-05). Lo que esta feature sí mejora es que la ventana pasa de «se pierde todo al reiniciar» a «puede faltar una entrada».
- **Qué pasa con la reconstrucción de la ventana si al registro le falta un tramo.** Un evento de ese tramo puede volver a contar como nuevo. Es la asimetría de ADR-040: la deduplicación es medición, y un duplicado contado dos veces ensucia una cifra en vez de gastar un cupo.
