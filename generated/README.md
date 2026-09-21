# generated/ — lo que se deriva del contrato

Nada de este directorio se escribe a mano. Cada archivo lo produce `npm run contract:types`
desde el contrato bundleado o desde uno de sus catálogos, lleva en su primera línea (o en
`$comment`, si es JSON) el script que lo genera y el comando que lo regenera, y
`npm run contract:types:check` falla si lo commiteado difiere de lo que el generador produce
(drift). Se versiona porque la compilación y las pruebas lo necesitan sin correr el generador;
`.gitattributes` lo marca `linguist-generated` para que aparezca colapsado en las revisiones.

Desde `src/` se importa como `#generated/<archivo>` (subpath import de Node declarado en
`package.json`) y **sólo** desde el núcleo HTTP del anillo de adaptadores
(`src/interface-adapters/http/`) y la infraestructura HTTP (`src/infrastructure/http/`); la regla
de arquitectura `generated-only-from-http-core` lo hace cumplir (ADR-013). Lint, Prettier, knip
y Stryker lo excluyen como a todo lo generado.

## Inventario

| Entrada               | Qué es                                                                                                                                                    | Fuente o derivado | Quién lo lee                                                                                  | Verificación                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `api.d.ts`            | Tipos TypeScript de la API (`paths`, `operations`, `components`) producidos por openapi-typescript desde `contracts/dist/openapi.yaml`.                    | derivado          | `interface-adapters/http/typed.ts` (los re-exporta para los módulos), `client/`, las pruebas    | `contract:types:check`; `tests/docs` (cabecera cita un script existente) |
| `problem-types.js`    | Catálogo de tipos de problema como valores en runtime (`PROBLEM_NAMESPACE`, `PROBLEM_TYPES` con status y título como literales), desde `contracts/problem-types.yaml`. | derivado          | `interface-adapters/http/problem-details.ts`; se emite a `dist/` con el resto del código        | `contract:types:check`; prueba de que todo `code` del dominio existe en el catálogo |
| `problem-types.d.ts`  | Los tipos del catálogo (`ProblemSlug` como unión de literales).                                                                                            | derivado          | lo mismo que `problem-types.js`, en tiempo de compilación                                     | `contract:types:check`                                   |
