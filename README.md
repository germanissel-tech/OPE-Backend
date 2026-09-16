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
npm run dev              # servidor real en http://127.0.0.1:3000 (PORT, HOST, OPE_MERCHANTS)
npm run contract:mock    # el mismo servidor respondiendo los ejemplos del contrato
npm run contract:docs    # docs/api/index.html, autocontenido
```

Probar la ingesta a mano (el mock trae un merchant de prueba con la clave `ope_mock_ingest_key`;
el servidor real lee los merchants de `OPE_MERCHANTS`, un JSON
`[{ "merchantId", "ingestKeys": [..], "origins": [..] }]`, o de `OPE_MERCHANTS_FILE`):

```bash
npm run contract:mock
curl -s -X POST http://127.0.0.1:3000/v1/events   -H "content-type: application/json" -H "X-OPE-Ingest-Key: ope_mock_ingest_key"   -d '{"events":[{"type":"product_viewed","eventId":"evt_00000001","sessionId":"ses_00000001","visitorId":"vis_00000001","occurredAt":"2026-09-16T12:00:00Z","page":{"pageType":"product","productId":"SKU-1"},"device":"mobile"}]}'
```

- Contrato: `contracts/` (raíz `openapi.yaml`, `paths/`, `components/`, `examples/`,
  catálogos `problem-types.yaml` y `no-op-reasons.yaml`).
- Tipos generados: `src/interface-adapters/http/generated/api.d.ts` (commiteado, nunca editado a mano).
- Cliente tipado para SDK y portal: `import { createOpeClient } from "ope-backend/client"`.
- Reglas del contrato y cómo ampliarlas: `contracts/.spectral.yaml`, `tests/contract-rules/README.md`.
- Decisiones de arquitectura: `docs/adr/` (citar `ADR-NNN`). Glosario del lenguaje ubicuo:
  `docs/dominio/`. Anillos, módulos y mapa de contextos (ADR-013): `.dependency-cruiser.cjs`,
  `npm run arch`.
- Puerta antes de publicar: `npm run release-check`.
- Flujo de trabajo para agentes: `CLAUDE.md`.
