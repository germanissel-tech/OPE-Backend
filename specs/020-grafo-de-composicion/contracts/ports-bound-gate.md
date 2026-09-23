# Contrato — el gate `check:ports-bound` y la regla de forma nueva

Las dos verificaciones de la historia 3. Cada una con su fixture: la regla se agrega con un caso que
la dispara, y el código real pasa limpio (FR-014, FR-015, SC-005).

## 1. `npm run check:ports-bound`

**Qué pregunta**: ¿toda abstracción que un módulo de aplicación declara como puerto está enlazada en
el grafo?

| Aspecto    | Definición                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| Entrada    | Todo tipo o interfaz exportado por `src/application/*/ports/*.ts`.                                               |
| Regla 1    | Cada uno es el tipo servido de algún `port<T>()` en `src/composition/modules/*.ts`.                              |
| Regla 2    | Dos puertos no declaran la misma etiqueta.                                                                       |
| Regla 3    | Una etiqueta se declara una sola vez (no hay `port("x")` repetido).                                              |
| Cómo lee   | API 6.0 de TypeScript, como `scripts/lint/_typed.mjs` y `scripts/check-language.mjs`. Sin regex sobre el fuente. |
| Alcance    | `--src <dir>` para correrlo sobre un fixture, como `check:behaviour-constants`.                                  |
| Salida     | Texto por defecto; `--json` con el protocolo `findings-v1`.                                                      |
| Bloqueante | Sí. Entra a la cadena de `quality` (ADR-016) después de `check:dead-code`.                                       |
| Auditoría  | `scripts/audit/gate-ports-bound.mjs` lo expone con `--files-from`, `--list-rules` y `--describe`.                |

**Salida `--json`**

```json
{
  "gate": "check:ports-bound",
  "mode": "blocking",
  "status": "fail",
  "findings": [
    {
      "file": "src/application/catalog/ports/catalog-policies.ts",
      "line": 12,
      "rule": "ports-bound/unbound-port",
      "message": "CatalogPolicies is declared as a port and no composition module binds it"
    }
  ]
}
```

**Reglas** (`--list-rules`): `ports-bound/unbound-port`, `ports-bound/duplicate-label`.

**Fixture**: `tests/audit/fixtures/unbound-port/src/` — un módulo de aplicación con un puerto
declarado y un módulo de composición que no lo enlaza. La prueba exige que el gate lo nombre con
archivo y línea, y que `src/` pase limpio.

**Por qué no alcanza lo que hay**: knip informa los tipos exportados sin uso en modo **informativo**,
y un puerto puede estar "usado" (un caso de uso lo recibe) y aun así no estar enlazado en ningún
despliegue. Eso es lo que hoy no ve nadie.

## 2. Regla de forma `port-implementations-only-in-bind`

**Qué pregunta**: ¿alguien construye la implementación de un puerto fuera de su enlace?

Vive en `scripts/shape-rules.mjs` junto a las otras seis, se agrega a `SHAPE_RULES` y la corre
`tests/architecture/shape.test.ts` sobre `src/` (debe pasar) y sobre su fixture (debe fallar
nombrando el archivo y la línea).

| Dónde mira                     | Qué reporta                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `src/composition/modules/*.ts` | Un `new X(...)` de algo importado de `interface-adapters/` o `infrastructure/` **fuera** del builder de un `bind`. |
| `src/composition/modules/*.ts` | Un objeto literal con métodos usado como valor de un puerto fuera del builder de un `bind`.                        |
| `serves` y `assembles`         | Allí sólo se instancian casos de uso y servicios de `application/`, con valores obtenidos del grafo.               |

**Fixture**: `tests/architecture/fixtures/shape/port-outside-bind/src/composition/modules/x.ts`.

**Qué corrige hoy**: los objetos anónimos que la composición escribe como implementación de puerto
—`rotation`, `signatureWindow`, `tolerance`, `visitorWindow`, la ventana de sesión, `holdout`—, que
esquivan el anillo de adaptadores (FR-020, research R-12).

## 3. El mapa de contextos sobre la composición

No es un gate nuevo: son las reglas `context-map:<módulo>` de `.dependency-cruiser.cjs` extendidas a
`src/composition/modules/<módulo>.ts` (FR-011, research R-13). Es posible porque el consumo entre
módulos pasó a ser un `import` de un puerto.

**Fixture**: `tests/architecture/fixtures/src/composition/modules/` — un módulo que importa otro que
el mapa no permite; `npm run arch` sobre el fixture lo reporta y sobre `src/` pasa limpio.

## 4. Dónde queda cada verificación

| Verificación                                                                         | Cuándo corre                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Requisito sin proveedor, tabla incompleta, vista mal derivada, operación sin handler | `npm run typecheck` (y todo `build`)              |
| Abstracción sin enlace, etiqueta repetida                                            | `npm run check:ports-bound` (dentro de `quality`) |
| Implementación fuera de un `bind`                                                    | `npm test` (forma) y la skill de auditoría        |
| Import prohibido entre módulos de composición                                        | `npm run arch` (dentro de `quality`)              |
| Ciclo entre proveedores                                                              | arranque, con prueba                              |
| Operación del contrato que el binario no sirve                                       | arranque, con la prueba de hoy                    |
