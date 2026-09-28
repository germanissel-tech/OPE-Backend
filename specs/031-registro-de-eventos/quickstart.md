# Quickstart — verificar que lo que el SDK manda dejó de ser invisible (031)

Ocho pasos. Los primeros siete los decide un comando; el último lo decide leer una consulta, y ése es el
que prueba de verdad que la feature sirve — la 030 aprendió que las cosas que faltaban aparecieron al
**usar** el sistema, no al correr la cadena de gates sobre sí misma.

## 1. El esquema subió de versión, y un almacén viejo ya no se rompe

```bash
ls migrations/
npm run dev
```

Hay una `002`. Y lo importante es lo que **no** pasa: un `data/ope.db` que venía de la feature 030, en
versión 1, **arranca y se migra**, en vez de negarse como hacía antes (research R-02). Si el almacén se
niega, la migración hacia adelante no quedó.

Para verlo contra un almacén realmente viejo, si hay uno a mano de la 030: correr `npm run dev` sobre él
y mirar que el servidor levanta.

## 2. Ninguna tabla queda fuera de las dos reglas

```bash
npx vitest run --project durability -t "esquema"
```

Las ocho tablas —las siete de la 030 más el registro— tienen clave primaria autoincremental y sus dos
timestamps (SC-009). La prueba lo verifica leyendo el esquema del almacén, no la migración: lo que importa
es lo que quedó, no lo que el archivo dice.

## 3. Un lote ingresado deja rastro de cada evento

```bash
npx vitest run --project durability -t "registro"
```

Ingestar un lote, esperar a que la cola se vacíe, y leer lo recibido con el mismo contenido: cada evento
con su identificador, su tipo, su instante declarado y **cuándo OPE lo recibió** (FR-001, FR-002).

## 4. Del click al veredicto, y al revés

```bash
npx vitest run --project durability -t "trazabilidad"
```

De la decisión a sus eventos y de un evento a su decisión, con el brazo con el que entró (historia 1). Y
sin brazo cuando no había experimento activo, que es distinto de `CONTROL` y no se inventa.

## 5. Lo descartado también está

```bash
npx vitest run --project durability -t "descarte"
```

Los dos tramos que hoy son invisibles (historia 2): el duplicado queda como repetición —y se llega a su
llegada original buscando el mismo `eventId`—, y **el lote rechazado con `422` queda con qué llegó y qué
invariante lo rechazó**, constando que no produjo decisión.

Éste es el paso que distingue «el merchant no mandó nada» de «mandó y se descartó», que es lo que SC-003
pide y hoy es imposible.

## 6. La decisión no se enteró

```bash
npm test
```

Ninguna prueba de comportamiento cambia de expectativa (SC-005, FR-011). Si alguna cambió, el registro
dejó de ser un observador puro y eso es un defecto de esta feature, no una expectativa a actualizar.

## 7. El apagado no pierde lo encolado, y una caída sí — y lo dice

```bash
npx vitest run --project durability -t "apagado"
```

Dos casos y son opuestos a propósito (Q3): el apagado ordenado **drena la cola** y no se pierde nada
(FR-017); una terminación abrupta pierde lo pendiente y al volver **el hueco queda nombrado** — cuántos
eventos y en qué intervalo (FR-018, SC-010).

El hueco se nombra reconciliando el ledger de decisiones contra el registro. Los lotes **rechazados** no
entran en esa reconciliación porque no dejan decisión: ésos se cuentan desde el log operativo, y la
asimetría está declarada, no promediada.

## 8. Mirar el registro con una consulta, que es el paso que de verdad prueba algo

```bash
node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('data/ope.db');console.table(d.prepare(\"SELECT type, disposition, COUNT(*) AS n FROM received_events WHERE merchant_id=? GROUP BY type, disposition\").all('m-uno'))"
```

Una consulta, una tabla en la pantalla: cuántos eventos de cada tipo entraron y cuántos se descartaron,
por merchant (historia 3, SC-007). Y con `EXPLAIN QUERY PLAN` delante, la misma consulta tiene que usar
`received_events_volume` — porque **un índice equivocado fue más de tres veces peor que ninguno** (research
R-06), así que acá se verifica el plan y no se supone.

```bash
node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('data/ope.db');console.log(d.prepare('EXPLAIN QUERY PLAN SELECT type, COUNT(*) FROM received_events WHERE merchant_id=? AND created_at BETWEEN ? AND ? GROUP BY type').all('m-uno','2026-01-01','2026-12-31'))"
```

Si dice `SCAN received_events`, el índice no se está usando y los 107 ms medidos no se van a cumplir.

---

## Lo que este quickstart **no** puede mostrar, y hay que saberlo

- **No hay una API para leer el registro.** Los pasos 4, 5 y 8 usan puertos y SQL porque la spec excluye
  el análisis explícitamente. Un operador todavía no puede hacer esto desde un tablero.
- **Los números son de SQLite local.** En producción el registro vive detrás de red (**D-21**), y el orden
  de magnitud es otro.
- **El atraso de la cola se lee, no se alerta**: la diferencia entre `received_at` y `created_at` lo mide
  (FR-015), y nada avisa todavía cuando crece.
