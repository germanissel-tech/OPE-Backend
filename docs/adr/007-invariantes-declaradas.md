---
numero: 7
titulo: Las reglas que el esquema no expresa se declaran
estado: aceptada
fecha: 2026-09-16
fuente: specs/002-gobernanza-contrato-codigo/research.md
---

# ADR-007 — Las reglas que el esquema no expresa se declaran

## Contexto

JSON Schema valida forma, no aritmética entre campos, unicidad ni estado de otros recursos.
Quien implementa leyendo sólo los esquemas cree que está cubierto. Práctica adoptada de
`las-animas`, adaptada a Problem Details.

## Decisión

Toda regla de ese tipo se declara en `x-invariants` sobre la operación (si depende de otro
recurso) o sobre el schema (si sólo involucra campos del mensaje), con `type` (slug del
catálogo, nunca `unprocessable`), `status`, `rule` y `description`. `ope-invariants` verifica
la forma y el catálogo; `ope-no-generic-422` exige que toda `422` nombre la invariante que la
produce; `check:invariant-tests` exige una prueba con `[invariant:<slug>]` en el título.

## Consecuencias

- Las reglas de negocio son enumerables: `grep x-invariants`.
- Una invariante sin prueba falla `contract:check`.
