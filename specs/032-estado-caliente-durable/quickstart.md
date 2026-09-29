# Quickstart — verificar que un reinicio dejó de reiniciar los topes (032)

Siete pasos. **Los comandos apuntan a rutas de archivo y no a filtros por nombre**, porque el quickstart de
la 031 encontró que `vitest run -t "<algo que no coincide>"` **sale con 0 corriendo cero pruebas** — seis
pasos daban verde sin ejecutar nada. Una ruta que no existe falla en el acto.

El último paso es el que de verdad prueba algo: usar el servidor, apagarlo y volver a levantarlo.

## 1. El esquema subió a la versión 3

```bash
ls migrations/
npx vitest run --project durability tests/durability/store.test.ts
```

Hay una `003`. Y un almacén en versión 2 —el que deja la 031— **arranca y se migra**, con sus decisiones
intactas y su `visitor_id` relleno desde el documento. Si alguna fila queda con el visitante vacío, el
relleno no funcionó y la lectura por visitante va a mentir en silencio.

## 2. El ledger sabe buscar por visitante

```bash
npx vitest run --project durability tests/durability/ledger.test.ts
```

La lectura que FR-007 pide, cruzando un reinicio, con su aislamiento por merchant y **usando su índice**:
`EXPLAIN QUERY PLAN` tiene que decir `decisions_by_visitor` y no `SCAN decisions`. En esta familia de
features un índice equivocado ya salió más de tres veces peor que ninguno.

## 3. Los puertos distinguen «no lo recuerdo» de «no se pudo determinar»

```bash
npx vitest run tests/unit/application/decision
```

Las tres respuestas, cada una con su consecuencia: recordado decide, olvidado reconstruye, y **fallado
degrada**. El caso que importa es el tercero, porque hoy es indistinguible del segundo y por eso el cupo
vuelve a cero.

## 4. Una sesión que vuelve, vuelve como estaba

```bash
npx vitest run --project durability tests/durability/state-reconstruction.test.ts
```

SC-002. Y el caso que decide si la reconstrucción es fiel: **los duplicados se replican y los rechazados
no**. Si los rechazados entran, la sesión vuelve con señales que nunca tuvo; si los duplicados no entran,
vuelve con menos de las que tuvo. Las dos devuelven un estado plausible, y las dos están mal.

## 5. Los dos topes sobreviven al reinicio

```bash
npx vitest run --project durability tests/durability/restart.test.ts
```

SC-001, y es el daño que la feature vino a arreglar: una sesión que agotó su presupuesto **sigue agotada**
después de un reinicio, y un visitante que agotó su cupo del día **sigue agotado**. Hoy las dos cosas se
vuelven a cero en cada despliegue y nada lo mide.

## 6. El caso normal no cambió

```bash
npm test
```

FR-010 y SC-004: cuando el estado **sí** está en memoria, nada cambia. Ninguna prueba de comportamiento
existente debería cambiar de expectativa — si hay que tocar una, esta feature se metió donde no debía.

## 7. Usarlo: apagar y prender, y ver que el tope aguanta

Éste es el paso que ningún gate reemplaza, y el que en las dos features anteriores encontró lo que los
gates no veían. **Esta vez encontró que el paso estaba mal escrito**: decía «mandar tráfico hasta que el
merchant intervenga», y siguiéndolo al pie no se interviene nunca. Faltan dos cosas, y las dos son del
merchant de desarrollo, no de la feature.

```bash
rm -rf data && npm run dev
```

**Primero hace falta un catálogo, y va firmado.** Sin catálogo no hay evidencia de producto, la puerta de
calidad no deja pasar ningún candidato y toda decisión sale `NO_OP` — correctamente, y sin decir que lo
que falta es el catálogo. Y `config/dev-merchants.json` declara `platformSecrets`, así que con un secreto
vigente toda operación con `platformKey` exige firma (ADR-029): sin ella la respuesta es `401
signature-missing`, que es lo que apareció al correr esto.

```bash
# El cuerpo y su firma, en un archivo: el HMAC es sobre los bytes exactos que se envían.
node -e "const {createHmac}=require('node:crypto');const fs=require('node:fs');
const at=new Date().toISOString();
const body=JSON.stringify({capturedAt:at,products:[{productId:'SKU-1',title:'Remera',attributes:[{key:'material',value:'algodon'}],variants:[{variantId:'SKU-1-M',attributes:[{key:'size',value:'M'},{key:'color',value:'negro'}],available:true,price:{amount:'19990.00',currency:'ARS'}}]}]});
const ts=String(Math.floor(Date.now()/1000));
fs.writeFileSync('cat.json',body);
console.log(ts, 'v1='+createHmac('sha256','ope_dev_platform_secret').update(ts+'.'+body).digest('hex'));"

curl -X PUT localhost:3000/v1/catalog -H 'content-type: application/json' \
  -H 'X-OPE-Platform-Key: ope_dev_platform_key' \
  -H "X-OPE-Timestamp: <el ts que imprimió>" -H "X-OPE-Signature: <la firma>" \
  --data-binary @cat.json
```

