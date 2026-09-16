---
numero: 2
titulo: Tipos de problema como URN urn:ope:problem:<slug>
estado: aceptada
fecha: 2026-09-16
fuente: specs/001-api-contract-toolchain/research.md
---

# ADR-002 — Tipos de problema como URN urn:ope:problem:<slug>

## Contexto

RFC 9457 identifica cada tipo de problema con una URI. HANDOFF proponía
`https://ope.dev/problems/<slug>`, pero el dominio no está decidido (hosting, ADR-010) y
cambiar el `type` es incompatible para los clientes que lo comparan.

## Decisión

El catálogo de tipos de problema vive en `contracts/problem-types.yaml` y cada tipo es
`urn:ope:problem:<slug>`. RFC 9457 §3.1 admite URIs no dereferenciables y pide que sean
estables; un URN no depende de ningún dominio ni proveedor. El servidor replica el catálogo en
`src/adapters/http/problem-details.ts` y una prueba verifica que ambos coinciden.

## Consecuencias

- Agregar un tipo es compatible; cambiar o quitar uno es incompatible (ADR-003).
- Si algún día se sirve documentación por tipo, se agrega un campo `docs` al catálogo sin
  tocar el `type`.
