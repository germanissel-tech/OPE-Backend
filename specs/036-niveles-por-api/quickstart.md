# Quickstart — verificar que todo se configura desde el panel (036)

Seis pasos. **El paso 6 es el que ningún gate reemplaza**: cambiar un valor contra el servidor de verdad y
ver que el comportamiento cambió **sin reiniciar**, que es la promesa entera de la feature.

## 1. Lo alcanzado se calcula por hoja, no por campo

```bash
npx vitest run --project fast tests/unit/domain/configuration/changed-leaves.test.ts
```

El caso que decide si la feature es correcta: un merchant que declara **una** hoja de un objeto y no las
otras. Si el cálculo fuera por campo, ese merchant se vería como no alcanzado y su ventana de medición
seguiría corriendo sobre un tratamiento que cambió — el error más caro de esta feature.

## 2. Publicar un nivel, con sus reglas

```bash
npx vitest run --project fast tests/unit/application/configuration
npx vitest run --project fast tests/integration/levels.test.ts
```

Versión correlativa acuñada por OPE, cuerpo idéntico que repite en vez de crear, valor inválido rechazado
nombrando el campo y sin crear versión, alcance total exigido, y la entrada del registro con actor, instante
y versión.

## 3. El congelamiento y las ventanas

```bash
npx vitest run --project fast tests/integration/levels-frozen.test.ts
```

Con experimentos activos: sin motivo se rechaza; con motivo se publica y **cada experimento alcanzado**
tiene su ventana reiniciada, con el nivel y la versión que lo causaron. Un experimento de un merchant que
declara todo lo que cambió **no** se reinicia; uno en calibración no bloquea ni se reinicia.

## 4. Sobrevive un reinicio, y la semilla es semilla

```bash
npx vitest run --project durability tests/durability/level-store.test.ts
```

Las versiones quedan; el arranque usa la última y **no** aplica el archivo del release; y lo dice en el log.
Editar el archivo después del primer arranque no hace nada — la forma de cambiar un valor es la API.

## 5. El camino de decisión no paga

```bash
npx vitest run --project durability tests/durability/ingest-latency.test.ts
npx vitest run --project fast
```

SC-006: el p95 de la ingesta contra la misma corrida antes de la feature. Y la suite entera, porque los once
sitios que pasan de valor a lector tocan composición: si alguno quedó leyendo del arranque, algo de esto se
cae.

## 6. Usarlo: cambiar un valor sin reiniciar

Éste es el paso que ningún gate reemplaza.

```bash
rm -rf data && npm run dev
```

```bash
A="Authorization: Bearer ope_dev_admin_token"; B=http://localhost:3000

# Lo vigente, antes de tocar nada
curl -s "$B/v1/admin/platform-configuration" -H "$A"
curl -s "$B/v1/admin/treatment-defaults" -H "$A"
```

Cambiar un valor **operativo** del nivel de plataforma, que no toca la medición, y ver el efecto sin
reiniciar:

```bash
# `retryAfterSeconds` se ve en la cabecera `retry-after` de una respuesta 503,
# y `anchorDiagnosticsKept` en cuántos diagnósticos conserva el merchant.
curl -i -X POST "$B/v1/admin/platform-configuration" -H "$A" -H 'content-type: application/json' \
  -d '{"content":{ ... "retryAfterSeconds": 11 ... }}'
```

Después uno **de tratamiento**, con un experimento activo, para ver la regla completa:

```bash
# Sin motivo: 409 configuration-frozen
curl -i -X POST "$B/v1/admin/treatment-defaults" -H "$A" -H 'content-type: application/json' \
  -d '{"content":{ ... "holdoutShare": 0.1 ... }}'

# Con motivo: 201, y la ventana del experimento alcanzado reiniciada
curl -i -X POST "$B/v1/admin/treatment-defaults" -H "$A" -H 'content-type: application/json' \
  -d '{"content":{ ... "holdoutShare": 0.1 ... },"corrective":true,"reason":"ajuste de holdout antes del piloto"}'
```

Y lo que cierra el paso, que es lo que un operador va a querer ver en el panel:

```bash
# El historial del nivel, y el registro de administración con los dos intentos
curl -s "$B/v1/admin/treatment-defaults/versions?limit=10" -H "$A"
curl -s "$B/v1/admin/log?limit=10" -H "$A"

# El experimento, con su ventana reiniciada y de qué nivel vino la versión que lo causó
curl -s "$B/v1/admin/merchants/dev-merchant/experiments" -H "$A"
```

Por último, **apagar y prender**: la última versión de cada nivel sigue vigente y el archivo del release no
volvió a aplicarse.

---

## Lo que este quickstart **no** puede mostrar

- **Que un cambio de nivel no arruine una medición en curso.** No puede: un cambio de tratamiento **cambia**
  la medición, y eso es lo que la feature admite bajo reglas. Lo que se muestra es que no pasa
  desapercibido y que alcanza sólo a quien toca.
- **El costo con dos procesos** (**D-21**): la configuración efectiva vive en memoria de este proceso, y con
  dos, un cambio no alcanzaría al otro.
- **Que ningún valor quedó leyéndose del arranque.** SC-001 pide una prueba por valor y el compilador
  encuentra los sitios, pero «ningún otro consumidor en el futuro» no es algo que una corrida demuestre —
  lo sostiene que el nivel ya no se pueda pedir como valor, sólo como lector.
