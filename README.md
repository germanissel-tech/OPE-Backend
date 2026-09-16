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

## Empezar

Requisitos: Node.js 22 (`.nvmrc`), npm 10+, [`uv`](https://docs.astral.sh/uv/) para las
pruebas de contrato con Schemathesis.

```bash
npm ci
npm run contract:check   # lint + bundle + compatibilidad + drift de tipos + gobernanza
npm run format:check && npm run lint   # Prettier y ESLint estricto con tipos
npm run build && npm run typecheck && npm test
npm run test:contract    # Schemathesis contra el servidor levantado
npm run dev              # servidor real en http://127.0.0.1:3000 (PORT, HOST)
npm run contract:mock    # el mismo servidor respondiendo los ejemplos del contrato
npm run contract:docs    # docs/api/index.html, autocontenido
```

- Contrato: `contracts/` (raíz `openapi.yaml`, `paths/`, `components/`, `examples/`).
- Tipos generados: `src/generated/api.d.ts` (commiteado, nunca editado a mano).
- Cliente tipado para SDK y portal: `import { createOpeClient } from "ope-backend/client"`.
- Reglas del contrato y cómo ampliarlas: `contracts/.spectral.yaml`, `tests/contract-rules/README.md`.
- Decisiones de arquitectura: `docs/adr/` (citar `ADR-NNN`). Glosario del lenguaje ubicuo:
  `docs/dominio/`. Capas del código y su verificación: `.dependency-cruiser.cjs`, `npm run arch`.
- Puerta antes de publicar: `npm run release-check`.
- Flujo de trabajo para agentes: `CLAUDE.md`.
