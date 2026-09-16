# Extensión `x-required-capabilities`

Declara, en una operación **autenticada**, la capacidad que la credencial tiene que tener.
Forma `<recurso>:<accion>`. La capacidad, no el puesto: los puestos se componen en el sistema
de identidad y el contrato no los conoce.

```yaml
post:
  operationId: ingestEvent
  security:
    - ingestKey: []
  x-required-capabilities:
    - events:write
```

Reglas verificadas por `ope-required-capabilities` (Spectral, documento resuelto):

- `security` no vacío (propio, o heredado del root cuando la operación no lo declara) ⇒
  `x-required-capabilities` presente, array no vacío de strings `^[a-z][a-z-]*:[a-z][a-z-]*$`.
- `security: []` (pública, como `getHealth`) ⇒ `x-required-capabilities` ausente.
