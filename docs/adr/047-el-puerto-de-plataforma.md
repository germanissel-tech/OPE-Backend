---
numero: 047
titulo: El puerto de plataforma — cuatro casos de uso, adaptadores que conducen y un modo por flujo que se hace cumplir
estado: aceptada
fecha: 2026-10-10
fuente: specs/044-el-puerto-de-plataforma/research.md; docs/verificacion-documental-plataformas.md; decisiones del dueño del 2026-10-10
---

# ADR-047 — El puerto de plataforma

## Contexto

La constitución X pide un puerto de plataforma de cuatro operaciones del que dependa el núcleo sin saber qué
plataforma hay detrás, y `02` §6 decidió que cada flujo llegue en uno de tres modos negociados con el merchant.
Hasta la feature 044 existía sólo el `push`, y la estrategia de sincronización se aceptaba y se estampaba sin que
nada la ejecutara. La verificación documental de Magento 2 y VTEX dejó siete puntos propuestos; los cinco que tocan
el diseño del puerto se deciden acá.

## Decisión

1. **Las cuatro operaciones del puerto son cuatro casos de uso del núcleo**: la foto del catálogo, el refresco de
   stock y precio, la orden confirmada y la devolución registrada. El núcleo no pide nada a la plataforma: recibe.
2. **Un adaptador es lo que llama a esos casos de uso.** El genérico son los controllers del `push`; el `pull` es un
   planificador que vive en el borde y conduce como un controller (un caso de uso no invoca a otro, ADR-023); el
   `subscribe` es un aviso que entra a una cola durable y que el planificador procesa. Lo que cada plataforma
   implementa es una **fuente**: las lecturas que el `pull` y el `subscribe` necesitan, y qué modos soporta.
3. **El refresco es una capa sobre la foto.** Se guarda por variante, la verdad de una variante es el dato más nuevo
   entre la foto y su refresco, y la frescura de stock y precio pasa a medirse **por variante**. La foto conserva su
   idempotencia por `capturedAt`. Enmienda ADR-025 §3 en ese punto: la frescura del catálogo sigue siendo la de la
   foto. Cada refresco aceptado cuenta como recepción del nivel de sincronización (decisión del dueño).
4. **El aviso tiene su propia credencial y su propio consumidor**, `notifier`, con el esquema `noticeKey` y la
   capacidad `notices:write`: agrega una fila a la tabla de consumidores de ADR-020. La clave del aviso se configura
   en el panel de un tercero, así que no puede depositar nada; lo que se registra sale de la lectura.
5. **«Confirmada» es configuración del merchant** (`confirmedOrderStates`), y la aplica el adaptador.
6. **El modo se hace cumplir en los dos sentidos.** Al publicar, una versión que configura un modo que la fuente del
   merchant no ejecuta se rechaza (`subscribe` sólo existe para órdenes y devoluciones, decisión del dueño). Al
   entrar, un decorador delante de cada caso de uso rechaza lo que llega por un modo que no rige
   (`409 sync-mode-not-configured`): el núcleo no ve el modo.
7. **El refresco empujado tiene su propio tag, `refresh`**: es idempotente por ítem, por su instante, y no por
   pedido como las operaciones `outcomes`.

## Consecuencias

- Agregar una plataforma es escribir una fuente; Magento 2 es la siguiente.
- Los niveles guardados antes de la 044 ganan, por migración, los valores que describen lo que corría: fuente
  genérica y ninguna regla de confirmación; las cadencias quedan inertes porque ningún flujo estaba en `pull`.
- La fuente de prueba sólo existe donde se instala (las pruebas y `npm run dev`); un servidor de producción no puede
  configurarla.
- La no superposición de corridas es de instancia única, como todo el MVP (constitución IV).

## Lo que la construcción agregó (2026-10-12, feature 044)

- **Un rechazo del núcleo no frena un flujo**: el planificador y el lector de avisos loguean la orden o la
  devolución que un caso de uso rechaza y siguen; la indisponibilidad del almacén sí frena, y el cursor no avanza.
  La cadencia cuenta desde el inicio de la última corrida, termine como termine. Decisiones de la implementación;
  la enmienda del 2026-10-13 las revisa.
- **El temporizador arranca cuando el arranque lo dice**, después de leer los niveles: su tick es del nivel 1.
- **La puerta del modo puede leer el flujo del pedido**: el aviso nombra si es de una orden o de una devolución.
- **Una orden sin instante de confirmación, leída dos veces**, lleva dos instantes de observación distintos y el
  libro de órdenes la ve como conflicto, no como repetida: no se duplica, pero se loguea como rechazo. Lo decide la
  enmienda del 2026-10-13.

## Enmienda (2026-10-13) — lo que la construcción dejó abierto, decidido con el dueño

Revisado punto por punto con el dueño. Uno confirma lo construido; tres cambian el comportamiento y los construye la
feature 045.

1. **Una orden o una devolución sin instante de la plataforma, leída dos veces, es la misma.** El instante dice su
   origen: la orden y la devolución guardan si su `confirmedAt` o su `returnedAt` vino de la plataforma o de la
   observación de OPE, y un instante observado no cuenta al decidir si dos lecturas son la misma. Un total o unos
   ítems distintos siguen siendo conflicto; lo que llega por `push` declara siempre su instante y no cambia. Se
   descartaron: que el adaptador no relea (un conflicto real pasaría en silencio), exigir el instante (una
   plataforma que no lo da quedaría sin `pull` ni `subscribe` de órdenes) y dejarlo como estaba (el log y el conteo
   mentirían).
2. **Un rechazo del núcleo no frena el flujo, salvo el que el tiempo resuelve.** Se loguea y la corrida sigue; el
   almacén caído la corta y el cursor no avanza, como se construyó. La excepción es **una devolución de una orden que
   OPE todavía no tiene**: no se descarta, se encola como un aviso de devolución y se relee con `noticeRetry`, con el
   mismo rastro al agotar los intentos. Se descartó frenar en cualquier rechazo: un cambio que nunca va a entrar
   trabaría el flujo para siempre.
3. **Una corrida fallida se reintenta a `noticeRetry.afterMs`**, sin tope, y la que sale bien espera su cadencia
   desde que empezó. Un catálogo que falla no espera un día entero; una plataforma caída se consulta al ritmo del
   reintento, no en cada tick. Si la cadencia del flujo es más corta, manda la cadencia. Se descartó un valor de
   reintento propio: el de los avisos ya expresa lo mismo.
4. **El temporizador corre por primera vez al primer tick** después de que el arranque lee los niveles, como se
   construyó: un deploy no dispara lecturas a todas las plataformas a la vez.

Y un pedido del dueño que este ADR no resuelve: **la salud de la sincronización tiene que verse y alertar**, junto
con el resto de la salud de la plataforma y sus merchants. Va al hito `observability` como su propia feature, que
evalúa la herramienta (Prometheus y Grafana, OpenTelemetry o sólo la consola) y la decide con un ADR.
