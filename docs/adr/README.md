# Registro de decisiones de arquitectura (ADR)

Una decisión transversal —la que va a leer la feature 004 y no sólo la que la tomó— se registra
acá, no en el `research.md` de una feature. El research **cita** el ADR y conserva la
evidencia; el ADR conserva la decisión y su razón.

## Cómo citar

`ADR-NNN` en cualquier documento del repo, incluido el contrato. `npm run check:adrs` falla si
el número no existe.

## Estados

| estado | significa |
|---|---|
| `propuesta` | esperando aprobación |
| `aceptada` | vigente |
| `reemplazada` | hay un ADR posterior (campo `reemplaza` en el nuevo) |
| `abierta` | registra algo que todavía no se decidió (ver ADR-010) |

## Plantilla

```markdown
---
numero: NNN
titulo: Título corto
estado: propuesta | aceptada | reemplazada | abierta
fecha: YYYY-MM-DD
fuente: specs/NNN-feature/research.md | sesión | documento
---

# ADR-NNN — Título corto

## Contexto

## Decisión

## Consecuencias
```

El archivo se llama `NNN-slug-en-kebab.md` y `numero` coincide con `NNN`. No se escriben
cifras sobre el estado del sistema; las informan los comandos.
