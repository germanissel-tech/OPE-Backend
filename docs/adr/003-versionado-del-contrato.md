---
numero: 3
titulo: Versionado del contrato y prefijo de rutas
estado: aceptada
fecha: 2026-09-16
fuente: specs/001-api-contract-toolchain/research.md
---

# ADR-003 — Versionado del contrato y prefijo de rutas

## Contexto

El contrato necesita una regla mecánica para "cambio incompatible ⇒ nueva versión mayor" y
un lugar único donde la versión se exprese.

## Decisión

- `info.version` es semver y arranca en `1.0.0`; el prefijo de toda ruta es `/v{major}/`.
  La regla `ope-path-version-prefix` ata ambos.
- `contract:diff` compara el bundle con el de `main` usando oasdiff con severidades propias
  (`contracts/oasdiff-severity.txt`): quitar un campo de respuesta aunque sea opcional,
  cambiar tipo o formato, quitar un valor de enum de request, volver obligatorio un campo,
  agregar una respuesta de error a una operación existente y eliminar una operación son
  incompatibles. Sin bump de major ⇒ falla; con bump ⇒ pasa y lo reporta como esperado.

## Consecuencias

- Un cambio incompatible implica `2.0.0` **y** `/v2/`.
- Agregar valores de enum en request y campos opcionales en respuesta es compatible.
