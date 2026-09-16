---
numero: 4
titulo: Herramientas de verificación del contrato
estado: aceptada
fecha: 2026-09-16
fuente: specs/001-api-contract-toolchain/research.md
---

# ADR-004 — Herramientas de verificación del contrato

## Contexto

La 001 evaluó lint, bundle, breaking changes, tipos, mock, docs y pruebas generadas. Varias
elecciones tienen restricciones no obvias que conviene no redescubrir.

## Decisión

- **Spectral** (`contracts/.spectral.yaml`, funciones custom en `contracts/rules/functions/`)
  para las reglas de OPE sobre el contrato resuelto, con un fixture por regla. `oas3-schema`
  apagada: en Spectral 6.16 falla con path items `$ref` externos en OpenAPI 3.1. El ruleset
  se escribe en estilo bloque y `"off"` entre comillas.
- **Redocly CLI** para la validez estructural (`struct`, `no-unresolved-refs`), el bundle, las
  docs y las assertions sobre archivos fuente (`rule/media-type-schema-ref`). La raíz del
  contrato no declara `components`: el bundle los promueve por nombre de archivo.
- **oasdiff** (binario Go, descargado con checksum por `scripts/oasdiff-install.mjs`) para
  compatibilidad; el wrapper npm `@pb33f/openapi-changes` no detecta "agregar respuesta de
  error" ni permite severidades por check.
- **openapi-typescript** para tipos (exige TypeScript 5.x), **openapi-fetch** como cliente,
  **Schemathesis** vía `uvx` para pruebas generadas, **Redoc** inlineado desde el paquete
  `redoc` para docs autocontenidas.

## Consecuencias

- Toda regla nueva del contrato va con fixture en `tests/contract-rules/fixtures/`.
- Actualizar TypeScript a 6/7 depende de openapi-typescript.
