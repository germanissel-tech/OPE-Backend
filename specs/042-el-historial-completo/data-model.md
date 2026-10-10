# Data model — fase 1 (042, el historial completo)

Nada nuevo se guarda (research R-01). Lo que cambia es **qué se lee** y **quién lo contesta**.

## 1 · La causa de un reinicio, y la pregunta sobre ella

`RestartSource` (dominio de experimentos, existente desde la 036 y la 038):

| campo                  | qué es                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `level`                | `platform`, `defaults` o `merchant`                                                                    |
| `configurationVersion` | el número de la versión. En los textos, el de la versión de esa clave en esa capa                      |
| `text?`                | `{ family, attributeValue?, locale, layer }` si la causa fue un texto. `layer` es `base` o el merchant |

**Regla nueva, en la entidad.** `Experiment.restartedBy(source): boolean`: verdadero si **alguno** de
sus `windowRestarts` tiene el mismo `level` y el mismo `configurationVersion`, y además:

- si `source.text` está, el reinicio tiene `text` con la misma `family`, el mismo `attributeValue`
  (ausente en los dos o igual), el mismo `locale` y la misma `layer`;
- si `source.text` no está, el reinicio tampoco lo tiene.

Un reinicio de texto nunca responde por una versión de configuración del mismo número, ni al revés.

## 2 · Las lecturas que ganan la pregunta

| módulo        | lectura                                                                | qué pregunta                                                     | filtro por merchant               |
| ------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------- |
| experiment    | `ExperimentStore.all()` (puerto nuevo)                                 | todo experimento de todo merchant, el más viejo primero          | —                                 |
| experiment    | `WindowRestartsService.restartedBy(source, merchantId?)`               | los experimentos con `restartedBy(source)`                       | con `merchantId`, sólo los suyos  |
| configuration | `ListLevelVersions`, `GetLevelVersion`                                 | `{ level, configurationVersion: n }`                             | no                                |
| configuration | `ListConfigurationVersions`, `GetMerchantConfigurationVersion` (nuevo) | `{ level: "merchant", configurationVersion: n }`                 | sí, el de la ruta (research R-03) |
| configuration | `PublishLevel`, `PublishMerchantConfiguration`, al repetir             | la misma que la lectura (research R-04)                          | como la lectura                   |
| messages      | `ListTextVersions`, `GetTextVersion`                                   | `{ level, configurationVersion: n, text: { …, layer: "base" } }` | no                                |
| messages      | `ListMerchantTextVersions`, `GetMerchantTextVersion`                   | lo mismo con `layer` = el merchant                               | sí                                |

El `level` de un texto es el que `WindowRestarts` ya registra para textos (`reached-by-text.service.ts`);
la clave se arma igual que al publicar, y una función compartida del módulo `messages` la arma en los
dos lados para que no se despeguen.

## 3 · Lo que devuelven

Cada lectura devuelve, por versión, la versión y **los experimentos que reinició**, con la forma que
la publicación ya usa (`PublishedLevel`, `PublishedText`: `{ version, outcome, windowsRestarted }`).
Los presentadores dejan de armar `windowsRestarted: []` y usan lo que la lectura trajo.
`publicationDto` ya omite la lista vacía (FR-003).

## 4 · La versión del merchant por número

`ConfigurationStore.versionOf(merchantId, version): Promise<MerchantConfigurationVersion | undefined>`.

- **Durable**: `SELECT version, document FROM merchant_configurations WHERE merchant_id = :merchant AND version = :version`.
- **Memoria**: la búsqueda en la lista del merchant.

`GetMerchantConfigurationVersionUseCase`:

| entra                                   | sale                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| `actor`, `merchantId`, `version`        | `{ version: MerchantConfigurationVersion, windowsRestarted: Experiment[] }`           |
| merchant fuera de alcance o inexistente | lo que `ScopedMerchantService.find` devuelve (`403` sin revelar)                      |
| número que el merchant no publicó       | `ConfigurationVersionNotFound("merchant", n)` → `404 configuration-version-not-found` |

Dependencias: `scoped`, `store`, `restarts`. Tres de seis (ADR-023).

## 5 · La publicación del merchant

`PublishMerchantConfigurationUseCase` gana `windowsRestarted: readonly Experiment[]` en su respuesta,
al lado del `windowRestarted: boolean` que el registro de administración ya lee y que no cambia:

- **creada y correctiva sobre un experimento activo**: el experimento reiniciado;
- **creada sin reinicio**: vacía;
- **repetida**: lo que la versión repetida reinició al publicarse (research R-04).
