---
numero: 1
titulo: Mapa de códigos 400 y 422
estado: aceptada
fecha: 2026-09-16
fuente: specs/001-api-contract-toolchain/research.md
---

# ADR-001 — Mapa de códigos 400 y 422

## Contexto

La spec de la 001 exige que el servidor responda `400` (forma) o `422` (semántica) ante un
request que no cumple el contrato, y que toda operación con request body declare ambos. El
validador de runtime (openapi-backend/Ajv) no distingue "forma" de "semántica": todo lo que
reporta es una violación del esquema.

## Decisión

- Toda violación del contrato detectada por el validador (parámetro o campo desconocido,
  tipo, enum, requerido, formato), JSON no parseable o content-type no soportado ⇒ **`400`**
  `urn:ope:problem:validation-failed`, con `errors[]` enumerando cada violación (`pointer`
  relativo al request: `/query/x`, `/body/campo`).
- **`422`** queda reservado para los manejadores: un request válido según el esquema que una
  regla de dominio rechaza. Cada una de esas reglas se declara como invariante (ADR-007) con
  su propio tipo de problema; el tipo genérico `unprocessable` no lo declara ninguna operación.
- Respuesta del manejador fuera del contrato (cuerpo o código no declarado) ⇒ `500`
  `response-contract-violation`; excepción no controlada ⇒ `500` `internal-error` sin detalles.

## Consecuencias

- El cliente ramifica por `type`, nunca por `detail`.
- Un `422` sin invariante declarada falla el lint (`ope-no-generic-422`).
- El mock (ADR-005) hereda el mismo mapa porque es el mismo código.
