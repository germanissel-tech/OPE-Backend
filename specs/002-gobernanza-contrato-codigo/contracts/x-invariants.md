# Extensión `x-invariants`

Declara, sobre una operación o sobre el objeto raíz de un schema, las reglas de negocio que el
esquema no puede expresar (aritmética entre campos, estado de otros recursos, unicidad).

```yaml
# sobre una operación (depende de otro recurso)
post:
  operationId: ingestOrder
  x-invariants:
    - type: order-duplicated            # slug de contracts/problem-types.yaml, sin namespace
      status: 409                       # igual al status del catálogo para ese slug
      rule: no existe una orden con el mismo orderId para este merchant
      description: orderId es la única identidad de compra; un reintento no crea otra orden.

# sobre un schema (sólo campos del propio mensaje)
type: object
x-invariants:
  - type: order-total-mismatch
    status: 422
    rule: sum(items[].quantity * items[].unitAmount) == total
    description: El total declarado tiene que coincidir con la suma de los ítems.
```

Reglas verificadas:

| Verificación | Dónde |
|---|---|
| Los cuatro campos presentes; `type` existe en el catálogo; `status` coincide con el del catálogo | `ope-invariants` (Spectral) |
| Toda respuesta `422` de una operación tiene ejemplos cuyo `type` no es `urn:ope:problem:unprocessable` y corresponde a una invariante declarada en la operación o en el schema de su request body | `ope-no-generic-422` (Spectral) |
| Toda invariante declarada tiene una prueba cuyo título contiene `[invariant:<slug>]` en `tests/**/*.test.ts` | `scripts/check-invariant-tests.mjs` |

Inválidos: falta `rule`; `type: unprocessable` (genérico); `status: 400` para un slug cuyo
catálogo dice 409; `422` cuyo ejemplo usa un `type` que ninguna invariante declara.
