# Data model — El catálogo de mensajes (027)

El vocabulario de la feature, con sus invariantes y su dueño. Nada de esto es esquema del contrato:
lo que el contrato publica sale de acá, no al revés.

## Módulo nuevo: `messages`

Entra al mapa de contextos con las dependencias mínimas: `[shared-kernel, selection]` —necesita la
familia de mensaje, que `selection` define— y nada más. **No depende de `catalog`**: recibe el valor
de atributo ya resuelto, no el producto.

---

## Dominio

### `MessageVersion` — valor

Lo que identifica de forma estable un texto concreto del corpus. Es lo que el ledger registra y lo
que permite atribuir un resultado a lo que la persona leyó.

- **Invariante que la manda todo**: una versión es **inmutable**. Corregir un texto acuña una
  versión nueva; editar la existente reescribiría el pasado del ledger (`FR-019`).
- Sin reglas de construcción más allá de su forma ⇒ **tipo marcado**, no clase (ADR-024).
- Vive en `domain/messages/ids.ts`: tiene un dueño claro, así que no va al `shared-kernel`.

### `CuratedText` — clase

Un texto del corpus, con su versión. Sólo existe válido.

- `of(...)` devuelve `Result` y rechaza: texto vacío o sólo espacios, texto más largo que el máximo
  que el contrato publica, y versión mal formada.
- **No lleva huecos ni marcadores de interpolación** (R-07): un texto con un `{...}` sin resolver
  es un texto que alguien creyó que era plantilla, y llegaría así a una persona.

### `Voice` — vocabulario cerrado

El registro de marca con el que está escrito un texto. Arranca con **un solo valor**, y la clave
existe desde el día uno para que el segundo sea una entrada y no un rediseño (`SC-008`).

- Réplica contra el contrato, como `BARRIERS` y `ANCHORS`: el kernel declara la lista y una prueba
  verifica que coincide con el esquema.
- Uno de los valores es **la voz por defecto**, la que se usa cuando la del merchant no tiene texto.

### `AttributeValue` — vocabulario cerrado

Un concepto sobre el que OPE **tiene prosa curada** (un tipo de tela, por ejemplo). **No** es la
etiqueta del merchant.

- Cerrado por la misma razón que los candidatos: un valor sin frase escrita no existe a efectos del
  mensaje (R-04).
- Crece por demanda, con la misma disciplina con la que se acotaron barreras (tres), anclajes
  (cuatro) y escalones (cinco).

### `LocaleChain` — clase

El orden en que se busca un texto cuando el idioma de la página no tiene uno propio.

- `of(tags)` rechaza: cadena vacía, tags mal formados por BCP 47 y **tags repetidos** —un tag dos
  veces es un error del que la declaró, no una preferencia—.
- `resolve(pageLocale)` devuelve los idiomas a probar, en orden, empezando por el de la página.
- **El idioma manda sobre la voz**: agotada la cadena no se devuelve nunca un texto de otro idioma
  (R-06).

### `MessageOutcome` — unión discriminada

Lo que la autoridad del mensaje responde. Estados ilegales irrepresentables (ADR-024):

```
Dressed   { text: CuratedText, version: MessageVersion }
Unavailable { reason: "message-unavailable" }
```

No existe un tercer estado ni un `Dressed` con texto ausente.

### `domain/messages/errors.ts`

Errores de negocio del módulo, todos devueltos y nunca lanzados (ADR-023). Cada uno con su entrada
en `contracts/problem-types.yaml`:

- `UnknownAttributeValue` — una correspondencia nombra un valor fuera del vocabulario (`FR-007`).
- `DuplicateAttributeLabel` — la misma etiqueta del merchant apunta a dos valores.
- `UnknownVoice` — el merchant elige una voz que no existe.
- `InvalidLocaleChain` — la cadena está vacía, mal formada o repite un tag.

---

## Aplicación

### `MessageService` (autoridad) — `application/messages/services/`

