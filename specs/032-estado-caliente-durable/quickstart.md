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
gates no veían.

```bash
rm -rf data && npm run dev
```

Con el servidor arriba, mandar tráfico hasta que el merchant intervenga —o hasta agotar el presupuesto de la
sesión—, **apagar con Ctrl+C**, volver a levantar, y mandar un evento más de la misma sesión. La decisión
tiene que seguir degradando por presupuesto agotado.

Y mirar el almacén, que es donde se ve si la reconstrucción tiene de dónde leer:

```bash
node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('data/ope.db');console.table(d.prepare(\"SELECT visitor_id, session_id, json_extract(document,'\$.outcome') AS outcome, COUNT(*) AS n FROM decisions WHERE merchant_id=? GROUP BY visitor_id, session_id, outcome\").all('dev-merchant'))"
```

Si `visitor_id` aparece vacío en alguna fila, el paso 1 mintió.

---

## Lo que este quickstart **no** puede mostrar, y hay que saberlo

- **Cuánto cuesta esperar la reconstrucción.** Medirlo contra SQLite local no dice nada del caso que
  importa, porque **no hay red**. Con PostgreSQL esa espera es I/O de red en el plano de decisión, y el
  orden de magnitud es otro (**D-21**). SC-005 se cumple publicando lo que se puede medir y diciendo qué no
  dice.
- **Qué pasa si la lectura tarda demasiado.** Hoy **no puede pasar**: `SqlStore` es síncrono y una lectura
  síncrona devuelve o lanza, así que no hay «tardó». La mitad de FR-016 que existe es la falla, y está
  cubierta; el plazo es de la spec del gateway de PostgreSQL (research R-03).
- **El arranque en frío con mucho tráfico**, que la spec lista como caso borde: con un proceso y lecturas
  síncronas las reconstrucciones se serializan, y qué significa eso bajo carga no se puede medir
  honestamente hoy.
