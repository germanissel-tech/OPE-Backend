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
npx vitest run --project durability tests/durability/ingest-latency.test.ts --reporter=verbose
```

Las pruebas que ya existen pasan igual: el comportamiento no cambia por dónde se guarda. Y la prueba
de latencia **mide los dos perfiles en la misma corrida** — la comparación es lo que importa, porque
una cifra absoluta de una máquina no dice nada y la diferencia sólo significa algo con la misma
máquina, el mismo JIT y la misma carga.

### Lo medido (2026-09-26, Windows 11, Node 24.21.0, tres corridas)

| Perfil             | p50            | p95              |
| ------------------ | -------------- | ---------------- |
| memoria            | 0,66 – 0,68 ms | 0,90 – 1,35 ms   |
| SQLite (WAL)       | 1,33 – 1,40 ms | 1,94 – 2,72 ms   |
| **diferencia p95** |                | **1,0 – 1,4 ms** |

**Qué se decide con esto, que era la única pregunta abierta del plan (research R-01).** El
presupuesto de `01 §4.6` son 150 ms para el camino crítico, marcado PROPUESTO como objetivo de
diseño. La escritura durable cuesta **poco más de un milisegundo**, es decir **menos del 2 % del
presupuesto**, y el p95 con almacén queda en el orden de 2 ms.

El disparador que R-01 fijó era «si el p95 con almacén durable se acerca al presupuesto, esa feature
sube de prioridad». **No se acerca**, así que **«desacoplar la aceptación del ledger» no sube de
prioridad**, y deja de apoyarse en una intuición: se apoya en esta tabla.

Dos cosas que este número **no** dice, y conviene no confundir: está medido con `fastify.inject`, que
saltea la pila de red, y con **un solo proceso** sobre SQLite. Lo segundo es lo que **D-21** deja
pendiente para PostgreSQL, y la concurrencia entre procesos puede cambiar la respuesta.

## 7. Lo que ningún comando decide

Abrir el archivo del almacén y mirar una fila del ledger. Si para entender qué decidió OPE hay que
reconstruirlo de varias tablas, el formato eligió mal: el ledger es lo que alguien va a leer el día
que discuta una cifra, y ese día no va a tener el código a mano.

## Estado (corrido entero el 2026-09-26, Windows 11, Node 24.21.0)

| Paso                                          | Resultado                                                                                                                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Node 24                                    | ✅ `.nvmrc` dice 24, `node --version` dice v24.21.0                                                                                                                                     |
| 2. `node:sqlite` sin advertencia              | ✅ una sola línea                                                                                                                                                                       |
| 3. esquema versionado y arranque que verifica | ✅ las dos mitades: `npm run dev` creó `data/ope.db` en WAL (`-wal` y `-shm` al lado), y con la versión falseada a 7 **no arrancó**: «holds schema version 7, and this build expects 1» |
| 4. lo decidido sigue ahí                      | ✅ la suite entera de `durability`                                                                                                                                                      |
| 5. el catálogo sigue ahí                      | ✅ incluida la poda de recibos cruzando el reinicio                                                                                                                                     |
| 6. la decisión no cambió, y qué cuesta        | ✅ las de `fast` pasan sin cambiar ninguna expectativa de comportamiento; la latencia, en la tabla de arriba                                                                            |
| 7. lo que ningún comando decide               | ✅ ver abajo                                                                                                                                                                            |

**Lo que el paso 3 encontró y ninguna prueba había encontrado**: SQLite crea el archivo pero **no el
directorio** que lo contiene, y su error —«unable to open database file»— no nombra ni la ruta ni qué
falta. Toda prueba de la suite arranca de `mkdtemp`, así que el directorio siempre existía; `npm run
dev` sobre un clon limpio, no. El almacén ahora crea el directorio, y ese caso tiene su prueba.

**El paso 7, con la fila real de una corrida.** Se ingestó un evento contra `npm run dev` y se leyó
la fila abriendo el archivo con `node:sqlite`. La fila sola dice: qué merchant, qué sesión, qué
visitante, en qué brazo de qué experimento, con qué versiones de configuración, qué confianza por
barrera, qué evidencia tenía (`truth: absent`) y por qué el veredicto fue `NO_OP` con motivo
`barrier-unclear`. **No hay que reconstruir nada de varias tablas**, que era el criterio.

Lo único que chirría al leerla es que un instante viaja como `{"$date": "…"}` en vez de como texto
plano. Es la marca que hace que una fecha vuelva siendo una fecha, y la alternativa —revivir por
nombre de campo— pierde un campo nuevo en silencio. Se lee sin esfuerzo, así que se acepta; queda
dicho para que nadie lo «simplifique» sin saber qué se lleva puesto.

## Dónde se toca qué, después de esto

| Si querés…                            | Se toca                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| cambiar la forma de lo que se guarda  | una migración versionada; el arranque verifica que el código y el almacén coincidan |
| que el estado de sesión sea durable   | la feature siguiente del hito, que trae la atomicidad del presupuesto               |
| correr sobre PostgreSQL               | el gateway de ese motor y sus pruebas de concurrencia (**D-21**)                    |
| sacar la escritura del camino crítico | «desacoplar la aceptación», y el número del paso 6 dice cuándo                      |
