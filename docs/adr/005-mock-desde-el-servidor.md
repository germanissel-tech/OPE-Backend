---
numero: 5
titulo: El mock es el mismo servidor en modo mock
estado: reemplazada
fecha: 2026-09-16
fuente: specs/001-api-contract-toolchain/research.md
---

# ADR-005 — El mock es el mismo servidor en modo mock

> Reemplazada por ADR-018: no hay servidor mock; el servidor real con el perfil en memoria cumple
> el mismo propósito con más fidelidad.

## Contexto

La spec pide que el mock rechace un request inválido con el mismo código que el servidor
real. Prism responde `422` a toda violación de esquema y no valida parámetros no declarados.

## Decisión

`npm run contract:mock` levanta el mismo servidor con `OPE_MOCK=1`: no registra
manejadores y responde el `example` declarado en el contrato para cada operación. Validación,
`404`/`405` y Problem Details son idénticos porque es el mismo código.

## Consecuencias

- Sin Prism como dependencia.
- Todo media type de respuesta exitosa necesita ejemplo (ya lo exige `ope-success-response-example`).
