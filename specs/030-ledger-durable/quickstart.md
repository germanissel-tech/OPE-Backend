# Quickstart — verificar que el ledger sobrevive a un reinicio (030)

Siete pasos. Seis los decide un comando; el último lo decide leer.

## 1. El repositorio corre sobre Node 24

```bash
cat .nvmrc && node --version
```

Los dos dicen 24. Si `node --version` dice otra cosa, la máquina no tomó el `.nvmrc` y lo que se
pruebe acá no es lo que corre CI.

## 2. `node:sqlite` no advierte nada

```bash
node -e "require('node:sqlite'); console.log('sin advertencia')" 2>&1
```

Una sola línea. Si aparece `ExperimentalWarning`, se está corriendo Node 22 y el paso 1 mintió.

## 3. El esquema está versionado y el arranque lo verifica

```bash
ls migrations/
npm run dev
```

El esquema se lee en una PR como cualquier archivo. Y contra un almacén con un esquema que no es el
esperado, el servidor **no arranca** y dice qué esperaba.

## 4. Lo que se decidió sigue ahí

```bash
npx vitest run --project durability
```

Es el paso que la feature existe para hacer verdadero: registrar una decisión, exponerla, atribuirle
una orden, **apagar y prender**, y leer las tres con el mismo contenido. Incluye la asignación, que es
donde perder el registro no sólo borra información sino que **cambia el comportamiento**: un visitante
reasignado puede cambiar de brazo.

## 5. El catálogo sigue ahí

```bash
npx vitest run --project durability -t "catálogo"
```

Publicar, reiniciar, y consultar la verdad de una variante sin volver a publicar. Y republicar la
misma instantánea sigue siendo una repetición, no un conflicto.

## 6. La decisión no cambió, y cuánto cuesta ahora

```bash
npm test
npx vitest run --project fast tests/integration/ingest-latency.test.ts
```

Las 1372 que ya existen pasan igual: el comportamiento no cambia por dónde se guarda. Y la prueba de
latencia **reporta el p50 y el p95 con el almacén durable** — ése es el número que decide si
«desacoplar la aceptación del ledger» sube de prioridad en el hito. **Anotarlo acá, fechado**: es el
único lugar donde queda.

## 7. Lo que ningún comando decide

Abrir el archivo del almacén y mirar una fila del ledger. Si para entender qué decidió OPE hay que
reconstruirlo de varias tablas, el formato eligió mal: el ledger es lo que alguien va a leer el día
que discuta una cifra, y ese día no va a tener el código a mano.

## Dónde se toca qué, después de esto

| Si querés…                            | Se toca                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| cambiar la forma de lo que se guarda  | una migración versionada; el arranque verifica que el código y el almacén coincidan |
| que el estado de sesión sea durable   | la feature siguiente del hito, que trae la atomicidad del presupuesto               |
| correr sobre PostgreSQL               | el gateway de ese motor y sus pruebas de concurrencia (**D-21**)                    |
| sacar la escritura del camino crítico | «desacoplar la aceptación», y el número del paso 6 dice cuándo                      |
