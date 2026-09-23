---
numero: 034
titulo: Dueño del acceso y auditoría como obligación de plataforma
estado: aceptada
fecha: 2026-09-22
fuente: specs/020-grafo-de-composicion/research.md
---

# ADR-034 — Dueño del acceso y auditoría como obligación de plataforma

## Contexto

Tres cosas quedaron sin dueño al crecer el sistema:

1. **La autenticación.** Los tres esquemas del contrato, sus resolvedores y las políticas de
   seguridad del nivel de plataforma quedaron repartidos entre el módulo de merchants, el de
   administración y el kernel. El módulo de merchants terminó con dos motivos de cambio: el agregado
   y su administración, y el protocolo con que se autentican los consumidores.
2. **La auditoría de lo que hace un operador.** El decorador que escribe el registro vive en el
   módulo de administración, así que todo módulo que audita tiene que importarlo: es la violación
   silenciosa que hoy comete el módulo de merchants contra el mapa de contextos.
3. **El tope de memoria** de los almacenes de sesión y de visitante, que se toma del tope de la
   deduplicación de eventos sin decisión que lo respalde.

## Decisión

### 1. El acceso tiene un módulo

Un módulo nuevo, `access`, es dueño de: los tres esquemas de autenticación del contrato y sus
headers, los cuatro resolvedores (clave de ingesta, clave de plataforma, firma de plataforma, token
de operador), el directorio de operadores y el cálculo de huellas, el autenticador de mensajes y las
políticas de seguridad del nivel de plataforma (la ventana de firma y la gracia máxima de rotación).

Se llama `access` y no "security" porque el anillo de adaptadores ya usa una carpeta `security/`
dentro de cada módulo para sus security handlers; un módulo con ese nombre produciría una ruta
repetida. `access` nombra la autoridad —quién entra y con qué— y deja intactas las convenciones de
carpeta.

La dirección es **`access` lee del módulo de merchants la vista de lectura del directorio**, y nunca
al revés: ése es el invariante que evita un ciclo en el mapa de contextos. De ahí se sigue lo que
**no** se muda:

- Las reglas de las credenciales viven en el agregado (ADR-024, ADR-031): el merchant sigue
  respondiendo si una huella le pertenece, cuáles de sus secretos están vigentes y si exige firma.
- El valor de la firma de plataforma es la firma de la request **de un merchant**, verificada con
  los secretos de su agregado: se queda con el dominio de merchant.
- La tolerancia de reloj se queda en el kernel: la leen ingesta, catálogo y outcomes para juzgar
  instantes declarados. Es una regla de frescura de datos, no de autenticación; moverla haría que
  tres módulos que no autentican dependan del acceso.
- La gracia de rotación y la acuñación de credenciales siguen **declaradas** como puertos del módulo
  de merchants —las consume el caso de uso que administra el agregado— pero es `access` quien
  **provee sus implementaciones**: así el módulo de merchants no declara ninguna política de firma ni
  de rotación y no aparece ningún ciclo. Es el idioma que el repositorio ya usa con la
  configuración: cada consumidor define su puerto de lectura y la composición enlaza.

### 2. La auditoría es una obligación de plataforma, como el log

El kernel de aplicación declara un puerto de **escritura angosto** del registro de operaciones y el
decorador que lo usa. El módulo de administración conserva la entrada del registro, su
almacenamiento y las lecturas paginadas, e implementa ese puerto. Ningún módulo necesita importar el
módulo de administración para auditar, y el mapa de contextos deja de tener una excepción
silenciosa. Sostiene la constitución IX: la trazabilidad es de la plataforma, no de un módulo.

**Costo aceptado y acotado**: el kernel no puede ver la identidad del operador (tiene dueño: el
módulo de operador), así que en el puerto el actor viaja como texto y la implementación del módulo
de administración lo vuelve a tipar. La pérdida está en un solo borde, y una prueba afirma que la
entrada del registro es idéntica campo por campo a la de hoy.