**Y el lote tiene que traer lo que la barrera de precio necesita**: una espera larga en el bloque de precio
y la mano yéndose al botón. Un `product_viewed` no alcanza, y tampoco dice por qué.

```bash
# Dos veces el mismo lote, con `eventId` distintos, en la misma sesión.
curl -X POST localhost:3000/v1/events -H 'content-type: application/json' \
  -H 'X-OPE-Ingest-Key: ope_dev_ingest_key' -d '{"events":[
    {"eventId":"evt_1","sessionId":"ses_quick001","visitorId":"vis_quick001","occurredAt":"<ahora>",
     "page":{"pageType":"product","productId":"SKU-1","variantId":"SKU-1-M"},"device":"mobile",
     "type":"block_dwelled","block":"price","dwellMs":6000},
    {"eventId":"evt_2","sessionId":"ses_quick001","visitorId":"vis_quick001","occurredAt":"<ahora>",
     "page":{"pageType":"product","productId":"SKU-1","variantId":"SKU-1-M"},"device":"mobile",
     "type":"cta_approached","approach":"hover"}]}'
```

El primero contesta `INTERVENE price`; el segundo, `NO_OP session-budget-exhausted`. **Ahí se apaga**, se
vuelve a levantar, y se manda un tercer lote de la misma sesión: tiene que seguir diciendo
`session-budget-exhausted`. Eso es lo que hoy no pasa.

Y mirar el almacén, que es donde se ve si la reconstrucción tiene de dónde leer:

```bash
node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('data/ope.db');
console.log('version:', d.prepare('PRAGMA user_version').get());
console.table(d.prepare(\"SELECT visitor_id, session_id, json_extract(document,'\$.outcome') AS outcome, json_extract(document,'\$.signalsIncomplete') AS short, COUNT(*) AS n FROM decisions WHERE merchant_id=? GROUP BY visitor_id, session_id, outcome, short\").all('dev-merchant'));
console.log('sin visitante:', d.prepare(\"SELECT COUNT(*) AS n FROM decisions WHERE visitor_id IS NULL OR visitor_id=''\").get());
console.table(d.prepare('SELECT disposition, COUNT(*) AS n FROM received_events GROUP BY disposition').all());"
```

Si `visitor_id` aparece vacío en alguna fila, el paso 1 mintió. Si `short` no es `null` en alguna, el
registro no contestó y la decisión lo dijo (FR-015), que es correcto pero conviene saberlo.

### Lo que la corrida del 2026-09-28 dio, y lo que no probó

Versión 3, ninguna fila sin visitante, tres decisiones —una `INTERVENE` y dos `session-budget-exhausted`,
la segunda **después del reinicio**— y `signalsIncomplete` nulo en todas. El tope aguantó en el servidor
real.

**El apagón fue en duro, no con Ctrl+C, y no perdió nada — pero eso no prueba que no pueda perder.** Los
seis eventos de los tres lotes estaban en el archivo. El motivo es que la cola vacía cada 250 ms y entre
un `curl` y el siguiente pasa mucho más que eso, así que no había nada pendiente cuando el proceso murió.
Para ver la pérdida haría falta matarlo **dentro** de esa ventana, que a mano no se puede. Lo que la
corrida sí muestra es lo que importa: **los topes aguantan un apagón sucio**, porque la escritura del
ledger es síncrona y no pasa por la cola (ADR-040, decisión 3).

---

## Lo que este quickstart **no** puede mostrar, y hay que saberlo

- **Cuánto cuesta esperar la reconstrucción.** Medirlo contra SQLite local no dice nada del caso que
  importa, porque **no hay red**. Con PostgreSQL esa espera es I/O de red en el plano de decisión, y el
  orden de magnitud es otro (**D-21**). SC-005 se cumple publicando lo que se puede medir y diciendo qué no
  dice: la medición está en `tests/durability/rebuild-latency.test.ts` y sus cifras, fechadas, en ADR-040.
  Quedó como deuda **D-26**.
- **Qué pasa si la lectura tarda demasiado.** Hoy **no puede pasar**: `SqlStore` es síncrono y una lectura
  síncrona devuelve o lanza, así que no hay «tardó». La mitad de FR-016 que existe es la falla, y está
  cubierta; el plazo es de la spec del gateway de PostgreSQL (research R-03).
- **El arranque en frío con mucho tráfico**, que la spec lista como caso borde: con un proceso y lecturas
  síncronas las reconstrucciones se serializan, y qué significa eso bajo carga no se puede medir
  honestamente hoy.
