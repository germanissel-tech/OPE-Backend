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
- Precisión (ADR-021, 2026-09-17): "agregar una respuesta de error" es incompatible cuando es
  **4xx** (una forma nueva de rechazar a un cliente válido); una **5xx** nueva es una condición
  del servidor que todo cliente tolera igual (Problem Details) y es compatible. oasdiff no las
  distingue (`response-non-success-status-added` queda en aviso); la 4xx la detecta el chequeo
  propio `ope-client-error-response-added` de `contract:diff`.
- Precisión (feature 016, 2026-09-20): **mientras ningún merchant consuma el contrato, el
  contrato lo declara** con `info.x-stability: building` y un cambio incompatible entra con
  un bump MINOR conservando el prefijo: `contract:diff` lo detecta y lo reporta igual, pero lo
  acepta ("Incompatible change accepted: the contract is building"); `release-check` avisa
  mientras la marca exista. Un salto a `/v2/` sin consumidores no protege a nadie y sí cuesta
  rutas, pruebas y documentación (decisión del dueño). La marca se quita antes del primer
  piloto y desde entonces rige la regla sin excepción; quitarla es un cambio del contrato como
  cualquier otro (pasa por `contract:check`). Sin la marca, todo lo anterior vale tal cual.
