# Quickstart — verificar que una acción y su auditoría son una sola cosa (034)

Seis pasos. **Los comandos apuntan a rutas de archivo y no a filtros por nombre**, por lo que la 031
encontró: `vitest run -t "<algo que no coincide>"` sale con 0 corriendo cero pruebas.

**Y el paso 6 trae los comandos completos**, incluida la parte que las tres features anteriores
descubrieron que faltaba: que para que una petición del SDK llegue a decidir hace falta un catálogo, y que
ese `PUT` va firmado.

## 1. La unidad de trabajo hace lo que dice, con dobles

```bash
npx vitest run --project fast tests/unit/interface-adapters/shared-kernel/unit-of-work.test.ts
npx vitest run --project fast tests/unit/application/shared-kernel/audited-use-case.test.ts
```

Lo que se ve acá y en ningún otro lado: que **un rechazo de negocio no aborta la unidad** —su entrada
tiene que quedar— y que **sólo el fallo del registro aborta**. Es la distinción que decide si la feature
audita lo que tiene que auditar o revierte justo lo que había que dejar escrito. Y de la unidad en
memoria, que **no puede revertir pero sí avisar**: un despliegue que respondiera `201` por una acción sin
auditar diría lo contrario de lo que la regla promete.

> La corrida del 2026-09-30 encontró que el primero de estos dos archivos **no existía**: las dos
> implementaciones del puerto quedaron cubiertas sólo de refilón, por la suite de integración. Se escribió
> ahí, que es donde este paso lo busca.

## 2. La acción y su entrada, contra un almacén de verdad

```bash
npx vitest run --project durability tests/durability/atomic-audit.test.ts
```

SC-001. Una acción con un registro sano deja las dos cosas y las dos sobreviven al reinicio; con un
registro que **falla al escribir la entrada**, el almacén no tiene ni el merchant ni sus orígenes
reservados. Eso es la ventana de ADR-034 cerrada, y es lo único que no se puede ver en memoria.

## 3. El turno: nadie escribe dentro de la transacción de otro

```bash
npx vitest run --project durability tests/durability/unit-of-work.test.ts
```

SC-005, y el caso son **dos gateways idénticos salvo una línea**: el que escribe sin esperar su turno
falla de inmediato mientras hay una unidad abierta, y el que agrega `await store.enter()` espera y escribe
cuando cierra. Con ninguna unidad abierta, los dos escriben igual. Sin esto, la feature dependería de que
la próxima persona se acuerde.

> La corrida del 2026-09-30 corrigió este comando: apuntaba a un archivo de `tests/unit/`, y el guardia
> **no se puede probar con dobles** — necesita un almacén de verdad, que es lo que hace fallar al
> olvidadizo. La prueba unitaria de las dos implementaciones del puerto es la del paso 1.

## 4. El tráfico del SDK no paga nada

```bash
npx vitest run --project durability tests/durability/admin-concurrency.test.ts
```

SC-002 —**la condición de aceptación**—, SC-003 y SC-004 juntas, porque son la misma corrida: tráfico de
ingesta continuo mientras corren acciones de administración, y después se mira el p95 contra la misma
corrida sin acciones, que ninguna decisión haya degradado por almacén no disponible, y que el conteo de
llegadas registradas sea exacto.

**Acá es donde la feature se acepta o no.** Si el p95 empeora de forma apreciable, la unidad de trabajo
está reteniendo el camino de decisión más de lo que una acción local justifica.

## 5. Nada del comportamiento existente cambió

```bash
npm test
npx vitest run --project durability
```

SC-006 y SC-008. Las 21 operaciones de administración responden lo mismo, los dos despliegues siguen de
acuerdo, y **ninguna prueba anterior cambia de expectativa** — salvo las que afirmaban la consulta previa
que se va, que es un cambio de mecanismo declarado y no de comportamiento.

## 6. Usarlo: una acción que se revierte, vista desde afuera

Éste es el paso que ningún gate reemplaza. En las tres features anteriores encontró lo que ninguna prueba
veía.

```bash
rm -rf data && npm run dev
```

Dar de alta un merchant, con el almacén sano, y quedarse con lo que devuelve:

```bash
A="Authorization: Bearer ope_dev_admin_token"; B=http://localhost:3000
curl -X POST "$B/v1/admin/merchants" -H "$A" -H 'content-type: application/json' \
  -d '{"origins":["https://revert-demo.example"],"signature":true}'
```

Ahora **hacer que el registro no pueda escribir** y repetir la acción con otro origen. La forma de
provocarlo sin tocar código es que **otro proceso tome el lock exclusivo** del almacén:

```bash
# En otra terminal, desde la raíz del repo. Suelta el lock a los 25 s.
node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('data/ope.db');
d.exec('BEGIN EXCLUSIVE'); console.log('lock tomado');
setTimeout(()=>{d.exec('ROLLBACK');d.close();console.log('lock soltado')},25000);"
```

