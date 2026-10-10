# Data model — fase 1 (043, el testigo de concurrencia)

Nada se guarda para comparar después: el testigo se calcula del estado actual (research R-03). Lo único
nuevo que se guarda es la revisión del merchant.

## 1 · El testigo de cada recurso

| recurso                      | se calcula de                                         | valor (sin las comillas del `ETag`) |
| ---------------------------- | ----------------------------------------------------- | ----------------------------------- |
| plataforma                   | `LevelVersion.versionName()` de la que rige           | `platform-12`                       |
| defaults                     | ídem                                                  | `defaults-3`                        |
| configuración de un merchant | el merchant y el número de la versión que rige, o `0` | `mrc_x:configuration:5`             |
| merchant                     | el merchant y su revisión                             | `mrc_x:7`                           |

## 2 · La revisión del merchant

`MerchantRecord.revision: number` (nuevo; ADR-041: viaja en el documento, sin migración).

| momento                                             | revisión                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| `Merchant.of` (alta, semilla)                       | `1`                                                                    |
| `rotated`, `switched`, `deactivated`, `withProfile` | la anterior más uno, por un único método privado que arma el siguiente |
| documento anterior a la 043, sin el campo           | `0` al rehidratar, hasta la primera escritura                          |

`Merchant.witness(): string` → `${merchantId}:${revision}`.

## 3 · El error

`StaleVersion` en `domain/shared-kernel/errors.ts`: `code = "stale-version"`, `412`, mensaje «The resource
changed since it was read.». Sin `details`: el testigo actual no viaja en el rechazo de uno viejo, por la
misma razón que no viaja en el de uno faltante (`TAN-10`); quien lo necesita relee el recurso.

`witness-required` (`428`) no es un error de dominio: lo responde la infraestructura cuando falta el
encabezado (research R-02).

## 4 · Los casos de uso

| caso de uso                    | gana en el request | gana en la respuesta                         | orden (R-05)                                                  |
| ------------------------------ | ------------------ | -------------------------------------------- | ------------------------------------------------------------- |
| `PublishLevel`                 | `witness: string`  | — (el nombre de la versión ya es su testigo) | draft → repetida → testigo → juicio → congelamiento           |
| `PublishMerchantConfiguration` | `witness: string`  | — (merchant y número ya están)               | alcance → draft → repetida → testigo → congelamiento → juicio |
| `UpdateMerchantProfile`        | `witness: string`  | el merchant (ya está)                        | alcance → perfil válido → idéntico → testigo → escritura      |
| `GetMerchantConfiguration`     | —                  | — (la versión que rige ya está)              | sin cambio                                                    |

El testigo de la configuración de un merchant lo calcula una función del módulo `configuration`
(`merchantConfigurationWitness(merchantId, version)`), que usan la lectura y la publicación.

## 5 · Lo que el borde hace

- **Leer `If-Match`**: un único testigo fuerte entre comillas → su valor. `*`, varios, débil o sin comillas
  → la cadena tal cual, que no coincide con ningún testigo.
- **Escribir `ETag`**: `"<testigo>"` en las respuestas de `getPlatformConfiguration`,
  `getTreatmentDefaults`, `getMerchantConfiguration`, `getMerchant`, las tres publicaciones,
  `updateMerchantProfile`, `createMerchant`, `setKillSwitch`, `deactivateMerchant` y las tres rotaciones.
- **El rechazo por faltante**: `validationFail` responde `428 witness-required` cuando el único error es un
  parámetro ausente que declara `x-when-missing`, sin `ETag`.