La autoridad que viste la decisión, **después del veredicto comercial y antes del ledger** (R-03).
Recibe la familia de mensaje elegida, el valor de atributo ya resuelto (o su ausencia), el idioma de
la página y la configuración del merchant; devuelve un `MessageOutcome`.

**No decide si intervenir.** Eso lo emitió la política comercial, única autoridad del veredicto
(constitución I). Esta autoridad informa **si puede entregar**, igual que `DecisionRecorder` informa
si el ledger aceptó.

### Puertos — `application/messages/ports/`

| Puerto             | Qué responde                                                                      | Quién lo enlaza                                     |
| ------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------- |
| `MessageCorpus`    | el texto curado para una familia, un valor, un idioma y una voz, si existe        | `messages`, sobre el activo del release             |
| `MessageDirectory` | lo que el merchant declaró: voz, cadena de idiomas y correspondencia de etiquetas | `configuration`, como ya hace con `PolicyDirectory` |
| `UnmappedValueLog` | registra que apareció un valor sin correspondencia                                | `messages`                                          |

Todos devuelven `Promise`, y los que pueden fallar devuelven `Result` (ADR-023).

### `MessagePlane` — puerto que declara `decision`

El módulo `decision` declara el puerto que necesita y `messages` lo implementa, igual que
`ingestion` declara `DecisionPlane` y `decision` lo implementa (ADR-026). **`decision` no importa
`messages`.**

---

## Configuración del merchant

Lo que se agrega a lo que un merchant publica, por el camino que ya existe
(`publishMerchantConfiguration`), versionado y estampado en cada decisión junto con las otras dos
versiones:

| Campo                   | Qué es                                  | Invariante                                               |
| ----------------------- | --------------------------------------- | -------------------------------------------------------- |
| `voice`                 | la voz elegida                          | del vocabulario cerrado                                  |
| `locales.fallbackChain` | reemplaza al `fallback` de un solo tag  | no vacía, sin repetidos, todos bien formados             |
| `attributeLabels`       | sus etiquetas → valores del vocabulario | cada valor existe; ninguna etiqueta apunta a dos valores |

Las tres las juzgan las fábricas del dominio, no el lector de forma (ADR-024): un valor fuera de
rango es un error que nombra su campo.

---

## El corpus como activo del release

Un archivo del repositorio que `readConfig` lee por un lector de forma y las fábricas del dominio
juzgan, igual que los dos niveles que ya existen. Su clave es:

```
familia de mensaje × valor de atributo (o ninguno) × idioma × voz  →  texto + versión
```

**Invariantes del corpus, verificadas al arrancar** (fail-closed, constitución II):

- Toda entrada nombra una familia que el plano puede elegir, un valor del vocabulario, un idioma
  bien formado y una voz que existe.
- Ninguna versión se repite con texto distinto.
- Existe al menos un texto por familia en el idioma y la voz por defecto — sin eso, un merchant
  recién configurado no podría mostrar nada y `message-unavailable` sería el caso normal en vez de
  la excepción.

---

## Valores pendientes de mapear

Lo que alimenta la historia 4, con la misma forma que los diagnósticos de anclajes, que ya está
construida y probada:

- Por merchant: la etiqueta que apareció sin correspondencia, **cuántos productos la traen**, el
  último instante en que se vio.
- **Con tope**, y alcanzado el tope se descarta lo más viejo. **Nunca** rechaza ni demora la ingesta
  del catálogo (`FR-021`).
- El tope es un valor de nivel plataforma, no una constante (constitución XI).

---

## Lo que **no** entra al modelo, y por qué

| Qué                                                 | Por qué no                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Category` y su mapa                                | El caso que lo motivaba lo resuelve la evidencia: el producto no trae el dato y el candidato se rechaza |
| Un predicado sobre atributos                        | Con la decisión de no redactar por producto, es potencia que sólo habilita lo prohibido                 |
| El texto dentro del registro de la decisión         | El registro guarda la **versión**; el texto vive en el corpus, inmutable por versión                    |
| Un identificador de producto en la clave del corpus | Es exactamente el texto por prenda que el stakeholder descartó                                          |
