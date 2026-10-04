# Modelo de datos — Los textos se editan por API

Fase 1 del plan. Lo nuevo: la clave de un texto, sus dos capas, la versión de una clave, la causa de un
reinicio de ventana, y una tabla. Lo que se retira: la voz.

## La clave de un texto

```text
TextKey {
  family: string          // una familia del vocabulario de candidatos (cerrado)
  attributeValue?: string // un valor del vocabulario de atributos (cerrado); sólo si la familia habla de uno
  locale: string          // etiqueta BCP 47, por forma (el mismo patrón que `Locales`)
}
```

Es una clase: se juzga al construirse contra los dos vocabularios y contra la familia (una familia que no
habla de atributo no admite valor; una que sí, lo exige), y falla con `TextKeyUnknown` nombrando qué parte.
Nunca se crea por la API: lo que un operador publica es un texto **para** una clave que ya existe en el
vocabulario.

**La capa no es parte de la clave sino de la publicación**: la base, o un merchant. El almacén las guarda
en la misma tabla con la capa como columna, y el corpus en memoria las indexa por capa y clave.

## La versión de una clave

```text
TextVersion {
  key: TextKey
  layer: "base" | MerchantId
  version: number           // correlativo por (capa, clave), acuñado por OPE
  text?: CuratedText        // ausente cuando la versión dice «quitado»
  publishedAt: Date
  operatorId: OperatorId
  corrective: boolean
  reason?: string
}
```

Es una clase (ADR-024): su regla es que **sólo la capa de un merchant admite «quitado»** —la base tiene que
seguir completa— y que su identificador de versión se deriva de la clave, la capa y el número. Su
`record()` declara `text` como el registro plano de `CuratedText` (feature 037): el constructor
convierte.

**El identificador que una intervención estampa** (`messageVersionId`) pasa a derivarse de la clave, la
capa y el número, sin voz: `<capa>/<familia>/<valor o ->/<idioma>#<n>`. Los identificadores ya estampados
con voz en el nombre no se tocan: identifican el texto que se mostró, y el ledger es inmutable. El largo
máximo del campo en `Intervention` sube para dar lugar a la clave entera.

## Lo vigente, y cómo se resuelve

Lo vigente de una (capa, clave) es su versión más alta; si dice «quitado», esa capa no tiene texto para la
clave. El corpus en memoria guarda sólo lo vigente, por capa y clave, y lo mantiene la misma escritura
después del commit (ADR-041).

La búsqueda del servicio de mensajes, para un merchant y una lista de idiomas (el de la página y el de
reserva), prueba en orden:

```text
para cada idioma:
  (merchant, clave, idioma)  →  (base, clave, idioma)
```

El idioma manda sobre la capa, como hoy. `TextKey` del puerto `MessageCorpus` pierde la voz y gana el
merchant.

## La completitud

Una regla del dominio de `messages` con nombre, mudada desde la composición: dado un idioma, **qué familias
incondicionales no tienen texto vigente en la base**. Vacía quiere decir completa. La usan:

- la importación de la semilla, contra los idiomas que los niveles sembrados soportan o nombran reserva;
- el decorador de `configuration` (R-05), contra los idiomas que **entran** en una publicación de defaults o
  de merchant;
- nadie más: una publicación de texto base nunca quita, así que no puede volver incompleta a la base.

## La causa de un reinicio de ventana

`WindowRestart` (036) lleva `level` y `configurationVersion`. Gana una causa discriminada y conserva los
dos campos para que un registro viejo siga leyéndose:

```text
WindowRestart {
  at: Date
  reason: string
  level: ConfigurationLevel        // se conserva; «merchant» cuando la causa es un texto de merchant, «defaults» para uno base
  configurationVersion: number     // se conserva; el número de la versión del texto cuando la causa es un texto
  cause?: { kind: "configuration" } | { kind: "text"; key: TextKey; layer: "base" | MerchantId }
}
```

`windowRestarted` recibe la causa; `ReachedExperiments` (036) pasa la de configuración y `ReachedByText`
la de texto. El servicio `WindowRestarts` de `experiment` es el único que llama a `windowRestarted` y
escribe el experimento.

## La tabla

`migrations/006-texts.sql`, con la convención de `migrations/README.md`:

```sql
CREATE TABLE texts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  layer           TEXT NOT NULL,   -- 'base', o el merchant; un centinela y no NULL, porque un índice único trata los NULL como distintos
  family          TEXT NOT NULL,
  attribute_value TEXT NOT NULL,   -- '' cuando la familia no habla de atributo, por la misma razón
  locale          TEXT NOT NULL,
  version         INTEGER NOT NULL,
  document        TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (...),
  updated_at      TEXT NOT NULL DEFAULT (...)
);
CREATE UNIQUE INDEX texts_key ON texts (layer, family, attribute_value, locale, version);
```

`MAX(version) + 1` por (capa, clave) dentro de la transacción que escribe, como `configuration_levels`. El
índice único convierte una carrera perdida en una escritura rechazada. Lo vigente se lee al construir el
gateway recorriendo la tabla ordenada por clave y versión y quedándose con la última de cada una; el
historial de una clave es un rango por el mismo índice, más nueva primero, con cursor por versión.

## La semilla

`config/messages.json` conserva `version` y `texts`, y cada entrada pierde `voice`. Se importa sólo en un
almacén de textos vacío, a nombre del operador del sistema, por un caso de uso auditado como el de los
niveles; un arranque que la encuentra importada lo dice en el log. La completitud se juzga al importar
contra los idiomas de los niveles sembrados; después, en las publicaciones.

## Lo que se retira

| Qué                                                             | Por qué                                                                                |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `domain/shared-kernel/voice.ts`                                 | La voz no nombra nada con una capa por merchant (spec, «Lo decidido antes de la spec») |
| `contracts/components/schemas/Voice.yaml`                       | Componente huérfano: ninguna operación lo referencia                                   |
| `voice` en `TextKey`, en la semilla y en `MessageSettings`      | Ídem                                                                                   |
| `interface-adapters/messages/gateways/memory-message-corpus.ts` | El almacén de textos en memoria sirve también el corpus                                |
| El juicio del corpus en `composition/corpus-config.ts`          | Se muda al dominio (`completeness.ts`, `TextKey`) y al caso de uso de importación      |

## Qué no cambia de forma

`Intervention` (texto y versión), `SdkConfig`, `EffectiveConfiguration` y todo lo que el SDK recibe.
`Locales` sigue igual; lo que cambia es que publicarlo puede rechazarse con `locale-incomplete`.