**Alternativa descartada**: ampliar el mapa de contextos con "todos pueden ver el módulo de
administración". Convierte una excepción silenciosa en una excepción escrita, y habilitaría a
cualquier módulo a importar casos de uso de administración.

### 3. El tope de identidades en memoria es uno solo, y se llama así

Los almacenes en memoria de sesión, de visitante y de deduplicación de eventos comparten el mismo
tope del nivel de plataforma, y eso es **deliberado**: es un único límite de la instancia —cuántas
identidades mantiene en memoria un proceso— y no tres políticas. La constitución IV fija instancia
única y estado caliente acotado; mientras ese estado viva en el proceso, el límite es uno.

Para que el reparto sea explícito y no implícito, la configuración de plataforma lo expone con un
lector con nombre y los tres almacenes lo piden por ese nombre.

No se agrega un campo por almacén: el nivel de plataforma se publica por el contrato con
`additionalProperties: false`, y la feature que toma esta decisión exige cero diff del contrato. El
día que el estado caliente salga del proceso, separarlos es un campo nuevo del nivel de plataforma y
su bump de versión, no un cambio de forma.

### Enmienda (2026-09-23) — una acción que no se pudo auditar no se hace

Decisión del dueño. `AuditTrail.record` devuelve `Result<undefined, StoreUnavailable>` y el
decorador **descartaba** ese resultado: si el registro no se podía escribir, la operación del
operador se completaba igual y no quedaba constancia, en silencio. Eso se termina: una acción
administrativa que no se puede auditar **falla**.

Lo que la decisión obliga a resolver es el **orden**, no el código de error. Hoy la auditoría se
escribe después de ejecutar, así que al enterarse de la falla la acción ya ocurrió: devolver `503`
ahí le dice al operador que no pasó algo que sí pasó. En una rotación es peor que no fallar — la
credencial nueva ya se acuñó y su valor viajaba en la respuesta descartada, de modo que el merchant
queda con una credencial que nadie conoce. Fallar significa **fallar antes de actuar**.

Se adopta, en dos tiempos:

1. **Ahora**: el decorador verifica que el registro acepte escrituras **antes** de ejecutar; si no,
   la operación responde `503 store-unavailable` y nada ocurre. No hace falta tocar el contrato:
   los catorce paths de administración ya declaran `503` y el slug ya está en el catálogo. Esto
   **reduce** la ventana a la duración de la acción; no la cierra, y se documenta así. Mientras el
   registro sea un almacén en memoria la ventana es teórica.
2. **Con la persistencia** (hito `persistence-and-resilience` del roadmap, donde queda escrito el
   requisito): la entrada de administración **commitea con la acción que registra**. Ahí la ventana
   se cierra y la verificación previa del punto 1 sobra.

Descartada: escribir el intento antes y completarlo después. Es correcta en principio —la entrada
que queda "intentada" es el registro forense que uno quiere— pero su escritura en dos fases existe
sólo porque falta la transacción que el hito de persistencia va a traer, y cuesta un valor más en
`AdminOutcome`, que es un enum cerrado del contrato, más un estado en `AdminEntry`, más una
operación de cierre en el puerto, más decidir qué muestran las dos lecturas paginadas de una
entrada pendiente. Construirla hoy es construir lo que la transacción vuelve innecesario.

## Consecuencias

- "Cómo se autentica cada consumidor" se revisa leyendo un módulo.
- Una acción administrativa que el registro no pudo aceptar no ocurre, y el operador se entera.
- El módulo de merchants queda con un solo motivo de cambio: el agregado y su administración.
- El mapa de contextos pasa sin excepciones, también entre módulos de composición (ADR-033).
- Ningún comportamiento observable cambia: los mismos esquemas, los mismos códigos de error, las
  mismas entradas del registro y los mismos valores de configuración.
