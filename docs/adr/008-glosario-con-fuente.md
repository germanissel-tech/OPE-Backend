---
numero: 8
titulo: Glosario de lenguaje ubicuo con fuente obligatoria
estado: aceptada
fecha: 2026-09-16
fuente: specs/002-gobernanza-contrato-codigo/research.md
---

# ADR-008 — Glosario de lenguaje ubicuo con fuente obligatoria

## Contexto

La constitución y los documentos del MVP están en castellano; el contrato en inglés. Sin
glosario, cada sesión traduce distinto. Traducir es una decisión.

## Decisión

`docs/dominio/<termino>.md`, una nota por término con `es`, `en`, `contexto`, `estado`,
`fuente` (constitución, documento del MVP o ruta del repo) y la cita textual. `check:glossary`
exige que todo sustantivo de ruta y de esquema del contrato resuelva a una nota o a la lista
técnica (`_tecnicos.json`), que toda nota tenga fuente existente y que las notas sin uso lo
declaren (`uso: disponible | pendiente`). Las fuentes fuera del repo (documentos del MVP en
`..`) se verifican cuando el directorio está disponible; si no, se avisa y no se falla.

## Consecuencias

- Ningún sustantivo entra al contrato sin nota previa.
- La semilla son las identidades que la constitución ya fija en inglés.
