# Research — La variante deja de exigir dos atributos de indumentaria (029)

Siete decisiones, todas chicas, todas con lo medido al lado. La feature es corta porque la medición
la achicó: lo que parecía diseño resultó ser un campo.

## R-00 — El alcance, contado

`grep` sobre el repositorio, sin `contracts/dist/` ni lo generado:

| Dónde                   | Cuánto      | Qué                                                                  |
| ----------------------- | ----------- | -------------------------------------------------------------------- |
| Contrato                | 1 esquema   | `CatalogVariant`, referenciado **sólo** por `CatalogProduct`         |
| Respuestas del contrato | **ninguna** | la variante no sale del backend: es cambio de **petición** solamente |
| `src/`                  | 2 archivos  | la interfaz del dominio y el controller que copia el DTO             |
| Huella de idempotencia  | 1 línea     | `contentKey` de `catalog-snapshot.ts`                                |
| `docs/dominio/`         | 1 nota      | `variante.md` (ver R-05)                                             |
| `tests/`                | 8 archivos  | sobre todo el helper que construye variantes                         |

**Que la variante no aparezca en ninguna respuesta es lo que hace barata a esta feature** y conviene
tenerlo escrito: un cambio de petición bajo la marca `building` no le rompe nada a nadie, mientras que
uno de respuesta habría tocado al SDK y a la administración.

## R-01 — ¿Los atributos de la variante son obligatorios?

**Decisión**: **opcionales**, como los del producto.

**Lo medido**: `CatalogProduct` declara `required: [productId, title, variants]` — sus atributos son
opcionales desde la feature 010. Una variante sin atributos es legítima: lo que la identifica es su
identificador, y los atributos dicen qué la distingue de sus hermanas. Un producto con una sola
variante puede no tener ninguno que declarar.

**Alternativa descartada**: exigir al menos uno. Obligaría a inventar un atributo justo en el caso que
esta feature viene a desbloquear — el que no tiene nada que declarar.

## R-02 — ¿Mismos límites que el producto, o propios?

**Decisión**: **exactamente los mismos**, y no por copiarlos: extrayendo la forma a un componente
único que los dos referencian.

**Motivo**: hoy el producto define el par clave/valor **en línea**. Si la variante lo define otra vez,
el contrato pasa a tener **dos maneras de decir lo mismo**, y la próxima vez que alguien ajuste un
límite va a ajustar una sola. Un componente compartido hace que la pregunta «¿cuánto mide un
atributo?» tenga una respuesta y no dos.

Los límites que quedan, que son los que el producto ya tenía: clave hasta 64, valor hasta 512, lista
hasta 64 entradas, `additionalProperties: false`, y la regla de que los valores llegan **tal como la
plataforma los expone, sin normalización**.

**Alternativa descartada**: un tope menor para la variante, con el argumento de que sus ejes son
pocos. Es cierto y no alcanza: un tope distinto es una regla nueva que alguien tiene que descubrir, y
el costo de 64 contra 8 no existe.

## R-03 — La huella de contenido

**Decisión**: la variante serializa sus atributos **igual que el producto**, que ya lo hace una línea
más arriba en la misma función.

**Por qué no es una decisión abierta**: la pregunta que parecía haber —si el orden de los atributos
importa para decidir si dos catálogos son «el mismo»— ya está contestada para el producto desde la
feature 010: se serializan en el orden recibido, así que reordenarlos es contenido distinto. Que la
variante haga otra cosa sería inventar una segunda semántica de igualdad dentro de la misma función.

**Lo que esto sí cambia, y hay que probarlo**: dos catálogos del mismo instante cuyas variantes
difieren en un atributo pasan a ser un **conflicto de idempotencia** y no una repetición. Antes eso
sólo se notaba si cambiaba el talle o el color; ahora se nota con cualquier eje. Es más correcto y es
la única parte de esta feature que altera comportamiento.

## R-04 — ¿Hace falta un ADR?

**Decisión**: **no**.

**Lo verificado**: ningún ADR nombra talle ni color —lo comprobé sobre `docs/adr/` entero—, salvo
ADR-037, que es el registro de la enmienda de la fuente y habla de ella en pasado. ADR-025 describe la
instantánea del catálogo sin enumerar los campos de la variante, así que no queda desactualizado.

La decisión transversal que esta feature aplica ya está escrita: es el criterio de ADR-036 y la regla
de la 028 sobre campos que nadie lee. Escribir un ADR para repetirla sería ruido.

## R-05 — La nota del glosario, que la 028 dejó a medias

**Decisión**: `docs/dominio/variante.md` actualiza su cita y su cuerpo.

**Lo medido, y el método**: comparé cada cita del glosario contra el diff de la enmienda del
2026-09-25 en el repositorio de los documentos del MVP. **Exactamente una** nota cita texto que la
enmienda borró: `variante.md`, que todavía dice «La combinación exacta de talle y color». Las otras
dos que estaban en esa situación —`anclaje.md` y `seleccion-de-variante.md`— las arregló la 028.

Su cuerpo además enumera los campos de la variante «(ADR-025): `variantId`, talle, color,
disponibilidad y precio», así que cambia con el contrato.

**Y conviene decir lo que este método no puede**: una comparación cruda de todas las citas contra la
fuente da decenas de falsos positivos —citas con elipsis, filas de tabla reescritas con separadores
distintos, texto de otras secciones—, así que **no hay base para afirmar nada sobre las demás**. Lo
único verificado es lo que nuestra propia enmienda rompió. Un gate que verifique citas contra su
fuente es otra cosa, y es pariente de D-18.

## R-06 — El dominio

**Decisión**: la variante lleva `attributes: readonly Attribute[]`, **reusando la interfaz `Attribute`
que el módulo ya exporta** para los atributos del producto. Ningún tipo nuevo.

**Motivo**: es el mismo concepto. Un tipo aparte para «atributo de variante» tendría los mismos
campos, las mismas reglas y otro nombre, que es la definición de duplicación.

## R-07 — Las pruebas

**Decisión**: el helper que construye variantes deja de recibir un talle y recibe atributos, y todo lo
demás **no cambia de expectativa**.

**El criterio es el de la 028, y acá vuelve a valer**: en un cambio de forma, la prueba que demuestra
que no se rompió nada es la que ya existía pasando con la forma nueva. Si una prueba necesita cambiar
**lo que espera**, no era un cambio de forma. Las dos únicas pruebas nuevas son las que cubren lo que
sí cambia: el rechazo de la forma vieja y el conflicto por un atributo distinto.

## Lo que no se investigó, y por qué

- **Qué claim leería los atributos de la variante.** Ninguno lo hace hoy y el vocabulario de claims es
  cerrado (ADR-027): inventar uno es una feature de producto, no una consecuencia de generalizar un
  campo.
- **Si conviene que la variante tenga ejes tipados** (una clave conocida por OPE, como `material` en
  el producto). Sería el patrón de ADR-036 aplicado a la variante, y no hace falta hasta que algo
  quiera leerla.
