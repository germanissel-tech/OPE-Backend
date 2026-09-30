# Data model — Los niveles 1 y 2 se configuran por API (036)

Una entidad nueva, una que gana un campo, una tabla y un cálculo. Lo demás ya existe.

## La versión de un nivel

Lo mismo que ya es `MerchantConfigurationVersion`, un nivel más arriba. **Clase y no tipo**, porque tiene
reglas: un contenido igual al vigente no es una versión nueva, y una versión correctiva exige su motivo
(ADR-024: `private constructor`, `of(...)` que devuelve `Result`, `rehydrate` que no re-juzga).

| Campo                       | Qué es                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------ |
| `level`                     | `platform` o `defaults`. Lo que decide contra qué vocabulario se valida el contenido |
| `version`                   | número correlativo **por nivel**, acuñado por OPE, nunca declarado por el operador   |
| `content`                   | el contenido publicado, tal cual, inmutable                                          |
| `publishedAt`, `operatorId` | cuándo y quién                                                                       |
| `reason`                    | el motivo, presente si y sólo si la versión es correctiva                            |

**Lo que el operador declara es contenido y, cuando hace falta, motivo.** El número no: hoy cada archivo
trae su propio `version` (`platform-2`, `defaults-1`) y nada obliga a cambiarlo cuando el contenido cambia
— una huella lo vigila para dos de los veintidós campos. Que lo acuñe el almacén saca esa responsabilidad
de las manos de quien publica.

## Las hojas que cambian

El cálculo del que depende todo lo demás, y su unidad es **la hoja**.

Seis de los diez campos de tratamiento se mezclan clave por clave (`PolicyInput.merge`), y
`decisionPolicy.evidence` una vuelta más adentro. Así que:

| Se compara                                                   | Y se obtiene                                                                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| el contenido de la versión saliente contra el de la entrante | el conjunto de **rutas de hoja** cuyo valor difiere (`decisionPolicy.threshold`, `commercialPolicy.marginShare`, `holdoutShare`, …) |

**Un merchant queda no alcanzado sólo si declara todas las hojas del conjunto.** Declarar el objeto que las
contiene no alcanza —puede haber declarado una clave y no otra—, y declarar una sola de varias tampoco.

## El registro de reinicio de ventana gana un campo

`WindowRestart` guarda hoy `{ at, reason, configurationVersion }`, y ese número era del merchant porque
era el único nivel que publicaba. Con tres, «versión 3» no identifica nada.

| Antes                                  | Después                                       |
| -------------------------------------- | --------------------------------------------- |
| `{ at, reason, configurationVersion }` | `{ at, reason, configurationVersion, level }` |

Es una entidad que el contrato publica (`Experiment.yaml`), así que el campo entra al contrato. Está
marcado en construcción (ADR-003): se acepta y se reporta.

## La tabla

Una, para los dos niveles, con el patrón de `merchant_configurations`:

| Columna                    | Para qué                                                            |
| -------------------------- | ------------------------------------------------------------------- |
| `level`                    | parte de la clave: cada nivel tiene su propia sucesión de versiones |
| `version`                  | el número, único por nivel                                          |
| `document`                 | el contenido, el motivo, el actor y el instante, como documento     |
| `created_at`, `updated_at` | las dos reglas del dueño de toda tabla (feature 033)                |

`MAX(version)+1` **dentro de la transacción**, que es lo que hace que dos publicaciones simultáneas no
compartan número. Índice único `(level, version)`.

## Qué no cambia de forma

- **Los valores de cada nivel**: no se agrega ni se quita ningún campo. Cambia quién los escribe.
- **La terna que cada decisión estampa** (`{ platform, defaults, merchant? }`): misma forma, mismos tres
  números. Lo que cambia es de dónde salen los dos primeros.
- **Lo que el SDK recibe**: `EffectiveConfiguration` conserva su forma y su `additionalProperties: false`.
  Cambian los valores y el número de versión, que ya viajaba.
- **Los archivos del release**: siguen existiendo y siguen siendo la única fuente del **contenido inicial**.
  Lo que cambia es que se aplican una sola vez, sobre un almacén vacío.
- **La resolución valor por valor** y el orden de los tres niveles.
