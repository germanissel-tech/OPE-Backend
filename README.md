# OPE-Backend

Backend del MVP de OPE (Zona B de la arquitectura). Se construye de cero; la POC es referencia de dominio, no base de código.

## Documentación fuente

La arquitectura, la integración con el ecommerce y el alcance viven en el directorio `mvp/` del
repositorio de trabajo (`../01-arquitectura-mvp.md`, `../02-integracion-ecommerce.md`,
`../03-alcance-mvp.md`). Este repo los deriva en `.specify/memory/constitution.md`.

## Método

- **Spec-driven** con [spec-kit](https://github.com/github/spec-kit): `/speckit-specify` →
  `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Los comandos están en `.claude/skills/`.
- **API-first**: `contracts/openapi.yaml` es la fuente de verdad de toda superficie HTTP; los
  tipos y validadores se generan desde el contrato. El cambio de contrato precede al código.

## Stack

Node.js LTS · TypeScript estricto · PostgreSQL (durable) · Redis (sesión caliente).
