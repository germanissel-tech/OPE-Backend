# El delta del contrato (028)

Diseñado **antes de cualquier tarea de código**, como el gate de superficie HTTP exige. Cada fila
dice el archivo, qué cambia y qué lo verifica.

Todo el delta entra bajo `info.x-stability: building` (ADR-003) con bump **MINOR**: ningún merchant
consume el contrato, `contract:diff` lo reporta y lo acepta, y `release-check` avisa. La versión pasa
de `1.7.0` a `1.8.0`.

## Esquemas del vocabulario

| Archivo                                                 | Cambio                                                                                                                                                                 | Verifica                                                 |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `components/schemas/Anchor.yaml`                        | `enum: [size_selector, …]` → `[variant_selector, price, cta, policies]`; la descripción deja de hablar de talles                                                       | `check:glossary`, la prueba de réplica de `ANCHORS`      |
| `components/schemas/AnchorMap.yaml`                     | las claves del mapa siguen al enum                                                                                                                                     | `contract:lint`                                          |
| `components/schemas/SizeSelectorInteracted.yaml`        | **se renombra el archivo** al nombre genérico; `enum` del discriminador al tipo nuevo; **se elimina** la propiedad de la etiqueta del talle y su entrada en `required` | `contract:types`, `test:contract`                        |
| `components/schemas/Event.yaml`                         | la entrada del `discriminator.mapping` y el `$ref` siguen al archivo nuevo                                                                                             | `contract:lint` (mapping y `oneOf` tienen que coincidir) |
| `components/schemas/BlockDwelled.yaml`                  | `enum` del bloque: `size_guide` → `specifications`                                                                                                                     | la prueba de réplica de `BLOCKS`                         |
| `components/schemas/MerchantConfigurationDeclared.yaml` | `barriers`: **se borra `maxItems`**; `minItems: 1` y `uniqueItems: true` se quedan; la descripción dice qué limita sin depender de cuántas barreras existan            | `contract:lint`, la prueba del esquema de configuración  |

## Ejemplos y descripciones que nombran el vocabulario

| Archivo                               | Cambio                                         |
| ------------------------------------- | ---------------------------------------------- |
| `examples/event-batch.yaml`           | el evento del selector, sin el campo eliminado |
| `examples/exposure-confirmation.yaml` | el anclaje                                     |
| `paths/sdk-config.yaml`               | el ejemplo del mapa de anclajes                |
| `paths/sdk-diagnostics.yaml`          | el ejemplo del diagnóstico                     |
| `paths/admin-diagnostics.yaml`        | el ejemplo de la página de diagnósticos        |
| `paths/admin-configuration.yaml`      | los ejemplos de configuración publicada        |
| `paths/admin-treatment-defaults.yaml` | el ejemplo de las reglas de la política        |

## Lo que NO cambia, y conviene que se vea

- **Ninguna operación** se agrega, retira ni cambia de forma: `contracts/api-map.yaml` queda igual.
- **Ningún tipo de problema** nuevo: un nombre viejo lo rechaza el esquema, que ya responde
  `validation-failed` nombrando el campo.
- **Ningún `x-invariants` nuevo**: el tope de barreras se borra porque el tipo lo garantiza, no se
  muda a una regla.
- **Ningún campo nuevo.** Uno se elimina.

## El orden, que es el de la regla del contrato

1. Las notas del glosario que cambian (ADR-008), antes de tocar el contrato.
2. El contrato en `contracts/`.
3. `npm run contract:check` en verde.
4. `npm run contract:types` — nunca editar lo generado a mano.
5. Dominio, aplicación, adaptadores, composición.
6. La cadena de gates.
