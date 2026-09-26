# El delta del contrato (029)

Diseñado **antes de cualquier tarea de código**, como el gate de superficie HTTP exige. Todo entra
bajo `info.x-stability: building` (ADR-003) con bump **MINOR**: `contract:diff` lo reporta y lo
acepta, `release-check` avisa. La versión pasa de `1.8.0` a `1.9.0`.

## Un componente nuevo, que quita duplicación

| Archivo                                    | Qué                                                                                                                                                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/schemas/CatalogAttribute.yaml` | **nuevo**: el par clave/valor tal como la plataforma lo expone, sin normalización. Clave hasta 64, valor hasta 512, `additionalProperties: false`, los dos requeridos. Es **exactamente** la forma que `CatalogProduct` define hoy en línea. |

## Dos esquemas que lo referencian

| Archivo                                  | Cambio                                                                                                                                                                                                                                                                                            | Verifica                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `components/schemas/CatalogVariant.yaml` | **pierde** `size` y `color` de `properties` y de `required`; **gana** `attributes` (array, `maxItems: 64`, items `$ref` al componente nuevo), opcional como en el producto. La descripción deja de decir «la combinación exacta de talle y color» y dice lo que la fuente dice desde la enmienda. | `contract:lint`, `check:glossary`                       |
| `components/schemas/CatalogProduct.yaml` | su lista de atributos pasa a referenciar el componente en vez de definirlo en línea. **El esquema resultante es idéntico**: lo que cambia es dónde está escrito.                                                                                                                                  | `contract:diff` no debe reportar nada sobre el producto |

## Ejemplos

| Archivo                          | Cambio                                                               |
| -------------------------------- | -------------------------------------------------------------------- |
| `examples/catalog-snapshot.yaml` | las variantes del ejemplo declaran atributos en vez de talle y color |

## Lo que NO cambia, y conviene que se vea

- **Ninguna operación**: `contracts/api-map.yaml` queda igual. La variante viaja dentro del cuerpo de
  una operación que ya existe.
- **Ninguna respuesta**: la variante no aparece en ninguna, verificado. Es cambio de petición.
- **Ningún tipo de problema nuevo**: la forma vieja la rechaza el esquema, que ya responde
  `validation-failed` nombrando el campo.
- **Ningún `x-invariants` nuevo**: un atributo repetido o dos variantes con los mismos atributos se
  aceptan, igual que en el producto. No se inventa una regla que el precedente no tiene.

## Un detalle que `contract:diff` va a mostrar y hay que leer bien

Extraer la forma del atributo del producto a un componente **no cambia el esquema efectivo** del
producto: el bundle lo resuelve al mismo objeto. Si `contract:diff` reporta algo sobre
`CatalogProduct`, la extracción se hizo mal — y eso es justamente lo que lo hace una verificación y no
un trámite.

## El orden, que es el de la regla del contrato

1. La nota del glosario que cambia (ADR-008), antes de tocar el contrato.
2. El contrato en `contracts/`.
3. `npm run contract:check` en verde.
4. `npm run contract:types` — nunca editar lo generado a mano.
5. Dominio y adaptadores.
6. La cadena de gates.