> **No sirve dejar el archivo en sólo lectura**, que es lo que este quickstart decía hasta que se corrió
> (2026-09-30): la acción responde `201` igual, por dos motivos que se suman. El almacén está en WAL, así
> que la escritura va al `-wal` y el archivo principal sólo se toca en el checkpoint; y en Windows el
> atributo de sólo lectura no alcanza a un **handle que ya está abierto**, así que marcar los tres
> archivos tampoco cambia nada. El lock de otro proceso sí: es un almacén que **rechaza**, que es la
> condición que la feature trata.

```bash
curl -i -X POST "$B/v1/admin/merchants" -H "$A" -H 'content-type: application/json' \
  -d '{"origins":["https://no-deberia-quedar.example"],"signature":true}'
# → 503, problem+json con type .../store-unavailable y retry-after
```

Soltado el lock, mirar el almacén: **ese merchant no existe, su origen no quedó reservado y el registro
de administración no tiene entrada suya** — las tres cosas, que es lo que antes de esta feature no era
cierto. `operation` y `outcome` viven **dentro del documento** y no como columnas:

```bash
node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('data/ope.db');
console.table(d.prepare('SELECT merchant_id, status FROM merchants').all());
console.table(d.prepare('SELECT merchant_id, origin FROM merchant_origins').all());
console.table(d.prepare(\"SELECT json_extract(document,'\$.operation') AS operation,
  json_extract(document,'\$.outcome') AS outcome, merchant_id
  FROM admin_entries ORDER BY id DESC LIMIT 5\").all());"
```

Y lo que cierra el paso: **mandar tráfico mientras una acción corre**. Con el almacén sano, publicar
configuración en un merchant y mandar eventos de otro a la vez; las dos cosas responden y ninguna decisión
vuelve con motivo de almacén no disponible.

---

## La corrida del 2026-09-30 (histórica y fechada)

Los seis pasos, de punta a punta, en esta máquina. Lo que encontró está corregido arriba, en el paso al
que pertenece; esta tabla es el registro de que se corrió y de qué dijo.

| Paso                         | Resultado                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| 1 · la unidad con dobles     | verde, **después de escribir la prueba que el paso nombraba y no existía**                    |
| 2 · la acción y su entrada   | verde                                                                                         |
| 3 · el turno                 | verde, con el comando corregido: el guardia no se prueba con dobles                           |
| 4 · el tráfico no paga       | verde; el turno costó **4.17 ms** de p95 en esta corrida, contra la ventana de lecturas       |
| 5 · nada cambió              | verde, las dos suites                                                                         |
| 6 · usarlo, contra el server | **503** con `store-unavailable`, y el almacén sin el merchant, sin su origen y sin su entrada |

Tres cosas que sólo aparecieron acá:

1. **La receta para provocar el fallo no provocaba nada** (paso 6): WAL y un handle abierto. Reemplazada
   por el lock exclusivo de otro proceso, que sí produce un almacén que rechaza.
2. **La consulta del registro nombraba columnas que no existen**: `operation` y `outcome` viven dentro del
   documento.
3. **Una prueba que el paso 1 prometía no estaba escrita.** Ningún gate lo ve: el archivo no existía, así
   que nada lo corría y nada lo echaba de menos.

Y lo que confirmó, que es el motivo de la feature: con el almacén rechazando, la acción responde `503`, no
queda el merchant, no queda su origen **y no queda su entrada de auditoría** — no ocurrió, así que no hay
nada que auditar. Con el almacén sano, 25 lotes de eventos y cuatro publicaciones de configuración
concurrentes respondieron todas, y ninguna decisión volvió con motivo de almacén no disponible.

---

## Lo que este quickstart **no** puede mostrar, y hay que saberlo

- **Lo que la unidad de trabajo costaría con un almacén remoto.** Contra SQLite local una unidad dura lo
  que dura una escritura local; contra PostgreSQL dura un viaje de red, y la espera del camino de decisión
  deja de ser invisible. Es **D-21**, y es también la razón por la que el puerto sobrevive al cambio de
  motor sin que este trabajo se tire.
- **Que con dos procesos la unidad no alcanza.** Es del proceso; con dos, cada uno tiene la suya y la
  atomicidad entre ellos es del motor. Lo mismo que D-21 ya declara de todo el hito.
- **La atomicidad del presupuesto por sesión**, que **no** entra acá: otro mecanismo, otra deuda
  (**D-30**), y la medición que le falta está escrita en su fila.
- **Qué pasa si una unidad no cierra.** FR-012 lo prohíbe y el diseño lo hace imposible desde el
  adaptador, pero ninguna prueba puede demostrar la ausencia de ese defecto: lo que se puede es que toda
  unidad de toda prueba cierre, y que el guardia grite si alguien escribe fuera de turno.
